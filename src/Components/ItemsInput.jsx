import { useState, useRef, memo, useCallback, useEffect } from 'react';
import useBillStore, { useBillItems } from '../billStore';
import useCurrencyStore, { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { useTheme } from '../ThemeContext';
import { Button, Card } from '../ui/components';
import ScanReceiptButton from './ScanReceiptButton';
import EditItemModal from './EditItemModal';
import BillTotalsSummary from './BillTotalsSummary';

// Item form component with optimized rendering
const ItemForm = memo(({ onAddItem }) => {
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    quantity: 1
  });
  
  const nameRef = useRef(null);
  
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 transition-colors">
            Item Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={newItem.name}
            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
            placeholder="e.g., Pizza"
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
            required
          />
        </div>
        
        <div className="col-span-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 transition-colors">
            Price
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={newItem.price}
            onChange={(e) => setNewItem({...newItem, price: e.target.value})}
            placeholder="0.00"
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
            required
          />
        </div>
        
        <div className="col-span-3">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 transition-colors">
            Qty
          </label>
          <input
            type="number"
            min="1"
            value={newItem.quantity}
            onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
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
const ItemListItem = memo(({ item, onRemove, onEdit, formatCurrency }) => {
  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);
  
  const handleEdit = useCallback(() => {
    onEdit(item);
  }, [item, onEdit]);
  
  return (
    <li className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 shadow-sm transition-colors">
      <div>
        <span className="font-medium dark:text-white transition-colors">{item.name}</span>
        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
          {item.quantity > 1 ? `${item.quantity} × ` : ''}
          {formatCurrency(Number(item.price))}
        </span>
      </div>
      <div className="flex space-x-2">
        <button 
          onClick={handleEdit}
          className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800 rounded-full transition-colors"
          aria-label={`Edit ${item.name}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button 
          onClick={handleRemove}
          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:focus-visible:ring-red-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800 rounded-full transition-colors"
          aria-label={`Remove ${item.name}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </li>
  );
});

// Items list component
const ItemsList = memo(({ items, onRemove, onEdit, formatCurrency }) => {
  if (items.length === 0) return null;
  
  return (
    <>
      <h3 className="text-lg font-medium mb-2 text-zinc-800 dark:text-zinc-200 transition-colors">Items</h3>
      <ul className="mb-6 space-y-2">
        {items.map(item => (
          <ItemListItem 
            key={item.id} 
            item={item} 
            onRemove={onRemove}
            onEdit={onEdit}
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
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1 transition-colors">
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
        className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
          bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
          rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
          dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
          transition-colors"
      />
    </div>
  );
});

// Main ItemsInput component
const ItemsInput = () => {
  // Use Zustand store with specialized hooks and useShallow
  const items = useBillItems();
  
  const { taxAmount, addItem, removeItem, updateItem, setTax, nextStep, prevStep, getSubtotal } = 
    useBillStore(useShallow(state => ({
      taxAmount: state.taxAmount,
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      setTax: state.setTax,
      nextStep: state.nextStep,
      prevStep: state.prevStep,
      getSubtotal: state.getSubtotal
    })));
  
  const formatCurrency = useFormatCurrency();
  const { theme } = useTheme();
  
  const [localTaxAmount, setLocalTaxAmount] = useState(taxAmount || '');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  
  // Sync the local tax amount with the store on first render
  useEffect(() => {
    setLocalTaxAmount(taxAmount || '');
  }, [taxAmount]);
  
  const handleAddItem = useCallback((itemData) => {
    addItem(itemData);
  }, [addItem]);
  
  const handleRemoveItem = useCallback((id) => {
    removeItem(id);
  }, [removeItem]);
  
  const handleEditItem = useCallback((item) => {
    setCurrentItem(item);
    setEditModalOpen(true);
  }, []);
  
  const handleSaveItem = useCallback((itemId, updatedData) => {
    updateItem(itemId, updatedData);
  }, [updateItem]);
  
  const handleTaxChange = useCallback((e) => {
    setLocalTaxAmount(e.target.value);
  }, []);
  
  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);
  
  const handleNext = useCallback(() => {
    if (items.length > 0) {
      setTax(localTaxAmount);
      nextStep();
    } else {
      alert('Please add at least one item');
    }
  }, [items.length, localTaxAmount, setTax, nextStep]);

  // Get subtotal from the store helper
  const subtotal = useShallow(getSubtotal)();
  const tax = parseFloat(localTaxAmount) || 0;
  const total = subtotal + tax;
  
  return (
    <div>
      <ScanReceiptButton />
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">What items are you splitting?</h2>
      
      <Card>
        <ItemForm onAddItem={handleAddItem} />
      </Card>
      
      <ItemsList 
        items={items} 
        onRemove={handleRemoveItem}
        onEdit={handleEditItem}
        formatCurrency={formatCurrency}
      />
      
      {items.length > 0 && (
        <>
          <TaxInput 
            taxAmount={localTaxAmount}
            onTaxChange={handleTaxChange}
          />
          
          <BillTotalsSummary
            subtotal={subtotal}
            taxAmount={tax}
            grandTotal={total}
            formatCurrency={formatCurrency}
            className="mb-6"
          />
        </>
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
          disabled={items.length === 0}
        >
          Next
        </Button>
      </div>
      
      {/* Edit Item Modal */}
      <EditItemModal 
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        item={currentItem}
        onSave={handleSaveItem}
      />
    </div>
  );
};

export default ItemsInput;