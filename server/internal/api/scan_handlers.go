// Receipt scanning, migrated from the external bill-processor Cloudflare
// Worker. The request/response contract (including the quirky 200-with-error-body
// behavior on unparseable LLM output) is preserved exactly so the frontend's
// existing Zod schema and retry logic don't need to change shape.
package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// analysisPrompt is ported verbatim from bill-processor/src/prompt.js.
const analysisPrompt = `
You are given an image of a restaurant bill that includes food and drink items.

Instructions:

Extract all ordered items under the items array.
For each item:

Item Name (multi-line merging):
Bills often wrap long item names across multiple lines. Reconstruct the full name by joining all continuation lines into a single string.
A line is a continuation of the previous item name if it has no price or quantity beside it and is indented or positioned directly below the item name.
Do not treat a continuation line as a separate item. Each physical item on the bill must appear exactly once in the output.
Examples of multi-line names to merge:
  "Paneer Aloo Mattar" on one line and "Sabji" on the next → "Paneer Aloo Mattar Sabji"
  "Grilled Chicken" on one line and "with Mushroom Sauce" on the next → "Grilled Chicken with Mushroom Sauce"

Quantity:
Extract the quantity. If not explicitly mentioned, default to 1.
If in the format Beer 6 1200, interpret it as 6 beers costing 1200 total, set price as 1200 / 6 = 200.00.

Price:
Extract the total item price (before any tax or service charge).

Discounts:
If the bill shows an overall flat discount, add it as a separate item with a negative price.
If discounts apply only to certain items, keep their final price after discount and include a discount field:
  discount: {
    value: <discount amount or percentage>,
    discountType: "flat" | "percentage"
  }
For percentage discounts, value is the percent off. For flat discounts, value is the amount subtracted.
Calculate the final per-unit price: price = (item total - discount) / quantity.
Apply item-level discounts before computing price.

Tax Field:
Include all service charges, tips, VAT, GST, or surcharges under the tax field.
If multiple components are listed separately, sum them.

Subtotal:
Sum of (price × quantity) for all items after discount, but before tax.

Total:
Final billed amount paid, including tax and all charges.

Validation:
1. Financial: Ensure subtotal + tax == total (within ±0.01 rounding tolerance). If mismatched, re-check discount and price calculations before producing output.
2. Item count: If the bill explicitly states a total number of items (e.g. "Total Items: 5", "Qty: 8"), count your extracted items (excluding discount lines) and verify it matches. If there is a mismatch, re-examine the bill for missed or duplicated items and correct your extraction before producing output.

Output format:

{
  "items": [
    {
      "name": "Item Name",
      "price": 123.45,
      "quantity": 1,
      "discount": {
        "value": 10,
        "discountType": "percentage"
      }
    },
    {
      "name": "Discount",
      "price": -5.00,
      "quantity": 1
    }
  ],
  "subtotal": 1345.67,
  "tax": 123.45,
  "total": 1469.12
}
`

