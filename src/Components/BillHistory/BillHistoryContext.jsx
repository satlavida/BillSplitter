import React, { createContext, useContext } from 'react';
import useBillHistoryModal from './useBillHistoryModal';
import BillHistoryModal from './BillHistoryModal';

// Create context
const BillHistoryContext = createContext(null);

// Provider component
export const BillHistoryProvider = ({ children }) => {
  const modalControls = useBillHistoryModal();
  
  return (
    <BillHistoryContext.Provider value={modalControls}>
      {children}
      <BillHistoryModal 
        isOpen={modalControls.isModalOpen} 
        onClose={modalControls.closeModal} 
      />
    </BillHistoryContext.Provider>
  );
};

// Hook to use bill history context
export const useBillHistory = () => {
  const context = useContext(BillHistoryContext);
  if (!context) {
    throw new Error('useBillHistory must be used within a BillHistoryProvider');
  }
  return context;
};

export default BillHistoryContext;