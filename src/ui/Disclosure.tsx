import { memo, type ReactNode } from 'react';

export interface DisclosureProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

// Native <details>/<summary>-based collapsible section — accessible and
// keyboard-operable by default, no extra open/close state to manage. Used
// where content should be closed by default but not always-rendered (e.g.
// BillSummary.tsx's "Split Breakdown").
export const Disclosure = memo(({ title, children, defaultOpen = false, className = '' }: DisclosureProps) => {
  return (
    <details
      open={defaultOpen}
      className={`group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 transition-colors ${className}`}
    >
      <summary className="cursor-pointer select-none list-none p-4 font-semibold text-zinc-800 dark:text-white flex items-center justify-between [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
});
