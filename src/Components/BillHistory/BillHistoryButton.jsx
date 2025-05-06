import React, { memo, useState } from 'react';
import { Button } from '../../ui/components';
import BillHistoryModal from './BillHistoryModal';

const BillHistoryButton = memo(() => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  return (
    <>
      <Button
        variant="secondary"
        onClick={handleOpenModal}
        className="flex items-center gap-2"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={1.5} 
          stroke="currentColor" 
          className="w-5 h-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Bill History
      </Button>
      
      <BillHistoryModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
      />
    </>
  );
});

export default BillHistoryButton;