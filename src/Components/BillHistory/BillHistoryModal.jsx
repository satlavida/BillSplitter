import React, { useState, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import useBillHistoryStore from '../../billHistoryStore';
import useBillStore from '../../billStore';
import { Button, Alert } from '../../ui/components';
import ModalPortal from '../PassAndSplit/ModalPortal';

// Format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// BillHistoryItem component
const BillHistoryItem = ({ bill, onLoad, onDelete }) => {
  return (
    <div className="p-3 mb-3 border rounded-lg border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-medium text-zinc-800 dark:text-white transition-colors">
            {bill.title || 'Untitled Bill'} 
            <span className="text-xs ml-2 text-zinc-500 dark:text-zinc-400 transition-colors">
              #{bill.id}
            </span>
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">
            {formatDate(bill.date)}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onLoad(bill.id)}
            disabled={bill.isCurrent}
          >
            {bill.isCurrent ? 'Current' : 'Load'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(bill.id)}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main BillHistoryModal component
const BillHistoryModal = ({ isOpen, onClose }) => {
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  
  // Get bills from store
  const { bills, deleteBill, setCurrentBill, exportBills, importBills } = 
    useBillHistoryStore(useShallow(state => ({
      bills: state.bills,
      deleteBill: state.deleteBill,
      setCurrentBill: state.setCurrentBill,
      exportBills: state.exportBills,
      importBills: state.importBills
    })));
  
  // Get import function from bill store
  const { importBill, setBillId } = useBillStore(useShallow(state => ({
    importBill: state.importBill,
    setBillId: state.setBillId
  })));
  
  // Sort bills by date (newest first)
  const sortedBills = [...bills].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  // Handle loading a bill
  const handleLoadBill = useCallback((billId) => {
    const bill = bills.find(b => b.id === billId);
    if (bill) {
      // Import bill data into current bill store
      importBill(bill.data);
      // Set the bill ID in the current bill
      setBillId(billId);
      // Set as current in history
      setCurrentBill(billId);
      // Close modal
      onClose();
    }
  }, [bills, importBill, setBillId, setCurrentBill, onClose]);
  
  // Handle deleting a bill
  const handleDeleteBill = useCallback((billId) => {
    if (window.confirm('Are you sure you want to delete this bill?')) {
      deleteBill(billId);
    }
  }, [deleteBill]);
  
  // Handle exporting all bills
  const handleExport = useCallback(() => {
    const jsonData = exportBills();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-splitter-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }, [exportBills]);
  
  // Handle clicking the import button
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  // Handle file selection for import
  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset status
    setImportError(null);
    setImportSuccess(false);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = importBills(event.target.result);
        if (result.success) {
          setImportSuccess(true);
        } else {
          setImportError(result.error || 'Failed to import bills');
        }
      } catch (error) {
        setImportError('Invalid file format');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    e.target.value = null;
  }, [importBills]);
  
  return (
    <ModalPortal 
      isOpen={isOpen} 
      onClose={onClose}
    >
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-xl w-full transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold dark:text-white transition-colors">Bill History</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="mb-4">
            {sortedBills.length > 0 ? (
              sortedBills.map(bill => (
                <BillHistoryItem
                  key={bill.id}
                  bill={bill}
                  onLoad={handleLoadBill}
                  onDelete={handleDeleteBill}
                />
              ))
            ) : (
              <p className="text-zinc-600 dark:text-zinc-400 text-center py-4 transition-colors">
                No saved bills yet. Complete a bill to add it to history.
              </p>
            )}
          </div>
          
          {importError && (
            <Alert type="error" className="mb-4">
              Import error: {importError}
            </Alert>
          )}
          
          {importSuccess && (
            <Alert type="success" className="mb-4">
              Bills imported successfully!
            </Alert>
          )}
          
          <div className="flex justify-between mt-4">
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={handleImportClick}
              >
                Import Bills
              </Button>
            </div>
            
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={sortedBills.length === 0}
            >
              Export All Bills
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default BillHistoryModal;