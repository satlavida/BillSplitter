// GET /adminhealth: a detailed, ADMIN_TOKEN-gated companion to GET
// /healthz (which stays intentionally public/minimal for uptime checks).
// See architecture/admin-panel.md.
package api

import "net/http"

type adminHealthWindow struct {
	SessionsActive int `json:"sessionsActive"`
	ScanRequests   int `json:"scanRequests"`
}

type adminHealthResponse struct {
	Status  string                    `json:"status"`
	Version string                    `json:"version"`
	Last24h adminHealthWindow         `json:"last24h"`
	Last7d  adminHealthWindow         `json:"last7d"`
	Errors  adminHealthErrorsResponse `json:"errors"`
	Jobs    []adminHealthJob          `json:"jobs"`
}

type adminHealthErrorsResponse struct {
	Last24h map[string]int `json:"last24h"`
	Last7d  map[string]int `json:"last7d"`
	AllTime map[string]int `json:"allTime"`
}

type adminHealthJob struct {
	JobName    string  `json:"jobName"`
	Status     string  `json:"status"`
	StartedAt  string  `json:"startedAt"`
	FinishedAt *string `json:"finishedAt"`
	Message    *string `json:"message,omitempty"`
}

// AdminHealth handles GET /adminhealth: 24h/7d session-activity and
// scan-request counts, 24h/7d/all-time error counts by category, and the
// latest run of every background job.
func (a *API) AdminHealth(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminTokenAPI(w, r) {
		return
	}

	resp := adminHealthResponse{Status: "ok", Version: a.Version}

	var err error
	if resp.Last24h.SessionsActive, err = a.store.SessionsActiveSince("-24 hours"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session stats")
		return
	}
	if resp.Last7d.SessionsActive, err = a.store.SessionsActiveSince("-7 days"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session stats")
		return
	}
	if resp.Last24h.ScanRequests, err = a.store.ScanRequestsSince("-24 hours"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load scan stats")
		return
	}
	if resp.Last7d.ScanRequests, err = a.store.ScanRequestsSince("-7 days"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load scan stats")
		return
	}

	if resp.Errors.Last24h, err = a.store.ErrorCountsSince("-24 hours"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load error stats")
		return
	}
	if resp.Errors.Last7d, err = a.store.ErrorCountsSince("-7 days"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load error stats")
		return
	}
	if resp.Errors.AllTime, err = a.store.ErrorCounters(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load error stats")
		return
	}

	jobRuns, err := a.store.LatestJobRuns()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load job stats")
		return
	}
	resp.Jobs = make([]adminHealthJob, 0, len(jobRuns))
	for _, jr := range jobRuns {
		resp.Jobs = append(resp.Jobs, adminHealthJob{
			JobName:    jr.JobName,
			Status:     jr.Status,
			StartedAt:  jr.StartedAt,
			FinishedAt: jr.FinishedAt,
			Message:    jr.Message,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}
