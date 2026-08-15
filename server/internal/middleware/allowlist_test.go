package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestAllowlist_NoOriginHeaderPasses(t *testing.T) {
	h := Allowlist([]string{"https://example.com"}, okHandler())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestAllowlist_LocalhostAlwaysPasses(t *testing.T) {
	h := Allowlist(nil, okHandler())
	for _, origin := range []string{"http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173"} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("origin %s: expected 200, got %d", origin, rec.Code)
		}
	}
}

func TestAllowlist_ConfiguredOriginPasses(t *testing.T) {
	h := Allowlist([]string{"https://example.com"}, okHandler())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestAllowlist_UnconfiguredOriginRejected(t *testing.T) {
	h := Allowlist([]string{"https://example.com"}, okHandler())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
