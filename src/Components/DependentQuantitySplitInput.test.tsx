import { render, screen, fireEvent } from '@testing-library/react';
import DependentQuantitySplitInput from './DependentQuantitySplitInput';
import type { Person } from '../schemas/bill.schema';

const people: Person[] = [
  { id: 'john', name: 'John', upiId: '' },
  { id: 'jane', name: 'Jane', upiId: '' },
  { id: 'don', name: 'Don', upiId: '' },
];

describe('DependentQuantitySplitInput', () => {
  it('starts everyone at 0 with the full quantity available to each', () => {
    render(<DependentQuantitySplitInput people={people} quantity={10} allocations={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'John: 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jane: 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Don: 10' })).toBeInTheDocument();
  });

  it('shrinks the remaining pool for everyone else as one person picks', () => {
    render(<DependentQuantitySplitInput people={people} quantity={10} allocations={[]} onSave={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'John: 5' }));

    // Jane and Don can now only go up to 5 (10 - John's 5).
    expect(screen.getByRole('button', { name: 'Jane: 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Jane: 6' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Don: 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Don: 6' })).not.toBeInTheDocument();

    // John's own row still goes up to 10 (his own value doesn't count
    // against himself).
    expect(screen.getByRole('button', { name: 'John: 10' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Jane: 2' }));

    // Don can now only go up to 3 (10 - John's 5 - Jane's 2).
    expect(screen.getByRole('button', { name: 'Don: 3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Don: 4' })).not.toBeInTheDocument();
  });

  it('blocks save while everyone is at 0', () => {
    render(<DependentQuantitySplitInput people={people} quantity={10} allocations={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the picked allocations in the shared Allocation[] shape', () => {
    const onSave = jest.fn();
    render(<DependentQuantitySplitInput people={people} quantity={10} allocations={[]} onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'John: 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jane: 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Don: 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith([
      { personId: 'john', value: 5 },
      { personId: 'jane', value: 2 },
      { personId: 'don', value: 3 },
    ]);
  });

  it('restores existing allocations instead of resetting everyone to 0', () => {
    render(
      <DependentQuantitySplitInput
        people={people}
        quantity={10}
        allocations={[
          { personId: 'john', value: 5 },
          { personId: 'jane', value: 2 },
          { personId: 'don', value: 3 },
        ]}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText('Total parts:').closest('div')).toHaveTextContent('10');
  });
});
