// Shared currency-display helpers, extracted from Settings.tsx/
// OnboardingModal.tsx (which duplicated this) since the Session Settings
// and Bill Settings panels (see architecture/currency.md) also need a
// currency code list + symbol lookup for their SearchSelect pickers.

export const getCurrencySymbol = (code: string): string => {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
};

export const getCurrencyCodes = (): string[] => {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('currency');
  }
  return ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR'];
};

// Currency code + display symbol, sorted by code — the shape every
// currency SearchSelect in the app renders its options from.
export const getCurrencyOptions = (): { code: string; symbol: string }[] =>
  getCurrencyCodes()
    .map((code) => ({ code, symbol: getCurrencySymbol(code) }))
    .sort((a, b) => a.code.localeCompare(b.code));

// Formats an amount in an explicitly-given currency — same Intl.NumberFormat
// logic as currencyStore.ts's formatCurrency, but parameterized rather than
// reading the user's global preference. Used wherever an amount is tied to
// a specific session/bill's own currency (e.g. SessionSettlementPage always
// rendering in session currency), which should never follow the global
// preference — see architecture/currency.md.
export const formatAmountInCurrency = (amount: number | null | undefined, currencyCode: string): string => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '';
  try {
    return new Intl.NumberFormat(navigator.language || 'en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
};