var fencedJSONPattern = regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)\\s*```")

type scanImagePayload struct {
	Base64Data string `json:"base64Data"`
	MimeType   string `json:"mimeType"`
}

type scanRequestBody struct {
	Image scanImagePayload `json:"image"`
}

type openRouterContentPart struct {
	Type     string           `json:"type"`
	Text     string           `json:"text,omitempty"`
	ImageURL *openRouterImage `json:"image_url,omitempty"`
}

type openRouterImage struct {
	URL string `json:"url"`
}

type openRouterMessage struct {
	Role    string                  `json:"role"`
	Content []openRouterContentPart `json:"content"`
}

type openRouterRequest struct {
	Model    string              `json:"model"`
	Messages []openRouterMessage `json:"messages"`
}

type openRouterUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type openRouterResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage *openRouterUsage `json:"usage"`
}

// Scan handles POST /api/scan: accepts a base64-encoded receipt image, sends
// it to OpenRouter, and returns the extracted items/subtotal/tax/total.
func (a *API) Scan(w http.ResponseWriter, r *http.Request) {
	if !strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "Request must be application/json", http.StatusBadRequest)
		return
	}

	var body scanRequestBody
	if err := decodeJSON(r, &body); err != nil {
		http.Error(w, "Invalid request format. Expected: { image: { base64Data: string, mimeType: string } }", http.StatusBadRequest)
		return
	}
	if body.Image.Base64Data == "" || body.Image.MimeType == "" {
		http.Error(w, "Invalid request format. Expected: { image: { base64Data: string, mimeType: string } }", http.StatusBadRequest)
		return
	}
	if !strings.HasPrefix(body.Image.MimeType, "image/") {
		http.Error(w, "File must be an image", http.StatusBadRequest)
		return
	}

	if a.openRouterAPIKey == "" {
		http.Error(w, "OPENROUTER_API_KEY is not configured.", http.StatusInternalServerError)
		return
	}

	model := a.resolveOpenRouterModel()
	content, usage, err := a.callOpenRouter(model, body.Image.Base64Data, body.Image.MimeType)
	if err != nil {
		a.reporter.Error("openrouter_request", "scan request failed (model=%s): %v", model, err)
		a.recordScanUsage(model, false, nil)
		http.Error(w, fmt.Sprintf("Error processing request: %s", err), http.StatusInternalServerError)
		return
	}

	a.recordScanUsage(model, true, usage)

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(content))
}

// ScanUsageQuery handles GET /api/scan/usage?year=&month=&day= — same
// contract as the Worker's GET /usage.
func (a *API) ScanUsageQuery(w http.ResponseWriter, r *http.Request) {
	year := r.URL.Query().Get("year")
	month := r.URL.Query().Get("month")
	day := r.URL.Query().Get("day")
	if year == "" || month == "" {
		http.Error(w, "year and month required", http.StatusBadRequest)
		return
	}

	if day != "" {
		usage, err := a.store.ScanUsageDaily(fmt.Sprintf("%s-%s-%s", year, month, day))
		if err != nil {
			http.Error(w, "failed to load usage", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, usage)
		return
	}

	usage, err := a.store.ScanUsageMonthly(fmt.Sprintf("%s-%s", year, month))
	if err != nil {
		http.Error(w, "failed to load usage", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, usage)
}

func (a *API) recordScanUsage(model string, success bool, usage *openRouterUsage) {
	prompt, completion, total := 0, 0, 0
	if usage != nil {
		prompt, completion, total = usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens
	}
	if err := a.store.RecordScanRequest(model, success, prompt, completion, total); err != nil {
		a.reporter.Warn("openrouter_request", "failed to record scan usage: %v", err)
	}
}

// callOpenRouter sends the image + prompt to OpenRouter and returns the
// response body to hand back to the client verbatim: on success, the
// extracted-JSON string; on unparseable LLM output, a JSON-encoded
// {raw_response, error} object (still a 200, matching the Worker's
// graceful-degrade behavior — see stringifyParsedResponse in
// bill-processor/src/index.js).
func (a *API) callOpenRouter(model, base64Image, mimeType string) (string, *openRouterUsage, error) {
	reqBody := openRouterRequest{
		Model: model,
		Messages: []openRouterMessage{
			{
				Role: "user",
				Content: []openRouterContentPart{
					{Type: "text", Text: analysisPrompt},
					{Type: "image_url", ImageURL: &openRouterImage{URL: fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)}},
				},
			},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", nil, fmt.Errorf("OpenRouter API error: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", strings.NewReader(string(payload)))
	if err != nil {
		return "", nil, fmt.Errorf("OpenRouter API error: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+a.openRouterAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", nil, fmt.Errorf("OpenRouter API error: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, fmt.Errorf("OpenRouter API error: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", nil, fmt.Errorf("OpenRouter API error: OpenRouter error %d: %s", resp.StatusCode, string(respBytes))
	}

	var parsed openRouterResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return "", nil, fmt.Errorf("OpenRouter API error: %w", err)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return "", nil, fmt.Errorf("OpenRouter API error: OpenRouter response missing message content.")
	}

	return stringifyParsedResponse(parsed.Choices[0].Message.Content), parsed.Usage, nil
}

// stringifyParsedResponse mirrors bill-processor/src/index.js's
// extractJsonString + stringifyParsedResponse: strip an optional fenced
// ```json ... ``` block, parse it, and re-marshal it minified. On parse
// failure, return a {raw_response, error} object instead of erroring.
func stringifyParsedResponse(responseText string) string {
	jsonText := responseText
	if m := fencedJSONPattern.FindStringSubmatch(responseText); m != nil {
		jsonText = m[1]
	}

	var parsed any
	if err := json.Unmarshal([]byte(jsonText), &parsed); err != nil {
		fallback, _ := json.Marshal(map[string]string{
			"raw_response": responseText,
			"error":        "Could not parse JSON from response",
		})
		return string(fallback)
	}

	reencoded, err := json.Marshal(parsed)
	if err != nil {
		fallback, _ := json.Marshal(map[string]string{
			"raw_response": responseText,
			"error":        "Could not parse JSON from response",
		})
		return string(fallback)
	}
	return string(reencoded)
}
