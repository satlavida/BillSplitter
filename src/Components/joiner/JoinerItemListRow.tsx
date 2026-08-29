import { useState } from 'react';
import { updateLiveItem, deleteLiveItem, LiveApiError } from '../../lib/liveApi';
import EditLiveItemModal from './EditLiveItemModal';
import type { LiveItem } from '../../schemas/live.schema';

interface JoinerItemListRowProps {
  code: string;
  billId: string;
  item: LiveItem;
  currency: string;
  unitPrice: number;
  myPersonId: string | null;
  joinerToken: string | null;
  disabled: boolean;
  onChanged: () => void;
}

// One item row in a joiner's "What items are you splitting?" step (step 1)
// — mirrors ItemsInput.tsx's ItemListItem (name/price + edit/remove icons)
// for the creator, but writes through the live-item endpoints instead of
// the local billStore. Edit/delete are gated by `disabled` (read-only
// sessions / settled bills), same as AddItemForm's add control.
const JoinerItemListRow = ({ code, billId, item, currency, unitPrice, myPersonId, joinerToken, disabled, onChanged }: JoinerItemListRowProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (data: Parameters<typeof updateLiveItem>[3]) => {
    setBusy(true);
    setError(null);
    try {
      await updateLiveItem(code, billId, item.id, data, myPersonId ?? undefined, joinerToken ?? undefined);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to update item');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove "${item.name}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLiveItem(code, billId, item.id, myPersonId ?? undefined, joinerToken ?? undefined);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to remove item');
      setBusy(false);
    }
  };

  return (
    <li className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600">
      <div className="min-w-0">
        <span className="text-zinc-800 dark:text-white">{item.name}</span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          {currency} {unitPrice.toFixed(2)}
          {item.quantity > 1 && (
            <>
              {' '}
              × {item.quantity} : {currency} {(unitPrice * item.quantity).toFixed(2)}
            </>
          )}
        </span>
        {error && <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
      {!disabled && (
        <div className="flex gap-2 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            disabled={busy}
            aria-label={`Edit ${item.name}`}
            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            aria-label={`Remove ${item.name}`}
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
      <EditLiveItemModal isOpen={editOpen} onClose={() => setEditOpen(false)} item={item} onSave={handleSave} />
    </li>
  );
};

export default JoinerItemListRow;
