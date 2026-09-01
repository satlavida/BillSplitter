import { memo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BackLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
}

// Shared "go back/away" text-link style — standardized from the 18+ sites
// across the app that already used this look ad hoc
// (`text-blue-600 dark:text-blue-400 hover:underline`), and replaces the 2
// sites that instead used a filled primary Button for the same
// navigational action (see architecture/ui-design-system.md).
export const BackLink = memo(({ to, children, className = '' }: BackLinkProps) => (
  <Link to={to} className={`text-blue-600 dark:text-blue-400 hover:underline ${className}`}>
    {children}
  </Link>
));
