/**
 * RoadScene — the main Konva canvas stage.
 *
 * Renders the full-viewport rocky road scene:
 *   - Background: sky gradient (top) → dirt road (bottom).
 *   - ~150 rock shapes, each a draggable RockShape component.
 *
 * Drag-to-basket logic:
 *   When a rock's drag ends, we compare its final stage-space position
 *   against a fixed basket zone in the lower-right corner.
 *   Stage coordinates === screen coordinates here because the Stage
 *   fills the full viewport with no offset.
 *
 *   If the rock lands inside the basket zone → onRockDropped(rock) fires.
 *   If not → the RockShape animates itself back to its origin.
 *
 * Hover/hold:
 *   Hover state and hold state are lifted to App so the tooltip (a DOM
 *   element) can be positioned independently of the canvas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import type { RoadRock } from '../../types';
import RockShape from './RockShape';

// The basket occupies the lower-right corner at these fixed dimensions (px).
// Must match the CSS in Basket.tsx.
const BASKET_SIZE = 140;
const BASKET_MARGIN = 20;

// How far down the viewport the sky-to-road gradient transition happens (0–1).
const HORIZON_RATIO = 0.32;

interface RoadSceneProps {
  rocks: RoadRock[];
  onRockDropped: (rock: RoadRock) => void;
  onHoverEnter: (rock: RoadRock, x: number, y: number) => void;
  onHoverLeave: () => void;
  onHoldStart: (rock: RoadRock) => void;
  onHoldEnd: () => void;
  /** True while the naming modal is open — disables drag so the user can type. */
  blocked: boolean;
}

const RoadScene: React.FC<RoadSceneProps> = ({
  rocks,
  onRockDropped,
  onHoverEnter,
  onHoverLeave,
  onHoldStart,
  onHoldEnd,
  blocked,
}) => {
  // Track viewport size so rocks reposition proportionally on resize.
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { width: W, height: H } = size;
  const horizonY = H * HORIZON_RATIO;

  /**
   * Called by each RockShape after a drag ends.
   * Returns true if the rock landed in the basket (was collected).
   * Returns false if the rock should animate back to its origin.
   */
  const handleRockDragEnd = useCallback(
    (rock: RoadRock, finalX: number, finalY: number): boolean => {
      // Compute basket bounds dynamically so resize doesn't stale them.
      const basketLeft = window.innerWidth - BASKET_MARGIN - BASKET_SIZE;
      const basketTop = window.innerHeight - BASKET_MARGIN - BASKET_SIZE;

      const inBasket =
        finalX >= basketLeft &&
        finalX <= window.innerWidth - BASKET_MARGIN &&
        finalY >= basketTop &&
        finalY <= window.innerHeight - BASKET_MARGIN;

      if (inBasket) {
        onRockDropped(rock);
        return true;
      }
      return false;
    },
    [onRockDropped],
  );

  return (
    <Stage width={W} height={H} style={{ position: 'fixed', top: 0, left: 0 }}>
      {/* ── Background layer — static, non-interactive ─────────────────── */}
      <Layer listening={false}>
        {/* Sky: soft blue gradient */}
        <Rect
          x={0}
          y={0}
          width={W}
          height={horizonY}
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: 0, y: horizonY }}
          fillLinearGradientColorStops={[0, '#7EC8E3', 0.6, '#B8D8EA', 1, '#D4C8A8']}
        />

        {/* Road/ground: warm tan, slightly darker at the very bottom */}
        <Rect
          x={0}
          y={horizonY}
          width={W}
          height={H - horizonY}
          fillLinearGradientStartPoint={{ x: 0, y: horizonY }}
          fillLinearGradientEndPoint={{ x: 0, y: H }}
          fillLinearGradientColorStops={[0, '#C8B48A', 0.5, '#B89E70', 1, '#A08058']}
        />

        {/* A subtle dirt-path band running down the center to suggest a road */}
        <Rect
          x={W * 0.1}
          y={horizonY}
          width={W * 0.8}
          height={H - horizonY}
          fillLinearGradientStartPoint={{ x: 0, y: horizonY }}
          fillLinearGradientEndPoint={{ x: 0, y: H }}
          fillLinearGradientColorStops={[0, '#D4BC90', 0.6, '#C0A878', 1, '#A89060']}
          opacity={0.6}
        />

        {/* Horizon line */}
        <Line
          points={[0, horizonY, W, horizonY]}
          stroke="#C0AA80"
          strokeWidth={2}
          opacity={0.4}
        />
      </Layer>

      {/* ── Rock layer — interactive ──────────────────────────────────────── */}
      <Layer>
        {rocks.map((rock) => {
          // Convert normalized 0-1 positions to pixel positions on the stage.
          // canvasX spans full width; canvasY spans the road area below the horizon.
          const absX = rock.canvasX * W;
          const absY = horizonY + rock.canvasY * (H - horizonY);

          return (
            <RockShape
              key={rock.id}
              rock={rock}
              x={absX}
              y={absY}
              onHoverEnter={blocked ? () => undefined : onHoverEnter}
              onHoverLeave={blocked ? () => undefined : onHoverLeave}
              onHoldStart={blocked ? () => undefined : onHoldStart}
              onHoldEnd={onHoldEnd}
              onDragStart={() => undefined}
              onDragEnd={blocked ? () => false : handleRockDragEnd}
            />
          );
        })}
      </Layer>
    </Stage>
  );
};

export default RoadScene;
