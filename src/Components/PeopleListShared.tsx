import { useCallback, useRef, memo, type FormEvent } from 'react';
import { Button } from '../ui/components';
import type { Person } from '../schemas/bill.schema';

// Presentational people-list pieces used by the session-level PeopleSection,
// bound to sessionStore's shared people (session.people).

interface PersonInputFormProps {
  onAddPerson: (name: string) => void;
}

export const PersonInputForm = memo(({ onAddPerson }: PersonInputFormProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value?.trim();

    if (value) {
      onAddPerson(value);
      inputRef.current!.value = '';
      inputRef.current!.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="flex items-center">
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter name"
          className="flex-grow p-2 border border-zinc-300 dark:border-zinc-600
            bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
            rounded-l focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
            dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
            transition-colors"
        />
        <Button type="submit" className="rounded-l-none">
          Add
        </Button>
      </div>
    </form>
  );
});

// Req 3: 'online'/'offline' renders a colored dot next to a person who has a
// joiner linked to their identity (presence.Tracker-backed); undefined means
// no joiner is linked at all, so no indicator is shown.
export type PresenceStatus = 'online' | 'offline' | undefined;

interface PersonListItemProps {
  person: Person;
  onRemove: (id: string) => void;
  onEdit: (person: Person) => void;
  presence?: PresenceStatus;
  isCreator?: boolean;
}

// Req 2: badge marking which person is the session's creator/maker —
// shown wherever people are listed (session home page and the bill
// wizard's People step) so it's obvious who holds creator-only privileges
// (approve joiners, edit paid-by, etc.).
const CreatorBadge = () => (
  <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
    Creator
  </span>
);

const PresenceDot = ({ status }: { status: PresenceStatus }) => {
  if (!status) return null;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-zinc-400 dark:bg-zinc-500'}`}
      title={status === 'online' ? 'Online' : 'Offline'}
      aria-label={status === 'online' ? 'Online' : 'Offline'}
    />
  );
};

const PersonListItem = memo(({ person, onRemove, onEdit, presence, isCreator }: PersonListItemProps) => {
  const handleRemove = useCallback(() => {
    onRemove(person.id);
  }, [onRemove, person.id]);

  const handleEdit = useCallback(() => {
    onEdit(person);
  }, [onEdit, person]);

  return (
    <li className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 shadow-sm transition-colors">
      <span className="flex items-center gap-2 dark:text-white cursor-pointer hover:underline" onClick={handleEdit}>
        <PresenceDot status={presence} />
        {person.name}
        {isCreator && <CreatorBadge />}
      </span>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleEdit}
          className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800 rounded-full transition-colors"
          aria-label={`Edit ${person.name}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          onClick={handleRemove}
          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:focus-visible:ring-red-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800 rounded-full transition-colors"
          aria-label={`Remove ${person.name}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </li>
  );
});

interface PeopleListProps {
  people: Person[];
  onRemove: (id: string) => void;
  onEdit: (person: Person) => void;
  emptyState?: React.ReactNode;
  presenceFor?: (personId: string) => PresenceStatus;
  creatorPersonId?: string | null;
}

export const PeopleList = memo(({ people, onRemove, onEdit, emptyState, presenceFor, creatorPersonId }: PeopleListProps) => {
  if (people.length === 0) return emptyState ?? null;

  return (
    <ul className="space-y-2">
      {people.map((person) => (
        <PersonListItem
          key={person.id}
          person={person}
          onRemove={onRemove}
          onEdit={onEdit}
          presence={presenceFor?.(person.id)}
          isCreator={Boolean(creatorPersonId) && person.id === creatorPersonId}
        />
      ))}
    </ul>
  );
});
