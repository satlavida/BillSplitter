// Package db opens the SQLite connection and applies migrations.
package db

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Open opens (creating parent directories as needed) the SQLite database at
// path, enables foreign key enforcement (required for cascading deletes
// used by cleanup), and applies any migrations not yet applied.
func Open(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create db dir: %w", err)
		}
	}

	// busy_timeout so concurrent writers (e.g. two joiners claiming
	// different items at once) block-and-retry instead of failing outright
	// with SQLITE_BUSY; journal_mode=WAL so readers don't block writers.
	database, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	// SQLite allows only one writer at a time regardless of connection
	// count; capping the pool to a single connection avoids
	// SQLITE_BUSY/"database is locked" errors under concurrent writes from
	// this process (busy_timeout above still covers cross-process contention).
	database.SetMaxOpenConns(1)

	if err := database.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	if err := migrate(database); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return database, nil
}

func migrate(database *sql.DB) error {
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	for _, name := range names {
		sqlBytes, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		if _, err := database.Exec(string(sqlBytes)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
	}

	return nil
}
