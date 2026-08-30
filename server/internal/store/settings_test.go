package store

import (
	"path/filepath"
	"testing"

	appdb "billsplitter/server/internal/db"
	"billsplitter/server/internal/models"
)

func openSettingsTestDB(t *testing.T) *Store {
	t.Helper()
	database, err := appdb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return New(database)
}

func TestSettingsGetSetRoundTrip(t *testing.T) {
	s := openSettingsTestDB(t)

	if _, ok, err := s.GetSetting("openrouter_model"); err != nil || ok {
		t.Fatalf("expected missing setting, got ok=%v err=%v", ok, err)
	}

	if err := s.SetSetting("openrouter_model", "some/model-v1"); err != nil {
		t.Fatalf("SetSetting: %v", err)
	}
	value, ok, err := s.GetSetting("openrouter_model")
	if err != nil || !ok || value != "some/model-v1" {
		t.Fatalf("expected value=some/model-v1 ok=true, got value=%q ok=%v err=%v", value, ok, err)
	}

	// Overwrite via upsert.
	if err := s.SetSetting("openrouter_model", "some/model-v2"); err != nil {
		t.Fatalf("SetSetting overwrite: %v", err)
	}
	value, _, _ = s.GetSetting("openrouter_model")
	if value != "some/model-v2" {
		t.Fatalf("expected overwritten value, got %q", value)
	}
}

func TestJobRunLifecycle(t *testing.T) {
	s := openSettingsTestDB(t)

	runID, err := s.StartJobRun("session_purge")
	if err != nil {
		t.Fatalf("StartJobRun: %v", err)
	}
	if err := s.FinishJobRun(runID, JobStatusSuccess, "purged 3 session(s)"); err != nil {
		t.Fatalf("FinishJobRun: %v", err)
	}

	latest, err := s.LatestJobRuns()
	if err != nil {
		t.Fatalf("LatestJobRuns: %v", err)
	}
	if len(latest) != 1 {
		t.Fatalf("expected 1 latest job run, got %d", len(latest))
	}
	if latest[0].Status != JobStatusSuccess || latest[0].FinishedAt == nil {
		t.Fatalf("expected finished success run, got %+v", latest[0])
	}

	// A second, failed run for the same job should become the "latest".
	runID2, err := s.StartJobRun("session_purge")
	if err != nil {
		t.Fatalf("StartJobRun 2: %v", err)
	}
	if err := s.FinishJobRun(runID2, JobStatusFailed, "boom"); err != nil {
		t.Fatalf("FinishJobRun 2: %v", err)
	}
	latest, err = s.LatestJobRuns()
	if err != nil {
		t.Fatalf("LatestJobRuns 2: %v", err)
	}
	if len(latest) != 1 || latest[0].Status != JobStatusFailed {
		t.Fatalf("expected latest run to reflect the failed run, got %+v", latest)
	}

	recent, err := s.ListRecentJobRuns(10)
	if err != nil {
		t.Fatalf("ListRecentJobRuns: %v", err)
	}
	if len(recent) != 2 {
		t.Fatalf("expected 2 recent job runs, got %d", len(recent))
	}
}

func TestErrorEventsAndCounters(t *testing.T) {
	s := openSettingsTestDB(t)

	if err := s.RecordErrorEvent("openrouter_request", "timeout"); err != nil {
		t.Fatalf("RecordErrorEvent: %v", err)
	}
	if err := s.RecordErrorEvent("openrouter_request", "500"); err != nil {
		t.Fatalf("RecordErrorEvent: %v", err)
	}
	if err := s.RecordErrorEvent("job_session_purge", "disk full"); err != nil {
		t.Fatalf("RecordErrorEvent: %v", err)
	}

	counters, err := s.ErrorCounters()
	if err != nil {
		t.Fatalf("ErrorCounters: %v", err)
	}
	if counters["openrouter_request"] != 2 {
		t.Fatalf("expected openrouter_request counter=2, got %d", counters["openrouter_request"])
	}
	if counters["job_session_purge"] != 1 {
		t.Fatalf("expected job_session_purge counter=1, got %d", counters["job_session_purge"])
	}

	since, err := s.ErrorCountsSince("-24 hours")
	if err != nil {
		t.Fatalf("ErrorCountsSince: %v", err)
	}
	if since["openrouter_request"] != 2 {
		t.Fatalf("expected windowed openrouter_request count=2, got %d", since["openrouter_request"])
	}
}

