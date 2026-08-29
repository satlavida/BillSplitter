import { render, screen, fireEvent } from '@testing-library/react';
import FractionalSplitInput from './FractionalSplitInput';
import type { Person } from '../schemas/bill.schema';

const people: Person[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
];

describe('FractionalSplitInput', () => {
  it('seeds default shares from the item quantity split evenly across people', () => {
    render(<FractionalSplitInput people={people} quantity={4} allocations={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByLabelText("Alice's share")).toHaveValue(2);
    expect(screen.getByLabelText("Bob's share")).toHaveValue(2);
  });

  it('allows a person to be zeroed out while the total stays valid', () => {
    const onSave = jest.fn();
    render(
      <FractionalSplitInput
        people={people}
        quantity={4}
        allocations={[
          { personId: 'p1', value: 2 },
          { personId: 'p2', value: 2 },
        ]}
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Zero out Bob's share"));
    expect(screen.getByLabelText("Bob's share")).toHaveValue(0);
    expect(screen.queryByText('Give at least one person a share greater than 0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith([
      { personId: 'p1', value: 2 },
      { personId: 'p2', value: 0 },
    ]);
  });

  it('blocks save and shows a humanized error when everyone is at 0', () => {
    render(
      <FractionalSplitInput
        people={people}
        quantity={4}
        allocations={[
          { personId: 'p1', value: 2 },
          { personId: 'p2', value: 2 },
        ]}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Zero out Alice's share"));
    fireEvent.click(screen.getByLabelText("Zero out Bob's share"));

    expect(screen.getByText('Give at least one person a share greater than 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('increments and decrements a person\'s share via the +/- buttons', () => {
    render(
      <FractionalSplitInput
        people={people}
        quantity={4}
        allocations={[
          { personId: 'p1', value: 2 },
          { personId: 'p2', value: 2 },
        ]}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Increase Alice's share"));
    expect(screen.getByLabelText("Alice's share")).toHaveValue(3);

    fireEvent.click(screen.getByLabelText("Decrease Alice's share"));
    fireEvent.click(screen.getByLabelText("Decrease Alice's share"));
    expect(screen.getByLabelText("Alice's share")).toHaveValue(1);
  });

  it('never lets the decrement button take a share below 0', () => {
    render(
      <FractionalSplitInput
        people={people}
        quantity={2}
        allocations={[
          { personId: 'p1', value: 0 },
          { personId: 'p2', value: 2 },
        ]}
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByLabelText("Decrease Alice's share")).toBeDisabled();
  });
});
