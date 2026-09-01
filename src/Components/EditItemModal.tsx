import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { Modal, Button, Dropdown, Input } from '../ui/components';
import type { Item } from '../schemas/bill.schema';

interface EditItemFormData {
  name: string;
  price: number | string;
  quantity: number | string;
  discount: number | string;
  discountType: 'flat' | 'percentage';
}

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (
    itemId: string,
    data: {
      name: string;
      price: number;
      quantity: number;
      discount: number;
      discountType: 'flat' | 'percentage';
    }
  ) => void;
}

const EditItemModal = ({ isOpen, onClose, item, onSave }: EditItemModalProps) => {
  const [formData, setFormData] = useState<EditItemFormData>({
    name: '',
    price: '',
    quantity: 1,
    discount: 0,
    discountType: 'flat',
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data when modal opens or item changes
  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discount: item.discount || 0,
        discountType: item.discountType || 'flat',
      });

      // Focus the name input when the modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, item]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (item && formData.name.trim() && formData.price !== '' && !isNaN(Number(formData.price))) {
      onSave(item.id, {
        name: formData.name.trim(),
        price: parseFloat(String(formData.price)),
        quantity: parseInt(String(formData.quantity)) || 1,
        discount: parseFloat(String(formData.discount)) || 0,
        discountType: formData.discountType,
      });
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Item">
      <form onSubmit={handleSubmit}>
        <Input
          ref={nameInputRef}
          id="itemName"
          name="name"
          label="Item Name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter item name"
          required
        />

        <Input
          id="itemPrice"
          name="price"
          type="number"
          step="0.01"
          label="Price"
          value={formData.price}
          onChange={handleChange}
          placeholder="0.00"
          required
        />

        <div className="mb-4 flex space-x-2 items-end">
          <Input
            id="itemDiscount"
            name="discount"
            type="number"
            step="0.01"
            label="Discount"
            value={formData.discount}
            onChange={handleChange}
            placeholder="0.00"
            containerClassName="mb-0 flex-1"
          />
          <Dropdown
            name="discountType"
            value={formData.discountType}
            onChange={handleChange}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'percentage', label: '%' },
            ]}
          />
        </div>

        <Input
          id="itemQuantity"
          name="quantity"
          type="number"
          min="1"
          label="Quantity"
          value={formData.quantity}
          onChange={handleChange}
          required
        />

        <div className="flex justify-end space-x-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditItemModal;
