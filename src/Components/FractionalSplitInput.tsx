import { useState, useEffect } from 'react';
import { Button, Input } from '../ui/components';
import type { Person } from '../schemas/bill.schema';
import type { Allocation } from '../billStore';

interface FractionalSplitInputProps {
  people: Person[];
  // The item's quantity (bill.schema.ts's Item.quantity) — used only to seed
  // a sensible default split (parts sum to the item's actual quantity
  // instead of an arbitrary "1 each") when there's no existing allocation to
  // restore. These values stay pure ratio/weights after that (see
  // ItemAssignment.tsx's isLive-gated fractionCorrectness comment) — editing
  // them doesn't re-clamp to quantity.
  quantity: number;
  allocations: Allocation[];
  onSave: (fractions: Allocation[]) => void;
  onCancel: () => void;
}

const STEP = 1;

const FractionalSplitInput = ({ people, quantity, allocations, onSave, onCancel }: FractionalSplitInputProps) => {
  // Initialize state with current allocations or default values
  const [fractions, setFractions] = useState<Allocation[]>(() => {
    // If we have allocations, use those values
    if (allocations.length > 0) {
      return allocations.map((allocation) => ({
        personId: allocation.personId,
        value: allocation.value,
      }));
    }

    // Otherwise, default to the item's own quantity split evenly across
    // people (e.g. quantity 3 among 2 people -> 2 and 1) rather than a flat
    // 1 each, so parts start out matching what's on the item.
    const base = Math.max(1, Math.floor(quantity));
    const share = Math.floor(base / people.length);
    const remainder = base - share * people.length;
    return people.map((person, index) => ({
      personId: person.id,
      value: Math.max(share + (index < remainder ? 1 : 0), 1),
    }));
  });

  const [total, setTotal] = useState(0);
  const [isValid, setIsValid] = useState(true);

  // Calculate total fractions. A person can sit at 0 — only the total needs
  // to be greater than 0 (someone has to actually be paying for this item).
  useEffect(() => {
    const newTotal = fractions.reduce((sum, item) => sum + item.value, 0);
    setTotal(newTotal);
    setIsValid(newTotal > 0 && fractions.every((item) => item.value >= 0));
  }, [fractions]);

  const setValue = (personId: string, newValue: number) => {
    const clamped = Math.max(newValue, 0);
    setFractions(fractions.map((item) => (item.personId === personId ? { ...item, value: clamped } : item)));
  };

  const handleFractionChange = (personId: string, newValue: string) => {
    setValue(personId, parseFloat(newValue) || 0);
  };

  // Handle save button click
  const handleSave = () => {
    if (isValid) {
      onSave(fractions);
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4 text-zinc-800 dark:text-white">Quantity Split</h3>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        Give each person a number of shares — higher numbers mean paying more. It's fine to leave someone at 0.
      </p>

      {fractions.map(({ personId, value }) => {
        const person = people.find((p) => p.id === personId);
        if (!person) return null;

        // Calculate percentage of total
        const percentage = total > 0 ? (value / total) * 100 : 0;

        return (
          <div key={personId} className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{person.name}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{percentage.toFixed(1)}% of total</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Decrease ${person.name}'s share`}
                onClick={() => setValue(personId, value - STEP)}
                disabled={value <= 0}
                className="h-9 w-9 shrink-0 rounded-md border border-zinc-300 dark:border-zinc-600 text-lg font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <Input
                type="number"
                min="0"
                inputMode="decimal"
                value={value}
                onChange={(e) => handleFractionChange(personId, e.target.value)}
                aria-label={`${person.name}'s share`}
                className="text-center"
                containerClassName="w-full"
                compact
              />
              <button
                type="button"
                aria-label={`Increase ${person.name}'s share`}
                onClick={() => setValue(personId, value + STEP)}
                className="h-9 w-9 shrink-0 rounded-md border border-zinc-300 dark:border-zinc-600 text-lg font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                +
              </button>
              <button
                type="button"
                aria-label={`Zero out ${person.name}'s share`}
                onClick={() => setValue(personId, 0)}
                disabled={value === 0}
                className="h-9 w-9 shrink-0 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                0
              </button>
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

export default FractionalSplitInput;
