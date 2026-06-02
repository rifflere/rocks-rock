/**
 * Tests for the TrophyShelf component.
 *
 * Verifies:
 *   - Empty state message when no rocks
 *   - Rock cards render with nickname and type name
 *   - Rocks without nicknames get an auto-exclamation (not the literal word "null")
 *   - Delete button shows confirmation before deleting
 *   - Confirming deletion calls onDelete with the correct ID
 *   - "No" cancels the delete without calling onDelete
 *   - Rock count in the subtitle
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import TrophyShelf from '../components/ui/TrophyShelf';
import { mockShelfRock } from './fixtures';

function setup(
  rocks = [mockShelfRock],
  onDelete = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
) {
  const user = userEvent.setup();
  const result = render(
    <TrophyShelf rocks={rocks} loading={false} onDelete={onDelete} onClose={onClose} />,
  );
  return { user, onDelete, onClose, ...result };
}

describe('TrophyShelf — empty state', () => {
  test('shows empty state message when no rocks', () => {
    render(<TrophyShelf rocks={[]} loading={false} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/go find some rocks/i)).toBeInTheDocument();
  });

  test('shows loading indicator', () => {
    render(<TrophyShelf rocks={[]} loading={true} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe('TrophyShelf — rock display', () => {
  test('shows rock type name', () => {
    setup();
    expect(screen.getByText('Quartz')).toBeInTheDocument();
  });

  test('shows nickname in quotes when present', () => {
    setup();
    expect(screen.getByText(/"Sparkles"/)).toBeInTheDocument();
  });

  test('shows auto-exclamation (not null) for rocks without nickname', () => {
    const rockWithoutName = { ...mockShelfRock, nickname: null };
    render(
      <TrophyShelf rocks={[rockWithoutName]} loading={false} onDelete={vi.fn()} onClose={vi.fn()} />,
    );
    // Should never render the literal string "null"
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bnull\b/);
  });

  test('shows rock count in subtitle', () => {
    setup([mockShelfRock, { ...mockShelfRock, id: 'rock-2' }]);
    expect(screen.getByText(/2 rocks collected/)).toBeInTheDocument();
  });

  test('singular "rock" for one rock', () => {
    setup([mockShelfRock]);
    expect(screen.getByText(/1 rock collected/)).toBeInTheDocument();
  });
});

describe('TrophyShelf — deletion flow', () => {
  test('× button appears on each card', () => {
    setup();
    const deleteBtn = screen.getByRole('button', { name: /delete sparkles/i });
    expect(deleteBtn).toBeInTheDocument();
  });

  test('clicking × shows confirmation prompt', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /delete sparkles/i }));
    expect(screen.getByText('Remove?')).toBeInTheDocument();
  });

  test('clicking "Yes" calls onDelete with the correct ID', async () => {
    const { user, onDelete } = setup();
    await user.click(screen.getByRole('button', { name: /delete sparkles/i }));
    await user.click(screen.getByRole('button', { name: /yes/i }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(mockShelfRock.id));
  });

  test('clicking "No" hides the confirmation without calling onDelete', async () => {
    const { user, onDelete } = setup();
    await user.click(screen.getByRole('button', { name: /delete sparkles/i }));
    await user.click(screen.getByRole('button', { name: /no/i }));
    expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe('TrophyShelf — close', () => {
  test('back button calls onClose', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByText(/Back to the road/i));
    expect(onClose).toHaveBeenCalled();
  });
});
