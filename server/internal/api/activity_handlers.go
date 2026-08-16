package api

import "net/http"

// GetActivityLog handles GET /api/sessions/{code}/activity (creator-only) —
// the claim/unclaim history a creator can review (see store.ListItemActivity,
// migrations/0003_joiner_token_and_activity_log.sql).
func (a *API) GetActivityLog(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")

	entries, err := a.store.ListItemActivity(code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load activity log")
		return
	}

	writeJSON(w, http.StatusOK, entries)
}
