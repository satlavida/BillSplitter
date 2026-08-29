import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JoinerUpiNudge from './JoinerUpiNudge';
import { updateLivePerson } from '../../lib/liveApi';
import type { LiveSettlement } from '../../schemas/live.schema';

jest.mock('../../lib/liveApi', () => ({
  updateLivePerson: jest.fn().mockResolvedValue(undefined),
  LiveApiError: class LiveApiError extends Error {},
}));

const owedSettlement: LiveSettlement = {
  balances: [{ personId: 'me', amount: 25 }],
  transactions: [],
};

const notOwedSettlement: LiveSettlement = {
  balances: [{ personId: 'me', amount: -10 }],
  transactions: [],
};

describe('JoinerUpiNudge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when the joiner is not owed money', () => {
    const { container } = render(
      <JoinerUpiNudge code="ABC123" myPersonId="me" myPersonUpiId="" joinerToken="tok" settlement={notOwedSettlement} onSaved={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the joiner already has a UPI ID set', () => {
    const { container } = render(
      <JoinerUpiNudge code="ABC123" myPersonId="me" myPersonUpiId="me@bank" joinerToken="tok" settlement={owedSettlement} onSaved={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the nudge when owed money with no UPI ID set, and saves it', async () => {
    const onSaved = jest.fn();
    render(<JoinerUpiNudge code="ABC123" myPersonId="me" myPersonUpiId="" joinerToken="tok" settlement={owedSettlement} onSaved={onSaved} />);

    expect(screen.getByText(/You're owed money/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('name@bank'), { target: { value: 'me@bank' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateLivePerson).toHaveBeenCalledWith('ABC123', 'me', { upiId: 'me@bank' }, 'tok'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
