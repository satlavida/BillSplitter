package api

import (
	"errors"
	"net/http"

	"billsplitter/server/internal/models"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

type createSessionRequest struct {
	Title     string          `json:"title"`
	People    []models.Person `json:"people"`
	JoinMode  string          `json:"joinMode"`
	ClaimMode string          `json:"claimMode"`
}

type createSessionResponse struct {
	Code         string `json:"code"`
	Link         string `json:"link"`
	CreatorToken string `json:"creatorToken"`
}

// CreateSession handles POST /api/sessions. Seeds server state from the
// creator's current local session and returns a code/link plus a creator
// token, required as X-Creator-Token on all creator-only mutating endpoints.
func (a *API) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req createSessionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	joinMode := models.JoinModeApprovalCode
	if req.JoinMode == string(models.JoinModeOpenLink) {
		joinMode = models.JoinModeOpenLink
	}
	claimMode := models.ClaimModeFreeSelect
	if req.ClaimMode == string(models.ClaimModeClaimsRequireApproval) {
		claimMode = models.ClaimModeClaimsRequireApproval
	}

	sess, err := a.store.CreateSession(req.Title, req.People, joinMode, claimMode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	writeJSON(w, http.StatusCreated, createSessionResponse{
		Code:         sess.ID,
		Link:         "/join/" + sess.ID,
		CreatorToken: sess.CreatorToken,
	})
}

// GetSession handles GET /api/sessions/{code} — full session state for both
// creator and admitted joiners.
func (a *API) GetSession(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	sess, err := a.store.GetSession(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

type joinRequest struct {
	Name             string  `json:"name"`
	ExistingPersonID *string `json:"existingPersonId"`
}

// Join handles POST /api/sessions/{code}/join. Branches on join_mode:
// approval_code creates a pending joiner with a 2-digit code; open_link
// auto-approves. Both are SSE-pushed to the creator.
func (a *API) Join(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	sess, err := a.store.GetSession(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}

	var req joinRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" && req.ExistingPersonID == nil {
		writeError(w, http.StatusBadRequest, "name or existingPersonId is required")
		return
	}

	name := req.Name
	if name == "" && req.ExistingPersonID != nil {
		for _, p := range sess.People {
			if p.ID == *req.ExistingPersonID {
				name = p.Name
				break
			}
		}
	}

	joinerID, err := newID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create joiner")
		return
	}

	// A joiner who picks "someone new" rather than an existing person needs
	// a Person row created for them so they have a personId to claim items
	// with once admitted.
	var newPersonID *string
	if req.ExistingPersonID == nil {
		id, err := newID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create joiner")
			return
		}
		newPersonID = &id
	}

	joiner, err := a.store.CreateJoiner(code, joinerID, name, req.ExistingPersonID, newPersonID, sess.JoinMode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create joiner")
		return
	}

	if joiner.Status == models.JoinerPending {
		a.hub.Broadcast(code, sse.Event{Kind: "joiner.pending", ID: joiner.ID})
	} else {
		a.hub.Broadcast(code, sse.Event{Kind: "joiner.approved", ID: joiner.ID})
	}

	writeJSON(w, http.StatusCreated, joiner)
}

// ListJoiners handles GET /api/sessions/{code}/joiners (creator-only) — lets
// the creator-side live view show pending/approved/disapproved joiners.
func (a *API) ListJoiners(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")

	joiners, err := a.store.ListJoiners(code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load joiners")
		return
	}

	writeJSON(w, http.StatusOK, joiners)
}

// GetJoiner handles GET /api/sessions/{code}/joiners/{id} — public (no
// creator token), so a still-pending joiner's own client can poll for their
// admission status without exposing the full joiner list to non-creators.
func (a *API) GetJoiner(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	joinerID := r.PathValue("id")

	joiner, err := a.store.GetJoiner(code, joinerID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "joiner not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load joiner")
		return
	}

	writeJSON(w, http.StatusOK, joiner)
}

// ApproveJoiner handles POST /api/sessions/{code}/joiners/{id}/approve (creator-only).
func (a *API) ApproveJoiner(w http.ResponseWriter, r *http.Request) {
	a.setJoinerStatus(w, r, models.JoinerApproved, "joiner.approved")
}

// DisapproveJoiner handles POST /api/sessions/{code}/joiners/{id}/disapprove (creator-only).
func (a *API) DisapproveJoiner(w http.ResponseWriter, r *http.Request) {
	a.setJoinerStatus(w, r, models.JoinerDisapproved, "joiner.disapproved")
}

func (a *API) setJoinerStatus(w http.ResponseWriter, r *http.Request, status models.JoinerStatus, eventKind string) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")
	joinerID := r.PathValue("id")

	if err := a.store.SetJoinerStatus(code, joinerID, status); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "joiner not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update joiner")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: eventKind, ID: joinerID})
	writeJSON(w, http.StatusOK, map[string]string{"status": string(status)})
}

// requireCreator checks the X-Creator-Token header against the session's
// stored creator token. Writes a 401/403 response and returns false if the
// check fails.
func (a *API) requireCreator(w http.ResponseWriter, r *http.Request) bool {
	code := r.PathValue("code")
	token := r.Header.Get("X-Creator-Token")
	if token == "" {
		writeError(w, http.StatusUnauthorized, "X-Creator-Token header required")
		return false
	}

	sess, err := a.store.GetSession(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return false
	}

	if token != sess.CreatorToken {
		writeError(w, http.StatusForbidden, "invalid creator token")
		return false
	}
	return true
}

// Settle handles POST /api/sessions/{code}/settle (creator-only).
func (a *API) Settle(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")

	if err := a.store.SettleSession(code); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to settle session")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "session.settled", ID: code})
	writeJSON(w, http.StatusOK, map[string]bool{"settled": true})
}
