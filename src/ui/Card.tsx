import { memo, type HTMLAttributes } from 'react';

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
