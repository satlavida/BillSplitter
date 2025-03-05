import { useState, useContext } from 'react';
import { BillContext, ADD_PERSON, REMOVE_PERSON, NEXT_STEP } from '../BillContext';

const PeopleInput = () => {
  const { state, dispatch } = useContext(BillContext);
  const [newPerson, setNewPerson] = useState('');
  
  const handleAddPerson = (e) => {
    e.preventDefault();
    if (newPerson.trim()) {
      dispatch({ type: ADD_PERSON, payload: newPerson.trim() });
      setNewPerson('');
    }
  };
  
  const handleRemovePerson = (id) => {
    dispatch({ type: REMOVE_PERSON, payload: id });
  };
  
  const handleNext = () => {
    if (state.people.length > 0) {
      dispatch({ type: NEXT_STEP });
    } else {
      alert('Please add at least one person');
    }
  };
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Who's splitting the bill?</h2>
      
      <form onSubmit={handleAddPerson} className="mb-6">
        <div className="flex items-center">
          <input
            type="text"
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            placeholder="Enter name"
            className="flex-grow p-2 border border-zinc-300 rounded-l focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
          />
          <button 
            type="submit"
            className="bg-blue-600 text-white p-2 rounded-r hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 transition-colors"
          >
            Add
          </button>
        </div>
      </form>
      
      {state.people.length > 0 && (
        <>
          <h3 className="text-lg font-medium mb-2">People</h3>
          <ul className="mb-6 space-y-2">
            {state.people.map(person => (
              <li key={person.id} className="flex justify-between items-center p-2 bg-zinc-50 rounded-md border border-zinc-200 shadow-sm">
                <span>{person.name}</span>
                <button 
                  onClick={() => handleRemovePerson(person.id)}
                  className="text-red-500 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 rounded-full transition-colors"
                  aria-label={`Remove ${person.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      
      <div className="flex justify-end">
        <button
          onClick={handleNext}
          className={`bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors ${state.people.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={state.people.length === 0}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PeopleInput;