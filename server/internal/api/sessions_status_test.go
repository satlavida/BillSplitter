package api

import (
	"net/http"
	"testing"
)

// TestSessionsStatusReportsActiveSettledAndDeleted covers the batch status
// endpoint a joiner's client uses to reconcile its locally-tracked "sessions
// I've joined" list: one active session, one settled session, and one code
// that never existed should each come back with the right status in a
// single request.
func TestSessionsStatusReportsActiveSettledAndDeleted(t *testing.T) {
	srv, _ := newTestServer(t)

	activeResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Active Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	active := decodeBody[createSessionResponse](t, activeResp)

	settledResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Settled Trip", "joinMode": "open_link", "claimMode": "free_select",
	}, nil)
	settled := decodeBody[createSessionResponse](t, settledResp)
	settleResp := postJSON(t, srv, "/api/sessions/"+settled.Code+"/settle", nil, map[string]string{"X-Creator-Token": settled.CreatorToken})
	if settleResp.StatusCode != http.StatusOK {
		t.Fatalf("settle: expected 200, got %d", settleResp.StatusCode)
	}

	statusResp := postJSON(t, srv, "/api/sessions/status", map[string]any{
		"codes": []string{active.Code, settled.Code, "NOPE1"},
	}, nil)
	if statusResp.StatusCode != http.StatusOK {
		t.Fatalf("sessions status: expected 200, got %d", statusResp.StatusCode)
	}
	body := decodeBody[sessionsStatusResponse](t, statusResp)
	if len(body.Statuses) != 3 {
		t.Fatalf("expected 3 statuses, got %d: %+v", len(body.Statuses), body.Statuses)
	}

	byCode := make(map[string]string)
	for _, s := range body.Statuses {
		byCode[s.Code] = s.Status
	}
	if byCode[active.Code] != "active" {
		t.Errorf("expected %q to be active, got %q", active.Code, byCode[active.Code])
	}
	if byCode[settled.Code] != "settled" {
		t.Errorf("expected %q to be settled, got %q", settled.Code, byCode[settled.Code])
	}
	if byCode["NOPE1"] != "deleted" {
		t.Errorf("expected an unknown code to be deleted, got %q", byCode["NOPE1"])
	}
}

func TestSessionsStatusEmptyCodesReturnsEmptyList(t *testing.T) {
	srv, _ := newTestServer(t)

	statusResp := postJSON(t, srv, "/api/sessions/status", map[string]any{"codes": []string{}}, nil)
	if statusResp.StatusCode != http.StatusOK {
		t.Fatalf("sessions status: expected 200, got %d", statusResp.StatusCode)
	}
	body := decodeBody[sessionsStatusResponse](t, statusResp)
	if len(body.Statuses) != 0 {
		t.Fatalf("expected 0 statuses, got %d: %+v", len(body.Statuses), body.Statuses)
	}
}
