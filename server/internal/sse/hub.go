// Package sse implements a per-session-code broadcast registry for
// Server-Sent Events. Event payloads are small and entity-id-only
// (planv3.md 3.6) — subscribers refetch the named resource rather than
// receiving full state over the wire.
package sse

import (
	"fmt"
	"net/http"
	"sync"
)

// Event is a small, named notification broadcast to every subscriber of a
// session code. Kind is one of: joiner.pending, joiner.approved,
// joiner.disapproved, item.updated, bill.updated, session.settled,
// activity.created.
type Event struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

type subscriber chan Event

type Hub struct {
	mu   sync.Mutex
	subs map[string]map[subscriber]struct{} // sessionCode -> set of subscriber channels
}

func NewHub() *Hub {
	return &Hub{subs: make(map[string]map[subscriber]struct{})}
}

// Subscribe registers a new subscriber for a session code and returns an
// unsubscribe function that must be called when the client disconnects.
func (h *Hub) Subscribe(sessionCode string) (subscriber, func()) {
	ch := make(subscriber, 8)

	h.mu.Lock()
	if h.subs[sessionCode] == nil {
		h.subs[sessionCode] = make(map[subscriber]struct{})
	}
	h.subs[sessionCode][ch] = struct{}{}
	h.mu.Unlock()

	unsubscribe := func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		delete(h.subs[sessionCode], ch)
		if len(h.subs[sessionCode]) == 0 {
			delete(h.subs, sessionCode)
		}
		close(ch)
	}

	return ch, unsubscribe
}

// Broadcast sends an event to every current subscriber of a session code.
// Non-blocking: a slow/stuck subscriber is dropped from delivery for this
// event rather than blocking the broadcaster.
func (h *Hub) Broadcast(sessionCode string, event Event) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for ch := range h.subs[sessionCode] {
		select {
		case ch <- event:
		default:
		}
	}
}

// ServeHTTP handles GET /api/sessions/{code}/events as an SSE stream.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request, sessionCode string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ch, unsubscribe := h.Subscribe(sessionCode)
	defer unsubscribe()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: %s\ndata: {\"id\":%q}\n\n", event.Kind, event.ID)
			flusher.Flush()
		}
	}
}
