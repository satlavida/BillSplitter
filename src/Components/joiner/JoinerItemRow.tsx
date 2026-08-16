import { useEffect, useState } from 'react';
import { claimItem, unclaimItem, LiveApiError } from '../../lib/liveApi';
import { Button } from '../../ui/components';
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

// One item row in a joiner's bill view. Non-fraction items get a plain
// claim/unclaim toggle; fraction items get a +/- stepper on this joiner's
// own share only — never anyone else's.
const JoinerItemRow = ({ code, billId, item, currency, myPersonId, joinerToken, nameFor, disabled, onChanged }: JoinerItemRowProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // In claims_require_approval mode, a claim doesn't show up in
  // item.consumedBy until the creator approves it (see ClaimItem's doc
  // comment), so this joiner's own pending submission is tracked locally to
  // avoid a double-submit and to surface "awaiting approval". Cleared once
  // myValue reflects an approved allocation.
  const [pendingSelf, setPendingSelf] = useState(false);

  const myValue = item.consumedBy.find((c) => c.personId === myPersonId)?.value ?? 0;
  const claimedByMe = myValue > 0;

  useEffect(() => {
    if (myValue > 0) setPendingSelf(false);
  }, [myValue]);

  const claimedLine =
    item.consumedBy.length > 0 ? `Claimed by ${item.consumedBy.map((c) => `${nameFor(c.personId)}${item.splitType === 'fraction' ? ` (${c.value})` : ''}`).join(', ')}` : null;

  const runClaim = async (value: number) => {
    setBusy(true);
    setError(null);
    try {
      const result = await claimItem(code, billId, item.id, myPersonId, value, joinerToken);
      if (result.status === 'pending') setPendingSelf(true);
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
      setPendingSelf(false);
      onChanged();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to unclaim item');
    } finally {
      setBusy(false);
    }
  };

  const controlsDisabled = disabled || busy || pendingSelf;

  return (
    <li className="flex justify-between items-center gap-2">
      <div className="min-w-0">
        <span className="text-zinc-800 dark:text-white transition-colors">{item.name}</span>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
          {currency} {item.price.toFixed(2)}
        </span>
        {claimedLine && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{claimedLine}</span>}
        {pendingSelf && <span className="block text-xs text-amber-600 dark:text-amber-400">Awaiting host approval…</span>}
        {error && <span className="block text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {item.splitType === 'fraction' ? (
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" disabled={controlsDisabled || myValue <= 0} onClick={() => (myValue <= 1 ? runUnclaim() : runClaim(myValue - 1))}>
            −
          </Button>
          <span className="w-6 text-center text-sm text-zinc-800 dark:text-white">{myValue}</span>
          <Button size="sm" variant="secondary" disabled={controlsDisabled} onClick={() => runClaim(myValue + 1)}>
            +
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant={claimedByMe ? 'secondary' : 'primary'}
          disabled={controlsDisabled}
          onClick={() => (claimedByMe ? runUnclaim() : runClaim(1))}
        >
          {pendingSelf ? 'Pending' : busy ? '…' : claimedByMe ? 'Unclaim' : 'Claim'}
        </Button>
      )}
    </li>
  );
};

export default JoinerItemRow;
