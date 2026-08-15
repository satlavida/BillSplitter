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

		if isLocalhost(origin) {
			next.ServeHTTP(w, r)
			return
		}

		if _, ok := allowed[origin]; ok {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, "origin not allowed", http.StatusForbidden)
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
