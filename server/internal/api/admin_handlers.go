package api

import (
	"crypto/subtle"
	"net/http"
	"os"
	"time"
)

const adminCookieName = "admin_token"

// requireAdminToken gates admin routes with a static bearer token/password
// from config, on top of the allowlist middleware wrapping every route.
//
// Auth is checked in order: cookie (steady-state visits), then
// header/query/form (bootstrap). A valid bootstrap token mints the cookie so
// future requests don't need it; a GET carrying ?token= is then redirected
// to the clean path so the token doesn't linger in the address bar/history.
func (a *API) requireAdminToken(w http.ResponseWriter, r *http.Request) bool {
	if a.adminToken == "" {
		http.Error(w, "admin panel disabled: ADMIN_TOKEN not configured", http.StatusForbidden)
		return false
	}

	if c, err := r.Cookie(adminCookieName); err == nil {
		if subtle.ConstantTimeCompare([]byte(c.Value), []byte(a.adminToken)) == 1 {
			return true
		}
	}

	token := r.Header.Get("X-Admin-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		token = r.FormValue("token")
	}
	if token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(a.adminToken)) != 1 {
		http.Error(w, "invalid admin token", http.StatusForbidden)
		return false
	}

	a.setAdminCookie(w, r)
	if r.Method == http.MethodGet && r.URL.Query().Get("token") != "" {
		http.Redirect(w, r, r.URL.Path, http.StatusSeeOther)
		return false
	}
	return true
}

// requireAdminTokenAPI gates JSON API admin routes (as opposed to
// server-rendered pages) behind the same static ADMIN_TOKEN, but without
// requireAdminToken's cookie-minting/redirect side effects — those exist for
// browser navigation and would surprise a plain HTTP client (e.g. a
// ?token=... GET silently 303-redirecting instead of returning JSON).
func (a *API) requireAdminTokenAPI(w http.ResponseWriter, r *http.Request) bool {
	if a.adminToken == "" {
		writeError(w, http.StatusForbidden, "admin panel disabled: ADMIN_TOKEN not configured")
		return false
	}

	if c, err := r.Cookie(adminCookieName); err == nil {
		if subtle.ConstantTimeCompare([]byte(c.Value), []byte(a.adminToken)) == 1 {
			return true
		}
	}

	token := r.Header.Get("X-Admin-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" || subtle.ConstantTimeCompare([]byte(token), []byte(a.adminToken)) != 1 {
		writeError(w, http.StatusForbidden, "invalid admin token")
		return false
	}
	return true
}

func (a *API) setAdminCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     adminCookieName,
		Value:    a.adminToken,
		Path:     "/admin",
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})
}

func (a *API) AdminSessionsPage(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	sessions, err := a.store.ListAllSessionsForAdmin()
	if err != nil {
		http.Error(w, "failed to load sessions", http.StatusInternalServerError)
		return
	}
	_ = adminSessionsTemplate.ExecuteTemplate(w, "layout", map[string]any{"Sessions": sessions})
}

func (a *API) AdminStatsPage(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	stats, err := a.store.AdminStats()
	if err != nil {
		http.Error(w, "failed to load stats", http.StatusInternalServerError)
		return
	}
	_ = adminStatsTemplate.ExecuteTemplate(w, "layout", stats)
}

func (a *API) AdminScanPage(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	summary, err := a.store.ScanAnalyticsSummary()
	if err != nil {
		http.Error(w, "failed to load scan analytics", http.StatusInternalServerError)
		return
	}
	_ = adminScanTemplate.ExecuteTemplate(w, "layout", summary)
}

// AdminJobsPage shows recent background-job run history (session purge, log
// retention) — see internal/cleanup.
func (a *API) AdminJobsPage(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	runs, err := a.store.ListRecentJobRuns(100)
	if err != nil {
		http.Error(w, "failed to load job runs", http.StatusInternalServerError)
		return
	}
	_ = adminJobsTemplate.ExecuteTemplate(w, "layout", map[string]any{"Runs": runs})
}

func (a *API) AdminPurgeSession(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	code := r.PathValue("code")
	paths, err := a.store.PurgeSessionByID(code)
	if err != nil {
		http.Error(w, "failed to purge session", http.StatusInternalServerError)
		return
	}
	for _, p := range paths {
		_ = os.Remove(p)
	}
	http.Redirect(w, r, "/admin", http.StatusSeeOther)
}
