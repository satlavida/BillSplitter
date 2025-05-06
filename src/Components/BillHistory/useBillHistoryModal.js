import { useState, useCallback } from 'react';

// Custom hook to manage bill history modal state
const useBillHistoryModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);
  
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);
  
  const toggleModal = useCallback(() => {
    setIsModalOpen(prev => !prev);
  }, []);
  
  return {
    isModalOpen,
    openModal,
    closeModal,
    toggleModal
  };
};

export default useBillHistoryModal; 