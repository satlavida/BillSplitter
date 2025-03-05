import { useState, useContext } from 'react';
import { BillContext, ADD_ITEM, REMOVE_ITEM, SET_TAX, NEXT_STEP, PREV_STEP } from '../BillContext';

const ItemsInput = () => {
  const { state, dispatch } = useContext(BillContext);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    quantity: 1
  });
  const [taxAmount, setTaxAmount] = useState(state.taxAmount || '');

  const handleAddItem = (e) => {
    e.preventDefault();
    if (newItem.name.trim() && Number(newItem.price) > 0) {
      dispatch({
        type: ADD_ITEM,
        payload: {
          name: newItem.name.trim(),
          price: newItem.price,
          quantity: newItem.quantity || 1
        }
      });
      setNewItem({
        name: '',
        price: '',
        quantity: 1
      });
    }
  };

  const handleRemoveItem = (id) => {
    dispatch({ type: REMOVE_ITEM, payload: id });
  };

  const handleTaxChange = (e) => {
    setTaxAmount(e.target.value);
  };

  const handlePrev = () => {
    dispatch({ type: PREV_STEP });
  };

  const handleNext = () => {
    if (state.items.length > 0) {
      dispatch({ type: SET_TAX, payload: taxAmount });
      dispatch({ type: NEXT_STEP });
    } else {
      alert('Please add at least one item');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">What items are you splitting?</h2>

      <form onSubmit={handleAddItem} className="mb-6">
        <div className="grid grid-cols-12 gap-2 mb-4">
          <div className="col-span-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name
            </label>
            <input
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="e.g., Pizza"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              placeholder="0.00"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qty
            </label>
            <input
              type="number"
              min="1"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add Item
        </button>
      </form>

      {state.items.length > 0 && (
        <>
          <h3 className="text-lg font-medium mb-2">Items</h3>
          <ul className="mb-6 space-y-2">
            {state.items.map(item => (
              <li key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-200">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {item.quantity > 1 ? `${item.quantity} × ` : ''}
                    ${Number(item.price).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-red-500 hover:text-red-700 focus:outline-none"
                  aria-label={`Remove ${item.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxAmount}
              onChange={handleTaxChange}
              placeholder="0.00"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      <div className="flex justify-between">
        <button
          onClick={handlePrev}
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={state.items.length === 0}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ItemsInput;
