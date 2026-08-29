package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestClaimQuantityRespectsItemQuantity covers the server-side half of the
// "N minus already-claimed" fix: a Quantity Split (fraction) item's total
// claimed value across everyone can never exceed its own quantity, even if
// a client tries to post past what the UI shows. Equal-split items have no
// such cap (their claim value is always exactly 1, presence-only).
func TestClaimQuantityRespectsItemQuantity(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	bob := models.Person{ID: "bob", Name: "Bob"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice, bob}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items",
		map[string]any{"name": "Pizza", "price": 24.0, "quantity": 10, "splitType": "fraction"}, nil)
	item := decodeBody[models.Item](t, itemResp)

	claimsPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID + "/items/" + item.ID + "/claims"

	// Alice claims 6 of 10 — within the pool, should succeed.
	aliceClaim := postJSON(t, srv, claimsPath, map[string]any{"personId": "alice", "value": 6}, nil)
	if aliceClaim.StatusCode != http.StatusOK {
		t.Fatalf("alice claims 6 of 10: expected 200, got %d", aliceClaim.StatusCode)
	}

	// Bob tries to claim 5 — only 4 are left (10 - 6), so this must be rejected.
	bobOverClaim := postJSON(t, srv, claimsPath, map[string]any{"personId": "bob", "value": 5}, nil)
	if bobOverClaim.StatusCode != http.StatusConflict {
		t.Fatalf("bob over-claims past the remaining pool: expected 409, got %d", bobOverClaim.StatusCode)
	}
	errBody := decodeBody[map[string]string](t, bobOverClaim)
	if errBody["error"] != "Only 4 left to claim on this item" {
		t.Fatalf("expected a clear remaining-count error, got %q", errBody["error"])
	}

	// Bob claims exactly what's left — should succeed.
	bobClaim := postJSON(t, srv, claimsPath, map[string]any{"personId": "bob", "value": 4}, nil)
	if bobClaim.StatusCode != http.StatusOK {
		t.Fatalf("bob claims exactly the remaining 4: expected 200, got %d", bobClaim.StatusCode)
	}

	// Alice re-claiming her own existing value (6) — still within the pool
	// relative to everyone else (bob's 4) — must succeed, not be treated as
	// a fresh addition on top of what she already holds.
	aliceReclaim := postJSON(t, srv, claimsPath, map[string]any{"personId": "alice", "value": 6}, nil)
	if aliceReclaim.StatusCode != http.StatusOK {
		t.Fatalf("alice re-claims her own existing value: expected 200, got %d", aliceReclaim.StatusCode)
	}

	// Alice raising her own claim now that the pool is fully spoken for
	// (6 + 4 == 10) must be rejected.
	aliceRaise := postJSON(t, srv, claimsPath, map[string]any{"personId": "alice", "value": 7}, nil)
	if aliceRaise.StatusCode != http.StatusConflict {
		t.Fatalf("alice raises her claim past the full pool: expected 409, got %d", aliceRaise.StatusCode)
	}
}

// TestClaimEqualSplitItemUnaffectedByQuantityCap confirms the new cap check
// is scoped to fraction items only — an equal-split item's claim (always
// value 1) is never rejected for exceeding its own quantity.
func TestClaimEqualSplitItemUnaffectedByQuantityCap(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	bob := models.Person{ID: "bob", Name: "Bob"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice, bob}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	// quantity 1, equal split — both people claiming "consumed this" is
	// normal (shared item), not an over-claim.
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items",
		map[string]any{"name": "Bread Basket", "price": 8.0, "quantity": 1, "splitType": "equal"}, nil)
	item := decodeBody[models.Item](t, itemResp)

	claimsPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID + "/items/" + item.ID + "/claims"

	aliceClaim := postJSON(t, srv, claimsPath, map[string]any{"personId": "alice"}, nil)
	if aliceClaim.StatusCode != http.StatusOK {
		t.Fatalf("alice claims the equal-split item: expected 200, got %d", aliceClaim.StatusCode)
	}
	bobClaim := postJSON(t, srv, claimsPath, map[string]any{"personId": "bob"}, nil)
	if bobClaim.StatusCode != http.StatusOK {
		t.Fatalf("bob also claims the equal-split item: expected 200, got %d", bobClaim.StatusCode)
	}
}
