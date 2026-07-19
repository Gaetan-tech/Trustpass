import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListingCard } from '../src/features/listings/ListingCard';
import type { Listing } from '../src/types/api';

const listing: Listing = {
  id: 'l1',
  event: { id: 'e1', name: 'Concert Test', venue: 'Zénith', startsAt: '2026-08-01T20:00:00Z' },
  ticketType: { id: 't1', name: 'Fosse' },
  price: 4500,
};

describe('ListingCard', () => {
  it('affiche le prix formaté et déclenche onBuy au clic', async () => {
    const onBuy = vi.fn();
    render(
      <MemoryRouter>
        <ListingCard listing={listing} onBuy={onBuy} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Concert Test')).toBeInTheDocument();
    expect(screen.getByText(/45,00/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /acheter/i }));
    expect(onBuy).toHaveBeenCalledWith(listing);
  });
});
