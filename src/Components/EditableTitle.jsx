import React, { useState, useRef, useEffect } from 'react';

const EditableTitle = ({ title, onSave, placeholder }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title || '');
  const inputRef = useRef(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      onSave(value);
    }
    setIsEditing(false);
  };

  const handleChange = (e) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (value.trim()) {
        onSave(value);
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setValue(title);
      setIsEditing(false);
    }
  };

  // Function to generate a default title suggestion with today's date
  const suggestDefaultTitle = () => {
    if (!value && !title) {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      return `Restaurant ${dateString}`;
    }
    return value || title;
  };

  const handleSaveClick = () => {
    if (value.trim()) {
      onSave(value);
    } else {
      // If empty, create a default title
      const defaultTitle = suggestDefaultTitle();
      setValue(defaultTitle);
      onSave(defaultTitle);
    }
    setIsEditing(false);
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">
        This bill is for:
      </label>
      
      <div className="relative">
        {isEditing ? (
          <div className="flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "e.g., Pizza Hut 2025-03-20"}
              className="w-full p-2 border-b-2 border-dashed border-blue-500 
                bg-transparent text-lg font-medium text-zinc-800 dark:text-white
                focus:outline-none focus:border-blue-600"
              autoComplete="off"
            />
            <button
              onClick={handleSaveClick}
              className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 
                text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        ) : (
          <div
            onClick={handleClick}
            className="cursor-text p-2 border-b-2 border-dashed border-zinc-300 dark:border-zinc-600
              text-lg font-medium text-zinc-800 dark:text-white min-h-[2.5rem] flex items-center
              hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors"
          >
            {title ? (
              title
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">
                {placeholder || "Click to add title (e.g., Pizza Hut 2025-03-20)"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableTitle;