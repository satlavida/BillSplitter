import { Modal } from '../../ui/components';

interface ClaimQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  quantity: number;
  selected: number;
  busy: boolean;
  onSelect: (value: number) => void;
  onUnclaim: () => void;
}

// Lets a joiner pick how many of a Quantity Split item's N units they're
// claiming, as a grid of number buttons (1..quantity) rather than the old
// +/- stepper — clearer when N is more than a couple of units.
const ClaimQuantityModal = ({ isOpen, onClose, itemName, quantity, selected, busy, onSelect, onUnclaim }: ClaimQuantityModalProps) => {
  const numbers = Array.from({ length: quantity }, (_, i) => i + 1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={itemName} className="max-w-sm">
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">How many of these {quantity} did you have?</p>
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
