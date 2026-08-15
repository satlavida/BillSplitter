package api

import "net/http"

// Router builds the full API mux. Wrapping (allowlist, logging,
// last-access-touch) happens in cmd/server/main.go.
func (a *API) Router() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mux.HandleFunc("POST /api/sessions", a.CreateSession)
	mux.HandleFunc("GET /api/sessions/{code}", a.GetSession)
	mux.HandleFunc("GET /api/sessions/{code}/events", a.Events)
	mux.HandleFunc("GET /api/sessions/{code}/settlement", a.GetSettlement)
	mux.HandleFunc("POST /api/sessions/{code}/settle", a.Settle)

	mux.HandleFunc("POST /api/sessions/{code}/join", a.Join)
	mux.HandleFunc("GET /api/sessions/{code}/joiners", a.ListJoiners)
	mux.HandleFunc("POST /api/sessions/{code}/joiners/{id}/approve", a.ApproveJoiner)
	mux.HandleFunc("POST /api/sessions/{code}/joiners/{id}/disapprove", a.DisapproveJoiner)

	mux.HandleFunc("POST /api/sessions/{code}/bills", a.AddBill)
	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/items", a.AddItem)
	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/items/{itemId}/claims", a.ClaimItem)
	mux.HandleFunc("POST /api/sessions/{code}/claims/{id}/approve", a.ApproveClaim)

	mux.HandleFunc("POST /api/sessions/{code}/bills/{billId}/images", a.UploadImage)
	mux.HandleFunc("GET /api/images/{refKey}", a.ServeImage)

	mux.HandleFunc("GET /admin", a.AdminSessionsPage)
	mux.HandleFunc("GET /admin/stats", a.AdminStatsPage)
	mux.HandleFunc("POST /admin/sessions/{code}/purge", a.AdminPurgeSession)

	return mux
}
