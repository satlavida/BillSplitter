package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestJoinerCannotClaimCreatorIdentity covers req 8: a joiner picking
// existingPersonId == the session's creatorPersonId must be rejected.
func TestJoinerCannotClaimCreatorIdentity(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":           "Trip",
		"people":          []models.Person{alice},
		"joinMode":        "open_link",
		"creatorPersonId": "alice",
	}, nil)
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("create session: expected 201, got %d", createResp.StatusCode)
	}
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"existingPersonId": "alice"}, nil)
	if joinResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 joining as creator identity, got %d", joinResp.StatusCode)
	}
}

// TestCreateSessionRejectsUnknownCreatorPersonID ensures creatorPersonId must
// reference a person actually included in the request.
func TestCreateSessionRejectsUnknownCreatorPersonID(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":           "Trip",
		"people":          []models.Person{alice},
		"joinMode":        "open_link",
		"creatorPersonId": "someone-else",
	}, nil)
	if createResp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown creatorPersonId, got %d", createResp.StatusCode)
	}
}

// TestJoinerCannotReclaimActiveIdentity covers the presence-based reclaim
// lock: once a joiner has joined as an existing person (and so is "active"
// per presence.Tracker), a second joiner cannot also join as that person
// until the first goes stale.
func TestJoinerCannotReclaimActiveIdentity(t *testing.T) {
	srv, _ := newTestServer(t)

	bob := models.Person{ID: "bob", Name: "Bob"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"people":   []models.Person{bob},
		"joinMode": "open_link",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	firstJoin := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"existingPersonId": "bob"}, nil)
	if firstJoin.StatusCode != http.StatusCreated {
		t.Fatalf("first join: expected 201, got %d", firstJoin.StatusCode)
	}

	secondJoin := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"existingPersonId": "bob"}, nil)
	if secondJoin.StatusCode != http.StatusConflict {
		t.Fatalf("second join: expected 409 while first is active, got %d", secondJoin.StatusCode)
	}
}

// TestJoinerCanClaimNeverSeenIdentity ensures an identity with no presence
// history at all (the common case) is joinable.
func TestJoinerCanClaimNeverSeenIdentity(t *testing.T) {
	srv, _ := newTestServer(t)

	carol := models.Person{ID: "carol", Name: "Carol"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"people":   []models.Person{carol},
		"joinMode": "open_link",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"existingPersonId": "carol"}, nil)
	if joinResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", joinResp.StatusCode)
	}
}
