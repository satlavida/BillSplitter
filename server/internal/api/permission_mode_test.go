package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestReadOnlySessionRejectsJoinerMutations covers req 6: in a read_only
// session, a joiner-originated request (X-Joiner-Token present) is rejected
// outright — there is no approval queue to fall back to.
func TestReadOnlySessionRejectsJoinerMutations(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":          "Trip",
		"people":         []models.Person{alice},
		"joinMode":       "open_link",
		"permissionMode": "read_only",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"existingPersonId": "alice"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	// A joiner-originated AddItem is rejected.
	joinerAddItem := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items",
		map[string]any{"name": "Nachos", "price": 5.0, "quantity": 1}, map[string]string{"X-Joiner-Token": joiner.Token})
	if joinerAddItem.StatusCode != http.StatusForbidden {
		t.Fatalf("joiner add item in read_only session: expected 403, got %d", joinerAddItem.StatusCode)
	}

	// A joiner-originated claim is rejected too.
	joinerClaim := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims",
		map[string]any{"personId": "alice"}, map[string]string{"X-Joiner-Token": joiner.Token})
	if joinerClaim.StatusCode != http.StatusForbidden {
		t.Fatalf("joiner claim in read_only session: expected 403, got %d", joinerClaim.StatusCode)
	}

	// The creator's own token-free edits are unaffected by read_only.
	creatorAddItem := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items",
		map[string]any{"name": "Nachos", "price": 5.0, "quantity": 1}, nil)
	if creatorAddItem.StatusCode != http.StatusCreated {
		t.Fatalf("creator add item in read_only session: expected 201, got %d", creatorAddItem.StatusCode)
	}
}

// TestEditSessionAllowsJoinerMutations is the counterpart: the default
// permission_mode ("edit") lets a joiner add items and claim directly.
func TestEditSessionAllowsJoinerMutations(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"joinMode": "open_link",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)

	joinerAddItem := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items",
		map[string]any{"name": "Nachos", "price": 5.0, "quantity": 1}, map[string]string{"X-Joiner-Token": joiner.Token})
	if joinerAddItem.StatusCode != http.StatusCreated {
		t.Fatalf("joiner add item in edit session: expected 201, got %d", joinerAddItem.StatusCode)
	}
}
