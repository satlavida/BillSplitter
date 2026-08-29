import { render, screen, fireEvent } from '@testing-library/react';
import EditPersonModal from './EditPersonModal';
import type { Person } from '../schemas/bill.schema';

describe('EditPersonModal', () => {
  const person: Person = { id: 'p1', name: 'Alice', upiId: 'alice@bank' };

  it('pre-fills name and UPI ID from the given person', () => {
    render(<EditPersonModal isOpen person={person} onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Alice');
    expect(screen.getByLabelText('UPI ID (optional)')).toHaveValue('alice@bank');
  });

  it('saves the trimmed name and UPI ID', () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<EditPersonModal isOpen person={person} onClose={onClose} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Alicia  ' } });
    fireEvent.change(screen.getByLabelText('UPI ID (optional)'), { target: { value: '  alicia@newbank  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('p1', 'Alicia', 'alicia@newbank');
    expect(onClose).toHaveBeenCalled();
  });

  it('allows saving with an empty UPI ID', () => {
    const onSave = jest.fn();
    render(<EditPersonModal isOpen person={{ id: 'p2', name: 'Bob', upiId: '' }} onClose={jest.fn()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('p2', 'Bob', '');
  });
});
