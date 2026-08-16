package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestListPendingClaimsReturnsOnlyPendingWithNames verifies the creator-only
// pending-claims list is scoped to this session's still-pending claims and
// carries item/person names for display.
func TestListPendingClaimsReturnsOnlyPendingWithNames(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "claims_require_approval",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)
	creatorHeaders := map[string]string{"X-Creator-Token": created.CreatorToken}

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	// Unauthenticated (no creator token) is rejected.
	unauthed := getJSON(t, srv, "/api/sessions/"+created.Code+"/claims/pending")
	if unauthed.StatusCode != http.StatusUnauthorized {
		t.Fatalf("list pending claims without creator token: expected 401, got %d", unauthed.StatusCode)
	}

	// No pending claims yet.
	emptyResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/claims/pending", creatorHeaders)
	empty := decodeBody[[]pendingClaimResponse](t, emptyResp)
	if len(empty) != 0 {
		t.Fatalf("expected no pending claims yet, got %+v", empty)
	}

	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": "alice", "value": 1.0}, nil)
	claim := decodeBody[models.ItemClaim](t, claimResp)

	listResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/claims/pending", creatorHeaders)
	pending := decodeBody[[]pendingClaimResponse](t, listResp)
	if len(pending) != 1 {
		t.Fatalf("expected 1 pending claim, got %d: %+v", len(pending), pending)
	}
	if pending[0].ID != claim.ID || pending[0].ItemID != item.ID || pending[0].ItemName != "Pizza" || pending[0].PersonName != "Alice" {
		t.Fatalf("expected the pending claim enriched with item/person names, got %+v", pending[0])
	}

	// Approving it removes it from the pending list.
	approveResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/claims/"+claim.ID+"/approve", nil, creatorHeaders)
	if approveResp.StatusCode != http.StatusOK {
		t.Fatalf("approve claim: expected 200, got %d", approveResp.StatusCode)
	}
	afterApprove := decodeBody[[]pendingClaimResponse](t, getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/claims/pending", creatorHeaders))
	if len(afterApprove) != 0 {
		t.Fatalf("expected no pending claims after approval, got %+v", afterApprove)
	}
}

// TestRejectClaimRemovesItAndLogsActivity verifies the creator-only reject
// endpoint deletes the pending claim (not just hides it), is idempotent-safe
// (a second reject 404s), requires the creator token, and is recorded in
// the activity log distinctly from an unclaim.
func TestRejectClaimRemovesItAndLogsActivity(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "claims_require_approval",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)
	creatorHeaders := map[string]string{"X-Creator-Token": created.CreatorToken}

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": "alice", "value": 1.0}, nil)
	claim := decodeBody[models.ItemClaim](t, claimResp)

	// Wrong/missing creator token is rejected.
	badReject := postJSON(t, srv, "/api/sessions/"+created.Code+"/claims/"+claim.ID+"/reject", nil, map[string]string{"X-Creator-Token": "wrong"})
	if badReject.StatusCode != http.StatusForbidden {
		t.Fatalf("reject with wrong creator token: expected 403, got %d", badReject.StatusCode)
	}

	rejectResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/claims/"+claim.ID+"/reject", nil, creatorHeaders)
	if rejectResp.StatusCode != http.StatusOK {
		t.Fatalf("reject claim: expected 200, got %d", rejectResp.StatusCode)
	}

	// Rejecting it again 404s — the row is gone, not just marked.
	secondReject := postJSON(t, srv, "/api/sessions/"+created.Code+"/claims/"+claim.ID+"/reject", nil, creatorHeaders)
	if secondReject.StatusCode != http.StatusNotFound {
		t.Fatalf("reject an already-rejected claim: expected 404, got %d", secondReject.StatusCode)
	}

	// The item shows no allocation (it was never approved).
	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if len(sess.Bills[0].Items[0].ConsumedBy) != 0 {
		t.Fatalf("expected no allocation for a rejected claim, got %+v", sess.Bills[0].Items[0].ConsumedBy)
	}

	// Activity log records the rejection distinctly from claim/unclaim.
	logResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/activity", creatorHeaders)
	entries := decodeBody[[]models.ItemActivity](t, logResp)
	if len(entries) != 2 { // the original claim submission + the reject
		t.Fatalf("expected 2 activity entries (claim + reject), got %d: %+v", len(entries), entries)
	}
	if entries[0].Action != "reject" || entries[0].PersonName != "Alice" || entries[0].ItemName != "Pizza" {
		t.Fatalf("expected the newest entry to be a reject with item/person names, got %+v", entries[0])
	}
}
