import { useState } from 'react';
import { addLiveItem } from '../../lib/liveApi';
import { generateId } from '../../lib/generateId';
import { Button } from '../../ui/components';
import type { SplitType } from '../../schemas/bill.schema';

interface AddItemFormProps {
  code: string;
  billId: string;
  joinerToken: string | null;
  disabled?: boolean;
  onAdded: () => void;
}

// Minimal item-add form for a joiner — name/price/quantity/splitType only.
// Discount fields are omitted; the server defaults them (see AddItem).
const AddItemForm = ({ code, billId, joinerToken, disabled, onAdded }: AddItemFormProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setPrice('');
    setQuantity('1');
    setSplitType('equal');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price) {
      setError('Enter a name and price');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addLiveItem(
        code,
        billId,
        {
          id: generateId(),
          name: name.trim(),
          price: parseFloat(price) || 0,
          quantity: parseInt(quantity, 10) || 1,
          discount: 0,
          discountType: 'flat',
          splitType,
        },
        joinerToken ?? undefined
      );
      reset();
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        + Add item
      </Button>
    );
  }

  return (
    <div className="mt-2 p-3 rounded-md bg-zinc-50 dark:bg-zinc-700/50">
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
            className="w-1/2 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white text-sm"
          />
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            className="w-1/2 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white text-sm"
          />
        </div>
        <select
          value={splitType}
          onChange={(e) => setSplitType(e.target.value as SplitType)}
          className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white text-sm"
        >
          <option value="equal">Split equally</option>
          <option value="percentage">Split by percentage</option>
          <option value="fraction">Split by parts</option>
        </select>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              reset();
              setError(null);
              setOpen(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddItemForm;
