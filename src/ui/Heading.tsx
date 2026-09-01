import { memo, type HTMLAttributes } from 'react';

type HeadingMargin = 'none' | 'sm' | 'md';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  margin?: HeadingMargin;
}

const MARGIN_CLASSES: Record<HeadingMargin, string> = {
  none: '',
  sm: 'mb-1',
  md: 'mb-4',
};

// Shared section-heading style — standardizes the literal className
// `"text-xl font-semibold mb-4 text-zinc-800 dark:text-white
// transition-colors"` (and its mb-1/no-margin variants) that was
// copy-pasted verbatim across ~19 sites (see architecture/ui-design-system.md).
export const Heading = memo(({ margin = 'md', className = '', children, ...props }: HeadingProps) => (
  <h2
    className={`text-xl font-semibold ${MARGIN_CLASSES[margin]} text-zinc-800 dark:text-white transition-colors ${className}`}
    {...props}
  >
    {children}
  </h2>
));
