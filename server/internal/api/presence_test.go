package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

func TestPresenceHeartbeatAndGetPresence(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title":    "Trip",
		"joinMode": "open_link",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)
	bobPersonID := *joiner.PersonID

	// Not online yet before any heartbeat beyond the initial join-time touch
	// — GetPresence should at least reflect that touch.
	presenceResp := getJSON(t, srv, "/api/sessions/"+created.Code+"/presence")
	if presenceResp.StatusCode != http.StatusOK {
		t.Fatalf("get presence: expected 200, got %d", presenceResp.StatusCode)
	}
	presence := decodeBody[presenceResponse](t, presenceResp)
	found := false
	for _, id := range presence.Online {
		if id == bobPersonID {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected %s online right after joining, got %+v", bobPersonID, presence.Online)
	}

	// Heartbeat without a token is rejected.
	noAuth := postJSON(t, srv, "/api/sessions/"+created.Code+"/presence/heartbeat", map[string]any{"personId": bobPersonID}, nil)
	if noAuth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("heartbeat without token: expected 401, got %d", noAuth.StatusCode)
	}

	// Heartbeat with a mismatched token is rejected.
	wrongAuth := postJSON(t, srv, "/api/sessions/"+created.Code+"/presence/heartbeat",
		map[string]any{"personId": bobPersonID}, map[string]string{"X-Joiner-Token": "not-the-real-token"})
	if wrongAuth.StatusCode != http.StatusForbidden {
		t.Fatalf("heartbeat with wrong token: expected 403, got %d", wrongAuth.StatusCode)
	}

	// Heartbeat with the right token succeeds.
	okAuth := postJSON(t, srv, "/api/sessions/"+created.Code+"/presence/heartbeat",
		map[string]any{"personId": bobPersonID}, map[string]string{"X-Joiner-Token": joiner.Token})
	if okAuth.StatusCode != http.StatusOK {
		t.Fatalf("heartbeat with right token: expected 200, got %d", okAuth.StatusCode)
	}
}
