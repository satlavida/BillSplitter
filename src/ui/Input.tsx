import { memo, useId, type ComponentProps, type ReactNode } from 'react';

export interface InputProps extends ComponentProps<'input'> {
  label?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  /** Suppresses the default mb-4 wrapper margin and shrinks padding — for
   * cramped contexts (e.g. a table/grid cell) where the default spacing
   * doesn't fit. See FractionalSplitInput.tsx. */
  compact?: boolean;
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
    compact = false,
    id,
    ref,
    ...props
  }: InputProps) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className={`${compact ? '' : 'mb-4'} ${containerClassName}`}>
        {label && (
          <label
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            htmlFor={inputId}
          >
            {label}
            {required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`
          w-full ${compact ? 'p-1.5' : 'p-2'} border border-zinc-300 dark:border-zinc-600
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
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);
