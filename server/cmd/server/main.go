// Command server runs the BillSplitter live-collaboration API: an optional
// layer on top of the fully-functional offline frontend (planv3.md Phase 3).
package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"billsplitter/server/internal/api"
	"billsplitter/server/internal/config"
	"billsplitter/server/internal/db"
	"billsplitter/server/internal/middleware"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"

	appcleanup "billsplitter/server/internal/cleanup"
)

func main() {
	cfg := config.Load()

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	st := store.New(database)
	hub := sse.NewHub()
	a := api.New(st, hub, cfg.ImageDir, cfg.AdminToken)

	stopCleanup := make(chan struct{})
	go appcleanup.Run(st, time.Duration(cfg.CleanupEvery)*time.Minute, stopCleanup)
	defer close(stopCleanup)

	handler := middleware.Logging(
		middleware.Allowlist(cfg.AllowedOrigins, a.Router()),
	)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: handler,
	}

	go func() {
		log.Printf("listening on :%s (db=%s images=%s)", cfg.Port, cfg.DBPath, cfg.ImageDir)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Println("shutting down")
	if err := srv.Close(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
