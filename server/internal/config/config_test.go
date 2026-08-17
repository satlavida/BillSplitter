package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvFileSetsUnsetKeys(t *testing.T) {
	os.Unsetenv("BILLSPLITTER_TEST_DOTENV_KEY")
	defer os.Unsetenv("BILLSPLITTER_TEST_DOTENV_KEY")

	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("# comment\n\nBILLSPLITTER_TEST_DOTENV_KEY=from-file\n"), 0o644); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	if !loadDotEnvFile(path) {
		t.Fatalf("expected loadDotEnvFile to report the file as found")
	}
	if got := os.Getenv("BILLSPLITTER_TEST_DOTENV_KEY"); got != "from-file" {
		t.Fatalf("expected .env value to be set, got %q", got)
	}
}

func TestLoadDotEnvFileDoesNotOverrideRealEnv(t *testing.T) {
	os.Setenv("BILLSPLITTER_TEST_DOTENV_KEY2", "from-real-env")
	defer os.Unsetenv("BILLSPLITTER_TEST_DOTENV_KEY2")

	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("BILLSPLITTER_TEST_DOTENV_KEY2=from-file\n"), 0o644); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	loadDotEnvFile(path)

	if got := os.Getenv("BILLSPLITTER_TEST_DOTENV_KEY2"); got != "from-real-env" {
		t.Fatalf("expected the real environment variable to win, got %q", got)
	}
}

func TestLoadDotEnvFileMissingFileIsANoop(t *testing.T) {
	if loadDotEnvFile(filepath.Join(t.TempDir(), "does-not-exist.env")) {
		t.Fatalf("expected loadDotEnvFile to report the file as not found")
	}
}

// TestLoadDotEnvChecksMultipleCandidateDirectories covers the actual bug
// this was written for: `go run ./cmd/server` invoked from server/cmd/server
// directly (cwd = server/cmd/server) rather than from server/ (cwd =
// server/) — server/.env sits two directories above cwd in that case, so
// loadDotEnv must find it via the "../../.env" candidate, not just "./.env".
func TestLoadDotEnvChecksMultipleCandidateDirectories(t *testing.T) {
	os.Unsetenv("BILLSPLITTER_TEST_DOTENV_NESTED")
	defer os.Unsetenv("BILLSPLITTER_TEST_DOTENV_NESTED")

	root := t.TempDir()
	nestedCwd := filepath.Join(root, "cmd", "server")
	if err := os.MkdirAll(nestedCwd, 0o755); err != nil {
		t.Fatalf("mkdir nested cwd: %v", err)
	}
	envPath := filepath.Join(root, ".env")
	if err := os.WriteFile(envPath, []byte("BILLSPLITTER_TEST_DOTENV_NESTED=from-two-levels-up\n"), 0o644); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	origWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer os.Chdir(origWD)
	if err := os.Chdir(nestedCwd); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	loadDotEnv()

	if got := os.Getenv("BILLSPLITTER_TEST_DOTENV_NESTED"); got != "from-two-levels-up" {
		t.Fatalf("expected .env two directories up to be found, got %q", got)
	}
}
