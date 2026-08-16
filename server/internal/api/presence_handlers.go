package api

import "net/http"

type heartbeatRequest struct {
	PersonID string `json:"personId"`
}

// PresenceHeartbeat handles POST /api/sessions/{code}/presence/heartbeat —
// a joiner's client calls this every 500ms (see src/hooks/usePresenceHeartbeat.ts)
// while its view is mounted, so presence.Tracker knows they're still active.
// Requires the caller's X-Joiner-Token to authenticate them as personId,
// same as claim/unclaim — a joiner can only report their own presence.
func (a *API) PresenceHeartbeat(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")

	var req heartbeatRequest
	if err := decodeJSON(r, &req); err != nil || req.PersonID == "" {
		writeError(w, http.StatusBadRequest, "personId is required")
		return
	}
	if !a.requireJoiner(w, r, code, req.PersonID) {
		return
	}

	a.presence.Touch(code, req.PersonID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// presenceResponse's online field is always a real (possibly empty) array,
// never null, so the frontend doesn't need to special-case JSON null.
type presenceResponse struct {
	Online []string `json:"online"`
}

// GetPresence handles GET /api/sessions/{code}/presence — public (no
// creator/joiner token required, mirroring GetSession/GetSettlement),
// returning which personIds are currently online so any client (creator's
// PeopleSection or a joiner's own view) can render an indicator.
func (a *API) GetPresence(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	online := a.presence.ListOnline(code)
	if online == nil {
		online = []string{}
	}
	writeJSON(w, http.StatusOK, presenceResponse{Online: online})
}
