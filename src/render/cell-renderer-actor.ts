import {
  BaseAlign,
  Color,
  Font,
  TextAlign,
  type ExcaliburGraphicsContext,
  vec,
} from "excalibur";
import type { ColonyRuntime } from "../colony/colony-runtime";
import {
  CellCoordComponent,
  CellStateComponent,
} from "../colony/ecs/components/colony-components";
import { COLONY } from "../colony/constants";
import { eligibleFoundationCoordsForLevel } from "../colony/placement";
import { hiveKey, parseHiveKey, type HiveCoord } from "../grid/hive-levels";
import { HEX_DIRECTIONS, hexToWorld } from "../grid/hex-grid";

const hexCorners = (cx: number, cy: number, r: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
};

/** Ring radius as a fraction of hex size (outside the inner cell disc). */
const BUILD_RING_RADIUS_FACTOR = 0.68;
const BUILD_RING_SEGMENTS = 48;

/**
 * Draws a track ring and a progress arc (0–1) for foundation cells under construction.
 */
const drawBuildProgressRing = (
  ctx: ExcaliburGraphicsContext,
  center: { x: number; y: number },
  radius: number,
  progress: number,
): void => {
  const p = Math.min(1, Math.max(0, progress));
  const start = -Math.PI / 2;
  const track = Color.fromHex("#34495e");
  const fill = Color.fromHex("#f1c40f");
  const trackW = 2;
  const progW = 3.5;
  for (let i = 0; i < BUILD_RING_SEGMENTS; i++) {
    const a0 = start + (i / BUILD_RING_SEGMENTS) * Math.PI * 2;
    const a1 = start + ((i + 1) / BUILD_RING_SEGMENTS) * Math.PI * 2;
    ctx.drawLine(
      vec(center.x + radius * Math.cos(a0), center.y + radius * Math.sin(a0)),
      vec(center.x + radius * Math.cos(a1), center.y + radius * Math.sin(a1)),
      track,
      trackW,
    );
  }
  if (p <= 0) {
    return;
  }
  const progSegs = Math.max(2, Math.ceil(BUILD_RING_SEGMENTS * p));
  const sweep = p * Math.PI * 2;
  for (let i = 0; i < progSegs; i++) {
    const a0 = start + (i / progSegs) * sweep;
    const a1 = start + ((i + 1) / progSegs) * sweep;
    ctx.drawLine(
      vec(center.x + radius * Math.cos(a0), center.y + radius * Math.sin(a0)),
      vec(center.x + radius * Math.cos(a1), center.y + radius * Math.sin(a1)),
      fill,
      progW,
    );
  }
};

/**
 * Progress ring for brood egg (time to hatch) and larvae (feeding toward sealing).
 * Uses distinct palettes from the foundation build ring.
 */
const drawBroodGrowthRing = (
  ctx: ExcaliburGraphicsContext,
  center: { x: number; y: number },
  radius: number,
  progress: number,
  variant: "egg" | "larvae",
): void => {
  const p = Math.min(1, Math.max(0, progress));
  const track = Color.fromHex(variant === "egg" ? "#d5d8dc" : "#b7950b");
  const fill = Color.fromHex(variant === "egg" ? "#e8daef" : "#f39c12");
  const trackW = 2;
  const progW = 3.5;
  const start = -Math.PI / 2;
  const segs = BUILD_RING_SEGMENTS;
  for (let i = 0; i < segs; i++) {
    const a0 = start + (i / segs) * Math.PI * 2;
    const a1 = start + ((i + 1) / segs) * Math.PI * 2;
    ctx.drawLine(
      vec(center.x + radius * Math.cos(a0), center.y + radius * Math.sin(a0)),
      vec(center.x + radius * Math.cos(a1), center.y + radius * Math.sin(a1)),
      track,
      trackW,
    );
  }
  if (p <= 0) {
    return;
  }
  const progSegs = Math.max(2, Math.ceil(segs * p));
  const sweep = p * Math.PI * 2;
  for (let i = 0; i < progSegs; i++) {
    const a0 = start + (i / progSegs) * sweep;
    const a1 = start + ((i + 1) / progSegs) * sweep;
    ctx.drawLine(
      vec(center.x + radius * Math.cos(a0), center.y + radius * Math.sin(a0)),
      vec(center.x + radius * Math.cos(a1), center.y + radius * Math.sin(a1)),
      fill,
      progW,
    );
  }
};

