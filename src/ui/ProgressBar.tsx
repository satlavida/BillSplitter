import { memo } from 'react';

export interface ProgressBarProps {
  /** 0-100 */
  value: number;
  label?: string;
  className?: string;
}

// Generic labeled percentage bar — e.g. "items claimed" on the joiner's
// bill summary. See PassAndSplit/ParticipantTracker.tsx for a visually
// similar, but purpose-built (people-avatar-stack), progress indicator that
// isn't a fit for reuse here.
export const ProgressBar = memo(({ value, label, className = '' }: ProgressBarProps) => {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>}
    </div>
  );
});
