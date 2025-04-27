import React, { useState, useRef } from 'react';
import useBillStore from '../billStore';
import { useShallow } from 'zustand/shallow';
import { Button, Modal, FileUpload, Spinner, Alert } from '../ui/components';

const API_URL = import.meta.env.VITE_WORKER_URL;

// Receipt Upload Form Component
const ReceiptUploadForm = ({ onSubmit, onCancel, isLoading, error, fileInputRef }) => {
  return (
    <form onSubmit={onSubmit}>
      <FileUpload
        ref={fileInputRef}
        label="Select receipt image"
        accept="image/*"
        error={error}
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
            'Upload Receipt'
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const openModal = () => {
    setIsModalOpen(true);
    setError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    
    const file = fileInputRef.current.files[0];
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
      const { setBillImage } = useBillStore();
      setBillImage(`data:${imageData.mimeType};base64,${imageData.base64Data}`);
      
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
        title="Upload Receipt Image"
      >
        <ReceiptUploadForm
          onSubmit={handleSubmit}
          onCancel={closeModal}
          isLoading={isLoading}
          error={error}
          fileInputRef={fileInputRef}
        />
      </Modal>
    </>
  );
};

export default ScanReceiptButton;