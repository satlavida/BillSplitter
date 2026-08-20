// Package cleanup runs the periodic session-purge and log/error-retention
// jobs (planv3.md 3.8). Every run is recorded in store.job_runs
// (started/success/failed) so status is visible on the admin jobs page and
// via GET /adminhealth.
package cleanup

import (
	"fmt"
	"log"
	"os"
	"time"

	"billsplitter/server/internal/logging"
	"billsplitter/server/internal/store"
)

const (
	JobSessionPurge = "session_purge"
	JobLogRetention = "log_retention"
)

// Run starts a ticker that purges stale sessions every `interval`. Blocks
// until stop is closed — call with `go cleanup.Run(...)`.
func Run(st *store.Store, reporter *logging.Reporter, idleRetentionDays, settledRetentionDays int, interval time.Duration, stop <-chan struct{}) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			PurgeOnce(st, reporter, idleRetentionDays, settledRetentionDays)
		}
	}
}

// PurgeOnce runs a single purge pass: image files are removed *before* the
// cascading SQL delete, so a mid-purge crash leaves both row and file intact
// for the next tick rather than orphaning a file. Unsettled-but-idle
// sessions are purged after idleRetentionDays since last access; settled
// sessions are purged after settledRetentionDays since settled_at.
func PurgeOnce(st *store.Store, reporter *logging.Reporter, idleRetentionDays, settledRetentionDays int) {
	runID, err := st.StartJobRun(JobSessionPurge)
	if err != nil {
		log.Printf("cleanup: failed to record job start: %v", err)
	}

	sessionIDs, imagePaths, err := st.PurgeStaleSessions(idleRetentionDays, settledRetentionDays)
	if err != nil {
		reporter.Error("job_session_purge", "purge failed: %v", err)
		finishJobRun(st, runID, store.JobStatusFailed, err.Error())
		return
	}

	var removeErrs int
	for _, p := range imagePaths {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			reporter.Warn("job_session_purge", "failed to remove image %s: %v", p, err)
			removeErrs++
		}
	}

	if len(sessionIDs) > 0 {
		log.Printf("cleanup: purged %d stale session(s): %v", len(sessionIDs), sessionIDs)
	}

	msg := fmt.Sprintf("purged %d session(s), %d image(s), %d image removal error(s)", len(sessionIDs), len(imagePaths), removeErrs)
	finishJobRun(st, runID, store.JobStatusSuccess, msg)
}

// RunLogRetention starts a ticker that prunes log files and error_events
// rows older than retentionDays every `interval`. Blocks until stop is
// closed — call with `go cleanup.RunLogRetention(...)`.
func RunLogRetention(st *store.Store, reporter *logging.Reporter, logDir string, retentionDays int, interval time.Duration, stop <-chan struct{}) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			LogRetentionOnce(st, reporter, logDir, retentionDays)
		}
	}
}

// LogRetentionOnce prunes log files and error_events rows past
// retentionDays.
func LogRetentionOnce(st *store.Store, reporter *logging.Reporter, logDir string, retentionDays int) {
	runID, err := st.StartJobRun(JobLogRetention)
	if err != nil {
		log.Printf("cleanup: failed to record job start: %v", err)
	}

	removedFiles, err := logging.PruneOldLogs(logDir, retentionDays)
	if err != nil {
		reporter.Error("job_log_retention", "prune log files failed: %v", err)
		finishJobRun(st, runID, store.JobStatusFailed, err.Error())
		return
	}

	removedEvents, err := st.PruneErrorEvents(retentionDays)
	if err != nil {
		reporter.Error("job_log_retention", "prune error_events failed: %v", err)
		finishJobRun(st, runID, store.JobStatusFailed, err.Error())
		return
	}

	msg := fmt.Sprintf("removed %d log file(s), %d error_events row(s)", removedFiles, removedEvents)
	log.Printf("cleanup: log retention: %s", msg)
	finishJobRun(st, runID, store.JobStatusSuccess, msg)
}

func finishJobRun(st *store.Store, runID int64, status, message string) {
	if runID == 0 {
		return
	}
	if err := st.FinishJobRun(runID, status, message); err != nil {
		log.Printf("cleanup: failed to record job finish: %v", err)
	}
}
