package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	appdb "billsplitter/server/internal/db"
	"billsplitter/server/internal/models"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

func newTestServer(t *testing.T) (*httptest.Server, *sql.DB) {
	t.Helper()
	database, err := appdb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	st := store.New(database)
	hub := sse.NewHub()
	a := New(st, hub, t.TempDir(), "test-admin-token")

	srv := httptest.NewServer(a.Router())
	t.Cleanup(srv.Close)
	return srv, database
}

func postJSON(t *testing.T, srv *httptest.Server, path string, body any, headers map[string]string) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req, err := http.NewRequest(http.MethodPost, srv.URL+path, &buf)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

func getJSON(t *testing.T, srv *httptest.Server, path string) *http.Response {
	t.Helper()
	resp, err := http.Get(srv.URL + path)
	if err != nil {
		t.Fatalf("get %s: %v", path, err)
	}
	return resp
}

func patchJSON(t *testing.T, srv *httptest.Server, path string, body any, headers map[string]string) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req, err := http.NewRequest(http.MethodPatch, srv.URL+path, &buf)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

func getJSONWithHeaders(t *testing.T, srv *httptest.Server, path string, headers map[string]string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("get %s: %v", path, err)
	}
	return resp
}

func decodeBody[T any](t *testing.T, resp *http.Response) T {
	t.Helper()
	defer resp.Body.Close()
	var out T
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return out
}

// TestFullJoinApproveClaimFlow exercises: create session (approval_code +
// claims_require_approval) -> joiner requests to join -> creator approves
// -> creator adds a bill/item -> joiner claims the item (pending) ->
// creator approves the claim -> settlement reflects it.
func TestFullJoinApproveClaimFlow(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":     "Trip",
		"people":    []models.Person{alice},
		"joinMode":  "approval_code",
		"claimMode": "claims_require_approval",
	}, nil)
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("create session: expected 201, got %d", createResp.StatusCode)
	}
	created := decodeBody[createSessionResponse](t, createResp)
	if created.Code == "" || created.CreatorToken == "" {
		t.Fatalf("expected code and creatorToken, got %+v", created)
	}
	creatorHeaders := map[string]string{"X-Creator-Token": created.CreatorToken}

	// Joiner requests to join by name.
	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	if joinResp.StatusCode != http.StatusCreated {
		t.Fatalf("join: expected 201, got %d", joinResp.StatusCode)
	}
	joiner := decodeBody[models.Joiner](t, joinResp)
	if joiner.Status != models.JoinerPending {
		t.Fatalf("expected pending joiner in approval_code mode, got %s", joiner.Status)
	}
	if joiner.ApprovalCode == "" {
		t.Fatal("expected a non-empty approval code")
	}

	// Wrong/missing creator token is rejected.
	badApprove := postJSON(t, srv, "/api/sessions/"+created.Code+"/joiners/"+joiner.ID+"/approve", nil, map[string]string{"X-Creator-Token": "wrong"})
	if badApprove.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for wrong creator token, got %d", badApprove.StatusCode)
	}

	// A joiner can poll their own status without a creator token (used by
	// the frontend to detect approval while still pending).
	selfLookup := getJSON(t, srv, "/api/sessions/"+created.Code+"/joiners/"+joiner.ID)
	if selfLookup.StatusCode != http.StatusOK {
		t.Fatalf("get own joiner: expected 200, got %d", selfLookup.StatusCode)
	}
	selfJoiner := decodeBody[models.Joiner](t, selfLookup)
	if selfJoiner.Status != models.JoinerPending {
		t.Fatalf("expected pending status from self-lookup, got %s", selfJoiner.Status)
	}

	// Listing joiners without a creator token is rejected.
	unauthedList := getJSON(t, srv, "/api/sessions/"+created.Code+"/joiners")
	if unauthedList.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for joiners list without creator token, got %d", unauthedList.StatusCode)
	}

	// Creator approves the joiner.
	approveResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/joiners/"+joiner.ID+"/approve", nil, creatorHeaders)
	if approveResp.StatusCode != http.StatusOK {
		t.Fatalf("approve joiner: expected 200, got %d", approveResp.StatusCode)
	}

	// Creator lists joiners and sees the now-approved joiner.
	listResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/joiners", creatorHeaders)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("list joiners: expected 200, got %d", listResp.StatusCode)
	}
	joiners := decodeBody[[]models.Joiner](t, listResp)
	if len(joiners) != 1 || joiners[0].Status != models.JoinerApproved {
		t.Fatalf("expected 1 approved joiner, got %+v", joiners)
	}

	// Creator adds a bill and an item.
	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	if billResp.StatusCode != http.StatusCreated {
		t.Fatalf("add bill: expected 201, got %d", billResp.StatusCode)
	}
	bill := decodeBody[models.Bill](t, billResp)

	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	if itemResp.StatusCode != http.StatusCreated {
		t.Fatalf("add item: expected 201, got %d", itemResp.StatusCode)
	}
	item := decodeBody[models.Item](t, itemResp)

	// Joiner claims the item -> pending, since claim_mode is claims_require_approval.
	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": "alice", "value": 1.0}, nil)
	if claimResp.StatusCode != http.StatusCreated {
		t.Fatalf("claim item: expected 201 (pending), got %d", claimResp.StatusCode)
	}
	claim := decodeBody[models.ItemClaim](t, claimResp)
	if claim.Status != models.ClaimPending {
		t.Fatalf("expected pending claim, got %s", claim.Status)
	}

	// Fetching the session shouldn't show the allocation yet (still pending).
	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sessBefore := decodeBody[models.Session](t, sessResp)
	if len(sessBefore.Bills[0].Items[0].ConsumedBy) != 0 {
		t.Fatalf("expected no allocations before claim approval, got %+v", sessBefore.Bills[0].Items[0].ConsumedBy)
	}

	// Creator approves the claim.
	approveClaimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/claims/"+claim.ID+"/approve", nil, creatorHeaders)
	if approveClaimResp.StatusCode != http.StatusOK {
		t.Fatalf("approve claim: expected 200, got %d", approveClaimResp.StatusCode)
	}

	// Now the allocation should be visible.
	sessAfterResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sessAfter := decodeBody[models.Session](t, sessAfterResp)
	if len(sessAfter.Bills[0].Items[0].ConsumedBy) != 1 {
		t.Fatalf("expected 1 allocation after claim approval, got %+v", sessAfter.Bills[0].Items[0].ConsumedBy)
	}

	settlementResp := getJSON(t, srv, "/api/sessions/"+created.Code+"/settlement")
	if settlementResp.StatusCode != http.StatusOK {
		t.Fatalf("settlement: expected 200, got %d", settlementResp.StatusCode)
	}
}

