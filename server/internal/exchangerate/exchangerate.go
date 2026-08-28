// Package exchangerate fetches historical foreign-exchange rates from
// Frankfurter (frankfurter.dev — free, no API key, ECB-sourced, historical
// data back to 1999). This package only talks to the external API; the
// server-side cache (a permanent store of already-fetched rates, since
// historical rates never change) lives in internal/store
// (GetExchangeRate/UpsertExchangeRate) and is populated by the caller of
// FetchRate, not by this package.
package exchangerate

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// defaultBaseURL is Frankfurter's historical-rate endpoint base. Confirmed
// live: GET {defaultBaseURL}/2024-01-15?base=USD&symbols=EUR returns
// {"amount":1.0,"base":"USD","date":"2024-01-15","rates":{"EUR":0.91366}}.
const defaultBaseURL = "https://api.frankfurter.dev/v1"

type Client struct {
	baseURL    string
	httpClient *http.Client
}

// New returns a Client. An empty baseURL uses Frankfurter's default —
// callers should pass through config.Config.ExchangeRateAPIBaseURL as-is
// (including when empty) rather than duplicating the default URL elsewhere.
func New(baseURL string) *Client {
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type frankfurterResponse struct {
	Amount float64            `json:"amount"`
	Base   string             `json:"base"`
	Date   string             `json:"date"`
	Rates  map[string]float64 `json:"rates"`
}

// FetchRate returns the rate to convert 1 unit of base into quote, as of
// date (format "2006-01-02"). base == quote short-circuits to 1.0 without an
// HTTP call, since Frankfurter's behavior for symbols == base is undefined.
func (c *Client) FetchRate(ctx context.Context, date, base, quote string) (float64, error) {
	if base == quote {
		return 1.0, nil
	}

	reqURL := fmt.Sprintf("%s/%s?%s", c.baseURL, url.PathEscape(date), url.Values{
		"base":    {base},
		"symbols": {quote},
	}.Encode())

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, fmt.Errorf("build exchange rate request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return 0, fmt.Errorf("fetch exchange rate: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("read exchange rate response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("exchange rate API returned %d: %s", resp.StatusCode, string(body))
	}

	var parsed frankfurterResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, fmt.Errorf("parse exchange rate response: %w", err)
	}

	rate, ok := parsed.Rates[quote]
	if !ok {
		return 0, fmt.Errorf("exchange rate response missing rate for %s: %s", quote, string(body))
	}

	return rate, nil
}
