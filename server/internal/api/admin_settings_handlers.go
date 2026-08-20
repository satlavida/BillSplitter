// Admin-configurable settings: currently just the receipt-scan OpenRouter
// model (settings key "openrouter_model", see api.resolveOpenRouterModel).
// See architecture/admin-panel.md and architecture/scan-receipt.md.
package api

import (
	"encoding/json"
	"io"
	"net/http"
	"time"
)

// openRouterModelListURL is OpenRouter's public model catalog — used to
// populate the admin model picker's dropdown.
const openRouterModelListURL = "https://openrouter.ai/api/v1/models"

type openRouterModelInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type openRouterModelListResponse struct {
	Data []openRouterModelInfo `json:"data"`
}

// AdminSettingsPage renders the settings page (model picker), fetching the
// dropdown's options client-side via AdminOpenRouterModels so a slow/failed
// OpenRouter call never blocks the page itself from loading.
func (a *API) AdminSettingsPage(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	current := a.resolveOpenRouterModel()
	_, overridden, err := a.store.GetSetting(openRouterModelSettingKey)
	if err != nil {
		http.Error(w, "failed to load settings", http.StatusInternalServerError)
		return
	}
	_ = adminSettingsTemplate.ExecuteTemplate(w, "layout", map[string]any{
		"CurrentModel":    current,
		"EnvDefaultModel": a.openRouterModel,
		"Overridden":      overridden,
	})
}

// AdminOpenRouterModels proxies GET https://openrouter.ai/api/v1/models so
// the admin settings page's JS can populate a dropdown without exposing the
// server's OPENROUTER_API_KEY to the browser.
func (a *API) AdminOpenRouterModels(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminTokenAPI(w, r) {
		return
	}
	if a.openRouterAPIKey == "" {
		writeError(w, http.StatusInternalServerError, "OPENROUTER_API_KEY is not configured")
		return
	}

	httpReq, err := http.NewRequest(http.MethodGet, openRouterModelListURL, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build request")
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+a.openRouterAPIKey)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		a.reporter.Warn("openrouter_models", "failed to fetch model list: %v", err)
		writeError(w, http.StatusBadGateway, "failed to reach OpenRouter")
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to read OpenRouter response")
		return
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		a.reporter.Warn("openrouter_models", "OpenRouter model list returned %d: %s", resp.StatusCode, string(body))
		writeError(w, http.StatusBadGateway, "OpenRouter returned an error")
		return
	}

	var parsed openRouterModelListResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		writeError(w, http.StatusBadGateway, "failed to parse OpenRouter response")
		return
	}

	writeJSON(w, http.StatusOK, parsed.Data)
}

// AdminSetOpenRouterModel handles POST /admin/settings/model. An empty
// "model" value clears the override, reverting to OPENROUTER_MODEL.
func (a *API) AdminSetOpenRouterModel(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}
	model := r.FormValue("model")
	if err := a.store.SetSetting(openRouterModelSettingKey, model); err != nil {
		http.Error(w, "failed to save setting", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/admin/settings", http.StatusSeeOther)
}
