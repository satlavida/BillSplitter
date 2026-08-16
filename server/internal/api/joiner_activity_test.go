package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"billsplitter/server/internal/models"
)

func deleteWithHeaders(t *testing.T, srv *httptest.Server, path string, headers map[string]string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, srv.URL+path, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete %s: %v", path, err)
	}
	return resp
}

// TestOpenLinkJoinerGetsTokenOnceAndCanOnlyClaimForSelf covers the whole
// joiner-token lifecycle: an open_link (auto-approved) joiner receives its
// secret token directly in the Join response, GetJoiner never repeats it,
// and the token only authenticates claims for the personId it owns.
func TestOpenLinkJoinerGetsTokenOnceAndCanOnlyClaimForSelf(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	if joinResp.StatusCode != http.StatusCreated {
		t.Fatalf("join: expected 201, got %d", joinResp.StatusCode)
	}
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)
	if joiner.Status != models.JoinerApproved {
		t.Fatalf("expected open_link join to auto-approve, got %s", joiner.Status)
	}
	if joiner.Token == "" {
		t.Fatal("expected a non-empty token on an immediately-approved joiner")
	}
	bobPersonID := *joiner.PersonID

	// GetJoiner never repeats the token once revealed.
	getResp := getJSON(t, srv, "/api/sessions/"+created.Code+"/joiners/"+joiner.ID)
	got := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, getResp)
	if got.Token != "" {
		t.Fatalf("expected the token to only be revealed once, got %q on a later GetJoiner call", got.Token)
	}

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	// Bob's token authenticates a claim for himself.
	selfClaim := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims",
		map[string]any{"personId": bobPersonID}, map[string]string{"X-Joiner-Token": joiner.Token})
	if selfClaim.StatusCode != http.StatusOK {
		t.Fatalf("self claim: expected 200, got %d", selfClaim.StatusCode)
	}

	// Bob's token does NOT authenticate a claim on Alice's behalf.
	otherClaim := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims",
		map[string]any{"personId": "alice"}, map[string]string{"X-Joiner-Token": joiner.Token})
	if otherClaim.StatusCode != http.StatusForbidden {
		t.Fatalf("claim on someone else's behalf with a mismatched token: expected 403, got %d", otherClaim.StatusCode)
	}

	// A token-free claim (the creator's own live-editing UI) is still allowed.
	creatorClaim := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims",
		map[string]any{"personId": "alice"}, nil)
	if creatorClaim.StatusCode != http.StatusOK {
		t.Fatalf("token-free (creator) claim: expected 200, got %d", creatorClaim.StatusCode)
	}
}

// TestUnclaimRemovesAllocationAndRequiresOwnToken verifies DELETE .../claims/{personId}
// removes the allocation, is rejected without a matching joiner token, and
// that both the claim and unclaim are recorded in the activity log.
func TestUnclaimRemovesAllocationAndRequiresOwnToken(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
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

	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims",
		map[string]any{"personId": bobPersonID}, map[string]string{"X-Joiner-Token": joiner.Token})
	if claimResp.StatusCode != http.StatusOK {
		t.Fatalf("claim: expected 200, got %d", claimResp.StatusCode)
	}

	unclaimPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID + "/items/" + item.ID + "/claims/" + bobPersonID

	// No token at all -> 401.
	noAuth := deleteWithHeaders(t, srv, unclaimPath, nil)
	if noAuth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unclaim without a token: expected 401, got %d", noAuth.StatusCode)
	}

	// Wrong token -> 403.
	wrongAuth := deleteWithHeaders(t, srv, unclaimPath, map[string]string{"X-Joiner-Token": "not-the-real-token"})
	if wrongAuth.StatusCode != http.StatusForbidden {
		t.Fatalf("unclaim with a wrong token: expected 403, got %d", wrongAuth.StatusCode)
	}

	// Correct token -> removes the allocation.
	okAuth := deleteWithHeaders(t, srv, unclaimPath, map[string]string{"X-Joiner-Token": joiner.Token})
	if okAuth.StatusCode != http.StatusOK {
		t.Fatalf("unclaim with the right token: expected 200, got %d", okAuth.StatusCode)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if len(sess.Bills[0].Items[0].ConsumedBy) != 0 {
		t.Fatalf("expected the allocation to be removed after unclaim, got %+v", sess.Bills[0].Items[0].ConsumedBy)
	}

	// Activity log has both the claim and the unclaim, newest first.
	logResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/activity", creatorHeaders)
	if logResp.StatusCode != http.StatusOK {
		t.Fatalf("get activity log: expected 200, got %d", logResp.StatusCode)
	}
	entries := decodeBody[[]models.ItemActivity](t, logResp)
	if len(entries) != 2 {
		t.Fatalf("expected 2 activity entries (claim + unclaim), got %d: %+v", len(entries), entries)
	}
	if entries[0].Action != "unclaim" || entries[1].Action != "claim" {
		t.Fatalf("expected newest-first [unclaim, claim], got [%s, %s]", entries[0].Action, entries[1].Action)
	}
	if entries[0].ItemName != "Pizza" || entries[0].PersonName != "Bob" {
		t.Fatalf("expected the unclaim entry to snapshot item/person names, got %+v", entries[0])
	}
}

// TestActivityLogRequiresCreatorToken verifies GET .../activity is
// creator-gated like the rest of the creator-only endpoints.
func TestActivityLogRequiresCreatorToken(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	unauthed := getJSON(t, srv, "/api/sessions/"+created.Code+"/activity")
	if unauthed.StatusCode != http.StatusUnauthorized {
		t.Fatalf("activity log without a creator token: expected 401, got %d", unauthed.StatusCode)
	}

	wrongToken := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/activity", map[string]string{"X-Creator-Token": "wrong"})
	if wrongToken.StatusCode != http.StatusForbidden {
		t.Fatalf("activity log with a wrong creator token: expected 403, got %d", wrongToken.StatusCode)
	}
}

// TestUnclaimCancelsPendingClaim verifies that in claims_require_approval
// mode, unclaiming before the creator has approved the claim removes the
// still-pending item_claims row (rather than only handling the
// already-approved item_allocations case).
func TestUnclaimCancelsPendingClaim(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "claims_require_approval",
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

	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims",
		map[string]any{"personId": bobPersonID}, map[string]string{"X-Joiner-Token": joiner.Token})
	claim := decodeBody[models.ItemClaim](t, claimResp)
	if claim.Status != models.ClaimPending {
		t.Fatalf("expected a pending claim, got %s", claim.Status)
	}

	unclaimPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID + "/items/" + item.ID + "/claims/" + bobPersonID
	unclaimResp := deleteWithHeaders(t, srv, unclaimPath, map[string]string{"X-Joiner-Token": joiner.Token})
	if unclaimResp.StatusCode != http.StatusOK {
		t.Fatalf("unclaim a pending claim: expected 200, got %d", unclaimResp.StatusCode)
	}

	// The pending claim is gone, so approving it now 404s.
	approveResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/claims/"+claim.ID+"/approve", nil, creatorHeaders)
	if approveResp.StatusCode != http.StatusNotFound {
		t.Fatalf("approving a cancelled pending claim: expected 404, got %d", approveResp.StatusCode)
	}
}
