import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A reusable modal portal component that renders content directly to document.body
 * Handles accessibility and keyboard events as well
 */
const ModalPortal = ({ children, isOpen, onClose }: ModalPortalProps) => {
  // Handle ESC key to close the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Set focus trap inside modal for better accessibility
  useEffect(() => {
    if (!isOpen) return;

    // Save the active element before opening the modal
    const activeElement = document.activeElement as HTMLElement | null;

    // Find all focusable elements in the modal
    const focusableElements = document.querySelectorAll<HTMLElement>(
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
  }, [isOpen]);

  // Don't render anything if the modal isn't open
  if (!isOpen) return null;

  // Render the modal to the document body using createPortal
  return createPortal(children, document.body);
};

export default ModalPortal;
