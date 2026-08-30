package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

type joinerWithToken struct {
	models.Joiner
	Token string `json:"token"`
}

func TestAddPayment_PayerAddedStaysUnverifiedByDefault(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select", "creatorPersonId": "alice",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	bob := decodeBody[joinerWithToken](t, joinResp)
	bobID := *bob.PersonID

	addResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments", map[string]any{
		"id": "pay1", "payerId": bobID, "payeeId": "alice", "amount": 500, "currency": "INR", "method": "cash", "addedByPersonId": bobID,
	}, map[string]string{"X-Joiner-Token": bob.Token})
	if addResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", addResp.StatusCode)
	}
	payment := decodeBody[models.Payment](t, addResp)
	if payment.Verified {
		t.Fatalf("expected a payer-added payment to start unverified, got verified=true")
	}
}

func TestAddPayment_PayeeAddedAutoVerifies(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select", "creatorPersonId": "alice",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	bob := decodeBody[joinerWithToken](t, joinResp)
	bobID := *bob.PersonID

	// Alice owes Bob; Bob (the payee here) logs it himself.
	addResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments", map[string]any{
		"id": "pay1", "payerId": "alice", "payeeId": bobID, "amount": 500, "currency": "INR", "method": "cash", "addedByPersonId": bobID,
	}, map[string]string{"X-Joiner-Token": bob.Token})
	if addResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", addResp.StatusCode)
	}
	payment := decodeBody[models.Payment](t, addResp)
	if !payment.Verified {
		t.Fatalf("expected a payee-added payment to auto-verify, got verified=false")
	}
}

func TestAddPayment_JoinerCannotLogOnBehalfOfSomeoneElse(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select", "creatorPersonId": "alice",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	bobResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	bob := decodeBody[joinerWithToken](t, bobResp)
	bobID := *bob.PersonID

	carolResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Carol"}, nil)
	carol := decodeBody[joinerWithToken](t, carolResp)
	carolID := *carol.PersonID

	// Bob tries to log a payment between Alice and Carol, using his own
	// valid token — rejected, since he's neither the payer nor the payee.
	resp := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments", map[string]any{
		"id": "pay1", "payerId": "alice", "payeeId": carolID, "amount": 100, "currency": "INR", "method": "cash", "addedByPersonId": bobID,
	}, map[string]string{"X-Joiner-Token": bob.Token})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestAddPayment_RequirePaymentVerificationOffAutoVerifiesBoth(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select", "creatorPersonId": "alice",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	bob := decodeBody[joinerWithToken](t, joinResp)
	bobID := *bob.PersonID

	toggleResp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/settings/require-payment-verification", map[string]any{"requirePaymentVerification": false}, map[string]string{"X-Creator-Token": created.CreatorToken})
	if toggleResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 turning off verification, got %d", toggleResp.StatusCode)
	}

	addResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments", map[string]any{
		"id": "pay1", "payerId": bobID, "payeeId": "alice", "amount": 500, "currency": "INR", "method": "cash", "addedByPersonId": bobID,
	}, map[string]string{"X-Joiner-Token": bob.Token})
	payment := decodeBody[models.Payment](t, addResp)
	if !payment.Verified {
		t.Fatalf("expected a payer-added payment to auto-verify when requirePaymentVerification is off, got verified=false")
	}
}

func TestVerifyPayment_PayeeCanVerifyPayerCannot(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select", "creatorPersonId": "alice",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	bob := decodeBody[joinerWithToken](t, joinResp)
	bobID := *bob.PersonID

	addResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments", map[string]any{
		"id": "pay1", "payerId": bobID, "payeeId": "alice", "amount": 500, "currency": "INR", "method": "cash", "addedByPersonId": bobID,
	}, map[string]string{"X-Joiner-Token": bob.Token})
	payment := decodeBody[models.Payment](t, addResp)
	if payment.Verified {
		t.Fatalf("expected unverified payment to start")
	}

	// Bob (the payer) tries to verify his own payment — rejected.
	payerVerify := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments/pay1/verify", nil, map[string]string{"X-Joiner-Token": bob.Token})
	if payerVerify.StatusCode != http.StatusForbidden {
		t.Fatalf("expected payer verify to be 403, got %d", payerVerify.StatusCode)
	}

	// Alice (the creator, token-free) verifies it — allowed.
	creatorVerify := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments/pay1/verify", nil, nil)
	if creatorVerify.StatusCode != http.StatusOK {
		t.Fatalf("expected creator verify to be 200, got %d", creatorVerify.StatusCode)
	}

	sessResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code, map[string]string{"X-Creator-Token": created.CreatorToken})
	sess := decodeBody[models.Session](t, sessResp)
	if len(sess.Payments) != 1 || !sess.Payments[0].Verified {
		t.Fatalf("expected the payment to be verified, got %+v", sess.Payments)
	}
}

func TestGetSession_PaymentsAreFilteredByViewerIdentity(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "people": []models.Person{alice}, "joinMode": "open_link", "claimMode": "free_select", "creatorPersonId": "alice",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	bobResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	bob := decodeBody[joinerWithToken](t, bobResp)
	bobID := *bob.PersonID

	carolResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Carol"}, nil)
	carol := decodeBody[joinerWithToken](t, carolResp)
	carolID := *carol.PersonID

	// A payment strictly between Bob and Alice.
	addResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/payments", map[string]any{
		"id": "pay1", "payerId": bobID, "payeeId": "alice", "amount": 500, "currency": "INR", "method": "cash", "addedByPersonId": bobID,
	}, map[string]string{"X-Joiner-Token": bob.Token})
	if addResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", addResp.StatusCode)
	}

	// The creator sees it.
	creatorSess := decodeBody[models.Session](t, getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code, map[string]string{"X-Creator-Token": created.CreatorToken}))
	if len(creatorSess.Payments) != 1 {
		t.Fatalf("expected creator to see 1 payment, got %d", len(creatorSess.Payments))
	}

	// An unauthenticated fetch (no identity headers at all) sees none.
	anonSess := decodeBody[models.Session](t, getJSON(t, srv, "/api/sessions/"+created.Code))
	if len(anonSess.Payments) != 0 {
		t.Fatalf("expected an unauthenticated fetch to see 0 payments, got %d", len(anonSess.Payments))
	}

	// Bob (a party to it) sees it.
	bobSess := decodeBody[models.Session](t, getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"?personId="+bobID, map[string]string{"X-Joiner-Token": bob.Token}))
	if len(bobSess.Payments) != 1 {
		t.Fatalf("expected Bob to see 1 payment, got %d", len(bobSess.Payments))
	}

	// Carol (uninvolved) does not see it.
	carolSess := decodeBody[models.Session](t, getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"?personId="+carolID, map[string]string{"X-Joiner-Token": carol.Token}))
	if len(carolSess.Payments) != 0 {
		t.Fatalf("expected Carol to see 0 payments, got %d", len(carolSess.Payments))
	}
}
