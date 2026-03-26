import { Vector, vec } from "excalibur";

/** Axial hex coordinate (pointy-top). */
export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/**
 * Returns the six neighboring axial coordinates.
 */
export const hexNeighbors = (h: HexCoord): HexCoord[] =>
  HEX_DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));

/**
 * Converts axial coordinates to world pixel position (center of hex), pointy-top layout.
 *
 * @param hexSize - Distance from center to vertex (approximate cell radius).
 */
export const hexToWorld = (h: HexCoord, hexSize: number): Vector => {
  const x = hexSize * Math.sqrt(3) * (h.q + h.r / 2);
  const y = hexSize * (3 / 2) * h.r;
  return vec(x, y);
};

/**
 * Nearest axial hex to a world position (pointy-top).
 */
export const worldToHex = (world: Vector, hexSize: number): HexCoord => {
  const q = ((Math.sqrt(3) / 3) * world.x - (1 / 3) * world.y) / hexSize;
  const r = ((2 / 3) * world.y) / hexSize;
  return axialRound(q, r);
};

const axialRound = (q: number, r: number): HexCoord => {
  let x = q;
  let z = r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  return { q: rx, r: rz };
};

export const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;

/**
 * Axial hex distance (steps between centers on the honeycomb).
 */
export const hexAxialDistance = (a: HexCoord, b: HexCoord): number =>
  (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
