import { render, screen } from '@testing-library/react';
import ItemSplitCard from './ItemSplitCard';
import type { Item, Person } from '../schemas/bill.schema';

const people: Person[] = [
  { id: 'p1', name: 'Alice', upiId: '' },
  { id: 'p2', name: 'Bob', upiId: '' },
];

const formatCurrency = (amount: number | null | undefined) => `$${(amount ?? 0).toFixed(2)}`;

describe('ItemSplitCard', () => {
  it('shows the item name, formatted price, and a human split summary', () => {
    const item: Item = {
      id: 'i1',
      name: 'Pizza',
      price: 20,
      quantity: 1,
      discount: 0,
      discountType: 'flat',
      splitType: 'equal',
      consumedBy: [
        { personId: 'p1', value: 1 },
        { personId: 'p2', value: 1 },
      ],
    };

    render(<ItemSplitCard item={item} people={people} formatCurrency={formatCurrency} />);

    expect(screen.getByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Split equally between Alice and Bob')).toBeInTheDocument();
  });

  it('shows "Not yet split" for an item nobody has claimed', () => {
    const item: Item = { id: 'i2', name: 'Soda', price: 3, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] };
    render(<ItemSplitCard item={item} people={people} formatCurrency={formatCurrency} />);
    expect(screen.getByText('Not yet split')).toBeInTheDocument();
  });
});
