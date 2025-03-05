import { useContext } from 'react';
import { BillContext, ASSIGN_ITEM, NEXT_STEP, PREV_STEP } from '../BillContext';

const ItemAssignment = () => {
  const { state, dispatch } = useContext(BillContext);

  const handleTogglePerson = (itemId, personId) => {
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

  const getPersonName = (personId) => {
    const person = state.people.find(p => p.id === personId);
    return person ? person.name : '';
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
        <div key={item.id} className="mb-6 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
          <div className="mb-3">
            <h3 className="text-lg font-medium">{item.name}</h3>
            <p className="text-sm text-gray-600">
              {item.quantity > 1 ? `${item.quantity} × ` : ''}
              ${parseFloat(item.price).toFixed(2)}
            </p>
          </div>

          <p className="mb-3 text-sm font-medium text-gray-700">Select who consumed this:</p>

          <div className="flex flex-wrap gap-2 mb-2">
            {state.people.map(person => (
              <button
                key={person.id}
                onClick={() => handleTogglePerson(item.id, person.id)}
                className={`px-3 py-1 rounded-full transition-colors ${item.consumedBy.includes(person.id)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {person.name}
              </button>
            ))}
          </div>

          {item.consumedBy.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Split between:</span> {item.consumedBy.map(id => getPersonName(id)).join(', ')}
              </p>
              {item.consumedBy.length > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  Each person pays: ${(parseFloat(item.price) * item.quantity / item.consumedBy.length).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-between">
        <button
          onClick={handlePrev}
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Calculate Split
        </button>
      </div>
    </div>
  );
};

export default ItemAssignment;
