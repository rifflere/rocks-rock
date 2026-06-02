/**
 * Shared test fixtures — minimal but type-safe fake data.
 * Import from here rather than repeating boilerplate in every test file.
 */

import type { RoadRock, ShelfRock, JournalEntry } from '../types';

export const mockRockType = {
  id: 1,
  name: 'Quartz',
  category: 'mineral',
  rarityScore: 1,
  colorPrimary: '#E8E0D5',
  colorSecondary: '#F5F0EC',
  sizeRangeMinMm: 5,
  sizeRangeMaxMm: 80,
  hardnessMin: 7,
  hardnessMax: 7,
  luster: 'glassy',
  texture: 'smooth',
  description: 'The most abundant mineral on Earth.',
  funFact: 'Quartz keeps time in your watch.',
};

export const mockRareRockType = {
  ...mockRockType,
  id: 2,
  name: 'Amethyst',
  rarityScore: 7,
  colorPrimary: '#9B59B6',
  colorSecondary: '#8E44AD',
  texture: 'crystalline',
  luster: 'glassy',
  description: 'A violet variety of quartz.',
  funFact: 'Medieval Europeans wore amethyst against poison.',
};

export const mockRoadRock: RoadRock = {
  id: 'test-road-rock-1',
  typeId: 1,
  rockType: mockRockType,
  canvasX: 0.5,
  canvasY: 0.6,
  sizeMm: 20,
  isCollected: false,
  generatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockShelfRock: ShelfRock = {
  id: 'test-shelf-rock-1',
  rockTypeId: 1,
  rockType: mockRockType,
  nickname: 'Sparkles',
  sizeMm: 20,
  collectedAt: '2024-01-01T00:00:00.000Z',
};

export const mockJournalEntry: JournalEntry = {
  id: 'test-journal-1',
  shelfRockId: 'test-shelf-rock-1',
  autoText: 'Found it! Added "Sparkles" — a small, pocket-sized stone — to the shelf today.',
  createdAt: '2024-01-01T00:00:00.000Z',
  shelfRock: mockShelfRock,
};
