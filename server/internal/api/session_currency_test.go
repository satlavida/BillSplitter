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
