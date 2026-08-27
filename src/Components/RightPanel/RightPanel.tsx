import { useShallow } from 'zustand/shallow';
import useSessionStore from '../../sessionStore';
import { usePeoplePresence } from '../PeopleSection';
import { PresenceDot } from '../PeopleListShared';
import ActivityFeedMini from '../ActivityFeedMini';
import { Card } from '../../ui/components';

interface RightPanelProps {
  className?: string;
}

// Desktop/tablet right column (and, via the `className` override, the
// mobile slide-in panel — see Sidebar/index.ts's toggle pattern) showing
// the current live session's people (read-only — PeopleSection.tsx already
// owns add/edit/remove, duplicating that here would double up on
// interactive controls the existing e2e suite locates by placeholder/role)
// and a short recent-activity feed. Renders nothing outside a live
// session — there's no meaningful "live people"/"activity" to show
// otherwise.
const RightPanel = ({ className = '' }: RightPanelProps) => {
  const session = useSessionStore(useShallow((s) => s.sessions.find((sess) => sess.id === s.currentSessionId)));
  const { presenceFor } = usePeoplePresence(session?.isLive ? (session.liveCode ?? null) : null, session?.liveCreatorToken ?? null);

  if (!session || !session.isLive) return null;

  return (
    <aside className={className}>
      <Card className="mb-4">
        <h3 className="font-medium mb-2 text-zinc-800 dark:text-white transition-colors">People</h3>
        {session.people.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No one yet.</p>
        ) : (
          <ul className="space-y-1" data-testid="right-panel-people-list">
            {session.people.map((person) => (
              <li key={person.id} className="text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <PresenceDot status={presenceFor(person.id)} />
                {person.name}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ActivityFeedMini />
    </aside>
  );
};

export default RightPanel;
