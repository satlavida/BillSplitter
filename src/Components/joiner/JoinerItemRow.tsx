import { useState } from 'react';
import { claimItem, unclaimItem, LiveApiError } from '../../lib/liveApi';
import { Button } from '../../ui/components';
import ClaimQuantityModal from './ClaimQuantityModal';
import type { LiveItem } from '../../schemas/live.schema';

interface JoinerItemRowProps {
  code: string;
  billId: string;
  item: LiveItem;
  currency: string;
  myPersonId: string;
  joinerToken: string;
  nameFor: (personId: string) => string;
  disabled: boolean;
  onChanged: () => void;
}

// One item row in a joiner's bill view. Equal-split items get a plain
// claim/unclaim toggle; Quantity Split items open a number-grid modal to
// pick how many of the item's units this joiner is claiming — own share
// only, never anyone else's. A claim takes effect immediately (req 6 — no
// approval queue), so there's no pending/awaiting-approval state.
const JoinerItemRow = ({ code, billId, item, currency, myPersonId, joinerToken, nameFor, disabled, onChanged }: JoinerItemRowProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantityModalOpen, setQuantityModalOpen] = useState(false);

  const myValue = item.consumedBy.find((c) => c.personId === myPersonId)?.value ?? 0;
  const claimedByMe = myValue > 0;

  const claimedLine =
    item.consumedBy.length > 0 ? `Claimed by ${item.consumedBy.map((c) => `${nameFor(c.personId)}${item.splitType === 'fraction' ? ` (${c.value})` : ''}`).join(', ')}` : null;

  const runClaim = async (value: number) => {
    setBusy(true);
    setError(null);
    try {
      await claimItem(code, billId, item.id, myPersonId, value, joinerToken);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to update claim');
    } finally {
      setBusy(false);
    }
  };

  const runUnclaim = async () => {
    setBusy(true);
    setError(null);
    try {
      await unclaimItem(code, billId, item.id, myPersonId, joinerToken);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to unclaim item');
    } finally {
      setBusy(false);
    }
  };

  const controlsDisabled = disabled || busy;

  return (
    <li className="flex justify-between items-center gap-2">
      <div className="min-w-0">
        <span className="text-zinc-800 dark:text-white transition-colors">{item.name}</span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          {currency} {item.price.toFixed(2)}
        </span>
        {claimedLine && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{claimedLine}</span>}
        {error && <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {item.splitType === 'fraction' ? (
        <>
          <Button size="sm" variant={claimedByMe ? 'secondary' : 'primary'} disabled={controlsDisabled} onClick={() => setQuantityModalOpen(true)}>
            {busy ? '…' : claimedByMe ? `Claimed ${myValue}` : 'Claim'}
          </Button>
          <ClaimQuantityModal
            isOpen={quantityModalOpen}
            onClose={() => setQuantityModalOpen(false)}
            itemName={item.name}
            quantity={Math.max(1, Math.floor(item.quantity))}
            selected={myValue}
            busy={busy}
            onSelect={(value) => {
              setQuantityModalOpen(false);
              runClaim(value);
            }}
            onUnclaim={() => {
              setQuantityModalOpen(false);
              runUnclaim();
            }}
          />
        </>
      ) : (
        <Button
          size="sm"
          variant={claimedByMe ? 'secondary' : 'primary'}
          disabled={controlsDisabled}
          onClick={() => (claimedByMe ? runUnclaim() : runClaim(1))}
        >
          {busy ? '…' : claimedByMe ? 'Unclaim' : 'Claim'}
        </Button>
      )}
    </li>
  );
};

export default JoinerItemRow;
