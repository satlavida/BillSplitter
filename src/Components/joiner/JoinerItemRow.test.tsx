import { render, screen, fireEvent } from '@testing-library/react';
import JoinerItemRow from './JoinerItemRow';
import type { LiveItem } from '../../schemas/live.schema';

jest.mock('../../lib/liveApi', () => ({
  claimItem: jest.fn().mockResolvedValue({ status: 'approved' }),
  unclaimItem: jest.fn().mockResolvedValue(undefined),
  LiveApiError: class LiveApiError extends Error {},
}));

const baseItem: LiveItem = {
  id: 'item1',
  name: 'Pizza',
  price: 30,
  quantity: 10,
  discount: 0,
  discountType: 'flat',
  splitType: 'fraction',
  consumedBy: [],
};

const nameFor = (personId: string) => (personId === 'me' ? 'Me' : personId === 'other' ? 'Other' : personId);

describe('JoinerItemRow — quantity claim cap', () => {
  it('caps the claim grid at the item quantity when nobody else has claimed', () => {
    render(
      <JoinerItemRow
        code="ABC123"
        billId="bill1"
        item={baseItem}
        currency="USD"
        myPersonId="me"
        joinerToken="tok"
        nameFor={nameFor}
        disabled={false}
        onChanged={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '11' })).not.toBeInTheDocument();
  });

  it('caps the claim grid at what is left once someone else has already claimed some', () => {
    const item: LiveItem = { ...baseItem, consumedBy: [{ personId: 'other', value: 6 }] };
    render(
      <JoinerItemRow
        code="ABC123"
        billId="bill1"
        item={item}
        currency="USD"
        myPersonId="me"
        joinerToken="tok"
        nameFor={nameFor}
        disabled={false}
        onChanged={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
  });

  it('lets a joiner keep their own already-claimed value in range even if others have claimed the rest', () => {
    const item: LiveItem = {
      ...baseItem,
      consumedBy: [
        { personId: 'me', value: 3 },
        { personId: 'other', value: 7 },
      ],
    };
    render(
      <JoinerItemRow
        code="ABC123"
        billId="bill1"
        item={item}
        currency="USD"
        myPersonId="me"
        joinerToken="tok"
        nameFor={nameFor}
        disabled={false}
        onChanged={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Claimed 3' }));
    // Nothing is left for me beyond what I already hold — the grid tops out at my own value.
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument();
  });
});
