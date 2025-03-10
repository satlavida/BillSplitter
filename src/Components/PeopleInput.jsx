import React, { useContext, useCallback, memo } from 'react';
import { BillContext, ADD_PERSON, REMOVE_PERSON, NEXT_STEP } from '../BillContext';
import { useTheme } from '../ThemeContext';
import { Button, Card } from '../ui/components';

// Isolated input component to prevent parent re-renders during typing
const PersonInputForm = memo(({ onAddPerson }) => {
  // Use uncontrolled input with ref instead of state
  const inputRef = React.useRef(null);
  
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
const PersonListItem = memo(({ person, onRemove }) => {
  // Use a callback to prevent unnecessary function recreation
  const handleRemove = useCallback(() => {
    onRemove(person.id);
  }, [onRemove, person.id]);
  
  return (
    <li className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 shadow-sm transition-colors">
      <span className="dark:text-white">{person.name}</span>
      <button 
        onClick={handleRemove}
        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:focus-visible:ring-red-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800 rounded-full transition-colors"
        aria-label={`Remove ${person.name}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </li>
  );
});

// People list component
const PeopleList = memo(({ people, onRemove }) => {
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
          />
        ))}
      </ul>
    </>
  );
});

// Main PeopleInput component
const PeopleInput = () => {
  const { state, dispatch } = useContext(BillContext);
  const { theme } = useTheme();
  
  // Use useCallback to prevent function recreation on each render
  const handleAddPerson = useCallback((name) => {
    dispatch({ type: ADD_PERSON, payload: name });
  }, [dispatch]);
  
  const handleRemovePerson = useCallback((id) => {
    dispatch({ type: REMOVE_PERSON, payload: id });
  }, [dispatch]);
  
  const handleNext = useCallback(() => {
    if (state.people.length > 0) {
      dispatch({ type: NEXT_STEP });
    } else {
      alert('Please add at least one person');
    }
  }, [state.people.length, dispatch]);
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Who's splitting the bill?</h2>
      
      <Card>
        <PersonInputForm onAddPerson={handleAddPerson} />
      </Card>
      
      <PeopleList 
        people={state.people} 
        onRemove={handleRemovePerson} 
      />
      
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={state.people.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default PeopleInput;