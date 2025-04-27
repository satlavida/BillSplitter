import React from 'react';
import { useTheme } from '../../ThemeContext';
import usePassAndSplitStore from './stores/passAndSplitStore';
import useBillStore from '../../billStore';

const CompletionScreen = () => {
  const { theme } = useTheme();
  const currentPersonId = usePassAndSplitStore(state => state.currentPersonId);
  const pendingAssignments = usePassAndSplitStore(state => state.pendingAssignments);
  const completeCurrentPerson = usePassAndSplitStore(state => state.completeCurrentPerson);
  const resetCurrentPerson = usePassAndSplitStore(state => state.resetCurrentPerson);
  
  // Get people and items from billStore
  const people = useBillStore(state => state.people);
  const items = useBillStore(state => state.items);
  
  // Find current person
  const currentPerson = people.find(p => p.id === currentPersonId);
  
  // Get selected items for this person
  const selectedItemIds = pendingAssignments[currentPersonId] || [];
  const selectedItems = items.filter(item => selectedItemIds.includes(item.id));
  
  // Handle "Pass to Next" action
  const handlePassToNext = () => {
    completeCurrentPerson();
  };
  
  // Handle "Redo Selection" action
  const handleRedoSelection = () => {
    resetCurrentPerson();
  };
  
  if (!currentPerson) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold mb-1">{currentPerson.name}'s Selections</h2>
        <p className={`text-sm dark:text-gray-300 text-gray-500`}>
          {selectedItems.length === 0 
            ? "You didn't select any items" 
            : `You selected ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`}
        </p>
      </div>
      
      {/* Selected items list */}
      <div className="flex-grow overflow-y-auto p-4">
        {selectedItems.length === 0 ? (
          <div className={`
            p-6 rounded-lg text-center
            dark:bg-gray-700 bg-gray-100
          `}>
            <p className="text-sm">No items selected</p>
            <p className={`text-xs mt-2 dark:text-gray-400 text-gray-500`}>
              You can redo your selection or pass the phone to the next person
            </p>
          </div>
        ) : (
          <ul className={`
            rounded-lg border
            dark:border-gray-700 border-gray-200
          `}>
            {selectedItems.map((item, index) => (
              <li 
                key={item.id}
                className={`
                  p-3 flex justify-between items-center
                  ${index !== selectedItems.length - 1 
                    ? `border-b dark:border-gray-700 border-gray-200` 
                    : ''}
                  dark:bg-gray-800 bg-white
                `}
              >
                <div className="flex items-center">
                  <div className={`
                    mr-3 w-8 h-8 rounded-full flex items-center justify-center
                    dark:bg-green-800 bg-green-100
                    dark:text-green-300 text-green-600
                  `}>
                    ✓
                  </div>
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className={`text-sm dark:text-gray-400 text-gray-500`}>
                  × {item.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Action buttons */}
      <div className={`
        p-4 border-t flex flex-col gap-2
        dark:border-gray-700 border-gray-200
      `}>
        <button
          onClick={handlePassToNext}
          className={`
            py-3 px-6 rounded-lg font-bold
            dark:bg-blue-600 dark:hover:bg-blue-700 bg-blue-500 hover:bg-blue-600
            text-white transition-colors
          `}
        >
          Pass to Next Person
        </button>
        
        <button
          onClick={handleRedoSelection}
          className={`
            py-3 px-6 rounded-lg font-medium
            dark:bg-gray-700 dark:hover:bg-gray-600 text-white bg-gray-200 hover:bg-gray-300 text-gray-800
            transition-colors
          `}
        >
          Redo My Selection
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;