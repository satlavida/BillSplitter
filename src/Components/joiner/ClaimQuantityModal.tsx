import { Modal } from '../../ui/components';

interface ClaimQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  quantity: number;
  // The highest number this joiner is actually allowed to pick right now —
  // their own current claim plus whatever's still unclaimed by everyone
  // else. Kept separate from `quantity` (used only for the "How many of
  // these N did you have?" copy) so the grid can be capped without
  // changing what the item's real total is described as.
  max: number;
  selected: number;
  busy: boolean;
  onSelect: (value: number) => void;
  onUnclaim: () => void;
}

// Lets a joiner pick how many of a Quantity Split item's units they're
// claiming, as a grid of number buttons rather than the old +/- stepper —
// clearer when N is more than a couple of units. The grid only goes up to
// `max`, not the item's full quantity, once others have already claimed
// some of it.
const ClaimQuantityModal = ({ isOpen, onClose, itemName, quantity, max, selected, busy, onSelect, onUnclaim }: ClaimQuantityModalProps) => {
  const numbers = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={itemName} className="max-w-sm">
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        How many of these {quantity} did you have?
        {max < quantity && <span className="block mt-1 text-xs text-amber-600 dark:text-amber-400">Others have already claimed the rest — only {max} left for you.</span>}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => (n === selected ? onUnclaim() : onSelect(n))}
            className={`h-12 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 ${
              n === selected
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-800 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {selected > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={onUnclaim}
          className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
        >
          Remove my claim
        </button>
      )}
    </Modal>
  );
};

export default ClaimQuantityModal;
