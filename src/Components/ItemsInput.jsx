import { useState, useContext, useRef, memo } from 'react';
import { BillContext, ADD_ITEM, REMOVE_ITEM, SET_TAX, NEXT_STEP, PREV_STEP } from '../BillContext';
import { Button, Input, Card } from '../ui/components';

// Item form component
const ItemForm = memo(({ onAddItem }) => {
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    quantity: 1
  });
  
  const nameRef = useRef(null);
  const priceRef = useRef(null);
  const quantityRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (newItem.name.trim() && Number(newItem.price) > 0) {
      onAddItem({
        name: newItem.name.trim(),
        price: newItem.price,
        quantity: newItem.quantity || 1
      });
      
      setNewItem({
        name: '',
        price: '',
        quantity: 1
      });
      
      // Focus the name input for better UX
      nameRef.current?.focus();
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="grid grid-cols-12 gap-2 mb-4">
        <div className="col-span-5">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Item Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
            placeholder="e.g., Pizza"
            className="w-full p-2 border border-zinc-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
            required
          />
        </div>
        
        <div className="col-span-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Price
          </label>
          <input
            ref={priceRef}
            type="number"
            min="0"
            step="0.01"
            value={newItem.price}
            onChange={(e) => setNewItem({...newItem, price: e.target.value})}
            placeholder="0.00"
            className="w-full p-2 border border-zinc-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
            required
          />
        </div>
        
        <div className="col-span-3">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Qty
          </label>
          <input
            ref={quantityRef}
            type="number"
            min="1"
            value={newItem.quantity}
            onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
            className="w-full p-2 border border-zinc-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
            required
          />
        </div>
      </div>
      
      <Button 
        type="submit"
        className="w-full"
      >
        Add Item
      </Button>
    </form>
  );
});

// Individual item list item
const ItemListItem = memo(({ item, onRemove, formatCurrency }) => {
  return (
    <li className="flex justify-between items-center p-2 bg-zinc-50 rounded-md border border-zinc-200 shadow-sm">
      <div>
        <span className="font-medium">{item.name}</span>
        <span className="ml-2 text-sm text-zinc-600">
          {item.quantity > 1 ? `${item.quantity} × ` : ''}
          {formatCurrency(Number(item.price))}
        </span>
      </div>
      <button 
        onClick={() => onRemove(item.id)}
        className="text-red-500 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 rounded-full transition-colors"
        aria-label={`Remove ${item.name}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </li>
  );
});

// Items list component
const ItemsList = memo(({ items, onRemove, formatCurrency }) => {
  if (items.length === 0) return null;
  
  return (
    <>
      <h3 className="text-lg font-medium mb-2">Items</h3>
      <ul className="mb-6 space-y-2">
        {items.map(item => (
          <ItemListItem 
            key={item.id} 
            item={item} 
            onRemove={onRemove}
            formatCurrency={formatCurrency}
          />
        ))}
      </ul>
    </>
  );
});

// Tax input component
const TaxInput = memo(({ taxAmount, onTaxChange }) => {
  const taxRef = useRef(null);
  
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        Tax Amount
      </label>
      <input
        ref={taxRef}
        type="number"
        min="0"
        step="0.01"
        value={taxAmount}
        onChange={onTaxChange}
        placeholder="0.00"
        className="w-full p-2 border border-zinc-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
      />
    </div>
  );
});

// Main ItemsInput component
const ItemsInput = () => {
  const { state, dispatch, formatCurrency } = useContext(BillContext);
  const [taxAmount, setTaxAmount] = useState(state.taxAmount || '');
  
  const handleAddItem = (itemData) => {
    dispatch({ 
      type: ADD_ITEM, 
      payload: itemData
    });
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
      
      <Card>
        <ItemForm onAddItem={handleAddItem} />
      </Card>
      
      <ItemsList 
        items={state.items} 
        onRemove={handleRemoveItem}
        formatCurrency={formatCurrency}
      />
      
      {state.items.length > 0 && (
        <TaxInput 
          taxAmount={taxAmount}
          onTaxChange={handleTaxChange}
        />
      )}
      
      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={handlePrev}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={state.items.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default ItemsInput;