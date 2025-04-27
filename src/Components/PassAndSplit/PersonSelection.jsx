import React, { useState } from 'react';
import { useTheme } from '../../ThemeContext';
import usePassAndSplitStore from 'components/PassAndSplit/stores/passAndSplitStore';
import useBillStore from '../../billStore';

const PersonSelection = () => {
  const { theme } = useTheme();
  const [newPersonName, setNewPersonName] = useState('');
  
  // Get people from billStore
  const people = useBillStore(state => state.people);
  
  // Get Pass and Split state/actions
  const selectPerson = usePassAndSplitStore(state => state.selectPerson);
  const addNewPerson = usePassAndSplitStore(state => state.addNewPerson);
  const completedPersonIds = usePassAndSplitStore(state => state.completedPersonIds);
  const remainingPersonIds = usePassAndSplitStore(state => state.remainingPersonIds);
  
  // Handle person selection
  const handleSelectPerson = (personId) => {
    selectPerson(personId);
  };
  
  // Handle adding a new person
  const handleAddPerson = (e) => {
    e.preventDefault();
    if (newPersonName.trim()) {
      addNewPerson(newPersonName.trim());
      setNewPersonName('');
    }
  };
  
  // Determine person status (completed/available)
  const getPersonStatus = (personId) => {
    if (completedPersonIds.includes(personId)) {
      return 'completed';
    }
    return 'available';
  };
  
  // All people have completed
  const allCompleted = people.length > 0 && completedPersonIds.length === people.length;
  
  return (
    <div className="flex flex-col h-full">
      {/* Instruction header */}
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold mb-1">Who's using the phone now?</h2>
        <p className={`text-sm dark:text-gray-300 text-gray-500`}>
          {allCompleted 
            ? "Everyone has completed their selections!" 
            : "Select your name to choose your items"}
        </p>
      </div>
      
      {/* People grid */}
      <div className="flex-grow p-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {people.map(person => {
            const status = getPersonStatus(person.id);
            const isCompleted = status === 'completed';
            
            return (
              <button
                key={person.id}
                onClick={() => !isCompleted && handleSelectPerson(person.id)}
                disabled={isCompleted}
                className={`
                  p-4 rounded-lg flex flex-col items-center justify-center 
                  h-24 transition-all ${
                    isCompleted 
                      ? `opacity-50 dark:bg-gray-700 bg-gray-100` 
                      : `dark:bg-blue-700 dark:hover:bg-blue-600 bg-blue-100 hover:bg-blue-200`
                  }
                `}
              >
                {/* Avatar circle with first letter */}
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center mb-2
                  ${isCompleted 
                    ? `dark:bg-gray-600 bg-gray-300` 
                    : `dark:bg-blue-500 bg-blue-500 text-white`}
                `}>
                  {person.name.charAt(0).toUpperCase()}
                </div>
                
                <span className="text-sm font-medium truncate max-w-full">
                  {person.name}
                </span>
                
                {isCompleted && (
                  <span className={`text-xs mt-1 dark:text-green-400 text-green-600`}>
                    ✓ Completed
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Add new person form */}
      <div className={`p-4 border-t dark:border-gray-700 border-gray-200`}>
        <form onSubmit={handleAddPerson} className="flex">
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Add a new person..."
            className={`
              flex-grow p-2 rounded-l-md border
              dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-white border-gray-300 text-gray-800
            `}
          />
          <button
            type="submit"
            disabled={!newPersonName.trim()}
            className={`
              px-4 py-2 rounded-r-md
              ${newPersonName.trim() 
                ? `dark:bg-blue-600 dark:hover:bg-blue-700 bg-blue-500 hover:bg-blue-600 text-white` 
                : `dark:bg-gray-700 dark:text-gray-500 bg-gray-200 text-gray-400`}
            `}
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
};

export default PersonSelection;