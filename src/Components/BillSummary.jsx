import { useContext } from 'react';
import { BillContext, GO_TO_STEP, RESET } from '../BillContext';

const BillSummary = () => {
  const { state, dispatch } = useContext(BillContext);

  // Calculate subtotals and tax for each person
  const calculatePersonTotals = () => {
    const personTotals = {};

    // Initialize totals for each person
    state.people.forEach(person => {
      personTotals[person.id] = {
        id: person.id,
        name: person.name,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0
      };
    });

    // Calculate each person's share for each item
    state.items.forEach(item => {
      // Skip items with no consumers
      if (item.consumedBy.length === 0) return;

      const totalItemPrice = parseFloat(item.price) * item.quantity;
      const pricePerPerson = totalItemPrice / item.consumedBy.length;

      item.consumedBy.forEach(personId => {
        if (personTotals[personId]) {
          personTotals[personId].items.push({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: item.quantity,
            sharedWith: item.consumedBy.length,
            share: pricePerPerson
          });

          personTotals[personId].subtotal += pricePerPerson;
        }
      });
    });

    // Calculate tax proportionally based on subtotals
    if (state.taxAmount > 0) {
      const totalBeforeTax = Object.values(personTotals).reduce((sum, person) => sum + person.subtotal, 0);

      if (totalBeforeTax > 0) {
        Object.values(personTotals).forEach(person => {
          // Proportional tax based on their share of the bill
          person.tax = (person.subtotal / totalBeforeTax) * parseFloat(state.taxAmount);
          person.total = person.subtotal + person.tax;
        });
      }
    } else {
      // No tax, so total equals subtotal
      Object.values(personTotals).forEach(person => {
        person.total = person.subtotal;
      });
    }

    return Object.values(personTotals);
  };

  const personTotals = calculatePersonTotals();

  const handleEdit = (step) => {
    dispatch({ type: GO_TO_STEP, payload: step });
  };

  const handleReset = () => {
    const confirm = window.confirm('Are you sure you want to start over? This will reset everything.');
    if (confirm) {
      dispatch({ type: RESET });
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Bill Summary</h2>

      {personTotals.map(person => (
        <div key={person.id} className="mb-6 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
          <h3 className="text-lg font-bold mb-3 pb-2 border-b">{person.name}</h3>

          {person.items.length > 0 ? (
            <>
              <ul className="mb-4 space-y-2">
                {person.items.map(item => (
                  <li key={item.id} className="flex justify-between items-start">
                    <div>
                      <span>{item.name}</span>
                      {item.sharedWith > 1 && (
                        <span className="text-sm text-gray-600 block">
                          Split by {item.sharedWith}
                        </span>
                      )}
                    </div>
                    <span className="font-medium">${item.share.toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${person.subtotal.toFixed(2)}</span>
                </div>

                {state.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${person.tax.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg pt-1">
                  <span>Total:</span>
                  <span>${person.total.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500">No items assigned</p>
          )}
        </div>
      ))}

      <div className="mb-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total Tax:</span>
          <span>${parseFloat(state.taxAmount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center font-bold text-lg">
          <span>Grand Total:</span>
          <span>${personTotals.reduce((sum, person) => sum + person.total, 0).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-between">
        <div className="space-x-2 mb-4">
          <button
            onClick={() => handleEdit(1)}
            className="bg-gray-200 text-gray-700 px-3 py-1 rounded-sm hover:bg-gray-300 focus:outline-hidden focus:ring-1 focus:ring-gray-500"
          >
            Edit People
          </button>
          <button
            onClick={() => handleEdit(2)}
            className="bg-gray-400 text-gray-700 px-3 py-1 rounded-sm hover:bg-gray-300 focus:outline-hidden focus:ring-1 focus:ring-gray-500"
          >
            Edit Items
          </button>
          <button
            onClick={() => handleEdit(3)}
            className="bg-gray-200 text-gray-700 px-3 py-1 rounded-sm hover:bg-gray-300 focus:outline-hidden focus:ring-1 focus:ring-gray-500"
          >
            Edit Assignments
          </button>
        </div>

        <button
          onClick={handleReset}
          className="bg-red-500 text-white px-4 py-2 rounded-sm hover:bg-red-600 focus:outline-hidden focus:ring-2 focus:ring-red-500"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};

export default BillSummary;
