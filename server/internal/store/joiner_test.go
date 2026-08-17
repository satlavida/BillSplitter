package store

import (
	"path/filepath"
	"testing"

	appdb "billsplitter/server/internal/db"
	"billsplitter/server/internal/models"
)

// TestRejoinByExistingPersonReplacesPriorJoinerRow guards against a
// duplicate-row regression: previously CreateJoiner always INSERTed, so a
// person who joined twice (e.g. re-requesting after their pending request
// went stale) showed up twice in the creator's approval list. The
// (session_id, person_id) upsert should collapse that into a single row
// carrying the latest status/timestamp.
func TestRejoinByExistingPersonReplacesPriorJoinerRow(t *testing.T) {
	database, err := appdb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer database.Close()

	s := New(database)
	alice := models.Person{ID: "alice", Name: "Alice"}
	sess, err := s.CreateSession("Trip", []models.Person{alice}, models.JoinModeApprovalCode, models.ClaimModeFreeSelect, models.PermissionModeEdit, nil)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	first, err := s.CreateJoiner(sess.ID, "joiner-1", "Alice", &alice.ID, nil, models.JoinModeApprovalCode)
	if err != nil {
		t.Fatalf("first join: %v", err)
	}

	second, err := s.CreateJoiner(sess.ID, "joiner-2", "Alice", &alice.ID, nil, models.JoinModeApprovalCode)
	if err != nil {
		t.Fatalf("second join (rejoin): %v", err)
	}

	joiners, err := s.ListJoiners(sess.ID)
	if err != nil {
		t.Fatalf("list joiners: %v", err)
	}
	if len(joiners) != 1 {
		t.Fatalf("expected rejoin to replace the prior row, got %d rows: %+v", len(joiners), joiners)
	}
	if joiners[0].ID != second.ID {
		t.Fatalf("expected the surviving row to be the latest join (%q), got %q", second.ID, joiners[0].ID)
	}
	if joiners[0].CreatedAt != second.CreatedAt {
		t.Fatalf("expected the latest join's timestamp, got %q want %q", joiners[0].CreatedAt, second.CreatedAt)
	}
	if joiners[0].ApprovalCode != second.ApprovalCode || joiners[0].ApprovalCode == first.ApprovalCode {
		t.Fatalf("expected the rejoin's own approval code to win, got %+v", joiners[0])
	}
}

// TestRejoinByAlreadyApprovedPersonStaysApproved guards against the upsert
// silently demoting an already-approved person back to pending on rejoin
// (e.g. a lost token, cleared storage, or a new device) — in approval_code
// mode that would revoke their claim access and force the creator to
// re-approve them, even though nothing about their standing actually
// changed. Their joiner_token is still expected to rotate (and is handed
// back to them directly), just not their status.
func TestRejoinByAlreadyApprovedPersonStaysApproved(t *testing.T) {
	database, err := appdb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer database.Close()

	s := New(database)
	alice := models.Person{ID: "alice", Name: "Alice"}
	sess, err := s.CreateSession("Trip", []models.Person{alice}, models.JoinModeApprovalCode, models.ClaimModeFreeSelect, models.PermissionModeEdit, nil)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	first, err := s.CreateJoiner(sess.ID, "joiner-1", "Alice", &alice.ID, nil, models.JoinModeApprovalCode)
	if err != nil {
		t.Fatalf("first join: %v", err)
	}
	if err := s.SetJoinerStatus(sess.ID, first.ID, models.JoinerApproved); err != nil {
		t.Fatalf("approve: %v", err)
	}

	rejoin, err := s.CreateJoiner(sess.ID, "joiner-2", "Alice", &alice.ID, nil, models.JoinModeApprovalCode)
	if err != nil {
		t.Fatalf("rejoin: %v", err)
	}
	if rejoin.Status != models.JoinerApproved {
		t.Fatalf("expected an already-approved person's rejoin to stay approved, got status %q", rejoin.Status)
	}
	if rejoin.JoinerToken == "" {
		t.Fatalf("expected the rejoining (already-approved) caller to receive a fresh token directly, got none")
	}

	ok, err := s.VerifyJoinerToken(sess.ID, alice.ID, rejoin.JoinerToken)
	if err != nil {
		t.Fatalf("verify token: %v", err)
	}
	if !ok {
		t.Fatalf("expected the rejoin's own token to authorize claims for alice")
	}
}
