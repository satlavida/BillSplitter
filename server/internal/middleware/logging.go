package middleware

import (
	"log"
	"net/http"
	"time"
)

// Logging logs method, path, status, and duration for every request.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// Flush forwards to the underlying ResponseWriter's Flusher, if it has one.
// Without this, wrapping ResponseWriter here would silently drop the
// Flusher interface (Go only promotes methods declared on the embedded
// field's static type, and http.ResponseWriter doesn't declare Flush),
// breaking every SSE handler behind this middleware — see sse.Hub.ServeHTTP.
func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
