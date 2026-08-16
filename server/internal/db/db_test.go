package db

import (
	"path/filepath"
	"testing"
)

func TestOpen_AppliesMigrationsAndEnablesForeignKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")

	database, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer database.Close()

	tables := []string{"sessions", "people", "bills", "items", "item_allocations", "joiners", "images"}
	for _, table := range tables {
		var name string
		err := database.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err != nil {
			t.Fatalf("table %s not found: %v", table, err)
		}
	}

	// item_claims is dropped by migration 0006 (req 6: claims-approval
	// workflow removed).
	var droppedTableName string
	err = database.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='item_claims'").Scan(&droppedTableName)
	if err == nil {
		t.Fatal("expected item_claims to have been dropped")
	}

	var fkEnabled int
	if err := database.QueryRow("PRAGMA foreign_keys").Scan(&fkEnabled); err != nil {
		t.Fatalf("query foreign_keys pragma: %v", err)
	}
	if fkEnabled != 1 {
		t.Fatalf("expected foreign_keys=1, got %d", fkEnabled)
	}

	// Re-opening (simulating a restart) must not fail against existing tables.
	database2, err := Open(path)
	if err != nil {
		t.Fatalf("second Open: %v", err)
	}
	defer database2.Close()
}
