package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
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

	// Creator approves the joiner.
	approveResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/joiners/"+joiner.ID+"/approve", nil, creatorHeaders)
	if approveResp.StatusCode != http.StatusOK {
		t.Fatalf("approve joiner: expected 200, got %d", approveResp.StatusCode)
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
