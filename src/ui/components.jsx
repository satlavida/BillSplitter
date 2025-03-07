import React, { forwardRef, memo } from 'react';
import { useTheme } from '../ThemeContext';

// Reusable Button component
export const Button = memo(forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false, 
  onClick, 
  type = 'button',
  className = '',
  ...props 
}, ref) => {
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
}));

// Input Field component
export const Input = memo(forwardRef(({
  label,
  type = 'text',
  error,
  className = '',
  containerClassName = '',
  required = false,
  ...props
}, ref) => {
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
}));

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