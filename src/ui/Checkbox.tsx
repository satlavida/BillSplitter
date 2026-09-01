import { memo, type ComponentProps, type ReactNode } from 'react';

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
