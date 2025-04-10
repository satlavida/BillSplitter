import { useState, useEffect } from 'react';
import { Button } from '../ui/components';

const FractionalSplitInput = ({ people, allocations, onSave, onCancel }) => {
  // Initialize state with current allocations or default values
  const [fractions, setFractions] = useState(() => {
    // If we have allocations, use those values
    if (allocations.length > 0) {
      return allocations.map(allocation => ({
        personId: allocation.personId,
        value: allocation.value
      }));
    }
    
    // Otherwise, set equal fractions (all 1)
    return people.map(person => ({
      personId: person.id,
      value: 1
    }));
  });
  
  const [total, setTotal] = useState(0);
  const [isValid, setIsValid] = useState(true);
  
  // Calculate total fractions
  useEffect(() => {
    const newTotal = fractions.reduce((sum, item) => sum + item.value, 0);
    setTotal(newTotal);
    setIsValid(newTotal > 0 && fractions.every(item => item.value > 0));
  }, [fractions]);
  
  // Handle fraction input change
  const handleFractionChange = (personId, newValue) => {
    // Ensure value is a positive number
    const numValue = Math.max(parseFloat(newValue) || 0, 0);
    
    setFractions(fractions.map(item => {
      if (item.personId === personId) {
        return { ...item, value: numValue };
      }
      return item;
    }));
  };
  
  // Handle save button click
  const handleSave = () => {
    if (isValid) {
      onSave(fractions);
    }
  };
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4 text-zinc-800 dark:text-white">Fractional Split</h3>
      
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Enter a number for each person representing their share. Higher numbers mean paying more.
      </p>
      
      {fractions.map(({ personId, value }) => {
        const person = people.find(p => p.id === personId);
        if (!person) return null;
        
        // Calculate percentage of total
        const percentage = total > 0 ? (value / total) * 100 : 0;
        
        return (
          <div key={personId} className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {person.name}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {percentage.toFixed(1)}% of total
              </span>
            </div>
            <div className="flex items-center">
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={value}
                onChange={(e) => handleFractionChange(personId, e.target.value)}
                className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white"
              />
            </div>
          </div>
        );
      })}
      
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm font-medium">
          Total parts: <span className={!isValid ? 'text-red-500' : 'text-green-500'}>
            {total}
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Save
          </Button>
        </div>
      </div>
      
      {!isValid && (
        <p className="text-sm text-red-500 mt-2">
          All fractions must be positive numbers
        </p>
      )}
    </div>
  );
};

export default FractionalSplitInput;