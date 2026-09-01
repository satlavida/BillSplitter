import { memo, type ComponentProps, type ReactNode } from 'react';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  icon: ReactNode;
  'aria-label': string;
}

// Generic icon-only button chrome — ported from the gear/settings button
// markup duplicated across BillEditorPage.tsx and SessionHomePage.tsx.
// `aria-label` is required since there's no visible text to fall back on.
export const IconButton = memo(({ icon, className = '', ref, ...props }: IconButtonProps) => (
  <button
    ref={ref}
    type="button"
    className={`p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors ${className}`}
    {...props}
  >
    {icon}
  </button>
));
