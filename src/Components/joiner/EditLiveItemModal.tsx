import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Modal, Button, Dropdown } from '../../ui/components';
import type { SplitType } from '../../schemas/bill.schema';
import type { LiveItem } from '../../schemas/live.schema';

interface EditLiveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: LiveItem | null;
  onSave: (data: { name: string; price: number; quantity: number; discount: number; discountType: 'flat' | 'percentage'; splitType: SplitType }) => void;
}

// Joiner-side edit form for an item they have edit permission on — mirrors
// EditItemModal.tsx's fields (name/price/quantity/discount/splitType) but
// works off LiveItem (whose discountType/splitType are plain strings, not
// the narrower literal unions EditItemModal's Item type expects), so it's
// its own small component rather than a reuse.
const EditLiveItemModal = ({ isOpen, onClose, item, onSave }: EditLiveItemModalProps) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && item) {
      setName(item.name);
      setPrice(String(item.price));
      setQuantity(String(item.quantity));
      setDiscount(String(item.discount || 0));
      setDiscountType(item.discountType === 'percentage' ? 'percentage' : 'flat');
      setSplitType((item.splitType as SplitType) || 'equal');
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen, item]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === '' || isNaN(Number(price))) return;
    onSave({
      name: name.trim(),
      price: parseFloat(price),
      quantity: parseInt(quantity, 10) || 1,
      discount: parseFloat(discount) || 0,
      discountType,
      splitType,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Item">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="joinerItemName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Item Name
          </label>
          <input
            ref={nameInputRef}
            id="joinerItemName"
            type="text"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            className="w-full p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800 transition-colors"
            required
          />
        </div>

        <div className="mb-4 flex gap-2">
          <div className="w-1/2">
            <label htmlFor="joinerItemPrice" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Price
            </label>
            <input
              id="joinerItemPrice"
              type="number"
              step="0.01"
              value={price}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800 transition-colors"
              required
            />
          </div>
          <div className="w-1/2">
            <label htmlFor="joinerItemQuantity" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Quantity
            </label>
            <input
              id="joinerItemQuantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800 transition-colors"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="joinerItemDiscount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Discount
          </label>
          <div className="flex gap-2">
            <input
              id="joinerItemDiscount"
              type="number"
              step="0.01"
              value={discount}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDiscount(e.target.value)}
              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-white rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-zinc-800 transition-colors"
            />
            <Dropdown
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percentage')}
              options={[
                { value: 'flat', label: 'Flat' },
                { value: 'percentage', label: '%' },
              ]}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Split Type</label>
          <Dropdown
            value={splitType}
            onChange={(e) => setSplitType(e.target.value as SplitType)}
            options={[
              { value: 'equal', label: 'Split equally' },
              { value: 'percentage', label: 'Split by percentage' },
              { value: 'fraction', label: 'Quantity Split' },
            ]}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditLiveItemModal;
