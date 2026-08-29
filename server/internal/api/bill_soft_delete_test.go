package api

import (
	"net/http"
	"testing"

	"billsplitter/server/internal/models"
)

// TestJoinerDeleteBillIsSoftAndCreatorCanRestoreOrPermanentlyRemove covers
// the whole lifecycle: a joiner's DELETE soft-deletes (bill drops out of
// GetSession, but the row survives), the deletion is attributed to them in
// the activity log, the creator sees it via ListDeletedBills, can restore
// it (bill reappears with its items intact), and can permanently remove a
// (re-deleted) bill — which a joiner cannot do themselves.
func TestJoinerDeleteBillIsSoftAndCreatorCanRestoreOrPermanentlyRemove(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := postJSON(t, srv, "/api/sessions", map[string]any{
		"title": "Trip", "joinMode": "open_link", "claimMode": "free_select", "permissionMode": "edit",
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
	itemResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"/items", map[string]any{"name": "Pizza", "price": 20.0}, nil)
	item := decodeBody[models.Item](t, itemResp)

	billPath := "/api/sessions/" + created.Code + "/bills/" + bill.ID

	// Bob soft-deletes it.
	deleteResp := deleteWithHeaders(t, srv, billPath+"?personId="+bobPersonID, map[string]string{"X-Joiner-Token": joiner.Token})
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("joiner delete bill: expected 200, got %d", deleteResp.StatusCode)
	}

	// It's gone from the normal session view (both creator's and joiners').
	sessResp := getJSON(t, srv, "/api/sessions/"+created.Code)
	sess := decodeBody[models.Session](t, sessResp)
	if len(sess.Bills) != 0 {
		t.Fatalf("expected the soft-deleted bill to be hidden from GetSession, got %+v", sess.Bills)
	}

	// The creator can see it in the deleted-bills list.
	deletedResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/bills/deleted", creatorHeaders)
	if deletedResp.StatusCode != http.StatusOK {
		t.Fatalf("list deleted bills: expected 200, got %d", deletedResp.StatusCode)
	}
	deletedBills := decodeBody[[]models.Bill](t, deletedResp)
	if len(deletedBills) != 1 || deletedBills[0].ID != bill.ID || deletedBills[0].DeletedAt == nil {
		t.Fatalf("expected 1 deleted bill with DeletedAt set, got %+v", deletedBills)
	}

	// A non-creator can't list deleted bills.
	unauthedList := getJSON(t, srv, "/api/sessions/"+created.Code+"/bills/deleted")
	if unauthedList.StatusCode != http.StatusUnauthorized {
		t.Fatalf("list deleted bills without creator token: expected 401, got %d", unauthedList.StatusCode)
	}

	// Activity log attributes the delete to Bob.
	logResp := getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/activity", creatorHeaders)
	entries := decodeBody[[]models.ItemActivity](t, logResp)
	if len(entries) != 1 || entries[0].Action != "delete_bill" || entries[0].PersonName != "Bob" {
		t.Fatalf("expected 1 delete_bill entry attributed to Bob, got %+v", entries)
	}

	// The creator restores it.
	restoreResp := postJSON(t, srv, billPath+"/restore", nil, creatorHeaders)
	if restoreResp.StatusCode != http.StatusOK {
		t.Fatalf("restore bill: expected 200, got %d", restoreResp.StatusCode)
	}
	sessAfterRestore := decodeBody[models.Session](t, getJSON(t, srv, "/api/sessions/"+created.Code))
	if len(sessAfterRestore.Bills) != 1 || len(sessAfterRestore.Bills[0].Items) != 1 || sessAfterRestore.Bills[0].Items[0].ID != item.ID {
		t.Fatalf("expected the restored bill to reappear with its item intact, got %+v", sessAfterRestore.Bills)
	}

	// A joiner cannot restore or permanently remove.
	joinerRestore := postJSON(t, srv, billPath+"/restore", nil, map[string]string{"X-Joiner-Token": joiner.Token})
	if joinerRestore.StatusCode != http.StatusUnauthorized {
		t.Fatalf("joiner restore: expected 401 (creator-only), got %d", joinerRestore.StatusCode)
	}
	joinerPermanent := deleteWithHeaders(t, srv, billPath+"/permanent", map[string]string{"X-Joiner-Token": joiner.Token})
	if joinerPermanent.StatusCode != http.StatusUnauthorized {
		t.Fatalf("joiner permanent delete: expected 401 (creator-only), got %d", joinerPermanent.StatusCode)
	}

	// The creator permanently removes it.
	permResp := deleteWithHeaders(t, srv, billPath+"/permanent", creatorHeaders)
	if permResp.StatusCode != http.StatusOK {
		t.Fatalf("permanent delete: expected 200, got %d", permResp.StatusCode)
	}
	sessAfterPermanent := decodeBody[models.Session](t, getJSON(t, srv, "/api/sessions/"+created.Code))
	if len(sessAfterPermanent.Bills) != 0 {
		t.Fatalf("expected the bill to be gone after permanent delete, got %+v", sessAfterPermanent.Bills)
	}
	deletedAfterPermanent := decodeBody[[]models.Bill](t, getJSONWithHeaders(t, srv, "/api/sessions/"+created.Code+"/bills/deleted", creatorHeaders))
	if len(deletedAfterPermanent) != 0 {
		t.Fatalf("expected the permanently-removed bill to be gone from the deleted list too, got %+v", deletedAfterPermanent)
	}
}

// TestReadOnlySessionRejectsJoinerBillDelete mirrors the item-level
// equivalent — requireEditPermission gates DeleteBill too.
func TestReadOnlySessionRejectsJoinerBillDelete(t *testing.T) {
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
	bobPersonID := *joiner.PersonID

	billResp := postJSON(t, srv, "/api/sessions/"+created.Code+"/bills", map[string]any{"title": "Dinner", "currency": "USD"}, nil)
	bill := decodeBody[models.Bill](t, billResp)

	deleteResp := deleteWithHeaders(t, srv, "/api/sessions/"+created.Code+"/bills/"+bill.ID+"?personId="+bobPersonID, map[string]string{"X-Joiner-Token": joiner.Token})
	if deleteResp.StatusCode != http.StatusForbidden {
		t.Fatalf("delete bill in a read-only session: expected 403, got %d", deleteResp.StatusCode)
	}
}
