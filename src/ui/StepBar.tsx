import { memo } from 'react';

export interface StepBarStep {
  number: number;
  title: string;
}

export interface StepBarProps {
  step: number;
  steps: StepBarStep[];
  onStepClick: (n: number) => void;
  className?: string;
}

// Presentational, store-agnostic step indicator: numbered circles + a
// progress line, click-to-jump on each circle. Shared by the creator's
// StepIndicator.tsx (billStore-bound) and the joiner's
// JoinerBillEditorPage.tsx (URL-driven) so the two stop drifting
// independently (see architecture/ui-design-system.md).
export const StepBar = memo(({ step, steps, onStepClick, className = '' }: StepBarProps) => (
  <div className={className}>
    <div className="flex items-center justify-between">
      {steps.map((s) => (
        <div
          key={s.number}
          className="flex flex-col items-center cursor-pointer transition-opacity hover:opacity-80"
          onClick={() => onStepClick(s.number)}
          role="button"
          aria-label={`Go to step ${s.number}: ${s.title}`}
          tabIndex={0}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              step >= s.number ? 'bg-blue-600 text-white dark:bg-blue-500' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
            }`}
          >
            {s.number}
          </div>
          <span className="text-xs mt-1 dark:text-zinc-300">{s.title}</span>
        </div>
      ))}
    </div>

    <div className="relative flex items-center justify-between mt-1">
      <div className="absolute left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-1 bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out"
          style={{ width: `${((step - 1) * 100) / Math.max(1, steps.length - 1)}%` }}
        />
      </div>
    </div>
  </div>
));
