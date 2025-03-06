import { useContext, useMemo, memo } from 'react';
import { 
  BillContext, 
  ASSIGN_ITEM, 
  ASSIGN_ALL_PEOPLE, 
  REMOVE_ALL_PEOPLE, 
  NEXT_STEP, 
  PREV_STEP 
} from '../BillContext';
import { Card, Button, ToggleButton, SelectAllButton } from '../ui/components';

// Individual Item Card component
const ItemCard = memo(({ item, people, onTogglePerson, formatCurrency }) => {
  // Compute if all people are assigned to this item
  const allSelected = useMemo(() => {
    return people.length > 0 && item.consumedBy.length === people.length;
  }, [item.consumedBy.length, people.length]);
  
  // Compute list of person names assigned to this item
  const assignedNames = useMemo(() => {
    return item.consumedBy
      .map(id => people.find(p => p.id === id)?.name || '')
      .filter(Boolean)
      .join(', ');
  }, [item.consumedBy, people]);
  
  return (
    <Card>
      <div className="mb-3">
        <h3 className="text-lg font-medium">{item.name}</h3>
        <p className="text-sm text-zinc-600">
          {item.quantity > 1 ? `${item.quantity} × ` : ''}
          {formatCurrency(parseFloat(item.price))}
        </p>
      </div>
      
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-medium text-zinc-700">Select who consumed this:</p>
        
        <SelectAllButton 
          allSelected={allSelected}
          onSelectAll={() => onTogglePerson('all', item.id)}
          onDeselectAll={() => onTogglePerson('none', item.id)}
          size="sm"
        />
      </div>
      
      <div className="flex flex-wrap gap-2 mb-2">
        {people.map(person => (
          <ToggleButton
            key={person.id}
            selected={item.consumedBy.includes(person.id)}
            onClick={() => onTogglePerson(person.id, item.id)}
          >
            {person.name}
          </ToggleButton>
        ))}
      </div>
      
      {item.consumedBy.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-100">
          <p className="text-sm text-zinc-600">
            <span className="font-medium">Split between:</span> {assignedNames}
          </p>
          {item.consumedBy.length > 1 && (
            <p className="text-xs text-zinc-500 mt-1">
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
  const { state, dispatch, formatCurrency } = useContext(BillContext);
  
  const handleTogglePerson = (personId, itemId) => {
    if (personId === 'all') {
      dispatch({
        type: ASSIGN_ALL_PEOPLE,
        payload: itemId
      });
      return;
    }
    
    if (personId === 'none') {
      dispatch({
        type: REMOVE_ALL_PEOPLE,
        payload: itemId
      });
      return;
    }
    
    const item = state.items.find(item => item.id === itemId);
    let newConsumedBy;
    
    // If person is already in the consumedBy array, remove them, otherwise add them
    if (item.consumedBy.includes(personId)) {
      newConsumedBy = item.consumedBy.filter(id => id !== personId);
    } else {
      newConsumedBy = [...item.consumedBy, personId];
    }
    
    dispatch({
      type: ASSIGN_ITEM,
      payload: {
        itemId,
        peopleIds: newConsumedBy
      }
    });
  };
  
  const handlePrev = () => {
    dispatch({ type: PREV_STEP });
  };
  
  const handleNext = () => {
    // Check if all items have at least one person assigned
    const unassignedItems = state.items.filter(item => item.consumedBy.length === 0);
    
    if (unassignedItems.length > 0) {
      const proceed = window.confirm(`${unassignedItems.length} item(s) do not have anyone assigned. Continue anyway?`);
      if (!proceed) return;
    }
    
    dispatch({ type: NEXT_STEP });
  };
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Who consumed what?</h2>
      
      {state.items.map(item => (
        <ItemCard 
          key={item.id}
          item={item}
          people={state.people}
          onTogglePerson={handleTogglePerson}
          formatCurrency={formatCurrency}
        />
      ))}
      
      <div className="flex justify-between">
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
    </div>
  );
};

export default ItemAssignment;