import React, { memo, useEffect, useRef, useState } from 'react';

// Reusable Button component
export const Button = memo(({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false, 
  onClick, 
  type = 'button',
  className = '',
  ref,
  ...props 
}) => {
  // Button variants with dark mode support
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
    secondary: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
    success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
  };
  
  // Button sizes
  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      ref={ref}
      type={type}
      className={`
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 
        focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
        transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});

// Input Field component
export const Input = memo(({
  label,
  type = 'text',
  error,
  className = '',
  containerClassName = '',
  required = false,
  ref,
  ...props
}) => {
  return (
    <div className={`mb-4 ${containerClassName}`}>
      {label && (
        <label 
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          htmlFor={props.id || props.name}
        >
          {label}
          {required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={`
          w-full p-2 border border-zinc-300 dark:border-zinc-600 
          bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white
          rounded-md focus:outline-none
          focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
          dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
          transition-colors
          ${error ? 'border-red-500 dark:border-red-400' : ''}
          ${className}
        `}
        required={required}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

// Card component
export const Card = memo(({ children, className = '', ...props }) => {
  return (
    <div 
      className={`mb-6 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 shadow-sm transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

// Toggle Button component (for selection)
export const ToggleButton = memo(({ 
  selected, 
  onClick, 
  children,
  className = '',
  ...props 
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-1 rounded-full transition-colors
        ${selected 
          ? 'bg-blue-600 text-white dark:bg-blue-500 shadow-sm' 
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
});

// Print Button component
export const PrintButton = memo(({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:focus-visible:ring-green-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800 transition-colors"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor" 
        className="w-5 h-5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
      </svg>
      Print Bill
    </button>
  );
});

// SelectAll Button component
export const SelectAllButton = memo(({ 
  allSelected, 
  onSelectAll, 
  onDeselectAll,
  className = '',
  ...props 
}) => {
  const handleClick = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        px-3 py-1 bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300
        rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-600
        focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:focus-visible:ring-zinc-400 
        focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800
        transition-colors flex items-center gap-1
        ${className}
      `}
      {...props}
    >
      {allSelected ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Deselect All
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Select All
        </>
      )}
    </button>
  );
});

// Print wrapper for styling print content
export const PrintWrapper = memo(({ children }) => {
  return (
    <div className="print-content">
      {children}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
});

// Modal component
export const Modal = memo(({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '',
  ...props 
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full transition-colors ${className}`} {...props}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white transition-colors">{title}</h2>
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
        {children}
      </div>
    </div>
  );
});

// File upload component

export const FileUpload = memo(({ 
  label, 
  accept, 
  onChange, 
  error,
  containerClassName = '',
  capture,
  onClick,
  ref,
  ...props 
}) => {
  return (
    <div className={`mb-4 ${containerClassName}`}>
      {label && (
        <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors">
          {label}
        </label>
      )}
      <input
        type="file"
        ref={ref}
        accept={accept}
        onChange={onChange}
        onClick={onClick}
        // Only add capture attribute when it's provided
        {...(capture ? { capture } : {})}
        className="block w-full text-sm text-zinc-700 dark:text-zinc-300 transition-colors
          file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 
          file:text-sm file:font-medium 
          file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 
          dark:file:bg-blue-900 dark:file:text-blue-200"
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400 transition-colors">{error}</p>}
    </div>
  );
});

// Loading spinner component
export const Spinner = memo(({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-6 w-6',
  };
  
  return (
    <svg 
      className={`animate-spin ${sizes[size] || sizes.md} ${className}`} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
});

// Alert component
export const Alert = memo(({ 
  type = 'info', 
  children,
  className = '',
  ...props 
}) => {
  const types = {
    info: 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    success: 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  
  return (
    <div 
      className={`mb-4 p-3 rounded ${types[type] || types.info} transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

// Dropdown (custom select) component
// Props: options [{ value, label }], value, onChange(value), placeholder, className, buttonClassName
export const Dropdown = memo(({ 
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  className = '',
  buttonClassName = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));
  const label = selected ? selected.label : placeholder;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSelect = (val) => {
    onChange && onChange(val);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-800 transition-colors ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={!selected ? 'text-zinc-500 dark:text-zinc-400' : ''}>{label}</span>
        <svg className="w-4 h-4 ml-2 text-zinc-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-300">No options</li>
          )}
          {options.map(opt => (
            <li
              key={String(opt.value)}
              role="option"
              aria-selected={String(opt.value) === String(value)}
              onClick={() => handleSelect(opt.value)}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-zinc-100 dark:hover:bg-zinc-600 ${String(opt.value) === String(value) ? 'bg-zinc-100 dark:bg-zinc-600' : ''}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
