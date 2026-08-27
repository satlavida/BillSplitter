import { memo, useEffect, useMemo, useRef, useState, type ComponentProps, type HTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Reusable Button component
export const Button = memo(
  ({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    onClick,
    type = 'button',
    className = '',
    ref,
    ...props
  }: ButtonProps) => {
    // Button variants with dark mode support
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
      secondary: 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600',
      danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
      success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
    };

    // Button sizes
    const sizes: Record<ButtonSize, string> = {
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
  }
);

export interface InputProps extends ComponentProps<'input'> {
  label?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

// Input Field component
export const Input = memo(
  ({
    label,
    type = 'text',
    error,
    className = '',
    containerClassName = '',
    required = false,
    ref,
    ...props
  }: InputProps) => {
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
  }
);

export type CardProps = HTMLAttributes<HTMLDivElement>;

// Card component
export const Card = memo(({ children, className = '', ...props }: CardProps) => {
  return (
    <div
      className={`mb-6 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 shadow-sm transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

export interface ToggleButtonProps extends ComponentProps<'button'> {
  selected: boolean;
}

// Toggle Button component (for selection)
export const ToggleButton = memo(
  ({ selected, onClick, children, className = '', ...props }: ToggleButtonProps) => {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
        px-3 py-1 rounded-full transition-colors
        ${
          selected
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
  }
);

export interface PrintButtonProps {
  onClick: () => void;
}

// Print Button component
export const PrintButton = memo(({ onClick }: PrintButtonProps) => {
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

export interface SelectAllButtonProps extends ComponentProps<'button'> {
  allSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

// SelectAll Button component
export const SelectAllButton = memo(
  ({ allSelected, onSelectAll, onDeselectAll, className = '', ...props }: SelectAllButtonProps) => {
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
  }
);

export interface PrintWrapperProps {
  children: ReactNode;
}

// Print wrapper for styling print content
export const PrintWrapper = memo(({ children }: PrintWrapperProps) => {
  return (
    <div className="print-content">
      {children}
      <style>{`
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
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          #sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
});

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
}

// Modal component
export const Modal = memo(({ isOpen, onClose, title, children, className = '', ...props }: ModalProps) => {
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

export interface FileUploadProps extends ComponentProps<'input'> {
  label?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

// File upload component
export const FileUpload = memo(
  ({ label, accept, onChange, error, containerClassName = '', capture, onClick, ref, ...props }: FileUploadProps) => {
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
  }
);

type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

// Loading spinner component
export const Spinner = memo(({ size = 'md', className = '' }: SpinnerProps) => {
  const sizes: Record<SpinnerSize, string> = {
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

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps extends Omit<ComponentProps<'select'>, 'children'> {
  options: DropdownOption[];
}

// Req 13: shared styled <select> — a thin wrapper (native select underneath,
// so keyboard/screen-reader/testing behavior is unchanged) with a custom
// chevron so every dropdown in the app looks consistent instead of each
// call site styling its own native <select>. Drop-in for
// `<select value={..} onChange={..}>...options...</select>`: pass the same
// options as an `options` array instead of <option> children.
export const Dropdown = memo(({ options, className = '', ref, ...props }: DropdownProps) => (
  <div className="relative inline-block w-full">
    <select
      ref={ref}
      className={`
        w-full appearance-none p-2 pr-8 border border-zinc-300 dark:border-zinc-600
        bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white
        rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
        dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
        transition-colors
        ${className}
      `}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <svg
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-zinc-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  </div>
));

export interface SearchSelectOption {
  value: string;
  label: string;
}

export interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

// Generic searchable dropdown: a button showing the current selection that
// opens a filterable list, for option sets too long to scan as a native
// <select> (e.g. currency codes). Reusable anywhere a Dropdown's plain list
// isn't easy to search.
export const SearchSelect = memo(
  ({ value, onChange, options, placeholder = 'Select...', searchPlaceholder = 'Search...', className = '', disabled = false }: SearchSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = useMemo(() => options.find((opt) => opt.value === value), [options, value]);

    const filteredOptions = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return options;
      return options.filter((opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q));
    }, [options, query]);

    useEffect(() => {
      if (!isOpen) return;
      const handleOutsideClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOpen]);

    useEffect(() => {
      if (isOpen) {
        setQuery('');
        // Let the popover mount before focusing.
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
    };

    return (
      <div ref={containerRef} className={`relative w-full ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`
            w-full flex items-center justify-between p-2 pr-8 border border-zinc-300 dark:border-zinc-600
            bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white text-left
            rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
            dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
            transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span className={selected ? '' : 'text-zinc-400 dark:text-zinc-500'}>{selected ? selected.label : placeholder}</span>
          <svg
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 dark:text-zinc-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-40 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-lg overflow-hidden">
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full p-1.5 text-sm border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 transition-colors"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No results</li>
              ) : (
                filteredOptions.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                        opt.value === value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-zinc-800 dark:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
  containerClassName?: string;
}

// Prettified checkbox: hides the native box (kept for a11y/interaction) and
// draws a larger custom one on top, so it matches the rest of the UI kit
// instead of each browser's default checkbox styling.
export const Checkbox = memo(
  ({ label, description, className = '', containerClassName = '', disabled = false, id, ref, ...props }: CheckboxProps) => {
    const checkbox = (
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          disabled={disabled}
          className={`
            peer h-5 w-5 shrink-0 appearance-none rounded-md border-2 border-zinc-300 dark:border-zinc-600
            bg-white dark:bg-zinc-700
            checked:bg-blue-600 checked:border-blue-600 dark:checked:bg-blue-500 dark:checked:border-blue-500
            hover:border-blue-400 dark:hover:border-blue-500
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1
            dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors cursor-pointer
            ${className}
          `}
          {...props}
        />
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
          aria-hidden="true"
        >
          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );

    if (!label && !description) {
      return <div className={containerClassName}>{checkbox}</div>;
    }

    return (
      <div className={containerClassName}>
        <label
          htmlFor={id}
          className={`inline-flex items-start gap-2.5 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          {checkbox}
          <span className="text-sm text-zinc-700 dark:text-zinc-300 transition-colors">
            {label && <span className="font-medium">{label}</span>}
            {description && <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</span>}
          </span>
        </label>
      </div>
    );
  }
);

type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  type?: AlertType;
}

// Alert component
export const Alert = memo(({ type = 'info', children, className = '', ...props }: AlertProps) => {
  const types: Record<AlertType, string> = {
    info: 'bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    success: 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className={`mb-4 p-3 rounded ${types[type] || types.info} transition-colors ${className}`} {...props}>
      {children}
    </div>
  );
});
