import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JoinerBillList from './JoinerBillList';
import { markBillVisited } from '../../lib/joinerVisitTracking';
import type { LiveBill } from '../../schemas/live.schema';

jest.mock('../../lib/liveApi', () => ({
  LIVE_SERVER_URL: 'http://localhost:8080',
}));

function makeBill(overrides: Partial<LiveBill>): LiveBill {
  return {
    id: 'bill1',
    title: 'Dinner',
    date: new Date().toISOString(),
    items: [],
    taxAmount: 0,
    currency: 'USD',
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateIsOverride: false,
    paidByPersonId: null,
    imageRefKey: null,
    imageWidth: null,
    imageHeight: null,
    ...overrides,
  };
}

describe('JoinerBillList — things-to-take-care-of signals', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('badges an unvisited bill as "New" without an unclaimed-items note', () => {
    const bill = makeBill({ id: 'b1', items: [{ id: 'i1', name: 'Pizza', price: 10, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] }] });
    render(
      <MemoryRouter>
        <JoinerBillList code="ABC123" bills={[bill]} myPersonId="me" />
      </MemoryRouter>
    );

    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.queryByText(/still unclaimed for you/)).not.toBeInTheDocument();
  });

  it('shows an unclaimed-items note once visited, with no "New" badge', () => {
    markBillVisited('ABC123', 'b1');
    const bill = makeBill({ id: 'b1', items: [{ id: 'i1', name: 'Pizza', price: 10, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] }] });
    render(
      <MemoryRouter>
        <JoinerBillList code="ABC123" bills={[bill]} myPersonId="me" />
      </MemoryRouter>
    );

    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.getByText(/1 item still unclaimed for you/)).toBeInTheDocument();
  });

  it('shows neither signal once visited and fully claimed', () => {
    markBillVisited('ABC123', 'b1');
    const bill = makeBill({ id: 'b1', items: [{ id: 'i1', name: 'Pizza', price: 10, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [{ personId: 'me', value: 1 }] }] });
    render(
      <MemoryRouter>
        <JoinerBillList code="ABC123" bills={[bill]} myPersonId="me" />
      </MemoryRouter>
    );

    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText(/still unclaimed for you/)).not.toBeInTheDocument();
  });
});
