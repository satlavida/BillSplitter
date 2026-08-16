import { Link } from 'react-router-dom';
import { Card } from '../../ui/components';
import { LIVE_SERVER_URL } from '../../lib/liveApi';
import type { LiveBill } from '../../schemas/live.schema';

interface JoinerBillListProps {
  code: string;
  bills: LiveBill[];
}

// Req 4: clicking a bill takes a joiner to its own step-wise wizard
// (JoinerBillEditorPage, mirroring the creator's BillEditorPage) rather
// than expanding it inline here — this list is now just a picker, like
// SessionHomePage's bill list is for the creator.
const JoinerBillList = ({ code, bills }: JoinerBillListProps) => {
  if (bills.length === 0) {
    return <p className="text-zinc-500 dark:text-zinc-400">No bills yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {bills.map((bill) => (
        <li key={bill.id}>
          <Link to={`/join/${code}/bills/${bill.id}/step/1`}>
            <Card className="mb-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700">
              <div className="flex justify-between items-center">
                <span className="font-medium text-zinc-800 dark:text-white transition-colors">{bill.title}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {bill.items.length} item{bill.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              {bill.imageRefKey && (
                <img
                  src={`${LIVE_SERVER_URL}/api/images/${bill.imageRefKey}`}
                  alt="Receipt"
                  className="mt-2 max-h-24 rounded border border-zinc-200 dark:border-zinc-700"
                />
              )}
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default JoinerBillList;
