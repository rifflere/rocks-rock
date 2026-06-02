/**
 * Tests for the NameRockModal component.
 *
 * Verifies:
 *   - Rock preview (name, size) is displayed
 *   - Skip button calls onConfirm(undefined)
 *   - Confirm button calls onConfirm(nickname) with the typed value
 *   - Empty nickname → confirm calls onConfirm(undefined)
 *   - Server error is shown inline
 *   - Pressing Enter triggers confirm
 *   - Pressing Escape triggers cancel
 *   - Character counter updates as user types
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import NameRockModal from '../components/ui/NameRockModal';
import { mockRoadRock } from './fixtures';

function setup(onConfirm = vi.fn().mockResolvedValue(undefined), onCancel = vi.fn()) {
  const user = userEvent.setup();
  const result = render(
    <NameRockModal rock={mockRoadRock} onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { user, onConfirm, onCancel, ...result };
}

describe('NameRockModal — rendering', () => {
  test('shows rock type name', () => {
    setup();
    expect(screen.getByText('Quartz')).toBeInTheDocument();
  });

  test('shows size in mm', () => {
    setup();
    expect(screen.getByText(/20\s*mm/)).toBeInTheDocument();
  });

  test('shows the heading text', () => {
    setup();
    expect(screen.getByText(/You found a rock/i)).toBeInTheDocument();
  });

  test('has an accessible input', () => {
    setup();
    const input = screen.getByRole('textbox', { name: /nickname/i });
    expect(input).toBeInTheDocument();
  });

  test('shows character counter starting at 0/40', () => {
    setup();
    expect(screen.getByText('0/40')).toBeInTheDocument();
  });
});

describe('NameRockModal — actions', () => {
  test('Skip button calls onConfirm(undefined)', async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByText('Skip name'));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  test('Confirm with blank input calls onConfirm(undefined)', async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByRole('button', { name: /Add to shelf/i }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  test('Confirm with typed nickname calls onConfirm(nickname)', async () => {
    const { user, onConfirm } = setup();
    const input = screen.getByRole('textbox', { name: /nickname/i });
    await user.type(input, 'Sparkles');
    await user.click(screen.getByRole('button', { name: /Name it/i }));
    expect(onConfirm).toHaveBeenCalledWith('Sparkles');
  });

  test('character counter updates as user types', async () => {
    const { user } = setup();
    const input = screen.getByRole('textbox', { name: /nickname/i });
    await user.type(input, 'Hi');
    expect(screen.getByText('2/40')).toBeInTheDocument();
  });

  test('Enter key triggers confirm', async () => {
    const { user, onConfirm } = setup();
    const input = screen.getByRole('textbox', { name: /nickname/i });
    await user.type(input, 'Rocky');
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('Rocky');
  });

  test('Escape key triggers cancel', async () => {
    const { user, onCancel } = setup();
    const input = screen.getByRole('textbox', { name: /nickname/i });
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('NameRockModal — server error handling', () => {
  test('shows error message when server rejects the nickname', async () => {
    const errorMsg = 'That name is not allowed. Please choose something else.';
    const onConfirm = vi.fn().mockRejectedValue(new Error(errorMsg));
    const { user } = setup(onConfirm);

    const input = screen.getByRole('textbox', { name: /nickname/i });
    await user.type(input, 'badword');
    await user.click(screen.getByRole('button', { name: /Name it/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(errorMsg);
    });
  });

  test('clears error when user edits the input after rejection', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Not allowed.'));
    const { user } = setup(onConfirm);

    const input = screen.getByRole('textbox', { name: /nickname/i });
    await user.type(input, 'badword');
    await user.click(screen.getByRole('button', { name: /Name it/i }));

    await waitFor(() => screen.getByRole('alert'));

    // Type another character — error should clear.
    await user.type(input, 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
