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

func TestAllowlist_AllowedRequestGetsCORSHeaders(t *testing.T) {
	h := Allowlist(nil, okHandler())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("expected Access-Control-Allow-Origin to echo the origin, got %q", got)
	}
	if rec.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Fatal("expected Access-Control-Allow-Headers to be set")
	}
}

func TestAllowlist_PreflightFromAllowedOriginGetsNoContent(t *testing.T) {
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true })
	h := Allowlist(nil, next)

	req := httptest.NewRequest(http.MethodOptions, "/api/sessions", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if called {
		t.Fatal("preflight should not reach the wrapped handler")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("expected Access-Control-Allow-Origin on preflight response, got %q", got)
	}
}

func TestAllowlist_PreflightFromDisallowedOriginRejected(t *testing.T) {
	h := Allowlist([]string{"https://example.com"}, okHandler())
	req := httptest.NewRequest(http.MethodOptions, "/api/sessions", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}
}
