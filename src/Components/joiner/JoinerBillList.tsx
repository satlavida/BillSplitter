import { Card } from '../../ui/components';
import { LIVE_SERVER_URL } from '../../lib/liveApi';
import type { LiveEvent } from '../../lib/liveSync';
import AddItemForm from './AddItemForm';
import JoinerItemRow from './JoinerItemRow';
import type { LiveBill } from '../../schemas/live.schema';

interface JoinerBillListProps {
  code: string;
  bills: LiveBill[];
  myPersonId: string;
  joinerToken: string;
  nameFor: (personId: string) => string;
  disabled: boolean;
  onChanged: () => void;
  lastEvent: LiveEvent | null;
}

const JoinerBillList = ({ code, bills, myPersonId, joinerToken, nameFor, disabled, onChanged, lastEvent }: JoinerBillListProps) => {
  if (bills.length === 0) {
    return <p className="text-zinc-500 dark:text-zinc-400">No bills yet.</p>;
  }

  return (
    <>
      {bills.map((bill) => (
        <Card key={bill.id} className="mb-3">
          <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">{bill.title}</h3>
          {bill.imageRefKey && (
            <img
              src={`${LIVE_SERVER_URL}/api/images/${bill.imageRefKey}`}
              alt="Receipt"
              className="mb-3 max-h-48 rounded border border-zinc-200 dark:border-zinc-700"
            />
          )}
          {bill.items.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">No items yet.</p>
          ) : (
            <ul className="space-y-2 mb-2">
              {bill.items.map((item) => (
                <JoinerItemRow
                  key={item.id}
                  code={code}
                  billId={bill.id}
                  item={item}
                  currency={bill.currency}
                  myPersonId={myPersonId}
                  joinerToken={joinerToken}
                  nameFor={nameFor}
                  disabled={disabled}
                  onChanged={onChanged}
                  lastEvent={lastEvent}
                />
              ))}
            </ul>
          )}
          <AddItemForm code={code} billId={bill.id} joinerToken={joinerToken} disabled={disabled} onAdded={onChanged} />
        </Card>
      ))}
    </>
  );
};

export default JoinerBillList;
