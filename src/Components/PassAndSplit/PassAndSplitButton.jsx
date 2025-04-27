import React, { useState } from 'react';
import { useTheme } from '../../ThemeContext';
import PassAndSplit from '../PassAndSplit';
import ModalPortal from './ModalPortal';

/**
 * Button to activate Pass and Split mode from the item assignment screen
 */
const PassAndSplitButton = () => {
  const { theme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  return (
    <>
      <button
        onClick={openModal}
        className={`
          mt-4 py-2 px-4 rounded-lg font-medium flex items-center justify-center w-full
          dark:bg-indigo-700 dark:hover:bg-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white
          transition-colors
        `}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 8L10 16L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z" stroke="currentColor" strokeWidth="2"/>
        </svg>
        Pass & Split
      </button>
      
      <ModalPortal isOpen={isModalOpen} onClose={closeModal}>
        <PassAndSplit onClose={closeModal} />
      </ModalPortal>
    </>
  );
};

export default PassAndSplitButton;