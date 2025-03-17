import React, { useState, useContext, useRef } from 'react';
import { BillContext } from '../BillContext'; 

const API_URL = import.meta.env.VITE_WORKER_URL;
console.log(API_URL);
const ScanReceiptButton = () => {
  const { dispatch } = useContext(BillContext);
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
      
      // Process response: add items to state
      data.items.forEach(item => {
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            name: item.name,
            price: parseFloat(item.price) || 0,
            quantity: parseInt(item.quantity, 10) || 1,
            consumedBy: []
          }
        });
      });

      // Set tax amount
      if (typeof data.tax === 'number' || typeof data.tax === 'string') {
        dispatch({
          type: 'SET_TAX',
          payload: parseFloat(data.tax) || 0
        });
      }

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
      <button
        type="button"
        onClick={openModal}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
      >
        Scan Receipt
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Upload Receipt Image</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select receipt image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200"
                />
              </div>

              <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900 rounded text-sm text-yellow-800 dark:text-yellow-200">
                <p>⚠️ <strong>Privacy Notice:</strong> By uploading an image, you agree to send the data to Google for image analysis. The data may be used for training AI models.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 rounded text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    'Upload Receipt'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ScanReceiptButton;