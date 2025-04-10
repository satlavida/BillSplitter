import { useState, useEffect } from 'react';
import { Button } from '../ui/components';

const PercentageSplitInput = ({ people, allocations, onSave, onCancel }) => {
  // Initialize state with current allocations or default values
  const [percentages, setPercentages] = useState(() => {
    // If we have allocations, use those values
    if (allocations.length > 0) {
      return allocations.map(allocation => ({
        personId: allocation.personId,
        value: allocation.value
      }));
    }
    
    // Otherwise, divide 100% equally among selected people
    const equalPercentage = Math.floor(100 / people.length);
    const remainder = 100 - (equalPercentage * people.length);
    
    return people.map((person, index) => ({
      personId: person.id,
      value: equalPercentage + (index === 0 ? remainder : 0)
    }));
  });
  
  const [total, setTotal] = useState(0);
  const [isValid, setIsValid] = useState(true);
  
  // Calculate total percentage and validate
  useEffect(() => {
    const newTotal = percentages.reduce((sum, item) => sum + item.value, 0);
    setTotal(newTotal);
    setIsValid(newTotal === 100);
  }, [percentages]);
  
  // Handle slider change
  const handlePercentageChange = (personId, newValue) => {
    const newValue2 = parseInt(newValue, 10);
    const newPercentages = percentages.map(item => {
      if (item.personId === personId) {
        return { ...item, value: newValue2 };
      }
      return item;
    });
    
    // Calculate total excluding the changed person
    const otherTotal = newPercentages
      .filter(item => item.personId !== personId)
      .reduce((sum, item) => sum + item.value, 0);
      
    const totalWithChanged = otherTotal + newValue2;
    
    // If total is not 100, try to adjust other values proportionally
    if (totalWithChanged !== 100 && newPercentages.length > 1) {
      const othersCount = newPercentages.filter(item => item.personId !== personId).length;
      if (othersCount > 0) {
        // Calculate how much we need to distribute among others
        const remaining = 100 - newValue2;
        
        // Get other items and their current total
        const otherItems = newPercentages.filter(item => item.personId !== personId);
        
        // Redistribute the remaining percentage proportionally
        if (otherTotal > 0) {
          let remainingToDistribute = remaining;
          
          // First pass - distribute proportionally
          otherItems.forEach((item, index) => {
            if (index === otherItems.length - 1) {
              // Last item gets whatever is left to ensure we sum to 100
              item.value = remainingToDistribute;
            } else {
              // Calculate proportional share
              const share = Math.floor(remaining * (item.value / otherTotal));
              item.value = share;
              remainingToDistribute -= share;
            }
          });
        } else {
          // If other total is 0, distribute evenly
          const evenShare = Math.floor(remaining / othersCount);
          let remainingToDistribute = remaining;
          
          otherItems.forEach((item, index) => {
            if (index === otherItems.length - 1) {
              item.value = remainingToDistribute;
            } else {
              item.value = evenShare;
              remainingToDistribute -= evenShare;
            }
          });
        }
      }
    }
    
    setPercentages(newPercentages);
  };
  
  // Handle save button click
  const handleSave = () => {
    if (isValid) {
      onSave(percentages);
    }
  };
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4 text-zinc-800 dark:text-white">Percentage Split</h3>
      
      {percentages.map(({ personId, value }) => {
        const person = people.find(p => p.id === personId);
        if (!person) return null;
        
        return (
          <div key={personId} className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {person?.name}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {value}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => handlePercentageChange(personId, e.target.value)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>
        );
      })}
      
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm font-medium">
          Total: <span className={total !== 100 ? 'text-red-500' : 'text-green-500'}>
            {total}%
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
          Percentages must add up to 100%
        </p>
      )}
    </div>
  );
};

export default PercentageSplitInput;