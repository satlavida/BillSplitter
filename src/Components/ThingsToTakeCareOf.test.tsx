import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThingsToTakeCareOf from './ThingsToTakeCareOf';
import type { Session } from '../schemas/session.schema';
import type { Item } from '../schemas/bill.schema';

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'item1',
    name: 'Pizza',
    price: 10,
    quantity: 1,
    discount: 0,
    discountType: 'flat',
    consumedBy: [],
    splitType: 'equal',
    ...overrides,
  };
}

function makeSession(bills: Session['bills']): Session {
  return {
    id: 'session1',
    title: 'Trip',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    people: [],
    bills,
    currentBillId: null,
    isLive: false,
    liveCode: null,
    liveCreatorToken: null,
    permissionMode: 'edit',
    creatorPersonId: null,
    currency: 'USD',
  };
}

describe('ThingsToTakeCareOf', () => {
  it('renders nothing when every item is fully claimed', () => {
    const session = makeSession([
      {
        id: 'bill1',
        title: 'Dinner',
        date: new Date().toISOString(),
        items: [makeItem({ consumedBy: [{ personId: 'p1', value: 1 }] })],
        taxAmount: 0,
        currency: 'USD',
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateIsOverride: false,
        paidByPersonId: null,
        receiptImage: null,
        splitStateVersion: '2.0.0',
        scanStatus: 'idle',
        scanError: null,
      },
    ]);

    const { container } = render(
      <MemoryRouter>
        <ThingsToTakeCareOf session={session} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lists a bill with unclaimed items, linking into it, with a singular/plural item count', () => {
    const session = makeSession([
      {
        id: 'bill1',
        title: 'Dinner',
        date: new Date().toISOString(),
        items: [makeItem({ id: 'a', consumedBy: [] }), makeItem({ id: 'b', consumedBy: [{ personId: 'p1', value: 1 }] })],
        taxAmount: 0,
        currency: 'USD',
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateIsOverride: false,
        paidByPersonId: null,
        receiptImage: null,
        splitStateVersion: '2.0.0',
        scanStatus: 'idle',
        scanError: null,
      },
    ]);

    render(
      <MemoryRouter>
        <ThingsToTakeCareOf session={session} />
      </MemoryRouter>
    );

    expect(screen.getByText('Things to Take Care of')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Dinner' });
    expect(link).toHaveAttribute('href', '/session/session1/bill/bill1');
    expect(screen.getByText(/1 item still needs claiming/)).toBeInTheDocument();
  });
});
