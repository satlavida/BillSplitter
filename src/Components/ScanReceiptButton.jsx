import React, { useState, useRef, useEffect } from 'react';
import useBillStore from '../billStore';
import { useShallow } from 'zustand/shallow';
import { Button, Modal, FileUpload, Spinner, Alert } from '../ui/components';
import useOnlineStatus from '../hooks/useOnlineStatus';

const API_URL = import.meta.env.VITE_WORKER_URL;

// Mode Selection Modal Component
const ModeSelectionModal = ({ isOpen, onClose, onSelectUpload, onSelectCapture }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white transition-colors">Choose Method</h2>
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
        
        <p className="mb-4 text-zinc-700 dark:text-zinc-300">How would you like to add your receipt?</p>
        <div className="flex flex-col space-y-4">
          <Button onClick={onSelectUpload} className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Choose from Gallery
          </Button>
          <Button onClick={onSelectCapture} className="flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            Take Photo
          </Button>
        </div>
      </div>
    </div>
  );
};

// Receipt Upload Form Component
const ReceiptUploadForm = ({ 
  onSubmit, 
  onCancel, 
  isLoading, 
  error, 
  fileInputRef, 
  onFileInputClick,
  useCameraCapture 
}) => {
  // Only intercept the click if useCameraCapture is undefined
  const handleFileInputClick = (e) => {
    if (useCameraCapture === undefined && onFileInputClick) {
      e.preventDefault();
      onFileInputClick();
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <FileUpload
        ref={fileInputRef}
        label={useCameraCapture ? "Take photo of receipt" : "Select receipt image"}
        accept="image/*"
        capture={useCameraCapture ? "environment" : undefined}
        error={error}
        onClick={handleFileInputClick}
      />

      <Alert type="warning">
        <p>⚠️ <strong>Privacy Notice:</strong> By uploading an image, you agree to send the data to Google for image analysis. The data may be used for training AI models.</p>
      </Alert>

      <div className="flex justify-end space-x-2 mt-4">
        <Button
          variant="secondary"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center">
              <Spinner className="mr-2" />
              Processing...
            </div>
          ) : (
            'Process Receipt'
          )}
        </Button>
      </div>
    </form>
  );
};

// Main ScanReceiptButton Component
const ScanReceiptButton = () => {
  // Use Zustand store with useShallow to prevent unnecessary re-renders
  const { addItem, setTax } = useBillStore(
    useShallow(state => ({
      addItem: state.addItem,
      setTax: state.setTax
    }))
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModeSelectionOpen, setIsModeSelectionOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useCameraCapture, setUseCameraCapture] = useState(undefined);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  const isOnline = useOnlineStatus();
  
  // Single file input ref
  const fileInputRef = useRef(null);

  const openModal = () => {
    if (!isOnline) {
      setIsOfflineModalOpen(true);
      return;
    }
    setIsModalOpen(true);
    setError(null);
    setUseCameraCapture(undefined);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
    setUseCameraCapture(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeOfflineModal = () => {
    setIsOfflineModalOpen(false);
  };

  const openModeSelection = () => {
    setIsModeSelectionOpen(true);
  };

  const closeModeSelection = () => {
    setIsModeSelectionOpen(false);
  };

  // React effect to trigger file input click when useCameraCapture changes from undefined
  useEffect(() => {
    // Only trigger if useCameraCapture is explicitly true or false (not undefined)
    if (useCameraCapture !== undefined && fileInputRef.current) {
      // Use setTimeout to ensure all state updates and renders have completed
      setTimeout(() => {
        fileInputRef.current.click();
      }, 100);
    }
  }, [useCameraCapture]);

  const handleSelectUpload = () => {
    closeModeSelection();
    setUseCameraCapture(false);
  };

  const handleSelectCapture = () => {
    closeModeSelection();
    setUseCameraCapture(true);
  };

  const validateImageFile = (file) => {
    // Check if file exists
    if (!file) return 'Please select an image file';
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return 'The selected file is not an image. Please select an image file.';
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return 'Image size exceeds 5MB. Please select a smaller image.';
    }
    
    return null; // No error
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data:image/xxx;base64, prefix
        const base64String = reader.result.split(',')[1];
        resolve({
          base64Data: base64String,
          mimeType: file.type
        });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const processReceiptItems = (data) => {
    // Add items to state
    data.items.forEach(item => {
      addItem({
        name: item.name,
        price: parseFloat(item.price) || 0,
        quantity: parseInt(item.quantity, 10) || 1
      });
    });

    // Set tax amount
    if (typeof data.tax === 'number' || typeof data.tax === 'string') {
      setTax(parseFloat(data.tax) || 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const file = fileInputRef.current?.files?.[0];
    
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Convert image to base64
      const imageData = await convertToBase64(file);
      
      // Prepare payload
      const payload = {
        image: imageData
      };

      const endpoint = API_URL;

      // Send request to worker
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      // Validate the response structure
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid response format: missing items array');
      }
      
      // Process the received data
      processReceiptItems(data);

      // Close modal after successful processing
      closeModal();
    } catch (err) {
      console.error('Error processing receipt:', err);
      setError('Failed to process receipt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        onClick={openModal}
        className="mb-4"
      >
        Scan Receipt
      </Button>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Upload Receipt"
      >
        <ReceiptUploadForm
          onSubmit={handleSubmit}
          onCancel={closeModal}
          isLoading={isLoading}
          error={error}
          fileInputRef={fileInputRef}
          onFileInputClick={openModeSelection}
          useCameraCapture={useCameraCapture}
        />
      </Modal>

      <ModeSelectionModal
        isOpen={isModeSelectionOpen}
        onClose={closeModeSelection}
        onSelectUpload={handleSelectUpload}
        onSelectCapture={handleSelectCapture}
      />

      <Modal
        isOpen={isOfflineModalOpen}
        onClose={closeOfflineModal}
        title="Offline"
      >
        <Alert type="warning">
          <p>You are offline. Scan Receipt requires an internet connection.</p>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={closeOfflineModal}>OK</Button>
        </div>
      </Modal>
    </>
  );
};

export default ScanReceiptButton;