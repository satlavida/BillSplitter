package api

import "net/http"

// Router builds the full API mux. Wrapping (allowlist, logging,
// last-access-touch) happens in cmd/server/main.go.
func (a *API) Router() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": a.Version})
	})
	mux.HandleFunc("GET /adminhealth", a.AdminHealth)

	mux.HandleFunc("POST /api/sessions", a.CreateSession)
	mux.HandleFunc("POST /api/sessions/status", a.GetSessionsStatus)
	mux.HandleFunc("GET /api/sessions/{code}", a.GetSession)
	mux.HandleFunc("DELETE /api/sessions/{code}", a.DeleteLiveSession)
	mux.HandleFunc("GET /api/sessions/{code}/events", a.Events)
	mux.HandleFunc("GET /api/sessions/{code}/settlement", a.GetSettlement)
	mux.HandleFunc("POST /api/sessions/{code}/settle", a.Settle)
	mux.HandleFunc("PATCH /api/sessions/{code}/currency", a.UpdateSessionCurrency)
	mux.HandleFunc("PATCH /api/sessions/{code}/people/{personId}", a.UpdatePerson)

	mux.HandleFunc("POST /api/sessions/{code}/join", a.Join)
	mux.HandleFunc("GET /api/sessions/{code}/joiners", a.ListJoiners)
	mux.HandleFunc("GET /api/sessions/{code}/joiners/{id}", a.GetJoiner)
	mux.HandleFunc("POST /api/sessions/{code}/joiners/{id}/approve", a.ApproveJoiner)
	mux.HandleFunc("POST /api/sessions/{code}/joiners/{id}/disapprove", a.DisapproveJoiner)

	mux.HandleFunc("POST /api/sessions/{code}/bills", a.AddBill)
	mux.HandleFunc("PATCH /api/sessions/{code}/bills/{billId}", a.UpdateBill)
	mux.HandleFunc("DELETE /api/sessions/{code}/bills/{billId}", a.DeleteBill)
	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/restore", a.RestoreBill)
	mux.HandleFunc("DELETE /api/sessions/{code}/bills/{billId}/permanent", a.PermanentlyDeleteBill)
	mux.HandleFunc("GET /api/sessions/{code}/bills/deleted", a.ListDeletedBills)
	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/items", a.AddItem)
	mux.HandleFunc("PATCH /api/sessions/{code}/bills/{billId}/items/{itemId}", a.UpdateItem)
	mux.HandleFunc("DELETE /api/sessions/{code}/bills/{billId}/items/{itemId}", a.DeleteItem)
	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/items/{itemId}/claims", a.ClaimItem)
	mux.HandleFunc("DELETE /api/sessions/{code}/bills/{billId}/items/{itemId}/claims/{personId}", a.UnclaimItem)
	mux.HandleFunc("GET /api/sessions/{code}/activity", a.GetActivityLog)

	mux.HandleFunc("POST /api/sessions/{code}/presence/heartbeat", a.PresenceHeartbeat)
	mux.HandleFunc("GET /api/sessions/{code}/presence", a.GetPresence)

	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/images", a.UploadImage)
	mux.HandleFunc("GET /api/images/{refKey}", a.ServeImage)

	mux.HandleFunc("POST /api/scan", a.Scan)
	mux.HandleFunc("GET /api/scan/usage", a.ScanUsageQuery)

	mux.HandleFunc("GET /api/exchange-rate", a.GetExchangeRate)

	mux.HandleFunc("GET /admin", a.AdminSessionsPage)
	mux.HandleFunc("GET /admin/stats", a.AdminStatsPage)
	mux.HandleFunc("GET /admin/bill-processor", a.AdminScanPage)
	mux.HandleFunc("POST /admin/sessions/{code}/purge", a.AdminPurgeSession)
	mux.HandleFunc("GET /admin/settings", a.AdminSettingsPage)
	mux.HandleFunc("GET /admin/settings/models", a.AdminOpenRouterModels)
	mux.HandleFunc("POST /admin/settings/model", a.AdminSetOpenRouterModel)
	mux.HandleFunc("GET /admin/jobs", a.AdminJobsPage)
	mux.HandleFunc("GET /admin/exchange-rates", a.AdminExchangeRatesPage)
	mux.HandleFunc("POST /admin/exchange-rates/flush", a.AdminFlushExchangeRates)

	return mux
}