/** 0–1: elapsed fraction of egg incubation (hatch when 1). */
const eggGrowthProgress = (st: InstanceType<typeof CellStateComponent>): number => {
  if (st.stage !== "egg") {
    return 0;
  }
  const total = COLONY.eggDurationMs;
  if (total <= 0) {
    return 0;
  }
  return 1 - Math.min(1, Math.max(0, st.eggTimerMs) / total);
};

/** 0–1: food delivered toward sealing (full when 1). */
const larvaeFeedingProgress = (st: InstanceType<typeof CellStateComponent>): number => {
  if (st.stage !== "larvae") {
    return 0;
  }
  const pollenTotal = COLONY.larvaePollenUnitsNeeded;
  const nectarTotal = COLONY.larvaeNectarUnitsNeeded;
  const total = pollenTotal + nectarTotal;
  if (total <= 0) {
    return 0;
  }
  const delivered =
    pollenTotal - st.larvaePollenRemaining + (nectarTotal - st.larvaeNectarRemaining);
  return Math.min(1, Math.max(0, delivered / total));
};

/** Thin outline when the pointer is over a hive hex (not selected). */
const HOVER_HEX_OUTLINE = Color.fromRGB(255, 255, 255, 0.72);
const HOVER_HEX_STROKE_PX = 1.75;
/** Slightly stronger outline for the cell awaiting type selection. */
const SELECTED_HEX_OUTLINE = Color.fromHex("#f1c40f");
const SELECTED_HEX_STROKE_PX = 2.25;
/** Queued cell type change (brood deferred or storage being emptied). */
const PENDING_RETYPE_OUTLINE = Color.fromHex("#e67e22");
const PENDING_RETYPE_STROKE_PX = 2;

/** Subtle stroke for empty hexes where a foundation may be placed. */
const ELIGIBLE_BUILD_OUTLINE = Color.fromRGB(130, 145, 160, 0.45);
const ELIGIBLE_BUILD_STROKE_PX = 1.25;

/** Centered labels for storage cells (pollen count, nectar + honey processing). */
const cellStockFont = new Font({
  size: 8,
  family: "sans-serif",
  color: Color.fromHex("#1e293b"),
  smoothing: true,
  textAlign: TextAlign.Center,
  baseAlign: BaseAlign.Middle,
  shadow: {
    blur: 0,
    offset: vec(0.5, 0.5),
    color: Color.fromRGB(255, 255, 255, 0.5),
  },
});

const CELL_STOCK_LINE_PX = 9;

const HONEY_LABEL_EPS = 1e-6;
const BUILT_EXTERIOR_OUTLINE = Color.fromHex("#d4a12a");
const BUILT_EXTERIOR_STROKE_PX = 4;
const BUILT_EXTERIOR_JOIN_OVERLAP_PX = 2;
const DIRECTION_TO_EDGE_INDEX: readonly number[] = [5, 4, 3, 2, 1, 0];

/** Slightly extends thick edge strokes so corners overlap without seams. */
const drawOverlappedEdge = (
  ctx: ExcaliburGraphicsContext,
  a: [number, number],
  b: [number, number],
  color: Color,
  strokePx: number,
): void => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len <= 1e-6) {
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  const extend = BUILT_EXTERIOR_JOIN_OVERLAP_PX;
  ctx.drawLine(
    vec(a[0] - ux * extend, a[1] - uy * extend),
    vec(b[0] + ux * extend, b[1] + uy * extend),
    color,
    strokePx,
  );
};

