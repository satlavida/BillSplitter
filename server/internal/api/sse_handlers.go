package api

import "net/http"

// Events handles GET /api/sessions/{code}/events (SSE).
func (a *API) Events(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	a.hub.ServeHTTP(w, r, code)
}
