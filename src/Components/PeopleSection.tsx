import { useCallback, useEffect, useState } from 'react';
import useSessionStore from '../sessionStore';
import { getPresence, listJoiners } from '../lib/liveApi';
import { Card } from '../ui/components';
import EditPersonModal from './EditPersonModal';
import { PersonInputForm, PeopleList, type PresenceStatus } from './PeopleListShared';
import type { Person } from '../schemas/bill.schema';
import type { Session } from '../schemas/session.schema';

interface PeopleSectionProps {
  session: Session;
}

// Req 3: while the session is live, poll for which personIds have a linked
// joiner (approved/pending — presence.Tracker doesn't care) and which of
// those are currently online, so PeopleList can render a dot. The two calls
// are staggered on purpose: getPresence (online/offline) needs to track the
// same ~1.5s cadence as the joiner's own heartbeat (usePresenceHeartbeat) to
// stay responsive, but listJoiners rarely changes — it only needs to catch a
// newly-approved/removed joiner — so it polls far less often to cut request
// volume.
const PRESENCE_POLL_MS = 1500;
const JOINERS_POLL_MULTIPLE = 4; // ~6s between listJoiners calls

function usePeoplePresence(liveCode: string | null, creatorToken: string | null) {
  const [linkedPersonIds, setLinkedPersonIds] = useState<Set<string>>(new Set());
  const [onlinePersonIds, setOnlinePersonIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!liveCode) {
      setLinkedPersonIds(new Set());
      setOnlinePersonIds(new Set());
      return;
    }

    let cancelled = false;
    let tickCount = 0;

    const tick = () => {
      getPresence(liveCode)
        .then((online) => {
          if (!cancelled) setOnlinePersonIds(new Set(online));
        })
        .catch(() => {});
      if (creatorToken && tickCount % JOINERS_POLL_MULTIPLE === 0) {
        listJoiners(liveCode, creatorToken)
          .then((joiners) => {
            if (!cancelled) setLinkedPersonIds(new Set(joiners.map((j) => j.personId).filter((id): id is string => Boolean(id))));
          })
          .catch(() => {});
      }
      tickCount += 1;
    };

    tick();
    const interval = setInterval(tick, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [liveCode, creatorToken]);

  const presenceFor = useCallback(
    (personId: string): PresenceStatus => {
      if (!linkedPersonIds.has(personId)) return undefined;
      return onlinePersonIds.has(personId) ? 'online' : 'offline';
    },
    [linkedPersonIds, onlinePersonIds]
  );

  return presenceFor;
}

// Session-level People editor (req 1): people are session-scoped data
// (session.people, shared across every bill in the session — see
// sessionStore.ts), so editing lives here on the session home page rather
// than inside a single bill's wizard. Reuses the same presentational pieces
// PeopleInput.tsx uses for the (now read/add-only-during-wizard) step 1.
const PeopleSection = ({ session }: PeopleSectionProps) => {
  const addPerson = useSessionStore((state) => state.addPerson);
  const removePerson = useSessionStore((state) => state.removePerson);
  const updatePerson = useSessionStore((state) => state.updatePerson);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);

  const presenceFor = usePeoplePresence(session.isLive ? session.liveCode : null, session.liveCreatorToken);

  const handleAddPerson = useCallback(
    (name: string) => {
      addPerson(session.id, name);
    },
    [addPerson, session.id]
  );

  const handleRemovePerson = useCallback(
    (id: string) => {
      removePerson(session.id, id);
    },
    [removePerson, session.id]
  );

  const handleEditPerson = useCallback((person: Person) => {
    setCurrentPerson(person);
    setEditModalOpen(true);
  }, []);

  const handleSavePerson = useCallback(
    (id: string, name: string) => {
      updatePerson(session.id, id, name);
    },
    [updatePerson, session.id]
  );

  return (
    <Card className="mb-4">
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">People</h2>

      <PersonInputForm onAddPerson={handleAddPerson} />

      <PeopleList
        people={session.people}
        onRemove={handleRemovePerson}
        onEdit={handleEditPerson}
        emptyState={<p className="text-sm text-zinc-500 dark:text-zinc-400">No one added yet — add the people splitting this session's bills.</p>}
        presenceFor={presenceFor}
      />

      <EditPersonModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} person={currentPerson} onSave={handleSavePerson} />
    </Card>
  );
};

export default PeopleSection;
