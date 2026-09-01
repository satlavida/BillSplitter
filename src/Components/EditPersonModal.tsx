import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Modal, Button, Input } from '../ui/components';
import type { Person } from '../schemas/bill.schema';

interface EditPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  onSave: (personId: string, name: string, upiId: string) => void;
}

const EditPersonModal = ({ isOpen, onClose, person, onSave }: EditPersonModalProps) => {
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  // Reset the form fields synchronously during render on the
  // closed->open transition, rather than in a useEffect — an effect runs
  // after the first paint, so `name` would still be its stale/empty value
  // (from before `person` populated it) for one frame, which was enough
  // to flash a false "Name is required" error on every open.
  if (isOpen && !wasOpenRef.current && person) {
    setName(person.name);
    setUpiId(person.upiId);
  }
  wasOpenRef.current = isOpen;

  useEffect(() => {
    if (isOpen && person) {
      // Focus the input when the modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, person]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && person) {
      onSave(person.id, name.trim(), upiId.trim());
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Person">
      <form onSubmit={handleSubmit}>
        <Input
          ref={inputRef}
          id="personName"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name"
          error={!name.trim() ? 'Name is required' : undefined}
        />
        <div className="mb-4">
          <Input
            id="personUpiId"
            label="UPI ID (optional)"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="name@bank"
            containerClassName="mb-0"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Lets others know where to pay this person back.</p>
        </div>
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

export default EditPersonModal;
