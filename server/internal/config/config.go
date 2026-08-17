// Package config loads server configuration from the environment. Every
// value has a sane local-dev default so `go run ./cmd/server` works out of
// the box, and every value can be overridden for deployment. For local dev
// convenience, a `.env` file (gitignored, next to go.mod — i.e.
// server/.env) is loaded first if present: see loadDotEnv. Deployment still
// uses real environment variables / an EnvironmentFile (see DEPLOYMENT.md);
// .env is never required.
package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port             string
	DBPath           string
	ImageDir         string
	AllowedOrigins   []string
	AdminToken       string
	CleanupEvery     int // minutes
	OpenRouterAPIKey string
	OpenRouterModel  string
}

func Load() Config {
	loadDotEnv()
	return Config{
		Port:             getEnv("PORT", "8080"),
		DBPath:           getEnv("DB_PATH", "./data/billsplitter.db"),
		ImageDir:         getEnv("IMAGE_DIR", "./data/images"),
		AllowedOrigins:   splitCSV(getEnv("ALLOWED_ORIGINS", "")),
		AdminToken:       getEnv("ADMIN_TOKEN", ""),
		CleanupEvery:     getEnvInt("CLEANUP_INTERVAL_MINUTES", 30),
		OpenRouterAPIKey: getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:  getEnv("OPENROUTER_MODEL", "google/gemini-3.1-flash-lite"),
	}
}

// loadDotEnv looks for server/.env relative to the process's working
// directory and, if found, applies it (see loadDotEnvFile). `go run`'s cwd
// is wherever the command was invoked from, not the package directory, so
// server/.env can end up one or two levels below cwd depending on whether
// that command was run as `go run ./cmd/server` from server/ (the
// documented convention, see DEPLOYMENT.md) or as `go run .`/`go run
// main.go` from server/cmd/server directly — checking a short list of
// candidates covers both without requiring an exact invocation style.
func loadDotEnv() {
	for _, path := range []string{".env", "../.env", "../../.env"} {
		if loadDotEnvFile(path) {
			return
		}
	}
}

// loadDotEnvFile reads a simple KEY=VALUE .env file (blank lines and lines
// starting with # ignored, surrounding quotes on the value stripped) and
// calls os.Setenv for each line — but only when that key isn't already set
// in the real environment, so a real env var / EnvironmentFile in
// deployment always wins over a stray .env file. Reports whether the file
// was found at all (not found is not an error — production doesn't have
// one and isn't expected to).
func loadDotEnvFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" {
			continue
		}
		if _, alreadySet := os.LookupEnv(key); alreadySet {
			continue
		}
		os.Setenv(key, value)
	}
	return true
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func splitCSV(v string) []string {
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