func TestPurgeStaleSessionsIndependentIdleAndSettledThresholds(t *testing.T) {
	s := openSettingsTestDB(t)

	idleSess, err := s.CreateSession("Idle", nil, "open_link", "free_select", "edit", nil, "USD")
	if err != nil {
		t.Fatalf("create idle session: %v", err)
	}
	settledSess, err := s.CreateSession("Settled", nil, "open_link", "free_select", "edit", nil, "USD")
	if err != nil {
		t.Fatalf("create settled session: %v", err)
	}
	if err := s.SettleSession(settledSess.ID); err != nil {
		t.Fatalf("SettleSession: %v", err)
	}

	// Backdate the idle session past a 14-day idle threshold but well within
	// a 21-day settled threshold (it's irrelevant here since it's not
	// settled); backdate the settled session past 21 days.
	if _, err := s.db.Exec(`UPDATE sessions SET last_access_at = datetime('now', '-15 days') WHERE id = ?`, idleSess.ID); err != nil {
		t.Fatalf("backdate idle session: %v", err)
	}
	if _, err := s.db.Exec(`UPDATE sessions SET settled_at = datetime('now', '-22 days') WHERE id = ?`, settledSess.ID); err != nil {
		t.Fatalf("backdate settled session: %v", err)
	}

	purged, _, err := s.PurgeStaleSessions(14, 21)
	if err != nil {
		t.Fatalf("PurgeStaleSessions: %v", err)
	}

	purgedSet := map[string]bool{}
	for _, id := range purged {
		purgedSet[id] = true
	}
	if !purgedSet[idleSess.ID] {
		t.Fatalf("expected idle session %s to be purged, got %v", idleSess.ID, purged)
	}
	if !purgedSet[settledSess.ID] {
		t.Fatalf("expected settled session %s to be purged, got %v", settledSess.ID, purged)
	}
}

// TestPurgeStaleSessionsCascadesPayments verifies the "no new cleanup code
// needed" claim in architecture/payments.md: a payments row has
// session_id ... ON DELETE CASCADE (migration 0014), so purging a session
// via PurgeStaleSessions's plain `DELETE FROM sessions` should remove its
// payments automatically, same as bills/item_activity/joiners already do —
// this is the verification for that claim, not a formality.
func TestPurgeStaleSessionsCascadesPayments(t *testing.T) {
	s := openSettingsTestDB(t)

	alice := models.Person{ID: "alice", Name: "Alice"}
	bob := models.Person{ID: "bob", Name: "Bob"}
	sess, err := s.CreateSession("Trip", []models.Person{alice, bob}, "open_link", "free_select", "edit", nil, "USD")
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	if err := s.AddPayment(sess.ID, models.Payment{
		ID: "pay1", PayerID: "bob", PayeeID: "alice", Amount: 500, Currency: "USD", Method: "cash",
		AddedByPersonID: "bob", CreatedAt: "2026-01-01T00:00:00Z",
	}); err != nil {
		t.Fatalf("AddPayment: %v", err)
	}

	if _, err := s.db.Exec(`UPDATE sessions SET last_access_at = datetime('now', '-15 days') WHERE id = ?`, sess.ID); err != nil {
		t.Fatalf("backdate session: %v", err)
	}

	if _, _, err := s.PurgeStaleSessions(14, 21); err != nil {
		t.Fatalf("PurgeStaleSessions: %v", err)
	}

	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM payments WHERE session_id = ?`, sess.ID).Scan(&count); err != nil {
		t.Fatalf("count payments: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected payments to be cascade-deleted with the session, found %d remaining", count)
	}
}
