import { memo } from 'react';
import useBillStore from '../billStore';
import { useShallow } from 'zustand/shallow';

const StepIndicator = memo(() => {
  const { step, goToStep } = useBillStore(
    useShallow((state) => ({
      step: state.step,
      goToStep: state.goToStep,
    }))
  );

  const steps = [
    { number: 1, title: 'People' },
    { number: 2, title: 'Items' },
    { number: 3, title: 'Assign' },
    { number: 4, title: 'Summary' },
  ];

  const handleStepClick = (stepNumber: number) => {
    goToStep(stepNumber);
  };

  return (
    <div className="mb-8 no-print">
      <div className="flex items-center justify-between">
        {steps.map((stepItem) => (
          <div
            key={stepItem.number}
            className={`flex flex-col items-center cursor-pointer transition-opacity hover:opacity-80`}
            onClick={() => handleStepClick(stepItem.number)}
            role="button"
            aria-label={`Go to step ${stepItem.number}: ${stepItem.title}`}
            tabIndex={0}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                step >= stepItem.number ? 'bg-blue-600 text-white dark:bg-blue-500' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
              }`}
            >
              {stepItem.number}
            </div>
            <span className="text-xs mt-1 dark:text-zinc-300">{stepItem.title}</span>
          </div>
        ))}
      </div>

      <div className="relative flex items-center justify-between mt-1">
        <div className="absolute left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-1 bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out"
            style={{ width: `${((step - 1) * 100) / 3}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
});

export default StepIndicator;
