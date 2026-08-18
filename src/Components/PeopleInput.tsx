import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import useBillStore, { useBillPersons } from '../billStore';
import useSessionStore from '../sessionStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card } from '../ui/components';
import EditableTitle from './EditableTitle';
import EditPersonModal from './EditPersonModal';
import { PersonInputForm, PeopleList } from './PeopleListShared';
import type { Person } from '../schemas/bill.schema';

// Main PeopleInput component
const PeopleInput = () => {
  // Use Zustand store with specialized hooks and useShallow
  const people = useBillPersons();

  const { sessionId } = useParams<{ sessionId: string }>();
  const creatorPersonId = useSessionStore((state) => (sessionId ? (state.getSession(sessionId)?.creatorPersonId ?? null) : null));

  const { title, addPerson, removePerson, updatePerson, nextStep, setTitle } = useBillStore(
    useShallow((state) => ({
      title: state.title,
      addPerson: state.addPerson,
      removePerson: state.removePerson,
      updatePerson: state.updatePerson,
      nextStep: state.nextStep,
      setTitle: state.setTitle,
    }))
  );

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);

  // Use useCallback to prevent function recreation on each render
  const handleAddPerson = useCallback(
    (name: string) => {
      addPerson(name);
    },
    [addPerson]
  );

  const handleRemovePerson = useCallback(
    (id: string) => {
      removePerson(id);
    },
    [removePerson]
  );

  const handleEditPerson = useCallback((person: Person) => {
    setCurrentPerson(person);
    setEditModalOpen(true);
  }, []);

  const handleSavePerson = useCallback(
    (id: string, name: string) => {
      updatePerson(id, name);
    },
    [updatePerson]
  );

  const handleNext = useCallback(() => {
    if (people.length > 0) {
      nextStep();
    } else {
      alert('Please add at least one person');
    }
  }, [people.length, nextStep]);

  const handleTitleSave = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
    },
    [setTitle]
  );

  // Suggest a default title if none exists
  const suggestDefaultTitle = () => {
    if (!title) {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      return `Restaurant ${dateString}`;
    }
    return title;
  };

  return (
    <div>
      {/* Editable Title Section */}
      <EditableTitle title={title} onSave={handleTitleSave} placeholder={suggestDefaultTitle()} />

      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Who's splitting the bill?</h2>

      <Card>
        <PersonInputForm onAddPerson={handleAddPerson} />
      </Card>

      {people.length > 0 && (
        <>
          <h3 className="text-lg font-medium mb-2 text-zinc-800 dark:text-zinc-200 transition-colors">People</h3>
          <div className="mb-6">
            <PeopleList people={people} onRemove={handleRemovePerson} onEdit={handleEditPerson} creatorPersonId={creatorPersonId} />
          </div>
        </>
      )}

      {/* Edit Person Modal */}
      <EditPersonModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} person={currentPerson} onSave={handleSavePerson} />

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={people.length === 0}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default PeopleInput;
