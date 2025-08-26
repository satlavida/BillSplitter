import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import useBillHistoryStore from '../../billHistoryStore';
import useBillStore from '../../billStore';
import { Button, Alert, Input } from '../../ui/components';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMethod, setSortMethod] = useState('date'); // 'date' or 'name'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [maxHeight, setMaxHeight] = useState('60vh');
  
  // Calculate max height for the bills list based on window height
  useEffect(() => {
    if (isOpen) {
      const calculateMaxHeight = () => {
        // Set max height to 70% of viewport height
        setMaxHeight(`${window.innerHeight * 0.7}px`);
      };
      
      calculateMaxHeight();
      window.addEventListener('resize', calculateMaxHeight);
      
      return () => {
        window.removeEventListener('resize', calculateMaxHeight);
      };
    }
  }, [isOpen]);
  
  // Get bills from store
  const { bills, deleteBill, clearHistory, setCurrentBill, exportBills, importBills } = 
    useBillHistoryStore(useShallow(state => ({
      bills: state.bills,
      deleteBill: state.deleteBill,
      clearHistory: state.clearHistory,
      setCurrentBill: state.setCurrentBill,
      exportBills: state.exportBills,
      importBills: state.importBills
    })));
  
  // Get import function from bill store
  const { importBill, setBillId } = useBillStore(useShallow(state => ({
    importBill: state.importBill,
    setBillId: state.setBillId
  })));
  
  // Filter and sort bills
  const filteredAndSortedBills = React.useMemo(() => {
    // First filter by search term
    const filtered = bills.filter(bill => 
      (bill.title || 'Untitled Bill')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
    
    // Then sort based on method and direction
    return [...filtered].sort((a, b) => {
      if (sortMethod === 'date') {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortMethod === 'name') {
        const titleA = (a.title || 'Untitled Bill').toLowerCase();
        const titleB = (b.title || 'Untitled Bill').toLowerCase();
        return sortDirection === 'asc' 
          ? titleA.localeCompare(titleB) 
          : titleB.localeCompare(titleA);
      }
      return 0;
    });
  }, [bills, searchTerm, sortMethod, sortDirection]);
  
  // Toggle sort direction
  const toggleSortDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);
  
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
  
  // Handle deleting all bills
  const handleDeleteAllBills = useCallback(() => {
    if (window.confirm('Are you sure you want to delete all bills? This action cannot be undone.')) {
      clearHistory();
    }
  }, [clearHistory]);
  
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
      } catch (_) {
        setImportError('Invalid file format');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    e.target.value = null;
  }, [importBills]);
  
  // Clear search term
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);
  
  return (
    <ModalPortal 
      isOpen={isOpen} 
      onClose={onClose}
    >
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-xl w-full max-h-[90vh] transition-colors flex flex-col">
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
          
          <div className="mb-4 flex flex-col space-y-2">
            {/* Search input */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Search bills by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
              {searchTerm && (
                <button 
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 focus:outline-none"
                  aria-label="Clear search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Sort controls */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-400 transition-colors">Sort by:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSortMethod('date')}
                  className={`px-2 py-1 text-sm rounded-md ${
                    sortMethod === 'date' 
                      ? 'bg-blue-600 text-white dark:bg-blue-500' 
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                  } transition-colors`}
                >
                  Date
                </button>
                <button
                  onClick={() => setSortMethod('name')}
                  className={`px-2 py-1 text-sm rounded-md ${
                    sortMethod === 'name' 
                      ? 'bg-blue-600 text-white dark:bg-blue-500' 
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                  } transition-colors`}
                >
                  Name
                </button>
              </div>
              <button
                onClick={toggleSortDirection}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
              >
                {sortDirection === 'asc' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {/* Scrollable bills list */}
          <div 
            className="mb-4 overflow-y-auto flex-grow"
            style={{ maxHeight }}
          >
            {filteredAndSortedBills.length > 0 ? (
              filteredAndSortedBills.map(bill => (
                <BillHistoryItem
                  key={bill.id}
                  bill={bill}
                  onLoad={handleLoadBill}
                  onDelete={handleDeleteBill}
                />
              ))
            ) : searchTerm ? (
              <p className="text-zinc-600 dark:text-zinc-400 text-center py-4 transition-colors">
                No bills match your search term "{searchTerm}".
              </p>
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
            <div className="flex flex-row h-auto space-x-2">
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
              
              <Button
                variant="danger"
                onClick={handleDeleteAllBills}
                disabled={bills.length === 0}
              >
                Delete All
              </Button>
            </div>
            
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={filteredAndSortedBills.length === 0}
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