// TestNewNameJoinerGetsAPersonIdAndCanClaim verifies a joiner who picks
// "someone new" (no existingPersonId) is given a real Person row and can
// claim items as themselves — without this, a new-name joiner would have no
// personId at all and ClaimItem would have nothing valid to send.
func TestNewNameJoinerGetsAPersonIdAndCanClaim(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Carol"}, nil)
	if joinResp.StatusCode != http.StatusCreated {
		t.Fatalf("join: expected 201, got %d", joinResp.StatusCode)
	}
	joiner := decodeBody[models.Joiner](t, joinResp)
	if joiner.PersonID == nil || *joiner.PersonID == "" {
		t.Fatalf("expected a new-name joiner to be assigned a personId, got %+v", joiner)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	found := false
	for _, p := range sess.People {
		if p.ID == *joiner.PersonID && p.Name == "Carol" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected Carol to appear in the session's people, got %+v", sess.People)
	}

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Snacks", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Chips", "price": 5.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": *joiner.PersonID}, nil)
	if claimResp.StatusCode != http.StatusOK {
		t.Fatalf("claim item: expected 200 (free_select), got %d", claimResp.StatusCode)
	}
}

// TestAddBillAndItemAcceptClientSuppliedID verifies a caller can pass its
// own id for a bill/item and have the server use it instead of generating
// one — required for the offline-first frontend to push a locally-created
// bill/item to a live session and have sessionStore's entity-id merge
// update it in place rather than create a duplicate.
func TestAddBillAndItemAcceptClientSuppliedID(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"id": "local-bill-1", "title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	if bill.ID != "local-bill-1" {
		t.Fatalf("expected the client-supplied bill id to be used, got %q", bill.ID)
	}

	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"id": "local-item-1", "name": "Pizza", "price": 20.0}, nil)
	item := decodeBody[models.Item](t, itemResp)
	if item.ID != "local-item-1" {
		t.Fatalf("expected the client-supplied item id to be used, got %q", item.ID)
	}
}

