package api

import (
	"net/http"
	"time"
)

type heartbeatRequest struct {
	PersonID string `json:"personId"`
}

// PresenceHeartbeat handles POST /api/sessions/{code}/presence/heartbeat —
// a joiner's client calls this every 1.5s (see src/hooks/usePresenceHeartbeat.ts)
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
// activeSince maps each online personId to when their current continuous
// activity streak began (RFC3339) — used by the frontend to gate renaming
// an active/claimed person (disabled while continuously active < 1hr).
type presenceResponse struct {
	Online      []string          `json:"online"`
	ActiveSince map[string]string `json:"activeSince"`
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

	activeSince := make(map[string]string, len(online))
	for _, personID := range online {
		if since, ok := a.presence.ActiveSince(code, personID); ok {
			activeSince[personID] = since.UTC().Format(time.RFC3339)
		}
	}

	writeJSON(w, http.StatusOK, presenceResponse{Online: online, ActiveSince: activeSince})
}
