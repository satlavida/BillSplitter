import { updateLivePerson, LiveApiError } from '../../lib/liveApi';
import UpiNudge from '../UpiNudge';
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
// setting their own UPI ID. Thin wrapper around the shared UpiNudge
// (src/Components/UpiNudge.tsx) — this file supplies the joiner-specific
// "am I owed money" check and the live-server save call.
const JoinerUpiNudge = ({ code, myPersonId, myPersonUpiId, joinerToken, settlement, onSaved }: JoinerUpiNudgeProps) => {
  const myBalance = settlement?.balances.find((b) => b.personId === myPersonId);
  const owedMoney = (myBalance?.amount ?? 0) > 0.005;

  const handleSave = async (upiId: string) => {
    try {
      await updateLivePerson(code, myPersonId, { upiId }, joinerToken);
      onSaved();
    } catch (err) {
      throw new Error(err instanceof LiveApiError ? err.message : 'Failed to save your UPI ID');
    }
  };

  return <UpiNudge owedMoney={owedMoney} myPersonUpiId={myPersonUpiId} onSave={handleSave} testId="joiner-upi-nudge" />;
};

export default JoinerUpiNudge;
