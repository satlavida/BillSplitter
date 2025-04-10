import { useState, useEffect } from 'react';
import PercentageSplitInput from './PercentageSplitInput';
import FractionalSplitInput from './FractionalSplitInput';
import { SPLIT_TYPES } from '../billStore';

const SplitTypeDrawer = ({ 
  isOpen, 
  onClose, 
  item, 
  people, 
  onSave
}) => {
  // Filter people to only those who are assigned to this item
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [splitType, setSplitType] = useState(item.splitType || SPLIT_TYPES.EQUAL);
  
  // Update selected people when item or people change
  useEffect(() => {
    if (item && item.consumedBy && people) {
      // Extract person IDs from consumedBy (handle both string and object formats)
      const personIds = item.consumedBy.map(c => 
        typeof c === 'string' ? c : c.personId
      );
      
      // Get person objects for each ID
      const assigned = personIds
        .map(id => people.find(p => p.id === id))
        .filter(Boolean); // Filter out any undefined (in case of data inconsistency)
      
      setSelectedPeople(assigned);
      setSplitType(item.splitType || SPLIT_TYPES.EQUAL);
    }
  }, [item, people]);
  
  // Get current allocations in the format expected by the input components
  const getAllocations = () => {
    if (!item || !item.consumedBy || item.consumedBy.length === 0) return [];
    
    // If consumedBy is an array of strings (old format)
    if (typeof item.consumedBy[0] === 'string') {
      // For equal split, convert to allocation objects with equal values
      const value = splitType === SPLIT_TYPES.PERCENTAGE 
        ? Math.floor(100 / item.consumedBy.length) 
        : 1;
        
      // For percentage, make sure it sums to 100%
      const allocations = item.consumedBy.map((personId, index) => ({
        personId,
        value: index === 0 && splitType === SPLIT_TYPES.PERCENTAGE 
          ? value + (100 - (value * item.consumedBy.length)) 
          : value
      }));
      
      return allocations;
    }
    
    // If consumedBy is already an array of allocation objects
    return item.consumedBy;
  };
  
  // Handle split type change
  const handleSplitTypeChange = (e) => {
    setSplitType(e.target.value);
  };
  
  // Handle saving the split configuration
  const handleSaveSplit = (allocations) => {
    onSave(item.id, splitType, allocations);
    onClose();
  };
  
  // Handle drawer closing behavior with backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-zinc-800 w-full max-w-lg rounded-t-lg sm:rounded-lg shadow-lg transition-all transform animate-slide-up overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">
              Split "{item.name}"
            </h3>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Split Type
            </label>
            <select
              value={splitType}
              onChange={handleSplitTypeChange}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
            >
              <option value={SPLIT_TYPES.EQUAL}>Equal Split</option>
              <option value={SPLIT_TYPES.PERCENTAGE}>Percentage Split</option>
              <option value={SPLIT_TYPES.FRACTION}>Fractional Split</option>
            </select>
          </div>
        </div>
        
        <div className="max-h-[70vh] overflow-y-auto">
          {splitType === SPLIT_TYPES.EQUAL ? (
            <div className="p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This item will be split equally among {selectedPeople.length} people.
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : splitType === SPLIT_TYPES.PERCENTAGE ? (
            <PercentageSplitInput
              people={selectedPeople}
              allocations={getAllocations()}
              onSave={handleSaveSplit}
              onCancel={onClose}
            />
          ) : (
            <FractionalSplitInput
              people={selectedPeople}
              allocations={getAllocations()}
              onSave={handleSaveSplit}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitTypeDrawer;