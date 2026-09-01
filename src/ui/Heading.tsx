import { memo, type HTMLAttributes } from 'react';

// Named for the literal Tailwind class each maps to (rather than a
// t-shirt-size scale) — the 19 sites this replaces actually used three
// distinct non-zero margins (mb-1, mb-2, mb-4), not two, so a 3-bucket
// small/medium scale silently collapsed two of them together (JoinPage's
// mb-2 headings shrank to mb-1) the first time this was built.
type HeadingMargin = 'none' | 'mb-1' | 'mb-2' | 'mb-4';

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  margin?: HeadingMargin;
}

const MARGIN_CLASSES: Record<HeadingMargin, string> = {
  none: '',
  'mb-1': 'mb-1',
  'mb-2': 'mb-2',
  'mb-4': 'mb-4',
};

// Shared section-heading style — standardizes the literal className
// `"text-xl font-semibold mb-4 text-zinc-800 dark:text-white
// transition-colors"` (and its mb-1/no-margin variants) that was
// copy-pasted verbatim across ~19 sites (see architecture/ui-design-system.md).
export const Heading = memo(({ margin = 'mb-4', className = '', children, ...props }: HeadingProps) => (
  <h2
    className={`text-xl font-semibold ${MARGIN_CLASSES[margin]} text-zinc-800 dark:text-white transition-colors ${className}`}
    {...props}
  >
    {children}
  </h2>
));
