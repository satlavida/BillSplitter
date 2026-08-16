import { useCallback, useState } from 'react';
import useSessionStore from '../sessionStore';
import { Card } from '../ui/components';
import EditPersonModal from './EditPersonModal';
import { PersonInputForm, PeopleList } from './PeopleListShared';
import type { Person } from '../schemas/bill.schema';
import type { Session } from '../schemas/session.schema';

interface PeopleSectionProps {
  session: Session;
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
      />

      <EditPersonModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} person={currentPerson} onSave={handleSavePerson} />
    </Card>
  );
};

export default PeopleSection;
