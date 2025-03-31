import React, { useCallback, useRef, memo, useState } from 'react';
import useBillStore, { useBillPersons } from '../billStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card } from '../ui/components';
import EditableTitle from './EditableTitle';
import EditPersonModal from './EditPersonModal';

// Isolated input component to prevent parent re-renders during typing
const PersonInputForm = memo(({ onAddPerson }) => {
  // Use uncontrolled input with ref instead of state
  const inputRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const value = inputRef.current?.value?.trim();
    
    if (value) {
      // Call the callback with the input value
      onAddPerson(value);
      // Reset the input field
      inputRef.current.value = '';
      // Focus the input again for better UX
      inputRef.current.focus();
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
        <Button 
          type="submit"
          className="rounded-l-none"
        >
          Add
        </Button>
      </div>
    </form>
  );
});

// Individual person list item
const PersonListItem = memo(({ person, onRemove, onEdit }) => {
  // Use a callback to prevent unnecessary function recreation
  const handleRemove = useCallback(() => {
    onRemove(person.id);
  }, [onRemove, person.id]);
  
  const handleEdit = useCallback(() => {
    onEdit(person);
  }, [onEdit, person]);

  return (
    <li className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 shadow-sm transition-colors">
      <span 
        className="dark:text-white cursor-pointer hover:underline"
        onClick={handleEdit}
      >
        {person.name}
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
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </li>
  );
});

// People list component
const PeopleList = memo(({ people, onRemove, onEdit }) => {
  if (people.length === 0) return null;
  
  return (
    <>
      <h3 className="text-lg font-medium mb-2 text-zinc-800 dark:text-zinc-200 transition-colors">People</h3>
      <ul className="mb-6 space-y-2">
        {people.map(person => (
          <PersonListItem 
            key={person.id} 
            person={person} 
            onRemove={onRemove}
            onEdit={onEdit}
          />
        ))}
      </ul>
    </>
  );
});

// Main PeopleInput component
const PeopleInput = () => {
  // Use Zustand store with specialized hooks and useShallow
  const people = useBillPersons();
  
  const { title, addPerson, removePerson, updatePerson, nextStep, setTitle } = 
    useBillStore(useShallow(state => ({
      title: state.title,
      addPerson: state.addPerson,
      removePerson: state.removePerson,
      updatePerson: state.updatePerson,
      nextStep: state.nextStep,
      setTitle: state.setTitle
    })));
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentPerson, setCurrentPerson] = useState(null);
  
  // Use useCallback to prevent function recreation on each render
  const handleAddPerson = useCallback((name) => {
    addPerson(name);
  }, [addPerson]);
  
  const handleRemovePerson = useCallback((id) => {
    removePerson(id);
  }, [removePerson]);

  const handleEditPerson = useCallback((person) => {
    setCurrentPerson(person);
    setEditModalOpen(true);
  }, []);

  const handleSavePerson = useCallback((id, name) => {
    updatePerson(id, name);
  }, [updatePerson]);
  
  const handleNext = useCallback(() => {
    if (people.length > 0) {
      nextStep();
    } else {
      alert('Please add at least one person');
    }
  }, [people.length, nextStep]);

  const handleTitleSave = useCallback((newTitle) => {
    setTitle(newTitle);
  }, [setTitle]);
  
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
      <EditableTitle 
        title={title}
        onSave={handleTitleSave}
        placeholder={suggestDefaultTitle()}
      />
      
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Who's splitting the bill?</h2>
      
      <Card>
        <PersonInputForm onAddPerson={handleAddPerson} />
      </Card>
      
      <PeopleList 
        people={people} 
        onRemove={handleRemovePerson}
        onEdit={handleEditPerson}
      />
      
      {/* Edit Person Modal */}
      <EditPersonModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        person={currentPerson}
        onSave={handleSavePerson}
      />
      
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={people.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default PeopleInput;