import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * A reusable modal portal component that renders content directly to document.body
 * Handles accessibility and keyboard events as well
 */
const ModalPortal = ({ 
  children, 
  isOpen, 
  onClose, 
  lockScroll = true 
}) => {
  // Don't render anything if the modal isn't open
  if (!isOpen) return null;
  
  // Handle scroll locking
//   useEffect(() => {
//     const originalStyle = window.getComputedStyle(document.body).overflow;
    
//     // Prevent background scrolling when modal is open
//     if (lockScroll) {
//       document.body.style.overflow = 'hidden';
//     }
    
//     // Clean up
//     return () => {
//       if (lockScroll) {
//         document.body.style.overflow = originalStyle;
//       }
//     };
//   }, [lockScroll]);
  
  // Handle ESC key to close the modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);
  
  // Set focus trap inside modal for better accessibility
  useEffect(() => {
    // Save the active element before opening the modal
    const activeElement = document.activeElement;
    
    // Find all focusable elements in the modal
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      // Focus the first element by default
      focusableElements[0].focus();
    }
    
    // Return focus to the previous element when closing
    return () => {
      if (activeElement) {
        activeElement.focus();
      }
    };
  }, []);
  
  // Render the modal to the document body using createPortal
  return createPortal(
    children,
    document.body
  );
};

export default ModalPortal;