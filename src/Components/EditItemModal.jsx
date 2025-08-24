import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from '../ui/components';

const EditItemModal = ({ isOpen, onClose, item, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    quantity: 1,
    discount: 0,
    discountType: 'flat'
  });
  const nameInputRef = useRef(null);

  // Initialize form data when modal opens or item changes
  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount || 0,
        discountType: item.discountType || 'flat'
      });
      
      // Focus the name input when the modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim() && formData.price !== '' && !isNaN(Number(formData.price))) {
      onSave(item.id, {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity) || 1,
        discount: parseFloat(formData.discount) || 0,
        discountType: formData.discountType
      });
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Item">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="itemName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Item Name
          </label>
          <input
            ref={nameInputRef}
            id="itemName"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
            placeholder="Enter item name"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="itemPrice" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Price
          </label>
          <input
            id="itemPrice"
            name="price"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={handleChange}
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
            placeholder="0.00"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="itemDiscount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Discount
          </label>
          <div className="flex space-x-2">
            <input
              id="itemDiscount"
              name="discount"
              type="number"
              step="0.01"
              value={formData.discount}
              onChange={handleChange}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800 transition-colors"
              placeholder="0.00"
            />
            <select
              name="discountType"
              value={formData.discountType}
              onChange={handleChange}
              className="p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800 transition-colors"
            >
              <option value="flat">Flat</option>
              <option value="percentage">%</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="itemQuantity" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Quantity
          </label>
          <input
            id="itemQuantity"
            name="quantity"
            type="number"
            min="1"
            value={formData.quantity}
            onChange={handleChange}
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
            required
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button 
            variant="secondary" 
            onClick={onClose}
            type="button"
          >
            Cancel
          </Button>
          <Button type="submit">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditItemModal;