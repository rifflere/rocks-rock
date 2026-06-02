/**
 * RockShape component.
 *
 * Renders a single rock on the Konva canvas as an organic, irregular polygon.
 * Each rock's shape is deterministically generated from its ID using a seeded
 * hash function, so the same rock always looks the same across renders.
 *
 * Visual design:
 *   - 10 perimeter points, each displaced ±35% radially from an ellipse.
 *   - Konva's `tension` prop smooths the polygon into organic curves.
 *   - A lighter highlight ellipse suggests 3D sheen (stronger for glassy/metallic luster).
 *   - Crystalline rocks get a subtle inner star sparkle.
 *   - Size scales linearly from sizeMm: pixelRadius = clamp(sizeMm * 0.7, 5, 75).
 *
 * Interaction:
 *   - onMouseEnter / onMouseLeave → hover tooltip (partial info)
 *   - onMouseDown + timer → hold for full-detail tooltip (300ms threshold)
 *   - draggable → drag to basket to collect
 *   - onDragEnd → parent checks if dropped on basket
 *   - onClick → jiggle animation via Konva Tween
 */

import React, { useRef, useCallback } from 'react';
import { Line, Ellipse, Group } from 'react-konva';
import type Konva from 'konva';
import type { RoadRock } from '../../types';

interface RockShapeProps {
  rock: RoadRock;
  /** Absolute pixel X on the canvas stage. */
  x: number;
  /** Absolute pixel Y on the canvas stage. */
  y: number;
  onHoverEnter: (rock: RoadRock, pointerX: number, pointerY: number) => void;
  onHoverLeave: () => void;
  onHoldStart: (rock: RoadRock) => void;
  onHoldEnd: () => void;
  onDragStart: (rock: RoadRock) => void;
  onDragEnd: (rock: RoadRock, finalX: number, finalY: number) => void;
}

// ─── Deterministic shape generation ──────────────────────────────────────────

/**
 * A simple string hash that produces consistent numbers from a rock ID.
 * Not cryptographic — just needs to be deterministic and well-distributed.
 * index is mixed in so we get different values for different points on
 * the same rock.
 */
function seededFloat(id: string, index: number): number {
  let h = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i) + index * 31;
    h = Math.imul(h, 16777619);
  }
  // Normalize to 0–1.
  return (h >>> 0) / 0xffffffff;
}

/** Number of polygon points on each rock outline. More = rounder. */
const NUM_POINTS = 10;

/**
 * Generates the flat array of [x, y, x, y, ...] points for a Konva Line
 * representing an organic rock silhouette.
 *
 * @param id       - Rock UUID (used as seed for reproducibility).
 * @param radiusX  - Horizontal "base" radius in pixels.
 * @param radiusY  - Vertical "base" radius in pixels.
 */
function generateRockPoints(id: string, radiusX: number, radiusY: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < NUM_POINTS; i++) {
    // Evenly space points around a full circle, then add random angular jitter.
    const baseAngle = (i / NUM_POINTS) * Math.PI * 2;
    const angleJitter = (seededFloat(id, i + 100) - 0.5) * 0.4; // ±0.2 rad
    const angle = baseAngle + angleJitter;

    // Radius variance: 0.65–1.35 of the base radius.
    const rv = 0.65 + seededFloat(id, i) * 0.70;

    points.push(Math.cos(angle) * radiusX * rv, Math.sin(angle) * radiusY * rv);
  }
  return points;
}

/**
 * Darken a CSS hex color by a given ratio (0 = black, 1 = same color).
 * Used for the rock's stroke/shadow color.
 */
