package cleanup

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	appdb "billsplitter/server/internal/db"
	"billsplitter/server/internal/logging"
	"billsplitter/server/internal/models"
	"billsplitter/server/internal/store"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := appdb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}

func TestPurgeOnce_RemovesBackdatedSettledSessionAndItsImageFile(t *testing.T) {
	database := openTestDB(t)
	st := store.New(database)

	sess, err := st.CreateSession("Test", nil, "open_link", "free_select", "edit", nil, "USD")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	if err := st.AddBill(sess.ID, models.Bill{ID: "bill1", Title: "Bill", Date: "2026-01-01T00:00:00Z", Currency: "USD"}); err != nil {
		t.Fatalf("AddBill: %v", err)
	}

	imgDir := t.TempDir()
	imgPath := filepath.Join(imgDir, "img1.jpg")
	if err := os.WriteFile(imgPath, []byte("fake-image-bytes"), 0o644); err != nil {
		t.Fatalf("write test image: %v", err)
	}
	if err := st.SaveImageMeta(sess.ID, models.ImageMeta{RefKey: "img1", BillID: "bill1", FilePath: imgPath}); err != nil {
		t.Fatalf("SaveImageMeta: %v", err)
	}

	// Backdate: settle the session, then push settled_at/created_at/updated_at/last_access_at
	// 49 hours into the past directly via SQL (bypassing the store's "now" helper).
	if err := st.SettleSession(sess.ID); err != nil {
		t.Fatalf("SettleSession: %v", err)
	}
	if _, err := database.Exec(
		`UPDATE sessions SET settled_at = datetime('now', '-49 hours'), last_access_at = datetime('now', '-49 hours') WHERE id = ?`,
		sess.ID,
	); err != nil {
		t.Fatalf("backdate session: %v", err)
	}

	PurgeOnce(st, logging.NewReporter(st), 2, 2)

	if _, err := st.GetSession(sess.ID); err != store.ErrNotFound {
		t.Fatalf("expected session to be purged, got err=%v", err)
	}
	if _, err := os.Stat(imgPath); !os.IsNotExist(err) {
		t.Fatalf("expected image file to be removed, stat err=%v", err)
	}
}

func TestPurgeOnce_LeavesRecentSessionsAlone(t *testing.T) {
	database := openTestDB(t)
	st := store.New(database)

	sess, err := st.CreateSession("Recent", nil, "open_link", "free_select", "edit", nil, "USD")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	PurgeOnce(st, logging.NewReporter(st), 14, 21)

	if _, err := st.GetSession(sess.ID); err != nil {
		t.Fatalf("expected recent session to survive purge, got err=%v", err)
	}
}
