import { Link } from 'react-router-dom';
import { Alert } from '../ui/components';
import { getUnclaimedItemCount } from '../lib/unclaimedItems';
import type { Session } from '../schemas/session.schema';

interface ThingsToTakeCareOfProps {
  session: Session;
}

// A gentle, consolidated nudge above the bill list: which bills still have
// items that aren't fully claimed. Complements (doesn't replace) the
// per-bill-card "Unclaimed items" pill already shown below — this section
// is the actionable top-to-bottom list, the pill is a fast per-card scan.
// Renders nothing when everything's already claimed, to avoid clutter in
// the common clean case.
const ThingsToTakeCareOf = ({ session }: ThingsToTakeCareOfProps) => {
  const flagged = session.bills
    .map((bill) => ({ bill, count: getUnclaimedItemCount(bill) }))
    .filter(({ count }) => count > 0);

  if (flagged.length === 0) return null;

  return (
    <Alert type="warning" className="mb-4" data-testid="things-to-take-care-of">
      <h3 className="font-medium mb-2">Things to Take Care of</h3>
      <ul className="space-y-1">
        {flagged.map(({ bill, count }) => (
          <li key={bill.id} className="text-sm">
            <Link to={`/session/${session.id}/bill/${bill.id}`} className="hover:underline">
              {bill.title}
            </Link>
            {' — '}
            {count} item{count === 1 ? '' : 's'} still need{count === 1 ? 's' : ''} claiming
          </li>
        ))}
      </ul>
    </Alert>
  );
};

export default ThingsToTakeCareOf;
