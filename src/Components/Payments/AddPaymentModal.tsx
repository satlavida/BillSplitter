import { useEffect, useMemo, useState } from 'react';
import { Modal, Input, SearchSelect, Dropdown, Spinner, Alert, Button } from '../../ui/components';
import { getCurrencyOptions } from '../../lib/currencyDisplay';
import { getExchangeRate } from '../../lib/exchangeRateApi';
import type { Person, PaymentMethod } from '../../schemas/bill.schema';

export interface AddPaymentInput {
  payerId: string;
  payeeId: string;
  amount: number;
  currency: string;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  exchangeRateIsOverride: boolean;
  method: PaymentMethod;
  transactionId: string | null;
}

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  sessionCurrency: string;
  defaultPayerId?: string;
  defaultPayeeId?: string;
  defaultAmount?: number;
  onSubmit: (input: AddPaymentInput) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

// Log a payment — payer/payee, amount, an optional different currency
// (mirroring BillSettingsModal's fetch/override exchange-rate pattern,
// defaulting to today's date and today's rate), method, and an optional
// transaction id for online payments. See architecture/payments.md.
const AddPaymentModal = ({ isOpen, onClose, people, sessionCurrency, defaultPayerId, defaultPayeeId, defaultAmount, onSubmit }: AddPaymentModalProps) => {
  const currencyOptions = useMemo(() => getCurrencyOptions(), []);

  const [payerId, setPayerId] = useState('');
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(sessionCurrency);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [transactionId, setTransactionId] = useState('');

  const [exchangeRateDate, setExchangeRateDate] = useState(todayISO());
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateIsOverride, setExchangeRateIsOverride] = useState(false);
  const [fetchedRate, setFetchedRate] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPayerId(defaultPayerId ?? '');
    setPayeeId(defaultPayeeId ?? '');
    setAmount(defaultAmount ? String(defaultAmount) : '');
    setCurrency(sessionCurrency);
    setMethod('cash');
    setTransactionId('');
    setExchangeRateDate(todayISO());
    setExchangeRate(null);
    setExchangeRateIsOverride(false);
    setFetchedRate(null);
    setFetchError(null);
    // Only reset when the modal actually opens — not on every prop change
    // while it's already open, which would clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const needsRate = currency !== sessionCurrency;

  const fetchRateFor = async (date: string, base: string) => {
    setFetching(true);
    setFetchError(null);
    try {
      const result = await getExchangeRate(base, sessionCurrency, date);
      setFetchedRate(result.rate);
      setExchangeRate(result.rate);
      setExchangeRateIsOverride(false);
    } catch {
      setFetchError("Couldn't fetch a rate — enter one manually.");
    } finally {
      setFetching(false);
    }
  };

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === sessionCurrency) {
      setExchangeRate(null);
      setExchangeRateIsOverride(false);
      setFetchedRate(null);
      setFetchError(null);
    } else {
      void fetchRateFor(exchangeRateDate, newCurrency);
    }
  };

  const handleDateChange = (date: string) => {
    setExchangeRateDate(date);
    if (date) void fetchRateFor(date, currency);
  };

  const handleRateOverride = (value: string) => {
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || parsed <= 0) {
      setExchangeRate(null);
      setExchangeRateIsOverride(true);
      return;
    }
    setExchangeRate(parsed);
    setExchangeRateIsOverride(fetchedRate === null || parsed !== fetchedRate);
  };

  const parsedAmount = Number(amount);
  const isValid = payerId && payeeId && payerId !== payeeId && parsedAmount > 0 && (!needsRate || exchangeRate !== null);

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      payerId,
      payeeId,
      amount: parsedAmount,
      currency,
      exchangeRate: needsRate ? exchangeRate : null,
      exchangeRateDate: needsRate ? exchangeRateDate : null,
      exchangeRateIsOverride: needsRate && exchangeRateIsOverride,
      method,
      transactionId: method === 'online' && transactionId.trim() ? transactionId.trim() : null,
    });
    onClose();
  };

  const peopleOptions = people.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log a Payment">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Who paid?</label>
          <SearchSelect value={payerId} onChange={setPayerId} placeholder="Select payer" searchPlaceholder="Search people..." options={peopleOptions} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Who was paid?</label>
          <SearchSelect value={payeeId} onChange={setPayeeId} placeholder="Select payee" searchPlaceholder="Search people..." options={peopleOptions} />
        </div>
        {payerId && payeeId && payerId === payeeId && <p className="text-xs text-red-600 dark:text-red-400">Payer and payee must be different people.</p>}

        <Input type="number" step="any" min="0" label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} containerClassName="mb-0" />

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Currency</label>
          <SearchSelect
            value={currency}
            onChange={handleCurrencyChange}
            searchPlaceholder="Search currency..."
            options={currencyOptions.map(({ code, symbol }) => ({ value: code, label: `${code} (${symbol})` }))}
          />
        </div>

        {needsRate && (
          <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
            <Input type="date" label="Transaction date" value={exchangeRateDate} onChange={(e) => handleDateChange(e.target.value)} containerClassName="mb-0" />

            {fetching && (
              <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <Spinner size="sm" />
                Fetching rate…
              </div>
            )}
            {fetchError && <Alert type="warning">{fetchError}</Alert>}
            {!fetching && fetchedRate !== null && !fetchError && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                1 {currency} = {fetchedRate} {sessionCurrency}, as of {exchangeRateDate}
              </p>
            )}

            <Input
              type="number"
              step="any"
              label="Rate in effect (editable) — confirm this is right"
              value={exchangeRate ?? ''}
              onChange={(e) => handleRateOverride(e.target.value)}
              placeholder={`Rate to convert 1 ${currency} to ${sessionCurrency}`}
              containerClassName="mb-0"
            />
            {exchangeRateIsOverride && exchangeRate !== null && <p className="text-xs text-zinc-500 dark:text-zinc-400">Using your own rate, not the fetched one.</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Payment method</label>
          <Dropdown
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'online', label: 'Online' },
            ]}
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          />
        </div>

        {method === 'online' && (
          <Input
            label="Transaction ID (optional)"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            containerClassName="mb-0"
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Log Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddPaymentModal;
