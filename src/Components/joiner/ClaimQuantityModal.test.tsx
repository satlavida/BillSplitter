import { render, screen } from '@testing-library/react';
import ClaimQuantityModal from './ClaimQuantityModal';

describe('ClaimQuantityModal', () => {
  it('renders a number button for every value up to max, not the full quantity', () => {
    render(
      <ClaimQuantityModal
        isOpen
        onClose={jest.fn()}
        itemName="Pizza"
        quantity={10}
        max={4}
        selected={0}
        busy={false}
        onSelect={jest.fn()}
        onUnclaim={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(screen.getByText(/Others have already claimed the rest — only 4 left for you\./)).toBeInTheDocument();
  });

  it('does not warn about others claiming when max matches the full quantity', () => {
    render(
      <ClaimQuantityModal
        isOpen
        onClose={jest.fn()}
        itemName="Pizza"
        quantity={10}
        max={10}
        selected={0}
        busy={false}
        onSelect={jest.fn()}
        onUnclaim={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.queryByText(/Others have already claimed the rest/)).not.toBeInTheDocument();
  });
});
