import { render, screen, fireEvent } from '@testing-library/react';
import PaymentCard from './PaymentCard';
import type { Payment } from '../../schemas/bill.schema';

const basePayment: Payment = {
  id: 'p1',
  payerId: 'bob',
  payeeId: 'alice',
  amount: 500,
  currency: 'INR',
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateIsOverride: false,
  method: 'cash',
  transactionId: null,
  addedByPersonId: 'bob',
  verified: false,
  verifiedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const nameFor = (id: string) => ({ bob: 'Bob', alice: 'Alice' })[id] ?? 'Someone';

describe('PaymentCard', () => {
  it('shows a Pending badge and no verify button when canVerify is false', () => {
    render(<PaymentCard payment={basePayment} nameFor={nameFor} sessionCurrency="INR" canVerify={false} verifying={false} onVerify={jest.fn()} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Received' })).not.toBeInTheDocument();
  });

  it('shows a Mark Received button when canVerify is true, and calls onVerify', () => {
    const onVerify = jest.fn();
    render(<PaymentCard payment={basePayment} nameFor={nameFor} sessionCurrency="INR" canVerify verifying={false} onVerify={onVerify} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Received' }));
    expect(onVerify).toHaveBeenCalled();
  });

  it('shows a Verified badge and no verify button for an already-verified payment', () => {
    render(<PaymentCard payment={{ ...basePayment, verified: true }} nameFor={nameFor} sessionCurrency="INR" canVerify verifying={false} onVerify={jest.fn()} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Received' })).not.toBeInTheDocument();
  });

  it('shows the converted session-currency amount when the payment currency differs', () => {
    render(
      <PaymentCard
        payment={{ ...basePayment, currency: 'USD', amount: 50, exchangeRate: 80 }}
        nameFor={nameFor}
        sessionCurrency="INR"
        canVerify={false}
        verifying={false}
        onVerify={jest.fn()}
      />
    );
    // 50 USD * 80 = 4000 INR
    expect(screen.getByText(/4,000\.00|4000\.00/)).toBeInTheDocument();
  });
});
