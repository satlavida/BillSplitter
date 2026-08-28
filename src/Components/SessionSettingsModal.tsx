import { useMemo } from 'react';
import { Modal, SearchSelect } from '../ui/components';
import { getCurrencyOptions } from '../lib/currencyDisplay';
import type { Session } from '../schemas/session.schema';

interface SessionSettingsModalProps {
  session: Session;
  isOpen: boolean;
  onClose: () => void;
  onCurrencyChange: (currency: string) => void;
}

// Session Settings — opened via the gear icon top-right of SessionHomePage.
// Lets the user change the session's base currency (settlement/balances and,
// by default, joiners always render in this currency — see
// architecture/currency.md) and shows a read-only table of every bill whose
// currency differs from the session's, with the rate currently in effect for
// each (fetched or overridden — see Bill Settings). This table is entirely
// client-computed from data already on each Bill; no new fetch happens here.
const SessionSettingsModal = ({ session, isOpen, onClose, onCurrencyChange }: SessionSettingsModalProps) => {
  const currencyOptions = useMemo(() => getCurrencyOptions(), []);

  const mismatchedBills = session.bills.filter((bill) => bill.currency !== session.currency);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Session Settings" className="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Session currency</label>
          <SearchSelect
            value={session.currency}
            onChange={onCurrencyChange}
            searchPlaceholder="Search currency..."
            options={currencyOptions.map(({ code, symbol }) => ({ value: code, label: `${code} (${symbol})` }))}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Settlement and balances are always shown in this currency. Bills in a different currency are converted using their own exchange rate.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Exchange rates in use</h3>
          {mismatchedBills.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">All bills in this session use {session.currency}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-1 pr-3 font-medium">Bill</th>
                    <th className="py-1 pr-3 font-medium">Date</th>
                    <th className="py-1 pr-3 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatchedBills.map((bill) => (
                    <tr key={bill.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <td className="py-1.5 pr-3 text-zinc-800 dark:text-white">{bill.title}</td>
                      <td className="py-1.5 pr-3 text-zinc-600 dark:text-zinc-300">{bill.exchangeRateDate ?? '—'}</td>
                      <td className="py-1.5 pr-3 text-zinc-600 dark:text-zinc-300">
                        {bill.exchangeRate === null
                          ? 'Not set'
                          : `1 ${bill.currency} = ${bill.exchangeRate} ${session.currency}${bill.exchangeRateIsOverride ? ' (override)' : ''}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SessionSettingsModal;
