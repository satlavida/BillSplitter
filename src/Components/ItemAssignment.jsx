import { useMemo, memo, useCallback, useState } from 'react';
import useBillStore, { useBillPersons, useBillItems, SPLIT_TYPES } from '../billStore';
import { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Card, Button, ToggleButton, SelectAllButton } from '../ui/components';
import SplitTypeDrawer from './SplitTypeDrawer';
import PassAndSplitButton from './PassAndSplit/PassAndSplitButton';


// Individual Item Card component
const ItemCard = memo(({ 
  item, 
  people, 
  onTogglePerson, 
  formatCurrency, 
  onOpenSplitDrawer 
}) => {
  // Compute if all people are assigned to this item
  const allSelected = useMemo(() => {
    // Extract person IDs from consumedBy (handle both string and object formats)
    const personIds = item.consumedBy.map(c => 
      typeof c === 'string' ? c : c.personId
    );
    return people.length > 0 && personIds.length === people.length;
  }, [item.consumedBy, people.length]);
  
  // Compute list of person names assigned to this item
  const assignedNames = useMemo(() => {
    // Extract person IDs from consumedBy (handle both string and object formats)
    const personIds = item.consumedBy.map(c => 
      typeof c === 'string' ? c : c.personId
    );
    
    return personIds
      .map(id => people.find(p => p.id === id)?.name || '')
      .filter(Boolean)
      .join(', ');
  }, [item.consumedBy, people]);
  
  // Get the split type display text
  const splitTypeText = useMemo(() => {
    switch(item.splitType) {
      case SPLIT_TYPES.PERCENTAGE:
        return 'Percentage Split';
      case SPLIT_TYPES.FRACTION:
        return 'Fractional Split';
      case SPLIT_TYPES.EQUAL:
      default:
        return 'Equal Split';
    }
  }, [item.splitType]);
  
  // Determine if this item has a custom split (not equal)
  const hasCustomSplit = useMemo(() => {
    return item.splitType && item.splitType !== SPLIT_TYPES.EQUAL;
  }, [item.splitType]);
  
  // For custom splits, generate split info text
  const splitInfoText = useMemo(() => {
    if (!hasCustomSplit) return null;
    
    // For percentage splits, show percentages
    if (item.splitType === SPLIT_TYPES.PERCENTAGE) {
      const allocations = item.consumedBy.map(c => {
        if (typeof c === 'string') return null;
        const person = people.find(p => p.id === c.personId);
        return person ? `${person.name}: ${c.value}%` : null;
      }).filter(Boolean);
      
      return allocations.join(', ');
    }
    
    // For fractional splits, show fractions or ratio
    if (item.splitType === SPLIT_TYPES.FRACTION) {
      const totalValue = item.consumedBy.reduce((sum, c) => 
        sum + (typeof c === 'string' ? 1 : c.value), 0
      );
      
      const allocations = item.consumedBy.map(c => {
        if (typeof c === 'string') return null;
        const person = people.find(p => p.id === c.personId);
        const percentage = totalValue > 0 ? ((c.value / totalValue) * 100).toFixed(0) : 0;
        return person ? `${person.name}: ${percentage}%` : null;
      }).filter(Boolean);
      
      return allocations.join(', ');
    }
    
    return null;
  }, [item.splitType, item.consumedBy, hasCustomSplit, people]);
  
  const handleSelectAll = useCallback(() => {
    onTogglePerson('all', item.id);
  }, [onTogglePerson, item.id]);
  
  const handleDeselectAll = useCallback(() => {
    onTogglePerson('none', item.id);
  }, [onTogglePerson, item.id]);
  
  return (
    <Card className="mb-4">
      <div className="mb-3 flex justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-800 dark:text-white transition-colors">{item.name}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
            {item.quantity > 1 ? `${item.quantity} × ` : ''}
            {formatCurrency(parseFloat(item.price))}
          </p>
        </div>
        <button 
          onClick={() => onOpenSplitDrawer(item)}
          className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          title="Configure Split"
          aria-label="Configure Split"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors">Select who consumed this:</p>
        
        <SelectAllButton 
          allSelected={allSelected}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          size="sm"
        />
      </div>
      
      <div className="flex flex-wrap gap-2 mb-2">
        {people.map(person => {
          // Check if person is in consumedBy (handling both formats)
          const isSelected = item.consumedBy.some(c => 
            (typeof c === 'string' && c === person.id) || 
            (c.personId === person.id)
          );
          
          return (
            <ToggleButton
              key={person.id}
              selected={isSelected}
              onClick={() => onTogglePerson(person.id, item.id)}
            >
              {person.name}
            </ToggleButton>
          );
        })}
      </div>
      
      {item.consumedBy.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-700 transition-colors">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
              <span className="font-medium">Split between:</span> {assignedNames}
            </p>
            <span className="text-xs py-1 px-2 bg-zinc-100 dark:bg-zinc-700 rounded-full text-zinc-600 dark:text-zinc-400 transition-colors">
              {splitTypeText}
            </span>
          </div>
          
          {hasCustomSplit ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 transition-colors">
              {splitInfoText}
            </p>
          ) : item.consumedBy.length > 1 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 transition-colors">
              Each person pays: {formatCurrency((parseFloat(item.price) * item.quantity / item.consumedBy.length))}
            </p>
          )}
        </div>
      )}
    </Card>
  );
});