function darkenHex(hex: string, ratio: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 0xff) * ratio);
  const g = Math.round(((n >> 8) & 0xff) * ratio);
  const b = Math.round((n & 0xff) * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RockShape: React.FC<RockShapeProps> = ({
  rock,
  x,
  y,
  onHoverEnter,
  onHoverLeave,
  onHoldStart,
  onHoldEnd,
  onDragStart,
  onDragEnd,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the rock's original position so we can animate it back if not dropped on basket.
  const originRef = useRef({ x, y });

  // Map sizeMm to canvas pixel radius (clamped to avoid tiny dots or huge blobs).
  const sizeMm = rock.sizeMm;
  const pixelRadius = Math.min(Math.max(sizeMm * 0.65, 5), 72);
  const radiusX = pixelRadius * (0.9 + seededFloat(rock.id, 200) * 0.3); // slight asymmetry
  const radiusY = pixelRadius * (0.75 + seededFloat(rock.id, 201) * 0.3);

  const points = generateRockPoints(rock.id, radiusX, radiusY);
  const strokeColor = darkenHex(rock.rockType.colorPrimary, 0.65);

  // Highlight ellipse position: slightly upper-left, as if lit from upper-left.
  const hlX = -radiusX * 0.25;
  const hlY = -radiusY * 0.25;
  const hlW = radiusX * 0.55;
  const hlH = radiusY * 0.45;

  // Glassy/metallic rocks get a brighter, more opaque highlight.
  const luster = rock.rockType.luster ?? 'dull';
  const highlightOpacity = luster === 'glassy' || luster === 'adamantine'
    ? 0.45
    : luster === 'metallic' || luster === 'pearly'
    ? 0.35
    : 0.18;

  // ── Jiggle animation ───────────────────────────────────────────────────────
  const jiggle = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    // Quick back-and-forth rotation tween using Konva's built-in animation.
    group.to({ rotation: 6, duration: 0.07, onFinish: () =>
      group.to({ rotation: -6, duration: 0.07, onFinish: () =>
        group.to({ rotation: 3, duration: 0.05, onFinish: () =>
          group.to({ rotation: 0, duration: 0.05 })
        })
      })
    });
  }, []);

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleMouseEnter = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    onHoverEnter(rock, pos?.x ?? 0, pos?.y ?? 0);
    // Change cursor to indicate draggability.
    if (stage) stage.container().style.cursor = 'grab';
  }, [rock, onHoverEnter]);

  const handleMouseLeave = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    onHoverLeave();
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
  }, [onHoverLeave]);

  const handleMouseDown = useCallback(() => {
    jiggle();
    // Start the hold timer — if user holds for 300ms, show full details.
    holdTimerRef.current = setTimeout(() => {
      onHoldStart(rock);
    }, 300);
  }, [jiggle, onHoldStart, rock]);

  const handleMouseUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    onHoldEnd();
  }, [onHoldEnd]);

  const handleDragStart = useCallback(() => {
    originRef.current = { x, y };
    onDragStart(rock);
    // Lift the rock visually (scale up slightly).
    groupRef.current?.to({ scaleX: 1.15, scaleY: 1.15, duration: 0.1 });
  }, [x, y, rock, onDragStart]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const finalX = e.target.x();
    const finalY = e.target.y();
    // Reset scale.
    groupRef.current?.to({ scaleX: 1, scaleY: 1, duration: 0.1 });
    onDragEnd(rock, finalX, finalY);
  }, [rock, onDragEnd]);

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      draggable
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Main rock body */}
      <Line
        points={points}
        closed
        tension={0.35}
        fill={rock.rockType.colorPrimary}
        stroke={strokeColor}
        strokeWidth={1.2}
      />

      {/* Highlight sheen — lighter ellipse toward upper-left */}
      <Ellipse
        x={hlX}
        y={hlY}
        radiusX={hlW}
        radiusY={hlH}
        fill="rgba(255,255,255,1)"
        opacity={highlightOpacity}
        listening={false}
      />

      {/* Crystalline sparkle: small bright dot for gem-grade rocks */}
      {rock.rockType.texture === 'crystalline' && (
        <Ellipse
          x={radiusX * 0.1}
          y={-radiusY * 0.35}
          radiusX={pixelRadius * 0.12}
          radiusY={pixelRadius * 0.08}
          fill="rgba(255,255,255,0.9)"
          listening={false}
        />
      )}
    </Group>
  );
};

export default React.memo(RockShape);
