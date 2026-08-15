package middleware

import (
	"net"
	"net/http"
	"net/url"
	"strings"
)

// Allowlist rejects requests whose Origin header isn't localhost/127.0.0.1
// (always allowed, for local dev) or an exact match against the configured
// allowed origins. Requests with no Origin header (e.g. curl, server-to-server)
// are allowed through — this guards browser cross-origin access, not general
// network access.
//
// It also answers CORS: the frontend's fetch() calls (liveApi.ts) send a
// JSON body, which makes the browser send a preflight OPTIONS request first.
// Without Access-Control-* response headers and OPTIONS handling here, the
// browser blocks the real request client-side even when this middleware
// would have allowed it — server-side origin gating alone isn't enough for
// browser callers.
func Allowlist(allowedOrigins []string, next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		_, explicitlyAllowed := allowed[origin]
		if !isLocalhost(origin) && !explicitlyAllowed {
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Creator-Token, X-Admin-Token")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isLocalhost(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// StripPort is a small helper used by tests/other middleware that need the
// bare host without a port suffix.
func StripPort(hostport string) string {
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		return h
	}
	return strings.TrimSpace(hostport)
}
