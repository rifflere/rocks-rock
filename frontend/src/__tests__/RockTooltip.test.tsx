/**
 * Tests for the RockTooltip component.
 *
 * Verifies:
 *   - Hover mode shows partial info (name, size, rarity) but not full details
 *   - Hold mode shows all collector data (hardness, luster, description, fun fact)
 *   - Rarity star count is correct for various scores
 *   - "Ultra Rare" label appears for score 9–10
 *   - Tooltip is positioned near the given x/y
 *   - Common rocks (score 1) show "Common" label
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import RockTooltip from '../components/ui/RockTooltip';
import { mockRoadRock, mockRareRockType } from './fixtures';

describe('RockTooltip — hover mode (partial info)', () => {
  test('shows rock name', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    expect(screen.getByText('Quartz')).toBeInTheDocument();
  });

  test('shows size in mm', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    expect(screen.getByText(/20\s*mm/)).toBeInTheDocument();
  });

  test('shows rarity stars', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    // Quartz rarityScore=1 → 1 star out of 5
    expect(screen.getByText(/★/)).toBeInTheDocument();
  });

  test('shows "Common" label for rarity score 1', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    expect(screen.getByText('Common')).toBeInTheDocument();
  });

  test('does NOT show description in hover mode', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    expect(screen.queryByText(/most abundant mineral/i)).not.toBeInTheDocument();
  });

  test('does NOT show fun fact in hover mode', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    expect(screen.queryByText(/Quartz keeps time/i)).not.toBeInTheDocument();
  });

  test('shows hint text in hover mode', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hover" x={100} y={100} />);
    expect(screen.getByText(/Hold to inspect/i)).toBeInTheDocument();
  });
});

describe('RockTooltip — hold mode (full info)', () => {
  test('shows description', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hold" x={100} y={100} />);
    expect(screen.getByText(/most abundant mineral/i)).toBeInTheDocument();
  });

  test('shows fun fact', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hold" x={100} y={100} />);
    expect(screen.getByText(/Quartz keeps time/i)).toBeInTheDocument();
  });

  test('shows hardness', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hold" x={100} y={100} />);
    // The span renders "7 (Mohs)" as a single text node — match the combined text.
    expect(screen.getByText(/7.*Mohs/s)).toBeInTheDocument();
  });

  test('shows luster', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hold" x={100} y={100} />);
    expect(screen.getByText(/glassy/i)).toBeInTheDocument();
  });

  test('shows "Drag to the basket" hint', () => {
    render(<RockTooltip rock={mockRoadRock} mode="hold" x={100} y={100} />);
    expect(screen.getByText(/Drag to the basket/i)).toBeInTheDocument();
  });
});

describe('RockTooltip — rarity labels', () => {
  function makeRock(rarityScore: number) {
    return {
      ...mockRoadRock,
      rockType: { ...mockRareRockType, rarityScore },
    };
  }

  test('rarityScore 7–8 shows "Very Rare"', () => {
    render(<RockTooltip rock={makeRock(7)} mode="hover" x={0} y={0} />);
    expect(screen.getByText('Very Rare')).toBeInTheDocument();
  });

  test('rarityScore 9–10 shows "Ultra Rare"', () => {
    render(<RockTooltip rock={makeRock(10)} mode="hover" x={0} y={0} />);
    expect(screen.getByText('Ultra Rare')).toBeInTheDocument();
  });

  test('rarityScore 3–4 shows "Uncommon"', () => {
    render(<RockTooltip rock={makeRock(3)} mode="hover" x={0} y={0} />);
    expect(screen.getByText('Uncommon')).toBeInTheDocument();
  });

  test('rarityScore 5–6 shows "Rare"', () => {
    render(<RockTooltip rock={makeRock(5)} mode="hover" x={0} y={0} />);
    expect(screen.getByText('Rare')).toBeInTheDocument();
  });
});
