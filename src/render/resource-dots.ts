import { Color, vec, type ExcaliburGraphicsContext, type Vector } from "excalibur";
import { COLONY } from "../colony/constants";

export type ResourceKind = "pollen" | "nectar" | "honey";

const POLLEN_COLORS = ["#f4d03f", "#f5b041", "#f9e79f"] as const;
const NECTAR_COLOR = "#fbf3c2";
const HONEY_COLOR = "#e8a317";

/** Offset from bee center (right, slightly below) — matches job label placement. */
export const BEE_CARRY_OFFSET = vec(10, 5);

const CELL_DOT_SPREAD = 11;
const BEE_CARRY_SPREAD = 5;

/**
 * Stable slot positions for up to {@link COLONY.pollenCellCapacity} units in a tight cluster.
 */
export const layoutDots = (
  count: number,
  center: { x: number; y: number },
  spread: number,
): Vector[] => {
  const n = Math.max(0, Math.min(count, COLONY.pollenCellCapacity));
  if (n === 0) {
    return [];
  }
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const stepX = spread / Math.max(1, cols - 1);
  const stepY = spread / Math.max(1, rows - 1);
  const startX = center.x - (spread * (cols - 1)) / 2;
  const startY = center.y - (spread * (rows - 1)) / 2;
  const out: Vector[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push(vec(startX + col * stepX, startY + row * stepY));
  }
  return out;
};

export const layoutCellDots = (
  count: number,
  center: { x: number; y: number },
): Vector[] => layoutDots(count, center, CELL_DOT_SPREAD);

export const layoutBeeCarryDots = (
  count: number,
  beePos: Vector,
  beeRotation: number,
): Vector[] => {
  const anchor = beePos.add(BEE_CARRY_OFFSET);
  const cos = Math.cos(beeRotation);
  const sin = Math.sin(beeRotation);
  const local = layoutDots(count, { x: 0, y: 0 }, BEE_CARRY_SPREAD);
  return local.map((p) =>
    vec(anchor.x + p.x * cos - p.y * sin, anchor.y + p.x * sin + p.y * cos),
  );
};

const colorForKind = (kind: ResourceKind, index: number): Color => {
  if (kind === "pollen") {
    return Color.fromHex(POLLEN_COLORS[index % POLLEN_COLORS.length]!);
  }
  if (kind === "nectar") {
    return Color.fromHex(NECTAR_COLOR);
  }
  return Color.fromHex(HONEY_COLOR);
};

const rimForKind = (kind: ResourceKind): Color => {
  if (kind === "pollen") {
    return Color.fromRGB(212, 172, 13, 0.55);
  }
  if (kind === "nectar") {
    return Color.fromRGB(183, 149, 11, 0.45);
  }
  return Color.fromRGB(125, 86, 8, 0.55);
};

export const drawResourceDot = (
  ctx: ExcaliburGraphicsContext,
  pos: Vector,
  kind: ResourceKind,
  index: number,
): void => {
  const r = COLONY.resourceDotRadiusPx;
  const fill = colorForKind(kind, index);
  const rim = rimForKind(kind);
  ctx.drawCircle(pos, r, fill, rim, 0.6);
  const hl =
    kind === "pollen"
      ? Color.fromRGB(253, 235, 208, 0.65)
      : Color.fromRGB(255, 255, 255, 0.45);
  ctx.drawCircle(vec(pos.x - r * 0.25, pos.y - r * 0.25), r * 0.35, hl);
};

/** Smoothstep ease for flying dots. */
export const easeFlight = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
