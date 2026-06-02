/**
 * Basket — the wicker basket drop target in the lower-right corner.
 *
 * This is a pure CSS/DOM element overlaid on top of the Konva canvas.
 * It does NOT handle drag events itself — the canvas detects when a rock
 * is dropped within the basket's screen region (see RoadScene.tsx).
 *
 * Props:
 *   highlighted — true while a rock is being dragged (glows to invite a drop)
 *   rockCount   — how many rocks are waiting in the basket (always 0 here since
 *                 the naming modal fires immediately on drop, but kept for UX)
 */

import React from 'react';

interface BasketProps {
  highlighted: boolean;
}

const Basket: React.FC<BasketProps> = ({ highlighted }) => {
  return (
    <div className={`basket ${highlighted ? 'basket--highlighted' : ''}`} aria-label="Drop rocks here">
      {/* Wicker basket drawn with CSS + text emoji for MVP. Replace with SVG later. */}
      <div className="basket__icon">🧺</div>
      <div className="basket__label">Drop here</div>
    </div>
  );
};

export default Basket;
