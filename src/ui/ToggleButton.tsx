import { memo, type ComponentProps } from 'react';

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
