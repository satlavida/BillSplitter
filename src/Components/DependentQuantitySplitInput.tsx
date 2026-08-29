import { useState, useEffect } from 'react';
import { Button } from '../ui/components';
import type { Person } from '../schemas/bill.schema';
import type { Allocation } from '../billStore';

interface DependentQuantitySplitInputProps {
  people: Person[];
  quantity: number;
  allocations: Allocation[];
  onSave: (fractions: Allocation[]) => void;
  onCancel: () => void;
}

// The "Show Detailed Quantity Split" beta UI (src/settingsStore.ts) — a
// dynamic, dependent-claim take on Quantity Split: instead of everyone
// entering an independent number (FractionalSplitInput.tsx), each person's
// selectable range shrinks live as the others pick, inspired by the
// joiner's ClaimQuantityModal.tsx number grid but rendered inline for every
// person at once rather than one person at a time in a modal. Same
// props/output shape as FractionalSplitInput.tsx (Allocation[]) so
// SplitTypeDrawer.tsx's onSave callback doesn't need to change shape.
const DependentQuantitySplitInput = ({ people, quantity, allocations, onSave, onCancel }: DependentQuantitySplitInputProps) => {
  const [fractions, setFractions] = useState<Allocation[]>(() => {
    if (allocations.length > 0) {
      return allocations.map((allocation) => ({ personId: allocation.personId, value: allocation.value }));
    }
    return people.map((person) => ({ personId: person.id, value: 0 }));
  });

  const [total, setTotal] = useState(0);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    const newTotal = fractions.reduce((sum, item) => sum + item.value, 0);
    setTotal(newTotal);
    setIsValid(newTotal > 0);
  }, [fractions]);

  const setValue = (personId: string, newValue: number) => {
    setFractions(fractions.map((item) => (item.personId === personId ? { ...item, value: newValue } : item)));
  };

  const handleSave = () => {
    if (isValid) {
      onSave(fractions);
    }
  };

  const quantityFloor = Math.max(1, Math.floor(quantity));

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2 text-zinc-800 dark:text-white">Quantity Split</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Pick how many each person had — as others pick, the pool left for everyone else shrinks.
      </p>

      {fractions.map(({ personId, value }) => {
        const person = people.find((p) => p.id === personId);
        if (!person) return null;

        // How much this person could hold: the item's quantity minus what
        // everyone else currently holds. Their own current value is part
        // of "not others", so this is the cap directly, not an amount to
        // add their own value to.
        const othersTotal = fractions.filter((f) => f.personId !== personId).reduce((sum, f) => sum + f.value, 0);
        const available = Math.max(0, quantityFloor - othersTotal);
        const numbers = Array.from({ length: available + 1 }, (_, i) => i);

        return (
          <div key={personId} className="mb-4">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{person.name}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {numbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue(personId, n)}
                  aria-label={`${person.name}: ${n}`}
                  className={`h-9 rounded-md text-sm font-medium border transition-colors ${
                    n === value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-6 flex justify-between items-center">
        <div
          className={`text-sm font-medium px-3 py-2 rounded-md ${
            isValid
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-1 ring-green-500/50'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-red-500/50'
          }`}
        >
          Total parts: <span className="font-bold">{total}</span>
          <span className="font-normal text-zinc-500 dark:text-zinc-400"> (item has {quantity})</span>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Save
          </Button>
        </div>
      </div>

      {!isValid && (
        <p className="text-sm text-red-500 mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-md ring-1 ring-red-500/50">
          Give at least one person a share greater than 0
        </p>
      )}
    </div>
  );
};

export default DependentQuantitySplitInput;
