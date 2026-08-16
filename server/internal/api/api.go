// Package api holds the HTTP handlers and router wiring for the
// live-collaboration API (planv3.md section 3.5).
package api

import (
	"encoding/json"
	"net/http"

	"billsplitter/server/internal/presence"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

type API struct {
	store            *store.Store
	hub              *sse.Hub
	presence         *presence.Tracker
	imageDir         string
	adminToken       string
	openRouterAPIKey string
	openRouterModel  string

	// Version is the running build's version string (set in cmd/server/main.go
	// from a -ldflags-injected value, "dev" otherwise). Exposed via GET
	// /healthz so a deployed instance's version can be checked remotely.
	Version string
}

func New(st *store.Store, hub *sse.Hub, imageDir, adminToken, openRouterAPIKey, openRouterModel string) *API {
	return &API{
		store:            st,
		hub:              hub,
		presence:         presence.NewTracker(),
		imageDir:         imageDir,
		adminToken:       adminToken,
		openRouterAPIKey: openRouterAPIKey,
		openRouterModel:  openRouterModel,
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
