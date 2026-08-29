import { useState } from 'react';
import { addLiveItem } from '../../lib/liveApi';
import { generateId } from '../../lib/generateId';
import useSettingsStore from '../../settingsStore';
import { defaultSplitTypeForQuantity } from '../../lib/defaultSplitType';
import { Button, Dropdown } from '../../ui/components';
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
  // Tracks whether the user has explicitly picked a split type, so the
  // quantity-driven auto-default below (mirrors ItemsInput.tsx/
  // billStore.addItem's same rule) never overwrites their own choice.
  const [splitTypeTouched, setSplitTypeTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (!splitTypeTouched) {
      setSplitType(defaultSplitTypeForQuantity(parseInt(value, 10) || 1, useSettingsStore.getState().autoQuantitySplit));
    }
  };

  const reset = () => {
    setName('');
    setPrice('');
    setQuantity('1');
    setSplitType('equal');
    setSplitTypeTouched(false);
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
            onChange={(e) => handleQuantityChange(e.target.value)}
            placeholder="Qty"
            className="w-1/2 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white text-sm"
          />
        </div>
        <Dropdown
          value={splitType}
          onChange={(e) => {
            setSplitType(e.target.value as SplitType);
            setSplitTypeTouched(true);
          }}
          options={[
            { value: 'equal', label: 'Split equally' },
            { value: 'percentage', label: 'Split by percentage' },
            { value: 'fraction', label: 'Quantity Split' },
          ]}
        />
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
