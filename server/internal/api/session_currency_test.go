package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

func TestUpdateSessionCurrency_CreatorOnly(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"people":   []models.Person{alice},
		"currency": "USD",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	// No creator token -> rejected.
	unauth := patchJSON(t, srv, "/api/sessions/"+created.Code+"/currency", map[string]string{"currency": "INR"}, nil)
	if unauth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 with no token, got %d", unauth.StatusCode)
	}

	// Wrong token -> rejected.
	wrong := patchJSON(t, srv, "/api/sessions/"+created.Code+"/currency", map[string]string{"currency": "INR"}, map[string]string{"X-Creator-Token": "wrong"})
	if wrong.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 with wrong token, got %d", wrong.StatusCode)
	}

	// Correct token -> applied.
	ok := patchJSON(t, srv, "/api/sessions/"+created.Code+"/currency", map[string]string{"currency": "INR"}, map[string]string{"X-Creator-Token": created.CreatorToken})
	if ok.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", ok.StatusCode)
	}

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if sess.Currency != "INR" {
		t.Fatalf("Currency = %q, want INR", sess.Currency)
	}
}

// TestUpdateSessionCurrency_ClearsBillExchangeRates verifies the fix for a
// stale-rate bug: a bill's exchange_rate/exchange_rate_date/
// exchange_rate_is_override are only ever meaningful relative to the session
// currency they were fetched/overridden against. Before this fix, changing
// the session currency left those fields in place, so settlement would
// silently apply a rate computed for the *old* session currency to the new
// one. See architecture/currency.md and getEffectiveRate in
// server/internal/settlement/settlement.go / src/lib/settlement.ts.
func TestUpdateSessionCurrency_ClearsBillExchangeRates(t *testing.T) {
	srv, _ := newTestServer(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"people":   []models.Person{alice},
		"currency": "INR",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	// A bill in USD, with a fetched/overridden rate against the session's
	// original INR currency.
	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)

	rate := 83.5
	date := "2026-08-01"
	updateResp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID, map[string]any{
		"title":                  "Dinner",
		"currency":               "USD",
		"exchangeRate":           &rate,
		"exchangeRateDate":       &date,
		"exchangeRateIsOverride": true,
	}, nil)
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 setting bill rate, got %d", updateResp.StatusCode)
	}

	// Sanity check: the rate is actually stored before the currency switch.
	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if len(sess.Bills) != 1 || sess.Bills[0].ExchangeRate == nil || *sess.Bills[0].ExchangeRate != rate {
		t.Fatalf("expected bill to have exchange rate %v set before currency switch, got %+v", rate, sess.Bills)
	}

	// Switch the session currency to SGD — the stored USD->INR rate is now
	// meaningless and must be cleared, not silently reused as USD->SGD.
	switchResp := patchJSON(t, srv, "/api/sessions/"+created.Code+"/currency", map[string]string{"currency": "SGD"}, map[string]string{"X-Creator-Token": created.CreatorToken})
	if switchResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 switching currency, got %d", switchResp.StatusCode)
	}

	sessResp = getJSON(t, srv, "/api/sessions/"+created.Code)
	sess = decodeBody[models.Session](t, sessResp)
	if sess.Currency != "SGD" {
		t.Fatalf("Currency = %q, want SGD", sess.Currency)
	}
	if len(sess.Bills) != 1 {
		t.Fatalf("expected 1 bill, got %d", len(sess.Bills))
	}
	got := sess.Bills[0]
	if got.ExchangeRate != nil {
		t.Fatalf("ExchangeRate = %v, want nil after currency switch", *got.ExchangeRate)
	}
	if got.ExchangeRateDate != nil {
		t.Fatalf("ExchangeRateDate = %v, want nil after currency switch", *got.ExchangeRateDate)
	}
	if got.ExchangeRateIsOverride {
		t.Fatalf("ExchangeRateIsOverride = true, want false after currency switch")
	}
	// The bill's own currency is untouched by a session currency change.
	if got.Currency != "USD" {
		t.Fatalf("bill Currency = %q, want USD (unchanged)", got.Currency)
	}
}

func TestCreateSession_DefaultsCurrencyToUSD(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{"title": "Trip"}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if sess.Currency != "USD" {
		t.Fatalf("Currency = %q, want USD", sess.Currency)
	}
}
