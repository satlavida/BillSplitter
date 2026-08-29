package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestAddItemResponseHasNonNullConsumedBy is a regression test: the
// server used to return "consumedBy": null on a freshly-added item (Go's
// encoding/json serializes a nil slice as null), which failed the
// frontend's LiveItemSchema (z.array(...) requires an array) — a joiner
// adding an item saw a raw Zod validation error instead of the item
// appearing. See bill_handlers.go's AddItem / Notes in
// architecture/live-collaboration.md.
func TestAddItemResponseHasNonNullConsumedBy(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)

	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0}, nil)
	defer itemResp.Body.Close()
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(itemResp.Body).Decode(&raw); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	consumedBy, ok := raw["consumedBy"]
	if !ok {
		t.Fatal("expected a consumedBy field in the response")
	}
	if string(consumedBy) == "null" {
		t.Fatal("expected consumedBy to be [], got null")
	}
	var parsed []models.Allocation
	if err := json.Unmarshal(consumedBy, &parsed); err != nil {
		t.Fatalf("expected consumedBy to parse as an array, got %s: %v", consumedBy, err)
	}
}

// TestAddBillResponseHasNonNullItems is the bill-level sibling of
// TestAddItemResponseHasNonNullConsumedBy: models.Bill.Items has no
// omitempty, so a freshly-built models.Bill with no Items set serializes
// as "items": null, which fails LiveBillSchema's z.array(...) — surfaced as
// a raw Zod error when a joiner used the new "Add Bill"/"Scan New Bill"
// buttons (JoinerSessionView.tsx).
func TestAddBillResponseHasNonNullItems(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	defer billResp.Body.Close()
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(billResp.Body).Decode(&raw); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	items, ok := raw["items"]
	if !ok {
		t.Fatal("expected an items field in the response")
	}
	if string(items) == "null" {
		t.Fatal("expected items to be [], got null")
	}
	var parsed []models.Item
	if err := json.Unmarshal(items, &parsed); err != nil {
		t.Fatalf("expected items to parse as an array, got %s: %v", items, err)
	}
}

// TestJoinerEditAndDeleteItemAreLoggedWithAttribution verifies a joiner
// with edit permission can PATCH/DELETE an item (attributing personId to
// themselves, not someone else), and that both actions land in the
// activity log with a human-readable details diff.
func TestJoinerEditAndDeleteItemAreLoggedWithAttribution(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select", "permissionMode": "edit",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)
	creatorHeaders := map[string]string{"X-Creator-Token": created.CreatorToken}

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)
	bobPersonID := *joiner.PersonID

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	itemPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID + "/items/" + item.ID

	// Bob can't attribute an edit to someone else with his own token.
	impersonate := patchJSON(t, srv, itemPath,
		map[string]any{"name": "Pizza", "price": 25.0, "quantity": 1, "personId": "someone-else"},
		map[string]string{"X-Joiner-Token": joiner.Token})
	if impersonate.StatusCode != http.StatusForbidden {
		t.Fatalf("edit attributed to another person with Bob's token: expected 403, got %d", impersonate.StatusCode)
	}

	// Bob edits the item as himself.
	editResp := patchJSON(t, srv, itemPath,
		map[string]any{"name": "Pizza", "price": 25.0, "quantity": 2, "personId": bobPersonID},
		map[string]string{"X-Joiner-Token": joiner.Token})
	if editResp.StatusCode != http.StatusOK {
		t.Fatalf("edit item: expected 200, got %d", editResp.StatusCode)
	}

	// Bob deletes the item as himself.
	deleteResp := deleteWithHeaders(t, srv, itemPath+"?personId="+bobPersonID, map[string]string{"X-Joiner-Token": joiner.Token})
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("delete item: expected 200, got %d", deleteResp.StatusCode)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if len(sess.Bills[0].Items) != 0 {
		t.Fatalf("expected the item to be gone after delete, got %+v", sess.Bills[0].Items)
	}

	logResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/activity", creatorHeaders)
	entries := decodeBody[[]models.ItemActivity](t, logResp)
	if len(entries) != 2 {
		t.Fatalf("expected 2 activity entries (edit + delete), got %d: %+v", len(entries), entries)
	}
	if entries[0].Action != "delete_item" || entries[1].Action != "edit_item" {
		t.Fatalf("expected newest-first [delete_item, edit_item], got [%s, %s]", entries[0].Action, entries[1].Action)
	}
	if entries[0].PersonName != "Bob" || entries[1].PersonName != "Bob" {
		t.Fatalf("expected both entries attributed to Bob, got %+v", entries)
	}
	if entries[1].Details == "" {
		t.Fatalf("expected edit_item to carry a non-empty details diff, got %+v", entries[1])
	}
}

// TestReadOnlySessionRejectsJoinerItemEditAndDelete verifies a
// read_only-permission session rejects a joiner's PATCH/DELETE on an item,
// same as it already rejects claims — requireEditPermission gates both.
func TestReadOnlySessionRejectsJoinerItemEditAndDelete(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select", "permissionMode": "read_only",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)
	bobPersonID := *joiner.PersonID

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)
	itemPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID + "/items/" + item.ID

	editResp := patchJSON(t, srv, itemPath,
		map[string]any{"name": "Pizza", "price": 25.0, "quantity": 1, "personId": bobPersonID},
		map[string]string{"X-Joiner-Token": joiner.Token})
	if editResp.StatusCode != http.StatusForbidden {
		t.Fatalf("edit item in a read-only session: expected 403, got %d", editResp.StatusCode)
	}

	deleteResp := deleteWithHeaders(t, srv, itemPath+"?personId="+bobPersonID, map[string]string{"X-Joiner-Token": joiner.Token})
	if deleteResp.StatusCode != http.StatusForbidden {
		t.Fatalf("delete item in a read-only session: expected 403, got %d", deleteResp.StatusCode)
	}
}
