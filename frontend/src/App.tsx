/**
 * App — root component and main state machine.
 *
 * Manages:
 *   - Which view is active ('road' | 'shelf' | 'journal')
 *   - Hover state (partial tooltip shown while hovering a rock)
 *   - Hold state (full-detail tooltip shown while clicking+holding a rock)
 *   - Naming modal state (opens when a rock is dropped in the basket)
 *   - Whether any rock is currently being dragged (highlights the basket)
 *
 * Data fetching is delegated to useRoadRocks and useShelf hooks.
 * The canvas (RoadScene) and DOM overlays (tooltip, modal, basket) are siblings
 * in the React tree — the canvas is fixed behind everything else.
 */

import React, { useState, useCallback } from 'react';
import RoadScene from './components/canvas/RoadScene';
import RockTooltip from './components/ui/RockTooltip';
import Basket from './components/ui/Basket';
import NameRockModal from './components/ui/NameRockModal';
import TrophyShelf from './components/ui/TrophyShelf';
import Journal from './components/ui/Journal';
import { useRoadRocks } from './hooks/useRoadRocks';
import { useShelf } from './hooks/useShelf';
import type { RoadRock, AppView } from './types';

const App: React.FC = () => {
  // ── View routing ────────────────────────────────────────────────────────────
  const [view, setView] = useState<AppView>('road');

  // ── Road rock data ─────────────────────────────────────────────────────────
  const { rocks, loading: rocksLoading, error: rocksError, collectRock } = useRoadRocks();

  // ── Shelf + journal data ────────────────────────────────────────────────────
  const {
    shelfRocks,
    journalEntries,
    shelfLoading,
    journalLoading,
    addRock,
    deleteShelfRock,
    deleteJournalEntry,
  } = useShelf();

  // ── Hover tooltip state ─────────────────────────────────────────────────────
  const [hoveredRock, setHoveredRock] = useState<RoadRock | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // ── Hold (full-detail) tooltip state ───────────────────────────────────────
  const [heldRock, setHeldRock] = useState<RoadRock | null>(null);

  // ── Naming modal state ──────────────────────────────────────────────────────
  // Set to the rock being named; null when modal is closed.
  const [namingRock, setNamingRock] = useState<RoadRock | null>(null);

  // ── Drag highlight state ────────────────────────────────────────────────────
  // True while any rock is being dragged — makes the basket glow.
  const [isDragging, setIsDragging] = useState(false);

  // ── Hover handlers ──────────────────────────────────────────────────────────
  const handleHoverEnter = useCallback((rock: RoadRock, x: number, y: number) => {
    setHoveredRock(rock);
    setHoverPos({ x, y });
  }, []);

  const handleHoverLeave = useCallback(() => {
    setHoveredRock(null);
  }, []);

  // ── Hold handlers ───────────────────────────────────────────────────────────
  const handleHoldStart = useCallback((rock: RoadRock) => {
    setHeldRock(rock);
    setHoveredRock(null); // upgrade from partial to full tooltip
  }, []);

  const handleHoldEnd = useCallback(() => {
    setHeldRock(null);
  }, []);

  // ── Drag handlers ───────────────────────────────────────────────────────────
  // Called by RoadScene when a rock lands in the basket zone.
  const handleRockDropped = useCallback(async (rock: RoadRock) => {
    setIsDragging(false);
    setHoveredRock(null);
    setHeldRock(null);
    // Immediately remove the rock from the road (optimistic).
    await collectRock(rock.id);
    // Open the naming modal.
    setNamingRock(rock);
  }, [collectRock]);

  // ── Naming modal handlers ───────────────────────────────────────────────────
  const handleNameConfirm = useCallback(async (nickname: string | undefined) => {
    if (!namingRock) return;
    await addRock(
      namingRock.id,
      namingRock.typeId,
      namingRock.sizeMm,
      nickname,
    );
    setNamingRock(null);
  }, [namingRock, addRock]);

  const handleNameCancel = useCallback(() => {
    // The rock was already removed from the road (optimistically collected).
    // We still shelve it without a name so it isn't lost.
    // This is a simplification for MVP — in v2, cancelling should return the rock.
    if (!namingRock) return;
    void addRock(namingRock.id, namingRock.typeId, namingRock.sizeMm, undefined);
    setNamingRock(null);
  }, [namingRock, addRock]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const isModalOpen = namingRock !== null;

  return (
    <div className="app">
      {/* ── Canvas layer (always rendered behind everything) ─────────────── */}
      <RoadScene
        rocks={rocks}
        onRockDropped={(rock) => void handleRockDropped(rock)}
        onHoverEnter={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        onHoldStart={handleHoldStart}
        onHoldEnd={handleHoldEnd}
        blocked={isModalOpen || view !== 'road'}
      />

      {/* ── HUD: fixed overlay elements ─────────────────────────────────── */}

      {/* Title — upper left, gently bobbing */}
      <h1 className="app-title" onClick={() => setView('road')}>
        Rocks Rock
      </h1>

      {/* Nav icons — upper right */}
      <nav className="app-nav" aria-label="Main navigation">
        <button
          className={`app-nav__btn ${view === 'journal' ? 'app-nav__btn--active' : ''}`}
          onClick={() => setView(v => v === 'journal' ? 'road' : 'journal')}
          aria-label="Open journal"
          title="Journal"
        >
          📖
        </button>
        <button
          className={`app-nav__btn ${view === 'shelf' ? 'app-nav__btn--active' : ''}`}
          onClick={() => setView(v => v === 'shelf' ? 'road' : 'shelf')}
          aria-label="Open trophy shelf"
          title="Trophy Shelf"
        >
          🏆
        </button>
      </nav>

      {/* Basket — lower right, always visible on road view */}
      {view === 'road' && (
        <Basket highlighted={isDragging} />
      )}

      {/* ── Hover tooltip ───────────────────────────────────────────────── */}
      {hoveredRock && !isModalOpen && view === 'road' && (
        <RockTooltip
          rock={hoveredRock}
          mode="hover"
          x={hoverPos.x}
          y={hoverPos.y}
        />
      )}

      {/* ── Hold (full-detail) tooltip ──────────────────────────────────── */}
      {heldRock && !isModalOpen && view === 'road' && (
        <RockTooltip
          rock={heldRock}
          mode="hold"
          x={hoverPos.x}
          y={hoverPos.y}
        />
      )}

      {/* ── Naming modal ─────────────────────────────────────────────────── */}
      {namingRock && (
        <NameRockModal
          rock={namingRock}
          onConfirm={handleNameConfirm}
          onCancel={handleNameCancel}
        />
      )}

      {/* ── Trophy shelf view ────────────────────────────────────────────── */}
      {view === 'shelf' && (
        <div className="view-overlay">
          <TrophyShelf
            rocks={shelfRocks}
            loading={shelfLoading}
            onDelete={deleteShelfRock}
            onClose={() => setView('road')}
          />
        </div>
      )}

      {/* ── Journal view (overlaid on road, road visible behind) ─────────── */}
      {view === 'journal' && (
        <Journal
          entries={journalEntries}
          loading={journalLoading}
          onDeleteEntry={deleteJournalEntry}
          onClose={() => setView('road')}
        />
      )}

      {/* ── Road loading / error states ──────────────────────────────────── */}
      {rocksLoading && view === 'road' && (
        <div className="road-status">Loading rocks…</div>
      )}
      {rocksError && view === 'road' && (
        <div className="road-status road-status--error">
          Couldn't load rocks: {rocksError}
        </div>
      )}
    </div>
  );
};

export default App;
