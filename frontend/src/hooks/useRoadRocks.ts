/**
 * useRoadRocks hook.
 *
 * Fetches the list of road rocks from the API and exposes helpers for
 * removing a rock from the local list when it's collected. This keeps
 * the UI snappy — we optimistically remove the rock from the canvas
 * immediately on pickup rather than waiting for a refetch.
 */

import { useState, useEffect, useCallback } from 'react';
import type { RoadRock } from '../types';
import { fetchRocks, collectRock as apiCollectRock } from '../services/api';

interface UseRoadRocksReturn {
  rocks: RoadRock[];
  loading: boolean;
  error: string | null;
  /** Marks a rock as collected in the API and removes it from the local list. */
  collectRock: (id: string) => Promise<void>;
  /** Re-fetches rocks from the server (e.g. after navigation back to road view). */
  refresh: () => Promise<void>;
}

export function useRoadRocks(): UseRoadRocksReturn {
  const [rocks, setRocks] = useState<RoadRock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRocks();
      setRocks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rocks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Optimistically removes the rock from the canvas, then fires the API call.
   * If the API call fails, the rock is added back to the list.
   */
  const collectRock = useCallback(async (id: string) => {
    // Optimistic remove.
    setRocks(prev => prev.filter(r => r.id !== id));
    try {
      await apiCollectRock(id);
    } catch (e) {
      // Rollback: re-fetch to restore consistent state.
      console.error('[useRoadRocks] Collect failed, rolling back:', e);
      await load();
    }
  }, [load]);

  return { rocks, loading, error, collectRock, refresh: load };
}
