// Package api holds the HTTP handlers and router wiring for the
// live-collaboration API (planv3.md section 3.5).
package api

import (
	"encoding/json"
	"net/http"
	"time"

	"billsplitter/server/internal/logging"
	"billsplitter/server/internal/presence"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

// openRouterModelSettingKey is the settings-table key an admin can set via
// /admin/settings to override the OPENROUTER_MODEL env var/default without a
// restart — see resolveOpenRouterModel.
const openRouterModelSettingKey = "openrouter_model"

type API struct {
	store                *store.Store
	hub                  *sse.Hub
	presence             *presence.Tracker
	reporter             *logging.Reporter
	imageDir             string
	adminToken           string
	openRouterAPIKey     string
	openRouterModel      string // fallback, used when the "openrouter_model" setting is unset
	logRetentionDays     int
	idleRetentionDays    int
	settledRetentionDays int

	// Version is the running build's version string (set in cmd/server/main.go
	// from a -ldflags-injected value, "dev" otherwise). Exposed via GET
	// /healthz so a deployed instance's version can be checked remotely.
	Version string
}

// Config bundles the values API.New needs beyond store/hub, so adding a new
// one doesn't require touching every call site's positional argument list.
type Config struct {
	ImageDir                    string
	AdminToken                  string
	OpenRouterAPIKey            string
	OpenRouterModel             string
	LogRetentionDays            int
	IdleSessionRetentionDays    int
	SettledSessionRetentionDays int
}

func New(st *store.Store, hub *sse.Hub, reporter *logging.Reporter, cfg Config) *API {
	return &API{
		store:                st,
		hub:                  hub,
		presence:             presence.NewTracker(),
		reporter:             reporter,
		imageDir:             cfg.ImageDir,
		adminToken:           cfg.AdminToken,
		openRouterAPIKey:     cfg.OpenRouterAPIKey,
		openRouterModel:      cfg.OpenRouterModel,
		logRetentionDays:     cfg.LogRetentionDays,
		idleRetentionDays:    cfg.IdleSessionRetentionDays,
		settledRetentionDays: cfg.SettledSessionRetentionDays,
	}
}

// resolveOpenRouterModel returns the admin-configured model (settings table
// key "openrouter_model") if set, falling back to the OPENROUTER_MODEL env
// var/default otherwise — see architecture/scan-receipt.md.
func (a *API) resolveOpenRouterModel() string {
	if value, ok, err := a.store.GetSetting(openRouterModelSettingKey); err == nil && ok && value != "" {
		return value
	}
	return a.openRouterModel
}

// RunPresenceSweeper periodically sweeps stale presence entries (see
// presence.Tracker.Sweep) until stop is closed — mirrors cleanup.Run's
// ticker-loop pattern for the session-purge job, started in cmd/server/main.go.
func (a *API) RunPresenceSweeper(interval time.Duration, stop <-chan struct{}) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			a.presence.Sweep()
		case <-stop:
			return
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	return dec.Decode(v)
}