// TestUpdateBillAndItemSyncFieldsWithoutTouchingClaims verifies PATCH
// bill/item updates a locally-edited bill/item's own fields on the server,
// while leaving any existing claim/allocation on that item completely
// untouched — an item edit (price, split type, etc.) must never be able to
// clobber a joiner's claim, since claims are driven only by the claim
// endpoints.
func TestUpdateBillAndItemSyncFieldsWithoutTouchingClaims(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD", "taxAmount": 1.0}, nil)
	bill := decodeBody[models.Bill](t, billResp)

	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	claimResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": "alice"}, nil)
	if claimResp.StatusCode != http.StatusOK {
		t.Fatalf("claim item: expected 200, got %d", claimResp.StatusCode)
	}

	updateBillResp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID, map[string]any{"title": "Renamed Dinner", "currency": "EUR", "taxAmount": 2.5}, nil)
	if updateBillResp.StatusCode != http.StatusOK {
		t.Fatalf("update bill: expected 200, got %d", updateBillResp.StatusCode)
	}

	updateItemResp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID, map[string]any{"name": "Pizza (large)", "price": 25.0, "quantity": 1}, nil)
	if updateItemResp.StatusCode != http.StatusOK {
		t.Fatalf("update item: expected 200, got %d", updateItemResp.StatusCode)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if sess.Bills[0].Title != "Renamed Dinner" || sess.Bills[0].Currency != "EUR" || sess.Bills[0].TaxAmount != 2.5 {
		t.Fatalf("expected bill fields to be updated, got %+v", sess.Bills[0])
	}
	updatedItem := sess.Bills[0].Items[0]
	if updatedItem.Name != "Pizza (large)" || updatedItem.Price != 25.0 {
		t.Fatalf("expected item fields to be updated, got %+v", updatedItem)
	}
	if len(updatedItem.ConsumedBy) != 1 || updatedItem.ConsumedBy[0].PersonID != "alice" {
		t.Fatalf("expected the existing claim to survive the item update untouched, got %+v", updatedItem.ConsumedBy)
	}

	// Updating a bill/item that doesn't exist 404s.
	notFoundBill := patchJSON(t, srv, "/api/sessions/"+created.Code+"/bills/does-not-exist", map[string]any{"title": "x", "currency": "USD"}, nil)
	if notFoundBill.StatusCode != http.StatusNotFound {
		t.Fatalf("update nonexistent bill: expected 404, got %d", notFoundBill.StatusCode)
	}
	notFoundItem := patchJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/does-not-exist", map[string]any{"name": "x", "price": 1.0}, nil)
	if notFoundItem.StatusCode != http.StatusNotFound {
		t.Fatalf("update nonexistent item: expected 404, got %d", notFoundItem.StatusCode)
	}
}

// TestUploadImageIsVisibleOnTheBillInGetSession verifies an uploaded
// receipt image's refKey/width/height round-trip onto the bill returned by
// GET /api/sessions/{code} — without this, joiners have no way to discover
// a bill's image refKey at all, since UploadImage's response only goes to
// whoever made the upload request.
func TestUploadImageIsVisibleOnTheBillInGetSession(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("width", "120")
	_ = mw.WriteField("height", "200")
	fw, err := mw.CreateFormFile("image", "receipt.jpg")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := fw.Write([]byte("fake-jpeg-bytes")); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/sessions/"+created.Code+"/bills/"+bill.ID+"/images", &buf)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do upload request: %v", err)
	}
	if uploadResp.StatusCode != http.StatusCreated {
		t.Fatalf("upload image: expected 201, got %d", uploadResp.StatusCode)
	}
	uploaded := decodeBody[map[string]string](t, uploadResp)
	refKey := uploaded["refKey"]
	if refKey == "" {
		t.Fatal("expected a non-empty refKey in the upload response")
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	got := sess.Bills[0]
	if got.ImageRefKey == nil || *got.ImageRefKey != refKey {
		t.Fatalf("expected bill.imageRefKey to be %q, got %+v", refKey, got.ImageRefKey)
	}
	if got.ImageWidth == nil || *got.ImageWidth != 120 || got.ImageHeight == nil || *got.ImageHeight != 200 {
		t.Fatalf("expected bill image dimensions 120x200, got width=%v height=%v", got.ImageWidth, got.ImageHeight)
	}

	imgResp := getJSON(t, srv, "/api/images/"+refKey)
	if imgResp.StatusCode != http.StatusOK {
		t.Fatalf("get image: expected 200, got %d", imgResp.StatusCode)
	}
}

// TestConcurrentFreeSelectClaimsDontLoseEitherClaim verifies the
// free_select insert-only claim path is safe under concurrent claims from
// two different people on the same item (planv3.md 3.11 acceptance item).
func TestConcurrentFreeSelectClaimsDontLoseEitherClaim(t *testing.T) {
	srv, _ := newTestServer(t)

	people := []models.Person{{ID: "alice", Name: "Alice"}, {ID: "bob", Name: "Bob"}}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": people, "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Snacks", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Chips", "price": 5.0, "quantity": 1}, nil)
	item := decodeBody[models.Item](t, itemResp)

	done := make(chan *http.Response, 2)
	go func() {
		done <- postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": "alice"}, nil)
	}()
	go func() {
		done <- postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items/"+item.ID+"/claims", map[string]any{"personId": "bob"}, nil)
	}()
	for i := 0; i < 2; i++ {
		resp := <-done
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for free_select claim, got %d", resp.StatusCode)
		}
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	allocations := sess.Bills[0].Items[0].ConsumedBy
	if len(allocations) != 2 {
		t.Fatalf("expected both concurrent claims to be recorded, got %d allocation(s): %+v", len(allocations), allocations)
	}
}
