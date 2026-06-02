/**
 * NameRockModal — appears after a rock is dropped into the basket.
 *
 * The user can optionally give their rock a nickname (up to 40 characters).
 * They can also skip naming entirely — the rock gets a randomly generated
 * happy exclamation on the trophy shelf instead.
 *
 * The nickname input is:
 *   - Limited to 40 characters client-side (belt-and-suspenders; server also checks)
 *   - Submitted to the server for profanity filtering
 *   - If the server rejects it, the user sees an inline error and can try again
 *
 * The modal shows a mini rock preview (color swatch + key stats) so the
 * user remembers what they just found.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { RoadRock } from '../../types';

interface NameRockModalProps {
  rock: RoadRock;
  onConfirm: (nickname: string | undefined) => Promise<void>;
  onCancel: () => void;
}

function rarityLabel(score: number): string {
  if (score <= 2) return 'Common';
  if (score <= 4) return 'Uncommon';
  if (score <= 6) return 'Rare';
  if (score <= 8) return 'Very Rare';
  return 'Ultra Rare ✨';
}

const MAX_NICKNAME_LENGTH = 40;

const NameRockModal: React.FC<NameRockModalProps> = ({ rock, onConfirm, onCancel }) => {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the modal opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass undefined if nickname is blank — the server treats null as "no nickname."
      await onConfirm(nickname.trim() || undefined);
    } catch (e) {
      // Show server-side profanity or validation errors inline.
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
    // On success, the parent closes the modal, so we don't reset loading.
  }, [nickname, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') void handleConfirm();
      if (e.key === 'Escape') onCancel();
    },
    [handleConfirm, onCancel],
  );

  const rt = rock.rockType;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onCancel} />

      <div className="name-modal" role="dialog" aria-modal="true" aria-label="Name your rock">
        {/* Rock preview */}
        <div className="name-modal__preview">
          <div
            className="name-modal__swatch"
            style={{ background: rt.colorPrimary }}
            aria-hidden="true"
          />
          <div className="name-modal__rock-info">
            <div className="name-modal__rock-name">{rt.name}</div>
            <div className="name-modal__rock-meta">
              {Math.round(rock.sizeMm)} mm · {rarityLabel(rt.rarityScore)}
            </div>
          </div>
        </div>

        <h2 className="name-modal__title">You found a rock! 🪨</h2>
        <p className="name-modal__subtitle">
          Give it a name, or skip — it'll get a name of its own.
        </p>

        {/* Nickname input */}
        <div className="name-modal__field">
          <input
            ref={inputRef}
            type="text"
            className="name-modal__input"
            placeholder="e.g. Sparkles, The Grey Philosopher…"
            value={nickname}
            maxLength={MAX_NICKNAME_LENGTH}
            onChange={(e) => {
              setNickname(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            aria-label="Rock nickname"
          />
          <div className="name-modal__char-count">
            {nickname.length}/{MAX_NICKNAME_LENGTH}
          </div>
        </div>

        {/* Inline error from server (e.g. profanity rejection) */}
        {error && <p className="name-modal__error" role="alert">{error}</p>}

        {/* Action buttons */}
        <div className="name-modal__actions">
          <button
            className="name-modal__btn name-modal__btn--skip"
            onClick={() => void onConfirm(undefined)}
            disabled={loading}
          >
            Skip name
          </button>
          <button
            className="name-modal__btn name-modal__btn--confirm"
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? 'Saving…' : nickname.trim() ? 'Name it! 🏷️' : 'Add to shelf'}
          </button>
        </div>
      </div>
    </>
  );
};

export default NameRockModal;
