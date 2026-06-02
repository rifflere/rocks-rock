/**
 * API client.
 *
 * Thin wrapper around fetch() for all backend calls. All endpoints are
 * relative (/api/...) so the Vite proxy handles routing in dev, and the
 * deployed frontend can point to the correct backend via base URL.
 *
 * Throws on non-2xx responses with the server's error message if available.
 */

import type { RoadRock, ShelfRock, JournalEntry } from '../types';

const BASE = '/api';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    // Try to surface the backend's error message.
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // Ignore JSON parse failure — use the status code message.
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── Road rocks ────────────────────────────────────────────────────────────────

/** Fetches all uncollected road rocks. */
export function fetchRocks(): Promise<RoadRock[]> {
  return request<RoadRock[]>('/rocks');
}

/**
 * Marks a road rock as collected — removes it from the road for everyone.
 * Call this the moment the user drops the rock onto the basket.
 */
export function collectRock(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/rocks/${id}/collect`, { method: 'POST' });
}

// ── Trophy shelf ──────────────────────────────────────────────────────────────

/** Fetches all shelf rocks, newest first. */
export function fetchShelf(): Promise<ShelfRock[]> {
  return request<ShelfRock[]>('/shelf');
}

/**
 * Adds a collected road rock to the communal shelf.
 * @param roadRockId - The road rock's UUID (must already be marked collected).
 * @param rockTypeId - The rock's type ID.
 * @param sizeMm     - The rock's actual size in mm.
 * @param nickname   - Optional user-supplied name (will be filtered server-side).
 */
export function addToShelf(
  roadRockId: string,
  rockTypeId: number,
  sizeMm: number,
  nickname?: string,
): Promise<ShelfRock> {
  return request<ShelfRock>('/shelf', {
    method: 'POST',
    body: JSON.stringify({ roadRockId, rockTypeId, sizeMm, nickname }),
  });
}

/** Removes a rock from the shelf (and its journal entry). */
export function deleteFromShelf(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/shelf/${id}`, { method: 'DELETE' });
}

// ── Journal ───────────────────────────────────────────────────────────────────

/** Fetches all journal entries, newest first. */
export function fetchJournal(): Promise<JournalEntry[]> {
  return request<JournalEntry[]>('/journal');
}

/** Deletes a journal entry (which also removes its shelf rock). */
export function deleteJournalEntry(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/journal/${id}`, { method: 'DELETE' });
}
