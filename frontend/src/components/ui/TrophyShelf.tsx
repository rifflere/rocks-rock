/**
 * TrophyShelf — the communal trophy shelf view.
 *
 * Displays all rocks that anyone has collected and shelved, newest first.
 * Each rock shows:
 *   - A colored "rock" shape (CSS, not Konva — simpler for the shelf layout)
 *   - Its nickname or a randomly generated exclamation ("Ooh, shiny!")
 *   - Rock type, size, rarity
 *
 * Deletion:
 *   Clicking a rock opens a confirmation state on that rock card.
 *   Confirming removes it from the shelf and its journal entry via the API.
 */

import React, { useState, useCallback } from 'react';
import type { ShelfRock } from '../../types';

interface TrophyShelfProps {
  rocks: ShelfRock[];
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

/** Fallback exclamations for rocks without a user-given nickname. */
const AUTO_EXCLAMATIONS = [
  'Ooh, shiny!',
  'What a find!',
  'Perfection.',
  'Nature is wild.',
  'Would you look at that.',
  'Beautiful.',
  'An absolute treasure.',
  'Simply stunning.',
  'A mystery rock!',
];

function getExclamation(id: string): string {
  // Hash the ID to a consistent index so the exclamation doesn't change on re-render.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AUTO_EXCLAMATIONS[Math.abs(h) % AUTO_EXCLAMATIONS.length];
}

function rarityStars(score: number): string {
  const stars = Math.ceil(score / 2);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/** Single rock card on the shelf. */
const ShelfRockCard: React.FC<{
  rock: ShelfRock;
  onDelete: (id: string) => Promise<void>;
}> = ({ rock, onDelete }) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(rock.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }, [rock.id, onDelete]);

  const displayName = rock.nickname ?? getExclamation(rock.id);
  const rt = rock.rockType;

  return (
    <div className="shelf-card" data-rarity={rt.rarityScore}>
      {/* Rock color blob */}
      <div
        className="shelf-card__rock"
        style={{ background: rt.colorPrimary }}
        aria-hidden="true"
      />

      {/* Rock info */}
      <div className="shelf-card__info">
        <div className="shelf-card__display-name">
          {rock.nickname ? `"${displayName}"` : displayName}
        </div>
        <div className="shelf-card__type-name">{rt.name}</div>
        <div className="shelf-card__meta">
          {Math.round(rock.sizeMm)} mm · {rarityStars(rt.rarityScore)}
        </div>
        <div className="shelf-card__date">
          {new Date(rock.collectedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Delete controls */}
      <div className="shelf-card__actions">
        {!confirming ? (
          <button
            className="shelf-card__delete-btn"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${displayName}`}
            title="Remove from shelf"
          >
            ×
          </button>
        ) : (
          <div className="shelf-card__confirm">
            <span>Remove?</span>
            <button
              className="shelf-card__confirm-yes"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? '…' : 'Yes'}
            </button>
            <button
              className="shelf-card__confirm-no"
              onClick={() => setConfirming(false)}
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const TrophyShelf: React.FC<TrophyShelfProps> = ({ rocks, loading, onDelete, onClose }) => {
  return (
    <div className="shelf-view">
      {/* Header */}
      <div className="shelf-view__header">
        <h1 className="shelf-view__title">Trophy Shelf 🏆</h1>
        <p className="shelf-view__subtitle">
          {rocks.length === 0
            ? 'Nothing here yet — go find some rocks!'
            : `${rocks.length} rock${rocks.length !== 1 ? 's' : ''} collected`}
        </p>
        <button className="shelf-view__close" onClick={onClose} aria-label="Back to road">
          ← Back to the road
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="shelf-view__loading">Loading shelf…</div>
      ) : rocks.length === 0 ? (
        <div className="shelf-view__empty">
          <p>The shelf is bare. Rocks await you on the road.</p>
        </div>
      ) : (
        <>
          {/* Warm wooden shelf strips, one per row of rocks */}
          <div className="shelf-view__shelves">
            {rocks.map((rock) => (
              <ShelfRockCard key={rock.id} rock={rock} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TrophyShelf;