// Main ItemAssignment component
const ItemAssignment = () => {
  // Use Zustand store with specialized hooks and useShallow
  const people = useBillPersons();
  const items = useBillItems();
  const [splitDrawerItem, setSplitDrawerItem] = useState(null);
  
  const { 
    assignItemEqual, 
    assignItemPercentage,
    assignItemFraction,
    assignAllPeopleEqual, 
    removeAllPeople, 
    setSplitType,
    nextStep, 
    prevStep, 
    getUnassignedItems 
  } = useBillStore(useShallow(state => ({
    assignItemEqual: state.assignItemEqual,
    assignItemPercentage: state.assignItemPercentage,
    assignItemFraction: state.assignItemFraction,
    assignAllPeopleEqual: state.assignAllPeopleEqual,
    removeAllPeople: state.removeAllPeople,
    setSplitType: state.setSplitType,
    nextStep: state.nextStep,
    prevStep: state.prevStep,
    getUnassignedItems: state.getUnassignedItems
  })));
  
  const formatCurrency = useFormatCurrency();
  
  const handleTogglePerson = useCallback((personId, itemId) => {
    if (personId === 'all') {
      assignAllPeopleEqual(itemId);
      return;
    }
    
    if (personId === 'none') {
      removeAllPeople(itemId);
      return;
    }
    
    const item = items.find(item => item.id === itemId);
    
    // Extract person IDs from consumedBy
    const personIds = item.consumedBy.map(c => 
      typeof c === 'string' ? c : c.personId
    );
    
    // Check if this person is already assigned to the item
    const isAssigned = personIds.includes(personId);
    
    // Handle based on split type
    if (!item.splitType || item.splitType === SPLIT_TYPES.EQUAL) {
      // For equal splits
      let newPersonIds;
      
      if (isAssigned) {
        // Remove person from the list
        newPersonIds = personIds.filter(id => id !== personId);
      } else {
        // Add person to the list
        newPersonIds = [...personIds, personId];
      }
      
      assignItemEqual(itemId, newPersonIds);
    } 
    else if (item.splitType === SPLIT_TYPES.PERCENTAGE) {
      // For percentage splits
      let newAllocations;
      
      if (isAssigned) {
        // Remove person from allocations
        newAllocations = item.consumedBy.filter(c => 
          (typeof c === 'string' && c !== personId) || 
          (c.personId !== personId)
        );
      } else {
        // Add person with a percentage value
        // Create new allocations from existing ones
        const existingAllocations = item.consumedBy.map(c => 
          typeof c === 'string' ? { personId: c, value: 100 / (personIds.length + 1) } : c
        );
        
        // Add new person's allocation
        newAllocations = [
          ...existingAllocations, 
          { personId, value: 100 / (personIds.length + 1) }
        ];
      }
      
      assignItemPercentage(itemId, newAllocations);
    }
    else if (item.splitType === SPLIT_TYPES.FRACTION) {
      // For fractional splits
      let newAllocations;
      
      if (isAssigned) {
        // Remove person from allocations
        newAllocations = item.consumedBy.filter(c => 
          (typeof c === 'string' && c !== personId) || 
          (c.personId !== personId)
        );
      } else {
        // Add person with default value of 1
        // Create new allocations from existing ones
        const existingAllocations = item.consumedBy.map(c => 
          typeof c === 'string' ? { personId: c, value: 1 } : c
        );
        
        // Add new person's allocation
        newAllocations = [...existingAllocations, { personId, value: 1 }];
      }
      
      assignItemFraction(itemId, newAllocations);
    }
  }, [items, assignItemEqual, assignItemPercentage, assignItemFraction, assignAllPeopleEqual, removeAllPeople]);
  
  const handleOpenSplitDrawer = useCallback((item) => {
    setSplitDrawerItem(item);
  }, []);
  
  const handleCloseSplitDrawer = useCallback(() => {
    setSplitDrawerItem(null);
  }, []);
  
  const handleSaveSplit = useCallback((itemId, splitType, allocations) => {
    setSplitType(itemId, splitType);
    
    switch (splitType) {
      case SPLIT_TYPES.PERCENTAGE:
        assignItemPercentage(itemId, allocations);
        break;
      case SPLIT_TYPES.FRACTION:
        assignItemFraction(itemId, allocations);
        break;
      default:
        // For equal split, we need to extract just the personIds
        const personIds = allocations.map(a => a.id);
        assignItemEqual(itemId, personIds);
    }
  }, [setSplitType, assignItemPercentage, assignItemFraction, assignItemEqual]);
  
  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);
  
  const handleNext = useCallback(() => {
    // Check if all items have at least one person assigned
    const unassignedItems = getUnassignedItems();
    
    if (unassignedItems.length > 0) {
      const proceed = window.confirm(`${unassignedItems.length} item(s) do not have anyone assigned. Continue anyway?`);
      if (!proceed) return;
    }
    
    nextStep();
  }, [getUnassignedItems, nextStep]);
  
  return (
    <div>
      <div className="mb-4">
        <div className={`p-3 rounded-lg dark:text-white transition-colors`}>
          <h3 className="font-medium mb-2">Quick Assignment</h3>
          <p className={`text-sm mb-3 dark:text-white transition-colors`}>
            Pass your phone around so everyone can select what they had.
          </p>
          <PassAndSplitButton />
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">Who consumed what?</h2>
      
      {items.map(item => (
        <ItemCard 
          key={item.id}
          item={item}
          people={people}
          onTogglePerson={handleTogglePerson}
          formatCurrency={formatCurrency}
          onOpenSplitDrawer={handleOpenSplitDrawer}
        />
      ))}
      
      <div className="flex justify-between mt-4">
        <Button
          variant="secondary"
          onClick={handlePrev}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
        >
          Calculate Split
        </Button>
      </div>
      
      {/* Split Type Drawer */}
      <SplitTypeDrawer
        isOpen={splitDrawerItem !== null}
        onClose={handleCloseSplitDrawer}
        item={splitDrawerItem || {}}
        people={people}
        onSave={handleSaveSplit}
      />
    </div>
  );
};

export default ItemAssignment;