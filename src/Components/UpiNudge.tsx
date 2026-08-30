import { useState } from 'react';
import { Alert, Button } from '../ui/components';

interface UpiNudgeProps {
  // Whether this person is currently owed money in the session's settlement
  // — the nudge only shows then, since that's when someone actually needs
  // to know where to pay them (see architecture/payments.md).
  owedMoney: boolean;
  myPersonUpiId: string;
  onSave: (upiId: string) => Promise<void>;
  testId?: string;
}

// Shared "you're owed money — add your UPI ID" nudge, extracted from what
// used to be joiner-only (JoinerUpiNudge.tsx) so the session creator gets
// the same prompt when they're the one owed money — see
// architecture/payments.md. Self-hiding: renders nothing until owedMoney is
// true and myPersonUpiId is still unset, so callers don't need their own
// conditional around it.
const UpiNudge = ({ owedMoney, myPersonUpiId, onSave, testId = 'upi-nudge' }: UpiNudgeProps) => {
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!owedMoney || myPersonUpiId) return null;

  const handleSave = async () => {
    const trimmed = upiId.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save your UPI ID');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Alert type="warning" className="mb-4" data-testid={testId}>
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

export default UpiNudge;
