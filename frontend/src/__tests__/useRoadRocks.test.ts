/**
 * Tests for the useRoadRocks hook.
 *
 * The API module is mocked so no real HTTP requests are made.
 *
 * Verifies:
 *   - Initial loading state
 *   - Rocks are loaded on mount
 *   - collectRock() optimistically removes the rock from the list
 *   - collectRock() rolls back if the API call fails
 *   - Error state is set when fetchRocks() throws
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { useRoadRocks } from '../hooks/useRoadRocks';
import { mockRoadRock } from './fixtures';

// Mock the API module — no real fetch calls during tests.
vi.mock('../services/api', () => ({
  fetchRocks: vi.fn(),
  collectRock: vi.fn(),
}));

// Import the mocked functions so we can control their behavior per-test.
import * as api from '../services/api';
const mockFetchRocks = vi.mocked(api.fetchRocks);
const mockCollectRock = vi.mocked(api.collectRock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRoadRocks — initial load', () => {
  test('starts in loading state', () => {
    mockFetchRocks.mockResolvedValue([]);
    const { result } = renderHook(() => useRoadRocks());
    expect(result.current.loading).toBe(true);
  });

  test('loads rocks on mount', async () => {
    mockFetchRocks.mockResolvedValue([mockRoadRock]);
    const { result } = renderHook(() => useRoadRocks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rocks).toHaveLength(1);
    expect(result.current.rocks[0].id).toBe(mockRoadRock.id);
  });

  test('sets error state when fetch fails', async () => {
    mockFetchRocks.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useRoadRocks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.rocks).toHaveLength(0);
  });
});

describe('useRoadRocks — collectRock', () => {
  test('optimistically removes rock from the list', async () => {
    mockFetchRocks.mockResolvedValue([mockRoadRock]);
    mockCollectRock.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useRoadRocks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rocks).toHaveLength(1);

    await act(async () => {
      await result.current.collectRock(mockRoadRock.id);
    });

    expect(result.current.rocks).toHaveLength(0);
  });

  test('calls the API with the correct rock ID', async () => {
    mockFetchRocks.mockResolvedValue([mockRoadRock]);
    mockCollectRock.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useRoadRocks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.collectRock(mockRoadRock.id);
    });

    expect(mockCollectRock).toHaveBeenCalledWith(mockRoadRock.id);
  });

  test('rolls back optimistic removal if API call fails', async () => {
    mockFetchRocks.mockResolvedValue([mockRoadRock]);
    mockCollectRock.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useRoadRocks());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Suppress the console.error from the rollback log.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      await result.current.collectRock(mockRoadRock.id);
    });

    // After rollback (which re-fetches), rocks should be restored.
    await waitFor(() => expect(result.current.rocks).toHaveLength(1));

    consoleSpy.mockRestore();
  });
});
