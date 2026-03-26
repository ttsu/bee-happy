import type { HexCoord } from "./hex-grid";

/** Hive cell identity: axial coords plus vertical level. */
export interface HiveCoord extends HexCoord {
  readonly level: number;
}

export const MIN_HIVE_LEVEL = -2;
export const MAX_HIVE_LEVEL = 2;

export const hiveKey = (h: HiveCoord): string => `${h.q},${h.r},${h.level}`;

export const parseHiveKey = (key: string): HiveCoord => {
  const [q, r, level] = key.split(",").map(Number);
  return { q, r, level };
};

export const isLevelInBounds = (level: number): boolean =>
  level >= MIN_HIVE_LEVEL && level <= MAX_HIVE_LEVEL;

/**
 * Vertical neighbor shares the same axial coordinate; used for cross-level comb.
 */
export const verticalNeighbor = (h: HiveCoord, delta: 1 | -1): HiveCoord | null => {
  const next = h.level + delta;
  if (!isLevelInBounds(next)) {
    return null;
  }
  return { q: h.q, r: h.r, level: next };
};
