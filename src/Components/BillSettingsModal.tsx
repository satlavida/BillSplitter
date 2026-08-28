import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import useBillStore from '../billStore';
import { Modal, Input, SearchSelect, Spinner, Alert } from '../ui/components';
import { getCurrencyOptions } from '../lib/currencyDisplay';
import { getExchangeRate } from '../lib/exchangeRateApi';

interface BillSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCurrency: string;
  // The bill's own transaction date (session.schema.ts's Bill.date) — the
  // date picker below defaults to this, but billStore doesn't track `date`
  // itself (the wizard never edits it), so it's passed in as a prop rather
  // than read from billStore.
  billDate: string;
}

// Bill Settings — opened via the gear icon top-right of BillEditorPage.
// Lets the user pick this bill's own currency; when it differs from the
// session's, a transaction date + fetched/overridable exchange rate is
// required (see architecture/currency.md). Writes go to billStore, which
// BillEditorPage's commit-back subscription persists to sessionStore.
const BillSettingsModal = ({ isOpen, onClose, sessionCurrency, billDate }: BillSettingsModalProps) => {
  const { currency, exchangeRate, exchangeRateDate, exchangeRateIsOverride, setCurrency, setExchangeRateInfo } = useBillStore(
    useShallow((s) => ({
      currency: s.currency,
      exchangeRate: s.exchangeRate,
      exchangeRateDate: s.exchangeRateDate,
      exchangeRateIsOverride: s.exchangeRateIsOverride,
      setCurrency: s.setCurrency,
      setExchangeRateInfo: s.setExchangeRateInfo,
    }))
  );

  const currencyOptions = useMemo(() => getCurrencyOptions(), []);

  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedRate, setFetchedRate] = useState<number | null>(null);

  const needsRate = currency !== sessionCurrency;
  const effectiveDate = exchangeRateDate ?? billDate.slice(0, 10);

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === sessionCurrency) {
      // Matches session currency again — the implicit rate is 1:1, nothing
      // to store.
      setExchangeRateInfo({ exchangeRate: null, exchangeRateDate: null, exchangeRateIsOverride: false });
      setFetchedRate(null);
      setFetchError(null);
    }
  };

  const fetchRateFor = async (date: string, base: string) => {
    setFetching(true);
    setFetchError(null);
    try {
      const result = await getExchangeRate(base, sessionCurrency, date);
      setFetchedRate(result.rate);
      setExchangeRateInfo({ exchangeRate: result.rate, exchangeRateDate: date, exchangeRateIsOverride: false });
    } catch {
      setFetchError("Couldn't fetch a rate — enter one manually.");
    } finally {
      setFetching(false);
    }
  };

  const handleDateChange = (date: string) => {
    if (date) void fetchRateFor(date, currency);
  };

  const handleRateOverride = (value: string) => {
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || parsed <= 0) {
      setExchangeRateInfo({ exchangeRate: null, exchangeRateDate: effectiveDate, exchangeRateIsOverride: true });
      return;
    }
    const isOverride = fetchedRate === null || parsed !== fetchedRate;
    setExchangeRateInfo({ exchangeRate: parsed, exchangeRateDate: effectiveDate, exchangeRateIsOverride: isOverride });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bill Settings">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Bill currency</label>
          <SearchSelect
            value={currency}
            onChange={handleCurrencyChange}
            searchPlaceholder="Search currency..."
            options={currencyOptions.map(({ code, symbol }) => ({ value: code, label: `${code} (${symbol})` }))}
          />
        </div>

        {needsRate && (
          <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
            <Input
              type="date"
              label="Transaction date"
              value={effectiveDate}
              onChange={(e) => handleDateChange(e.target.value)}
              containerClassName="mb-0"
            />

            {fetching && (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Spinner size="sm" />
                Fetching rate…
              </div>
            )}

            {fetchError && <Alert type="warning">{fetchError}</Alert>}

            {!fetching && fetchedRate !== null && !fetchError && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                1 {currency} = {fetchedRate} {sessionCurrency}, as of {effectiveDate}
              </p>
            )}

            <Input
              type="number"
              step="any"
              label="Rate in effect (editable)"
              value={exchangeRate ?? ''}
              onChange={(e) => handleRateOverride(e.target.value)}
              placeholder={`Rate to convert 1 ${currency} to ${sessionCurrency}`}
              containerClassName="mb-0"
            />
            {exchangeRateIsOverride && exchangeRate !== null && <p className="text-xs text-zinc-500 dark:text-zinc-400">Using your own rate, not the fetched one.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BillSettingsModal;
