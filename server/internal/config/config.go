// Package config loads server configuration from the environment. There is
// no config file — every value has a sane local-dev default so `go run
// ./cmd/server` works out of the box, and every value can be overridden for
// deployment.
package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port           string
	DBPath         string
	ImageDir       string
	AllowedOrigins []string
	AdminToken     string
	CleanupEvery   int // minutes
}

func Load() Config {
	return Config{
		Port:           getEnv("PORT", "8080"),
		DBPath:         getEnv("DB_PATH", "./data/billsplitter.db"),
		ImageDir:       getEnv("IMAGE_DIR", "./data/images"),
		AllowedOrigins: splitCSV(getEnv("ALLOWED_ORIGINS", "")),
		AdminToken:     getEnv("ADMIN_TOKEN", ""),
		CleanupEvery:   getEnvInt("CLEANUP_INTERVAL_MINUTES", 30),
	}
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
