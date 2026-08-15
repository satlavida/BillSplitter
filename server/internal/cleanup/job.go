// Package cleanup runs the 48h purge job (planv3.md 3.8).
package cleanup

import (
	"log"
	"os"
	"time"

	"billsplitter/server/internal/store"
)

// Run starts a ticker that purges stale sessions every `interval`. Blocks
// until stop is closed — call with `go cleanup.Run(...)`.
func Run(st *store.Store, interval time.Duration, stop <-chan struct{}) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			PurgeOnce(st)
		}
	}
}

// PurgeOnce runs a single purge pass: image files are removed *before* the
// cascading SQL delete, so a mid-purge crash leaves both row and file intact
// for the next tick rather than orphaning a file.
func PurgeOnce(st *store.Store) {
	sessionIDs, imagePaths, err := st.PurgeStaleSessions()
	if err != nil {
		log.Printf("cleanup: purge failed: %v", err)
		return
	}
	for _, p := range imagePaths {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			log.Printf("cleanup: failed to remove image %s: %v", p, err)
		}
	}
	if len(sessionIDs) > 0 {
		log.Printf("cleanup: purged %d stale session(s): %v", len(sessionIDs), sessionIDs)
	}
}
