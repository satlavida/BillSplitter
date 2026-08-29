package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestUpdatePersonCreatorCanEditAnyField covers the token-free (creator)
// path: any field, on any person.
func TestUpdatePersonCreatorCanEditAnyField(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	resp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/people/alice", map[string]any{"name": "Alicia", "upiId": "alicia@bank"}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("creator update: expected 200, got %d", resp.StatusCode)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if sess.People[0].Name != "Alicia" || sess.People[0].UpiID != "alicia@bank" {
		t.Fatalf("expected name/upiId updated, got %+v", sess.People[0])
	}
}

// TestUpdatePersonJoinerCanOnlySetOwnUpiID covers the joiner path: their own
// upiId only — not their name, not anyone else's row.
func TestUpdatePersonJoinerCanOnlySetOwnUpiID(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)
	bobPersonID := *joiner.PersonID

	// Bob sets his own upiId — allowed.
	selfUpi := patchJSON(t, srv, "/api/sessions/"+created.Code+"/people/"+bobPersonID, map[string]any{"upiId": "bob@bank"}, map[string]string{"X-Joiner-Token": joiner.Token})
	if selfUpi.StatusCode != http.StatusOK {
		t.Fatalf("joiner sets own upiId: expected 200, got %d", selfUpi.StatusCode)
	}

	// Bob tries to rename himself — forbidden.
	selfRename := patchJSON(t, srv, "/api/sessions/"+created.Code+"/people/"+bobPersonID, map[string]any{"name": "Bobby"}, map[string]string{"X-Joiner-Token": joiner.Token})
	if selfRename.StatusCode != http.StatusForbidden {
		t.Fatalf("joiner renames self: expected 403, got %d", selfRename.StatusCode)
	}

	// Bob tries to set Alice's upiId using his own token — forbidden (wrong person).
	otherUpi := patchJSON(t, srv, "/api/sessions/"+created.Code+"/people/alice", map[string]any{"upiId": "alice@bank"}, map[string]string{"X-Joiner-Token": joiner.Token})
	if otherUpi.StatusCode != http.StatusForbidden {
		t.Fatalf("joiner sets someone else's upiId: expected 403, got %d", otherUpi.StatusCode)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	var bob models.Person
	for _, p := range sess.People {
		if p.ID == bobPersonID {
			bob = p
		}
	}
	if bob.Name != "Bob" || bob.UpiID != "bob@bank" {
		t.Fatalf("expected Bob's name unchanged and upiId set, got %+v", bob)
	}
}

func TestUpdatePersonNotFound(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	resp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/people/does-not-exist", map[string]any{"upiId": "x@bank"}, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}
