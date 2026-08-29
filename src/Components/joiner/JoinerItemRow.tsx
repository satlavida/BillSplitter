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

  // The highest value I'm allowed to hold on this item: the quantity minus
  // whatever everyone else already holds. This already accounts for my own
  // current claim (it's not subtracted out), so it's the cap directly, not
  // an amount to add my own value to — mirrors the server-side cap in
  // bill_handlers.go's ClaimItem.
  const othersClaimed = item.consumedBy.filter((c) => c.personId !== myPersonId).reduce((sum, c) => sum + c.value, 0);
  const maxSelectable = Math.max(0, item.quantity - othersClaimed);

  // Kept in sync with billStore.getDiscountedItemPrice / personTotals.ts's
  // copy of the same formula — duplicated rather than imported since
  // LiveItem's discountType is a plain string, not the narrower literal
  // union those helpers are typed against.
  const unitPrice = item.discountType === 'percentage' ? item.price - (item.price * item.discount) / 100 : item.price - item.discount;

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
    <li className="flex justify-between items-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 transition-colors">
      <div className="min-w-0">
        <span className="text-lg font-medium text-zinc-800 dark:text-white transition-colors">{item.name}</span>
        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
          {currency} {unitPrice.toFixed(2)}
          {item.quantity > 1 && (
            <>
              {' '}
              × {item.quantity} : {currency} {(unitPrice * item.quantity).toFixed(2)}
            </>
          )}
        </span>
        {claimedLine && <span className="block text-sm text-zinc-600 dark:text-zinc-400">{claimedLine}</span>}
        {error && <span className="block text-sm text-red-600 dark:text-red-400">{error}</span>}
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
            max={Math.max(1, Math.floor(maxSelectable))}
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
