// Package logging wires the standard `log` package to also write to a
// daily-rotating file (in addition to stdout) and provides a Reporter that
// durably records warnings/errors (error_events + lifetime counters in the
// settings table, see internal/store) for the admin panel and /adminhealth.
package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"billsplitter/server/internal/store"
)

const logFilePrefix = "billsplitter-"

// rotatingFileWriter is an io.Writer that appends to
// "<dir>/billsplitter-YYYY-MM-DD.log", switching to a new file whenever the
// UTC date changes.
type rotatingFileWriter struct {
	mu   sync.Mutex
	dir  string
	date string
	file *os.File
}

func newRotatingFileWriter(dir string) (*rotatingFileWriter, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create log dir: %w", err)
	}
	w := &rotatingFileWriter{dir: dir}
	if err := w.rotateIfNeeded(); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *rotatingFileWriter) rotateIfNeeded() error {
	today := time.Now().UTC().Format("2006-01-02")
	if today == w.date && w.file != nil {
		return nil
	}
	if w.file != nil {
		_ = w.file.Close()
	}
	path := filepath.Join(w.dir, logFilePrefix+today+".log")
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open log file %s: %w", path, err)
	}
	w.file = f
	w.date = today
	return nil
}

func (w *rotatingFileWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.rotateIfNeeded(); err != nil {
		// Fall back to discarding rather than erroring the caller (the
		// standard `log` package treats a Write error as fatal-ish noise on
		// stderr) — stdout still gets the line via the MultiWriter in Init.
		return len(p), nil
	}
	return w.file.Write(p)
}

func (w *rotatingFileWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	return w.file.Close()
}

// Init points the standard `log` package at both stdout and a
// daily-rotating file under dir. Returns a close func for graceful
// shutdown (best-effort).
func Init(dir string) (func(), error) {
	w, err := newRotatingFileWriter(dir)
	if err != nil {
		return nil, err
	}
	log.SetOutput(io.MultiWriter(os.Stdout, w))
	return func() { _ = w.Close() }, nil
}

// PruneOldLogs removes daily log files older than retentionDays (judged by
// the date encoded in the filename, not filesystem mtime, so the retention
// window survives copies/backups that touch mtime).
func PruneOldLogs(dir string, retentionDays int) (int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	removed := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, logFilePrefix) || !strings.HasSuffix(name, ".log") {
			continue
		}
		dateStr := strings.TrimSuffix(strings.TrimPrefix(name, logFilePrefix), ".log")
		t, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}
		if t.Before(cutoff) {
			if err := os.Remove(filepath.Join(dir, name)); err == nil {
				removed++
			}
		}
	}
	return removed, nil
}

// Reporter logs warnings/errors through the standard logger and durably
// records them via the store (error_events + lifetime counters), so they
// surface in the admin panel and GET /adminhealth. category should be a
// short stable slug, e.g. "openrouter_request", "job_cleanup".
type Reporter struct {
	st *store.Store
}

func NewReporter(st *store.Store) *Reporter {
	return &Reporter{st: st}
}

func (r *Reporter) Warn(category, format string, args ...any) {
	r.report("WARN", category, fmt.Sprintf(format, args...))
}

func (r *Reporter) Error(category, format string, args ...any) {
	r.report("ERROR", category, fmt.Sprintf(format, args...))
}

func (r *Reporter) report(level, category, message string) {
	log.Printf("[%s] %s: %s", level, category, message)
	if r.st == nil {
		return
	}
	if err := r.st.RecordErrorEvent(category, message); err != nil {
		log.Printf("[ERROR] logging: failed to record error event: %v", err)
	}
}
