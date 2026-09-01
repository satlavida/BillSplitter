import { memo } from 'react';
import useBillStore from '../billStore';
import { useShallow } from 'zustand/shallow';
import { StepBar } from '../ui/components';

const STEPS = [
  { number: 1, title: 'Items' },
  { number: 2, title: 'Assign' },
  { number: 3, title: 'Summary' },
];

// Thin billStore-bound wrapper around the shared, store-agnostic StepBar —
// see JoinerBillEditorPage.tsx for the joiner's URL-driven counterpart,
// which now shares the same presentational implementation instead of an
// independently-drifting copy (see architecture/ui-design-system.md).
const StepIndicator = memo(() => {
  const { step, goToStep } = useBillStore(
    useShallow((state) => ({
      step: state.step,
      goToStep: state.goToStep,
    }))
  );

  return (
    <div className="mb-8 no-print">
      <StepBar step={step} steps={STEPS} onStepClick={goToStep} />
    </div>
  );
});

export default StepIndicator;
