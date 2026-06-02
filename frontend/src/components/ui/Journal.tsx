/**
 * Journal — the "vade mecum" little red book.
 *
 * Opens as an overlay on the road view (the road is still visible behind it).
 * Shows journal entries two per "page spread" (left + right pages).
 * The user can click the outer edges of the book to turn pages forward/back.
 * Each entry has a small "×" to delete it (which also removes it from the shelf).
 *
 * Visual style: aged parchment pages inside a red leather cover.
 * Uses the "Lora" serif font loaded in index.html for a handwritten-book feel.
 */

import React, { useState, useCallback } from 'react';
import type { JournalEntry } from '../../types';

interface JournalProps {
  entries: JournalEntry[];
  loading: boolean;
  onDeleteEntry: (id: string) => Promise<void>;
  onClose: () => void;
}

const ENTRIES_PER_PAGE = 2; // one entry per page side (left + right)

const Journal: React.FC<JournalProps> = ({ entries, loading, onDeleteEntry, onClose }) => {
  // currentSpread is the index of the left page (0, 2, 4, …)
  const [currentSpread, setCurrentSpread] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalSpreads = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
  const canGoBack = currentSpread > 0;
  const canGoForward = currentSpread + ENTRIES_PER_PAGE < entries.length;

  const leftEntry = entries[currentSpread] ?? null;
  const rightEntry = entries[currentSpread + 1] ?? null;

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await onDeleteEntry(id);
        // If we deleted the last entry on this spread, go back a spread.
        if (!leftEntry || !rightEntry) {
          setCurrentSpread(Math.max(0, currentSpread - ENTRIES_PER_PAGE));
        }
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleteEntry, leftEntry, rightEntry, currentSpread],
  );

  return (
    <>
      {/* Semi-transparent backdrop so road is still visible */}
      <div className="journal-backdrop" onClick={onClose} />

      <div className="journal" role="dialog" aria-modal="true" aria-label="Field journal">
        {/* Red leather cover spine (left edge) */}
        <div className="journal__spine" />

        {/* Book pages */}
        <div className="journal__pages">
          {/* Left page */}
          <div className="journal__page journal__page--left">
            <PageContent
              entry={leftEntry}
              pageNumber={currentSpread + 1}
              totalPages={entries.length}
              loading={loading}
              deletingId={deletingId}
              onDelete={handleDelete}
              emptyMessage={entries.length === 0 ? 'No entries yet.\nGo find some rocks!' : ''}
            />
            {/* Turn-back button on left edge */}
            {canGoBack && (
              <button
                className="journal__turn journal__turn--left"
                onClick={() => setCurrentSpread(s => s - ENTRIES_PER_PAGE)}
                aria-label="Previous page"
              >
                ‹
              </button>
            )}
          </div>

          {/* Page divider / binding */}
          <div className="journal__gutter" />

          {/* Right page */}
          <div className="journal__page journal__page--right">
            <PageContent
              entry={rightEntry}
              pageNumber={currentSpread + 2}
              totalPages={entries.length}
              loading={false}
              deletingId={deletingId}
              onDelete={handleDelete}
              emptyMessage=""
            />
            {/* Turn-forward button on right edge */}
            {canGoForward && (
              <button
                className="journal__turn journal__turn--right"
                onClick={() => setCurrentSpread(s => s + ENTRIES_PER_PAGE)}
                aria-label="Next page"
              >
                ›
              </button>
            )}
          </div>
        </div>

        {/* Page counter */}
        <div className="journal__footer">
          <span className="journal__page-count">
            {entries.length === 0
              ? 'Empty'
              : `Page ${Math.floor(currentSpread / ENTRIES_PER_PAGE) + 1} of ${totalSpreads}`}
          </span>
          <button className="journal__close" onClick={onClose} aria-label="Close journal">
            Close
          </button>
        </div>
      </div>
    </>
  );
};

// ── Page content sub-component ────────────────────────────────────────────────

interface PageContentProps {
  entry: JournalEntry | null;
  pageNumber: number;
  totalPages: number;
  loading: boolean;
  deletingId: string | null;
  onDelete: (id: string) => Promise<void>;
  emptyMessage: string;
}

const PageContent: React.FC<PageContentProps> = ({
  entry,
  pageNumber,
  totalPages,
  loading,
  deletingId,
  onDelete,
  emptyMessage,
}) => {
  if (loading) {
    return <div className="journal__loading">Loading…</div>;
  }

  if (!entry) {
    return (
      <div className="journal__page-empty">
        {emptyMessage.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    );
  }

  const isDeleting = deletingId === entry.id;
  const sr = entry.shelfRock;
  const displayName = sr?.nickname
    ? `"${sr.nickname}"`
    : sr?.rockType?.name ?? 'Unknown';

  return (
    <div className="journal__entry">
      {/* Entry header: rock name + page number */}
      <div className="journal__entry-header">
        <span
          className="journal__rock-swatch"
          style={{ background: sr?.rockType?.colorPrimary ?? '#888' }}
        />
        <span className="journal__rock-label">{displayName}</span>
        <button
          className="journal__delete-btn"
          onClick={() => void onDelete(entry.id)}
          disabled={isDeleting}
          aria-label="Delete entry"
          title="Remove this entry"
        >
          {isDeleting ? '…' : '×'}
        </button>
      </div>

      {/* Auto-generated flavor text */}
      <p className="journal__entry-text">{entry.autoText}</p>

      {/* Date */}
      <div className="journal__entry-date">
        {new Date(entry.createdAt).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>

      {/* Decorative page number */}
      <div className="journal__page-number">{pageNumber} / {totalPages}</div>
    </div>
  );
};

export default Journal;
