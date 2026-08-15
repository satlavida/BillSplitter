package api

import (
	"html/template"
	"net/http"
	"os"
)

var adminSessionsTemplate = template.Must(template.New("admin_sessions").Parse(`<!doctype html>
<html>
<head><title>BillSplitter Admin — Sessions</title></head>
<body>
<h1>Sessions</h1>
<p><a href="/admin/stats">Stats</a></p>
<table border="1" cellpadding="6">
<tr><th>Code</th><th>Title</th><th>Created</th><th>Last Access</th><th>Settled</th><th></th></tr>
{{range .Sessions}}
<tr>
<td>{{.ID}}</td>
<td>{{.Title}}</td>
<td>{{.CreatedAt}}</td>
<td>{{.LastAccessAt}}</td>
<td>{{if .IsSettled}}yes{{else}}no{{end}}</td>
<td>
<form method="post" action="/admin/sessions/{{.ID}}/purge" style="display:inline">
<input type="hidden" name="token" value="{{$.Token}}">
<button type="submit">Purge</button>
</form>
</td>
</tr>
{{end}}
</table>
</body>
</html>`))

var adminStatsTemplate = template.Must(template.New("admin_stats").Parse(`<!doctype html>
<html>
<head><title>BillSplitter Admin — Stats</title></head>
<body>
<h1>Stats</h1>
<p><a href="/admin">Sessions</a></p>
<ul>
<li>Sessions: {{.SessionCount}}</li>
<li>Bills: {{.BillCount}}</li>
<li>Avg bills/session: {{printf "%.2f" .AvgBillsPerSession}}</li>
<li>Images: {{.ImageCount}}</li>
</ul>
</body>
</html>`))

// requireAdminToken gates admin routes with a static bearer token/password
// from config, on top of the allowlist middleware wrapping every route.
func (a *API) requireAdminToken(w http.ResponseWriter, r *http.Request) bool {
	if a.adminToken == "" {
		http.Error(w, "admin panel disabled: ADMIN_TOKEN not configured", http.StatusForbidden)
		return false
	}
	token := r.Header.Get("X-Admin-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		token = r.FormValue("token")
	}
	if token != a.adminToken {
		http.Error(w, "invalid admin token", http.StatusForbidden)
		return false
	}
	return true
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
	_ = adminSessionsTemplate.Execute(w, map[string]any{"Sessions": sessions, "Token": a.adminToken})
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
	_ = adminStatsTemplate.Execute(w, stats)
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
	http.Redirect(w, r, "/admin?token="+a.adminToken, http.StatusSeeOther)
}
