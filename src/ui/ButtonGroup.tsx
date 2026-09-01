// Wraps a row of related Buttons (e.g. view-mode toggles + an action) so
// they stay visually grouped and wrap together onto their own line on
// narrow screens instead of colliding with an adjacent title.
export const ButtonGroup = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-wrap items-center gap-1 ${className}`}>{children}</div>
);
