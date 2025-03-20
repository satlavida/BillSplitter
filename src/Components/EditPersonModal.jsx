import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button } from '../ui/components';

const EditPersonModal = ({ isOpen, onClose, person, onSave }) => {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  // Initialize name when modal opens
  useEffect(() => {
    if (isOpen && person) {
      setName(person.name);
      // Focus the input when the modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, person]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(person.id, name.trim());
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Person">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="personName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Name
          </label>
          <input
            ref={inputRef}
            id="personName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 
              bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
              rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
              dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
              transition-colors"
            placeholder="Enter name"
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

export default EditPersonModal;