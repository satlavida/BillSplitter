import { useState } from 'react';
import { Alert, Button } from '../../ui/components';
import { updateLivePerson, LiveApiError } from '../../lib/liveApi';
import type { LiveSettlement } from '../../schemas/live.schema';

interface JoinerUpiNudgeProps {
  code: string;
  myPersonId: string;
  myPersonUpiId: string;
  joinerToken: string;
  settlement: LiveSettlement | null;
  onSaved: () => void;
}

// The joiner-side UPI-ID entry point (Phase F) — not at session-join or
// per-bill-visit, but a "Things to Take Care of" nudge shown when this
// joiner is owed money (someone needs to know where to pay them) and they
// haven't set a UPI ID yet. This is the joiner's only touchpoint for
// setting their own UPI ID.
const JoinerUpiNudge = ({ code, myPersonId, myPersonUpiId, joinerToken, settlement, onSaved }: JoinerUpiNudgeProps) => {
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myBalance = settlement?.balances.find((b) => b.personId === myPersonId);
  const owedMoney = (myBalance?.amount ?? 0) > 0.005;

  if (!owedMoney || myPersonUpiId) return null;

  const handleSave = async () => {
    const trimmed = upiId.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await updateLivePerson(code, myPersonId, { upiId: trimmed }, joinerToken);
      onSaved();
    } catch (err) {
      setError(err instanceof LiveApiError ? err.message : 'Failed to save your UPI ID');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Alert type="warning" className="mb-4" data-testid="joiner-upi-nudge">
      <p className="text-sm mb-2">You're owed money — add your UPI ID so people know where to pay you.</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input
          type="text"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          placeholder="name@bank"
          className="flex-1 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
        />
        <Button size="sm" onClick={() => void handleSave()} disabled={saving || !upiId.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Alert>
  );
};

export default JoinerUpiNudge;
