import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../ui/components';
import ImageLightbox from '../ImageLightbox';
import { LIVE_SERVER_URL } from '../../lib/liveApi';
import { hasBillBeenVisited } from '../../lib/joinerVisitTracking';
import { getMyUnclaimedItemCount } from '../../lib/joinerUnclaimedItems';
import type { LiveBill } from '../../schemas/live.schema';

interface JoinerBillListProps {
  code: string;
  bills: LiveBill[];
  myPersonId: string;
}

// Req 4: clicking a bill takes a joiner to its own step-wise wizard
// (JoinerBillEditorPage, mirroring the creator's BillEditorPage) rather
// than expanding it inline here — this list is now just a picker, like
// SessionHomePage's bill list is for the creator.
const JoinerBillList = ({ code, bills, myPersonId }: JoinerBillListProps) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (bills.length === 0) {
    return <p className="text-zinc-500 dark:text-zinc-400">No bills yet.</p>;
  }

  const openLightbox = (e: MouseEvent, src: string) => {
    // Clicking the thumbnail shouldn't also follow the card's Link into the
    // bill wizard.
    e.preventDefault();
    e.stopPropagation();
    setLightboxSrc(src);
  };

  return (
    <>
      <ul className="space-y-2">
        {bills.map((bill) => {
          const imageSrc = bill.imageRefKey ? `${LIVE_SERVER_URL}/api/images/${bill.imageRefKey}` : null;
          // The joiner-side "Things to Take Care of" signal: an unvisited
          // badge is cheap (localStorage-only); once visited, a lighter
          // "N still unclaimed" note based on this joiner's own claims —
          // see architecture/live-collaboration.md.
          const unvisited = !hasBillBeenVisited(code, bill.id);
          const myUnclaimedCount = getMyUnclaimedItemCount(bill, myPersonId);
          return (
            <li key={bill.id}>
              <Link to={`/join/${code}/bills/${bill.id}/step/1`}>
                <Card className="mb-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-medium text-zinc-800 dark:text-white transition-colors">{bill.title}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {unvisited && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          New
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {bill.items.length} item{bill.items.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>
                  {!unvisited && myUnclaimedCount > 0 && (
                    <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {myUnclaimedCount} item{myUnclaimedCount === 1 ? '' : 's'} still unclaimed for you
                    </span>
                  )}
                  {imageSrc && (
                    <img
                      src={imageSrc}
                      alt="Receipt"
                      className="mt-2 max-h-24 rounded border border-zinc-200 dark:border-zinc-700 cursor-zoom-in"
                      onClick={(e) => openLightbox(e, imageSrc)}
                    />
                  )}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
      <ImageLightbox isOpen={lightboxSrc !== null} onClose={() => setLightboxSrc(null)} src={lightboxSrc ?? ''} alt="Receipt" />
    </>
  );
};

export default JoinerBillList;
