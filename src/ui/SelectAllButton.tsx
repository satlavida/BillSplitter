import { memo, type ComponentProps } from 'react';

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
