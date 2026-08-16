package api

import (
	"errors"
	"net/http"

	"billsplitter/server/internal/models"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

type createSessionRequest struct {
	Title           string          `json:"title"`
	People          []models.Person `json:"people"`
	JoinMode        string          `json:"joinMode"`
	ClaimMode       string          `json:"claimMode"`
	PermissionMode  string          `json:"permissionMode"`
	CreatorPersonID *string         `json:"creatorPersonId"`
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
	permissionMode := models.PermissionModeEdit
	if req.PermissionMode == string(models.PermissionModeReadOnly) {
		permissionMode = models.PermissionModeReadOnly
	}

	if req.CreatorPersonID != nil {
		found := false
		for _, p := range req.People {
			if p.ID == *req.CreatorPersonID {
				found = true
				break
			}
		}
		if !found {
			writeError(w, http.StatusBadRequest, "creatorPersonId must reference a person in people")
			return
		}
	}

	sess, err := a.store.CreateSession(req.Title, req.People, joinMode, claimMode, permissionMode, req.CreatorPersonID)
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
	// Joining a settled session is still allowed — "settled" means the
	// bill/item/claim state is read-only, not that the session becomes
	// inaccessible to a late viewer who wants to see the final result.

	var req joinRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" && req.ExistingPersonID == nil {
		writeError(w, http.StatusBadRequest, "name or existingPersonId is required")
		return
	}

	if req.ExistingPersonID != nil {
		if sess.CreatorPersonID != nil && *req.ExistingPersonID == *sess.CreatorPersonID {
			writeError(w, http.StatusForbidden, "cannot join as the session creator's own identity")
			return
		}
		if !a.presence.IsAvailable(code, *req.ExistingPersonID) {
			writeError(w, http.StatusConflict, "this person is already active in the session — try again in a few minutes")
			return
		}
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

	if joiner.PersonID != nil {
		a.presence.Touch(code, *joiner.PersonID)
	}

	if joiner.Status == models.JoinerPending {
		a.hub.Broadcast(code, sse.Event{Kind: "joiner.pending", ID: joiner.ID})
	} else {
		a.hub.Broadcast(code, sse.Event{Kind: "joiner.approved", ID: joiner.ID})
	}

	writeJSON(w, http.StatusCreated, withJoinerToken(joiner))
}

// joinerResponse wraps models.Joiner to add an optional one-time-reveal
// token field, without touching Joiner's own json:"-" tag (which must stay
// unexported from every other response, e.g. ListJoiners).
type joinerResponse struct {
	*models.Joiner
	Token string `json:"token,omitempty"`
}

func withJoinerToken(joiner *models.Joiner) joinerResponse {
	return joinerResponse{Joiner: joiner, Token: joiner.JoinerToken}
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

	// One-time reveal: a joiner who's just become approved picks up its
	// secret claim/unclaim token on the first poll that observes it, and
	// never again — see store.RevealJoinerTokenIfPending.
	token, err := a.store.RevealJoinerTokenIfPending(code, joinerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load joiner")
		return
	}
	joiner.JoinerToken = token

	writeJSON(w, http.StatusOK, withJoinerToken(joiner))
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

// requireJoiner checks the X-Joiner-Token header authenticates the caller
// as the joiner who owns personID in this session — used to enforce that a
// joiner can only claim/unclaim for themselves, never on behalf of someone
// else. Writes a 401/403 and returns false on failure. Callers that also
// want to allow token-free requests (e.g. the creator's own live-editing
// claims) should only call this when a token header is actually present —
// see ClaimItem.
func (a *API) requireJoiner(w http.ResponseWriter, r *http.Request, code, personID string) bool {
	token := r.Header.Get("X-Joiner-Token")
	if token == "" {
		writeError(w, http.StatusUnauthorized, "X-Joiner-Token header required")
		return false
	}
	ok, err := a.store.VerifyJoinerToken(code, personID, token)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify joiner")
		return false
	}
	if !ok {
		writeError(w, http.StatusForbidden, "invalid joiner token for this person")
		return false
	}
	return true
}

// requireNotSettled aborts with 409 if the session has already been
// settled — once settled, bill/item/claim/join state is meant to be
// read-only (see LiveSessionPanel.tsx's Settle Up UI and JoinPage.tsx's
// read-only banner, which this backs server-side). Returns false if the
// session wasn't found, couldn't be loaded, or was settled; the caller
// should return immediately in all of those cases.
func (a *API) requireNotSettled(w http.ResponseWriter, r *http.Request, code string) bool {
	sess, err := a.store.GetSession(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return false
	}
	if sess.IsSettled {
		writeError(w, http.StatusConflict, "session has been settled")
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
