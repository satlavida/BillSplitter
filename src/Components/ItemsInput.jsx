import { useState, useRef, memo, useCallback, useEffect } from 'react';
import useBillStore, { useBillItems, getDiscountedItemPrice } from '../billStore';
import { useFormatCurrency } from '../currencyStore';
import { useShallow } from 'zustand/shallow';
import { Button, Card } from '../ui/components';
import TaxManager from './TaxManager';
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
    if (newItem.name.trim() && newItem.price !== '' && !isNaN(Number(newItem.price))) {
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

// Individual item list item (draggable)
const ItemListItem = memo(({ item, onRemove, onEdit, formatCurrency, onDragStart, displayAmount, postTaxEnabled }) => {
  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);

  const handleEdit = useCallback(() => {
    onEdit(item);
  }, [item, onEdit]);

  const hasDiscount = item.discount > 0;
  const discountText = hasDiscount
    ? `Discount ${
        item.discountType === 'percentage'
          ? `${item.discount}%`
          : formatCurrency(item.discount)
      }`
    : '';

  return (
    <li
      className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600 shadow-sm transition-colors"
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium dark:text-white transition-colors">{item.name}</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
            {item.quantity > 1 ? `${item.quantity} × ` : ''}
            {formatCurrency(displayAmount)}
          </span>
          {postTaxEnabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 uppercase tracking-wide">
              incl. tax
            </span>
          )}
        </div>
        {hasDiscount && (
          <span className="block text-xs text-zinc-500 dark:text-zinc-400 transition-colors">
            ({discountText})
          </span>
        )}
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

// Section block with heading and drop target for moving items
const SectionBlock = memo(({ title, items, sectionId, onDropToSection, onRemoveItem, onEditItem, formatCurrency, computeDisplayAmount, postTaxEnabled }) => {
  const [isOver, setIsOver] = useState(false);
  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragEnter = useCallback((e) => { e.preventDefault(); setIsOver(true); }, []);
  const handleDragLeave = useCallback(() => { setIsOver(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (itemId) onDropToSection(itemId, sectionId);
    setIsOver(false);
  }, [onDropToSection, sectionId]);
  const handleDragStart = useCallback((e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2 text-zinc-800 dark:text-zinc-100 transition-colors">{title}</h3>
      <ul
        className={`mb-2 space-y-2 p-2 border border-dashed rounded-md min-h-[2.5rem] transition-colors ${isOver ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-zinc-300 dark:border-zinc-600'}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {items.map(item => (
          <ItemListItem
            key={item.id}
            item={item}
            onRemove={onRemoveItem}
            onEdit={onEditItem}
            onDragStart={handleDragStart}
            formatCurrency={formatCurrency}
            displayAmount={computeDisplayAmount(item)}
            postTaxEnabled={postTaxEnabled}
          />
        ))}
      </ul>
    </div>
  );
});

// Sections Manager component
const SectionsManager = memo(({ sections, onAdd, onUpdate, onRemove }) => {
  const [name, setName] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim() });
    setName('');
  };

  return (
    <Card>
      <h3 className="text-lg font-medium mb-2 text-zinc-800 dark:text-zinc-200 transition-colors">Sections</h3>
      {sections.length > 0 && (
        <ul className="mb-4 divide-y divide-zinc-100 dark:divide-zinc-700">
          {sections.map(sec => (
            <li key={sec.id} className="py-2 flex items-center gap-2">
              <input
                type="text"
                value={sec.name}
                onChange={(e) => onUpdate(sec.id, { name: e.target.value })}
                className="flex-1 p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md"
                placeholder="Section name"
              />
              <Button variant="danger" size="sm" onClick={() => onRemove(sec.id)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="grid grid-cols-12 gap-2">
        <div className="col-span-7">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New section name"
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md"
          />
        </div>
        <div className="col-span-5">
          <Button type="submit" className="w-full">Add</Button>
        </div>
      </form>
    </Card>
  );
});

// Removed legacy TaxInput; taxes are managed via TaxesManager

// Main ItemsInput component
const ItemsInput = () => {
  // Use Zustand store with specialized hooks and useShallow
  const items = useBillItems();
  
  const { addItem, removeItem, updateItem, nextStep, prevStep, getSubtotal, sections, addSection, updateSection, removeSection, assignItemToSection, getSectionsSummary, sectionTaxes, addTax, updateTax, removeTax } = 
    useBillStore(useShallow(state => ({
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateItem: state.updateItem,
      nextStep: state.nextStep,
      prevStep: state.prevStep,
      getSubtotal: state.getSubtotal,
      sections: state.sections,
      addSection: state.addSection,
      updateSection: state.updateSection,
      removeSection: state.removeSection,
      assignItemToSection: state.assignItemToSection,
      getSectionsSummary: state.getSectionsSummary,
      sectionTaxes: state.sectionTaxes,
      addTax: state.addTax,
      updateTax: state.updateTax,
      removeTax: state.removeTax,
    })));
  
  const formatCurrency = useFormatCurrency();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [showSectionsManager, setShowSectionsManager] = useState(false);
  
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

  const handleDropToSection = useCallback((itemId, sectionId) => {
    assignItemToSection(itemId, sectionId || null);
  }, [assignItemToSection]);
  
  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);
  
  const handleNext = useCallback(() => {
    if (items.length > 0) {
      nextStep();
    } else {
      alert('Please add at least one item');
    }
  }, [items.length, nextStep]);

  // Compute section subtotals for tax logic and item display
  const sectionSubtotals = (() => {
    const map = {};
    items.forEach(it => {
      const key = it.sectionId || '';
      map[key] = (map[key] || 0) + (getDiscountedItemPrice(it) * (parseInt(it.quantity) || 1));
    });
    return map;
  })();
  
  // Get subtotal from the store helper
  const subtotal = useShallow(getSubtotal)();
  const sectionsSummary = useShallow(getSectionsSummary)();
  const tax = sectionsSummary.reduce((sum, s) => sum + (parseFloat(s.tax) || 0), 0);
  const total = subtotal + tax;
  const sectionTaxTotalsMap = (() => {
    const map = {};
    sectionsSummary.forEach(s => { map[s.id || ''] = parseFloat(s.tax) || 0; });
    return map;
  })();
  const postTaxEnabled = useBillStore(state => state.showPostTaxPrice);
  const computeDisplayAmount = useCallback((item) => {
    const base = getDiscountedItemPrice(item) * (parseInt(item.quantity) || 1);
    if (!postTaxEnabled) return base;
    const key = item.sectionId || '';
    const secSubtotal = sectionSubtotals[key] || 0;
    const secTax = sectionTaxTotalsMap[key] || 0;
    if (secSubtotal <= 0 || secTax <= 0) return base;
    return base + (base / secSubtotal) * secTax;
  }, [postTaxEnabled, sectionSubtotals, sectionTaxTotalsMap]);
  
  return (
    <div>
      <ScanReceiptButton />
      <h2 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-white transition-colors">What items are you splitting?</h2>
      
      <Card>
        <ItemForm onAddItem={handleAddItem} />
      </Card>
      
      {(() => {
        const itemsBySection = new Map();
        items.forEach(it => {
          const key = it.sectionId || '';
          if (!itemsBySection.has(key)) itemsBySection.set(key, []);
          itemsBySection.get(key).push(it);
        });
        const blocks = [];
        // Default unlabeled
        blocks.push(
          <SectionBlock
            key="__default__"
            title="Default"
            items={itemsBySection.get('') || []}
            sectionId={null}
            onDropToSection={handleDropToSection}
            onRemoveItem={handleRemoveItem}
            onEditItem={handleEditItem}
            formatCurrency={formatCurrency}
            computeDisplayAmount={computeDisplayAmount}
            postTaxEnabled={postTaxEnabled}
          />
        );
        // Labeled sections
        sections.forEach(sec => {
          blocks.push(
            <SectionBlock
              key={sec.id}
              title={sec.name || 'Section'}
              items={itemsBySection.get(sec.id) || []}
              sectionId={sec.id}
              onDropToSection={handleDropToSection}
              onRemoveItem={handleRemoveItem}
              onEditItem={handleEditItem}
              formatCurrency={formatCurrency}
              computeDisplayAmount={computeDisplayAmount}
              postTaxEnabled={postTaxEnabled}
            />
          );
        });
        return blocks;
      })()}
      
      {items.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSectionsManager(v => !v)}
            >
              {showSectionsManager ? 'Hide Add New Section' : 'Add New Section'}
            </Button>
          </div>
          {showSectionsManager && (
            <SectionsManager
              sections={sections}
              onAdd={addSection}
              onUpdate={updateSection}
              onRemove={removeSection}
            />
          )}

          {/* Taxes manager (default + sections) */}
          <TaxManager
            sections={sections}
            sectionTaxes={sectionTaxes}
            onAddTax={addTax}
            onUpdateTax={updateTax}
            onRemoveTax={removeTax}
          />
          
          {(() => {
            const appliedRows = sectionsSummary
              .filter(s => (parseFloat(s.tax) || 0) > 0)
              .map(s => ({ label: (s.name && s.name.trim().length > 0 ? s.name : 'Global') + ' Tax', amount: s.tax, id: s.id }));
            const rows = [...appliedRows.filter(r => r.id), ...appliedRows.filter(r => !r.id)].map(({ label, amount }) => ({ label, amount }));
            return (
              <BillTotalsSummary
                subtotal={subtotal}
                taxAmount={tax}
                grandTotal={total}
                formatCurrency={formatCurrency}
                className="mb-6"
                taxesBreakdown={rows}
              />
            );
          })()}
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
