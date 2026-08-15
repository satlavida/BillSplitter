// Package api holds the HTTP handlers and router wiring for the
// live-collaboration API (planv3.md section 3.5).
package api

import (
	"encoding/json"
	"net/http"

	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

type API struct {
	store      *store.Store
	hub        *sse.Hub
	imageDir   string
	adminToken string
}

func New(st *store.Store, hub *sse.Hub, imageDir, adminToken string) *API {
	return &API{store: st, hub: hub, imageDir: imageDir, adminToken: adminToken}
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