/**
 * Draws pollen in pollen cells; nectar or per-cell honey in nectar cells (mutually exclusive with nectar).
 */
const drawCellStorageLabels = (
  ctx: ExcaliburGraphicsContext,
  center: { x: number; y: number },
  st: InstanceType<typeof CellStateComponent>,
): void => {
  if (!st.built) {
    return;
  }
  if (st.cellType === "pollen") {
    const text = `P ${Math.round(st.pollenStored)}/${COLONY.pollenCellCapacity}`;
    ctx.save();
    ctx.translate(center.x, center.y);
    cellStockFont.render(ctx, text, cellStockFont.color, 0, 0);
    ctx.restore();
    return;
  }
  if (st.cellType === "nectar") {
    const lines: string[] = [];
    if (st.honeyStored > HONEY_LABEL_EPS) {
      lines.push(`H ${Math.round(st.honeyStored)}/${COLONY.honeyCellCapacity}`);
    } else {
      lines.push(`N ${Math.round(st.nectarStored)}/${COLONY.nectarCellCapacity}`);
    }
    if (st.honeyProcessingProgress > 0) {
      lines.push(`→ ${Math.round(st.honeyProcessingProgress * 100)}%`);
    }
    ctx.save();
    ctx.translate(center.x, center.y);
    const offsetY = lines.length === 1 ? 0 : -(CELL_STOCK_LINE_PX / 2);
    for (let i = 0; i < lines.length; i++) {
      cellStockFont.render(
        ctx,
        lines[i]!,
        cellStockFont.color,
        0,
        offsetY + i * CELL_STOCK_LINE_PX,
      );
    }
    ctx.restore();
  }
};

const drawHexRing = (
  ctx: ExcaliburGraphicsContext,
  corners: [number, number][],
  color: Color,
  strokePx: number,
): void => {
  for (let i = 0; i < 6; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 6]!;
    ctx.drawLine(vec(a[0], a[1]), vec(b[0], b[1]), color, strokePx);
  }
};

const colorForCell = (st: InstanceType<typeof CellStateComponent>): Color => {
  if (!st.built) {
    return Color.fromHex("#7f8c8d");
  }
  if (st.stage === "foundation") {
    return Color.fromHex("#95a5a6");
  }
  switch (st.cellType) {
    case "brood":
      if (st.stage === "egg") {
        return Color.fromHex("#fdebd0");
      }
      if (st.stage === "larvae") {
        return Color.fromHex("#f8c471");
      }
      if (st.stage === "sealed") {
        return Color.fromHex("#d7bde2");
      }
      if (st.stage === "cleaning") {
        return Color.fromHex("#aed6f1");
      }
      return Color.fromHex("#fadbd8");
    case "pollen":
      return Color.fromHex("#f7dc6f");
    case "nectar":
      return Color.fromHex("#82e0aa");
    default:
      return Color.fromHex("#ecf0f1");
  }
};

/**
 * Draws hive cells for the active level (called from {@link Scene.onPostDraw}).
 */
