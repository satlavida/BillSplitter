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
	"billsplitter/server/internal/logging"
	"billsplitter/server/internal/middleware"
	"billsplitter/server/internal/presence"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"

	appcleanup "billsplitter/server/internal/cleanup"
)

// version is set at build time via:
//
//	go build -ldflags "-X main.version=$(git describe --tags --always)" ./cmd/server
//
// Left as "dev" for local `go run`/unversioned builds.
var version = "dev"

func main() {
	cfg := config.Load()

	closeLogging, err := logging.Init(cfg.LogDir)
	if err != nil {
		log.Fatalf("failed to init logging: %v", err)
	}
	defer closeLogging()

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	st := store.New(database)
	reporter := logging.NewReporter(st)
	hub := sse.NewHub()
	a := api.New(st, hub, reporter, api.Config{
		ImageDir:                    cfg.ImageDir,
		AdminToken:                  cfg.AdminToken,
		OpenRouterAPIKey:            cfg.OpenRouterAPIKey,
		OpenRouterModel:             cfg.OpenRouterModel,
		LogRetentionDays:            cfg.LogRetentionDays,
		IdleSessionRetentionDays:    cfg.IdleSessionRetentionDays,
		SettledSessionRetentionDays: cfg.SettledSessionRetentionDays,
	})
	a.Version = version

	stopCleanup := make(chan struct{})
	go appcleanup.Run(st, reporter, cfg.IdleSessionRetentionDays, cfg.SettledSessionRetentionDays, time.Duration(cfg.CleanupEvery)*time.Minute, stopCleanup)
	defer close(stopCleanup)

	stopLogRetention := make(chan struct{})
	go appcleanup.RunLogRetention(st, reporter, cfg.LogDir, cfg.LogRetentionDays, 24*time.Hour, stopLogRetention)
	defer close(stopLogRetention)

	stopPresenceSweep := make(chan struct{})
	go a.RunPresenceSweeper(presence.FlushAfter, stopPresenceSweep)
	defer close(stopPresenceSweep)

	handler := middleware.Logging(
		middleware.Allowlist(cfg.AllowedOrigins, a.Router()),
	)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: handler,
	}

	go func() {
		log.Printf("billsplitter-server %s listening on :%s (db=%s images=%s)", version, cfg.Port, cfg.DBPath, cfg.ImageDir)
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
