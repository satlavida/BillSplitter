import { useState, useEffect, type ChangeEvent, type MouseEvent } from 'react';
import { Dropdown } from '../ui/components';
import PercentageSplitInput from './PercentageSplitInput';
import FractionalSplitInput from './FractionalSplitInput';
import { SPLIT_TYPES, type Allocation, type SplitType } from '../billStore';
import type { Item } from '../schemas/bill.schema';
import type { Person } from '../schemas/bill.schema';

interface SplitTypeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
  people: Person[];
  onSave: (itemId: string, splitType: SplitType, allocations: Person[] | Allocation[]) => void;
}

const SplitTypeDrawer = ({ isOpen, onClose, item, people, onSave }: SplitTypeDrawerProps) => {
  // Filter people to only those who are assigned to this item
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [splitType, setSplitType] = useState<SplitType>(item.splitType || SPLIT_TYPES.EQUAL);

  // Update selected people when item or people change
  useEffect(() => {
    if (item && item.consumedBy && people) {
      // Extract person IDs from consumedBy (handle both string and object formats)
      const personIds = item.consumedBy.map((c) => (typeof c === 'string' ? c : c.personId));

      // Get person objects for each ID
      const assigned = personIds
        .map((id) => people.find((p) => p.id === id))
        .filter((p): p is Person => Boolean(p)); // Filter out any undefined (in case of data inconsistency)

      setSelectedPeople(assigned);
      setSplitType(item.splitType || SPLIT_TYPES.EQUAL);
    }
  }, [item, people]);

  // Custom splits need at least one person to configure shares for — if
  // nobody was toggled on yet in the equal-split step (item.consumedBy is
  // empty), selectedPeople is empty too, which used to leave
  // Percentage/Quantity Split with nothing to render and Save permanently
  // disabled (total was stuck at 0). Falling back to everyone in the bill
  // gives the user something to actually configure.
  const splitPeople = selectedPeople.length > 0 ? selectedPeople : people;

  // Get current allocations in the format expected by the input components
  const getAllocations = (): Allocation[] => {
    if (!item || !item.consumedBy || item.consumedBy.length === 0) return [];

    // If consumedBy is an array of strings (old format)
    if (typeof item.consumedBy[0] === 'string') {
      // For equal split, convert to allocation objects with equal values
      const value = splitType === SPLIT_TYPES.PERCENTAGE ? Math.floor(100 / item.consumedBy.length) : 1;

      // For percentage, make sure it sums to 100%
      const allocations = item.consumedBy.map((personId, index) => ({
        personId: personId as unknown as string,
        value: index === 0 && splitType === SPLIT_TYPES.PERCENTAGE ? value + (100 - value * item.consumedBy.length) : value,
      }));

      return allocations;
    }

    // If consumedBy is already an array of allocation objects
    return item.consumedBy;
  };

  // Handle split type change
  const handleSplitTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newSplitType = e.target.value as SplitType;
    setSplitType(newSplitType);

    // If changing to equal split, save it immediately
    if (newSplitType === SPLIT_TYPES.EQUAL) {
      // For equal split, we convert back to simple personId array
      //const personIds = selectedPeople.map(person => person.id);
      onSave(item.id, SPLIT_TYPES.EQUAL, selectedPeople);
    }
  };

  // Handle saving the split configuration
  const handleSaveSplit = (allocations: Allocation[]) => {
    onSave(item.id, splitType, allocations);
    onClose();
  };

  // Handle drawer closing behavior with backdrop
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-end sm:items-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-zinc-800 w-full max-w-lg rounded-t-lg sm:rounded-lg shadow-lg transition-all transform animate-slide-up overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">Split "{item.name}"</h3>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Split Type</label>
            <Dropdown
              value={splitType}
              onChange={handleSplitTypeChange}
              options={[
                { value: SPLIT_TYPES.EQUAL, label: 'Equal Split' },
                { value: SPLIT_TYPES.PERCENTAGE, label: 'Percentage Split' },
                { value: SPLIT_TYPES.FRACTION, label: 'Quantity Split' },
              ]}
            />
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {splitType === SPLIT_TYPES.EQUAL ? (
            <div className="p-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 inline-block mr-1 -mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  This item will be split equally among {splitPeople.length} people.
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">The equal split has been automatically applied.</p>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : splitType === SPLIT_TYPES.PERCENTAGE ? (
            <PercentageSplitInput people={splitPeople} allocations={getAllocations()} onSave={handleSaveSplit} onCancel={onClose} />
          ) : (
            <FractionalSplitInput people={splitPeople} quantity={item.quantity} allocations={getAllocations()} onSave={handleSaveSplit} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitTypeDrawer;