export const drawHiveCells = (
  ctx: ExcaliburGraphicsContext,
  colony: ColonyRuntime,
): void => {
  const lvl = colony.activeLevel;
  const S = COLONY.hexSize;

  const lookup = {
    has: (k: string) => colony.cellsByKey.has(k),
    getBuilt: (k: string) => colony.cellsByKey.get(k)?.get(CellStateComponent),
  };
  const builtCoords: HiveCoord[] = [];
  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    const st = ent.get(CellStateComponent)!;
    if (st.built) {
      builtCoords.push({ q: c.q, r: c.r, level: c.level });
    }
  }
  const eligibleForLevel = eligibleFoundationCoordsForLevel(lvl, lookup, builtCoords);
  for (const coord of eligibleForLevel) {
    const w = hexToWorld({ q: coord.q, r: coord.r }, S);
    const corners = hexCorners(w.x, w.y, S * 0.92);
    for (let i = 0; i < 6; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 6]!;
      ctx.drawLine(
        vec(a[0], a[1]),
        vec(b[0], b[1]),
        ELIGIBLE_BUILD_OUTLINE,
        ELIGIBLE_BUILD_STROKE_PX,
      );
    }
  }
  const builtCellKeys = new Set(
    builtCoords.filter((coord) => coord.level === lvl).map((coord) => hiveKey(coord)),
  );

  const eligibleKeys = new Set(eligibleForLevel.map((c) => hiveKey(c)));

  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    if (c.level !== lvl) {
      continue;
    }
    const st = ent.get(CellStateComponent)!;
    const w = hexToWorld({ q: c.q, r: c.r }, S);
    const corners = hexCorners(w.x, w.y, S * 0.92);
    const stroke = Color.fromHex("#555555");
    for (let i = 0; i < 6; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 6]!;
      ctx.drawLine(vec(a[0], a[1]), vec(b[0], b[1]), stroke, 1.5);
    }
    if (st.built) {
      for (let i = 0; i < HEX_DIRECTIONS.length; i++) {
        const dir = HEX_DIRECTIONS[i]!;
        const neighborKey = hiveKey({ q: c.q + dir.q, r: c.r + dir.r, level: c.level });
        if (builtCellKeys.has(neighborKey)) {
          continue;
        }
        const edgeIndex = DIRECTION_TO_EDGE_INDEX[i]!;
        const a = corners[edgeIndex]!;
        const b = corners[(edgeIndex + 1) % 6]!;
        drawOverlappedEdge(ctx, a, b, BUILT_EXTERIOR_OUTLINE, BUILT_EXTERIOR_STROKE_PX);
      }
    }
    const fill = colorForCell(st);
    ctx.drawCircle(w, S * 0.55, fill, Color.fromHex("#2c3e50"), 1);
    if (st.built && (st.cellType === "pollen" || st.cellType === "nectar")) {
      drawCellStorageLabels(ctx, w, st);
    }
    if (!st.built) {
      drawBuildProgressRing(ctx, w, S * BUILD_RING_RADIUS_FACTOR, st.buildProgress);
    } else if (st.cellType === "brood") {
      const ringR = S * BUILD_RING_RADIUS_FACTOR;
      if (st.stage === "egg") {
        drawBroodGrowthRing(ctx, w, ringR, eggGrowthProgress(st), "egg");
      } else if (st.stage === "larvae") {
        drawBroodGrowthRing(ctx, w, ringR, larvaeFeedingProgress(st), "larvae");
      }
    }
    if (st.pendingCellType) {
      drawHexRing(ctx, corners, PENDING_RETYPE_OUTLINE, PENDING_RETYPE_STROKE_PX);
    }
  }

  const highlightKeys = new Set<string>();
  if (colony.pendingCellTypeKey) {
    highlightKeys.add(colony.pendingCellTypeKey);
  }
  if (colony.hoverHiveKey) {
    highlightKeys.add(colony.hoverHiveKey);
  }
  for (const key of highlightKeys) {
    const coord = parseHiveKey(key);
    if (coord.level !== lvl) {
      continue;
    }
    if (!colony.cellsByKey.has(key) && !eligibleKeys.has(key)) {
      continue;
    }
    const w = hexToWorld({ q: coord.q, r: coord.r }, S);
    const corners = hexCorners(w.x, w.y, S * 0.92);
    const isSelected = colony.pendingCellTypeKey === key;
    if (isSelected) {
      drawHexRing(ctx, corners, SELECTED_HEX_OUTLINE, SELECTED_HEX_STROKE_PX);
    } else {
      drawHexRing(ctx, corners, HOVER_HEX_OUTLINE, HOVER_HEX_STROKE_PX);
    }
  }
};
