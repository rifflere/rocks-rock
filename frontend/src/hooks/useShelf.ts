/**
 * useShelf hook.
 *
 * Manages trophy shelf and journal state:
 *   - Fetches shelf rocks and journal entries.
 *   - Exposes addRock() for the naming flow.
 *   - Exposes deleteShelfRock() and deleteJournalEntry() for removal.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ShelfRock, JournalEntry } from '../types';
import {
  fetchShelf,
  addToShelf as apiAddToShelf,
  deleteFromShelf as apiDeleteShelf,
  fetchJournal,
  deleteJournalEntry as apiDeleteJournal,
} from '../services/api';

interface UseShelfReturn {
  shelfRocks: ShelfRock[];
  journalEntries: JournalEntry[];
  shelfLoading: boolean;
  journalLoading: boolean;
  error: string | null;
  /**
   * Adds a collected road rock to the shelf.
   * @returns The created ShelfRock, or throws on profanity/error.
   */
  addRock: (
    roadRockId: string,
    rockTypeId: number,
    sizeMm: number,
    nickname?: string,
  ) => Promise<ShelfRock>;
  deleteShelfRock: (id: string) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  refreshShelf: () => Promise<void>;
  refreshJournal: () => Promise<void>;
}

export function useShelf(): UseShelfReturn {
  const [shelfRocks, setShelfRocks] = useState<ShelfRock[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [shelfLoading, setShelfLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShelf = useCallback(async () => {
    setShelfLoading(true);
    try {
      const data = await fetchShelf();
      setShelfRocks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shelf.');
    } finally {
      setShelfLoading(false);
    }
  }, []);

  const loadJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const data = await fetchJournal();
      setJournalEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal.');
    } finally {
      setJournalLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShelf();
    void loadJournal();
  }, [loadShelf, loadJournal]);

  const addRock = useCallback(
    async (roadRockId: string, rockTypeId: number, sizeMm: number, nickname?: string) => {
      const newRock = await apiAddToShelf(roadRockId, rockTypeId, sizeMm, nickname);
      // Prepend to keep "newest first" order without a full refetch.
      setShelfRocks(prev => [newRock, ...prev]);
      // Also reload journal to pick up the new entry.
      await loadJournal();
      return newRock;
    },
    [loadJournal],
  );

  const deleteShelfRock = useCallback(async (id: string) => {
    setShelfRocks(prev => prev.filter(r => r.id !== id));
    setJournalEntries(prev => prev.filter(j => j.shelfRockId !== id));
    try {
      await apiDeleteShelf(id);
    } catch (e) {
      // Rollback on failure.
      await loadShelf();
      await loadJournal();
      throw e;
    }
  }, [loadShelf, loadJournal]);

  const deleteJournalEntry = useCallback(async (id: string) => {
    const entry = journalEntries.find(j => j.id === id);
    // Optimistic remove from both lists.
    setJournalEntries(prev => prev.filter(j => j.id !== id));
    if (entry) setShelfRocks(prev => prev.filter(r => r.id !== entry.shelfRockId));
    try {
      await apiDeleteJournal(id);
    } catch (e) {
      await loadShelf();
      await loadJournal();
      throw e;
    }
  }, [journalEntries, loadShelf, loadJournal]);

  return {
    shelfRocks,
    journalEntries,
    shelfLoading,
    journalLoading,
    error,
    addRock,
    deleteShelfRock,
    deleteJournalEntry,
    refreshShelf: loadShelf,
    refreshJournal: loadJournal,
  };
}
