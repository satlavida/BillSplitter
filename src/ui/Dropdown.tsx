import { memo, type ComponentProps } from 'react';

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
