package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestLoggingPreservesFlusher guards against a real regression: wrapping
// http.ResponseWriter in statusWriter without a Flush method silently drops
// the http.Flusher interface, breaking every SSE handler behind this
// middleware (sse.Hub.ServeHTTP type-asserts on http.Flusher and 500s if it
// isn't there). httptest.NewRecorder() implements Flusher, so this only
// catches the bug because it type-asserts on the writer actually passed to
// the inner handler.
func TestLoggingPreservesFlusher(t *testing.T) {
	var sawFlusher bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, sawFlusher = w.(http.Flusher)
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/events", nil)
	rec := httptest.NewRecorder()
	Logging(inner).ServeHTTP(rec, req)

	if !sawFlusher {
		t.Fatal("expected the ResponseWriter passed to the wrapped handler to implement http.Flusher")
	}
}
