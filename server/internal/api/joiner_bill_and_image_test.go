package api

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestJoinerCanAddBillInEditModeButNotReadOnly verifies a joiner's own
// X-Joiner-Token actually exercises requireEditPermission on AddBill —
// previously only the creator's token-free UI called this route, so
// nothing exercised the joiner-token branch of the check.
func TestJoinerCanAddBillInEditModeButNotReadOnly(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select", "permissionMode": "edit",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)

	addResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills",
		map[string]any{"title": "Dinner", "currency": "USD"}, map[string]string{"X-Joiner-Token": joiner.Token})
	if addResp.StatusCode != http.StatusCreated {
		t.Fatalf("joiner add bill in edit-mode session: expected 201, got %d", addResp.StatusCode)
	}

	// Flip the session to read-only via a fresh session instead (permission
	// mode isn't PATCHable), reusing the same joiner-token check.
	roResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip2", "joinMode": "open_link", "claimMode": "free_select", "permissionMode": "read_only",
	}, nil)
	roCreated := decodeBody[createSessionResponse](t, roResp)
	roJoinResp := postJSON(t, srv, "/api/sessions/"+roCreated.Code+"/join", map[string]any{"name": "Bob"}, nil)
	roJoiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, roJoinResp)

	roAddResp := postJSON(t, srv, "/api/sessions/"+roCreated.Code+"/bills",
		map[string]any{"title": "Dinner", "currency": "USD"}, map[string]string{"X-Joiner-Token": roJoiner.Token})
	if roAddResp.StatusCode != http.StatusForbidden {
		t.Fatalf("joiner add bill in read-only session: expected 403, got %d", roAddResp.StatusCode)
	}
}

// TestUploadImageRespectsReadOnlyPermission is a regression test: UploadImage
// used to have no requireEditPermission/requireNotSettled check at all, so a
// read-only joiner could still push a receipt image. Needed once the joiner
// UI (JoinerScanReceiptButton.tsx) started calling this route with its own
// token for the gate to mean anything.
func TestUploadImageRespectsReadOnlyPermission(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select", "permissionMode": "read_only",
	}, nil)
	created := decodeBody[createSessionResponse](t, createResp)

	joinResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/join", map[string]any{"name": "Bob"}, nil)
	joiner := decodeBody[struct {
		models.Joiner
		Token string `json:"token"`
	}](t, joinResp)

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
	req.Header.Set("X-Joiner-Token", joiner.Token)
	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do upload request: %v", err)
	}
	if uploadResp.StatusCode != http.StatusForbidden {
		t.Fatalf("upload image with a joiner token in a read-only session: expected 403, got %d", uploadResp.StatusCode)
	}
}
