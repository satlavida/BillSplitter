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
            className="flex-grow p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <li key={person.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-200">
                <span>{person.name}</span>
                <button
                  onClick={() => handleRemovePerson(person.id)}
                  className="text-red-500 hover:text-red-700 focus:outline-none"
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
          className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.people.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={state.people.length === 0}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PeopleInput;
