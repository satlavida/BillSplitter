// Talks to the Go server's GET /api/exchange-rate (see
// server/internal/api/exchangerate_handlers.go) — a stateless, non-session-
// scoped endpoint, so it's kept separate from liveApi.ts (whose exports are
// all session/live-session-shaped). Used by BillSettingsModal.tsx to fetch
// a historical rate for a bill's transaction date when the bill's currency
// differs from its session's — see architecture/currency.md.
import { LIVE_SERVER_URL } from './liveApi';
import { friendlyErrorMessage } from './errorMessages';

export class ExchangeRateApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ExchangeRateApiError';
  }
}

export interface ExchangeRateResult {
  date: string;
  base: string;
  quote: string;
  rate: number;
  cached: boolean;
}

// Fetches the rate to convert 1 unit of base into quote, as of date
// ("YYYY-MM-DD"). Throws ExchangeRateApiError on any failure (invalid
// params, the Go server unreachable, or the upstream provider failing) —
// callers (BillSettingsModal) should catch this and fall back to manual
// entry, mirroring receiptScan.ts's offline handling.
export const getExchangeRate = async (base: string, quote: string, date: string): Promise<ExchangeRateResult> => {
  const params = new URLSearchParams({ base, quote, date });
  let res: Response;
  try {
    res = await fetch(`${LIVE_SERVER_URL}/api/exchange-rate?${params.toString()}`);
  } catch {
    throw new ExchangeRateApiError('Could not reach the live server.', 0);
  }

  if (!res.ok) {
    let rawMessage = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) rawMessage = body.error;
    } catch {
      // ignore — use the generic message
    }
    throw new ExchangeRateApiError(friendlyErrorMessage(rawMessage), res.status);
  }

  return res.json();
};
