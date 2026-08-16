package api

import (
	"net/http"
	"testing"
)

// TestDeleteLiveSessionRequiresCreatorToken covers req 15: only the creator
// can delete the online mirror of a session, and once deleted it's really
// gone (GetSession 404s, not just marked settled/hidden).
func TestDeleteLiveSessionRequiresCreatorToken(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"joinMode": "open_link",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	req, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/sessions/"+created.Code, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	unauthed, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	if unauthed.StatusCode != http.StatusUnauthorized {
		t.Fatalf("delete without creator token: expected 401, got %d", unauthed.StatusCode)
	}

	req2, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/sessions/"+created.Code, nil)
	req2.Header.Set("X-Creator-Token", "wrong")
	wrongAuth, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	if wrongAuth.StatusCode != http.StatusForbidden {
		t.Fatalf("delete with wrong creator token: expected 403, got %d", wrongAuth.StatusCode)
	}

	req3, _ := http.NewRequest(http.MethodDelete, srv.URL+"/api/sessions/"+created.Code, nil)
	req3.Header.Set("X-Creator-Token", created.CreatorToken)
	okDelete, err := http.DefaultClient.Do(req3)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	if okDelete.StatusCode != http.StatusOK {
		t.Fatalf("delete with creator token: expected 200, got %d", okDelete.StatusCode)
	}

	getResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	if getResp.StatusCode != http.StatusNotFound {
		t.Fatalf("get deleted session: expected 404, got %d", getResp.StatusCode)
	}
}
