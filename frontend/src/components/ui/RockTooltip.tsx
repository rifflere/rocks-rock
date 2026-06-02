/**
 * RockTooltip — hover and hold tooltip for rocks on the road.
 *
 * Two modes:
 *   "hover" (partial) — rock name, size, rarity stars. Appears immediately on hover.
 *   "hold"  (full)    — all collector data. Appears after holding a click for 300ms.
 *
 * Positioned absolutely near the mouse cursor using fixed CSS so it stays
 * anchored to the viewport regardless of any scrolling parent.
 *
 * Rarity stars: ★★★★★ scale where:
 *   1–2 = 1 star (common)   3–4 = 2 stars   5–6 = 3 stars   7–8 = 4 stars   9–10 = 5 stars
 */

import React from 'react';
import type { RoadRock } from '../../types';

interface RockTooltipProps {
  rock: RoadRock;
  mode: 'hover' | 'hold';
  /** Cursor X position in viewport pixels. */
  x: number;
  /** Cursor Y position in viewport pixels. */
  y: number;
}

/** Converts a 1–10 rarity score into a star string. */
function rarityStars(score: number): string {
  const stars = Math.ceil(score / 2); // 1–10 → 1–5
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/** Mohs hardness label. */
function hardnessLabel(min: number | null, max: number | null): string {
  if (min === null) return 'Unknown';
  if (min === max || max === null) return `${min}`;
  return `${min}–${max}`;
}

/** Rounds sizeMm to one decimal and shows appropriate unit. */
function sizeLabel(mm: number): string {
  if (mm >= 10) return `${Math.round(mm)} mm`;
  return `${mm.toFixed(1)} mm`;
}

const CATEGORY_LABELS: Record<string, string> = {
  igneous: 'Igneous',
  sedimentary: 'Sedimentary',
  metamorphic: 'Metamorphic',
  mineral: 'Mineral',
};

const RockTooltip: React.FC<RockTooltipProps> = ({ rock, mode, x, y }) => {
  const rt = rock.rockType;

  // Keep the tooltip on-screen: flip horizontally if too close to the right edge.
  const OFFSET = 14;
  const tooltipWidth = mode === 'hold' ? 260 : 180;
  const flipX = x + tooltipWidth + OFFSET > window.innerWidth;
  const left = flipX ? x - tooltipWidth - OFFSET : x + OFFSET;
  const top = Math.min(y, window.innerHeight - (mode === 'hold' ? 280 : 120));

  return (
    <div
      className="rock-tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        width: tooltipWidth,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* Rock color swatch + name */}
      <div className="rock-tooltip__header">
        <span
          className="rock-tooltip__swatch"
          style={{ background: rt.colorPrimary }}
        />
        <strong className="rock-tooltip__name">{rt.name}</strong>
        {mode === 'hover' && (
          <span className="rock-tooltip__size">{sizeLabel(rock.sizeMm)}</span>
        )}
      </div>

      {/* Partial hover info */}
      <div className="rock-tooltip__rarity">
        <span className="rock-tooltip__stars">{rarityStars(rt.rarityScore)}</span>
        <span className="rock-tooltip__label">
          {rt.rarityScore <= 2 ? 'Common' :
           rt.rarityScore <= 4 ? 'Uncommon' :
           rt.rarityScore <= 6 ? 'Rare' :
           rt.rarityScore <= 8 ? 'Very Rare' : 'Ultra Rare'}
        </span>
      </div>

      {/* Full hold info — collector-grade detail */}
      {mode === 'hold' && (
        <div className="rock-tooltip__details">
          <div className="rock-tooltip__detail-row">
            <span className="rock-tooltip__detail-key">Type</span>
            <span>{CATEGORY_LABELS[rt.category] ?? rt.category}</span>
          </div>
          <div className="rock-tooltip__detail-row">
            <span className="rock-tooltip__detail-key">Size</span>
            <span>{sizeLabel(rock.sizeMm)}</span>
          </div>
          <div className="rock-tooltip__detail-row">
            <span className="rock-tooltip__detail-key">Hardness</span>
            <span>
              {hardnessLabel(rt.hardnessMin, rt.hardnessMax)}
              {rt.hardnessMax !== null && ' (Mohs)'}
            </span>
          </div>
          {rt.luster && (
            <div className="rock-tooltip__detail-row">
              <span className="rock-tooltip__detail-key">Luster</span>
              <span className="rock-tooltip__capitalize">{rt.luster}</span>
            </div>
          )}
          {rt.texture && (
            <div className="rock-tooltip__detail-row">
              <span className="rock-tooltip__detail-key">Texture</span>
              <span className="rock-tooltip__capitalize">{rt.texture}</span>
            </div>
          )}
          <p className="rock-tooltip__description">{rt.description}</p>
          {rt.funFact && (
            <p className="rock-tooltip__fun-fact">💡 {rt.funFact}</p>
          )}
          <p className="rock-tooltip__hint">Drag to the basket to collect!</p>
        </div>
      )}

      {mode === 'hover' && (
        <p className="rock-tooltip__hint">Hold to inspect · Drag to collect</p>
      )}
    </div>
  );
};

export default RockTooltip;
