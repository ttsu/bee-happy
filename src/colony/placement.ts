import { hexNeighbors } from "../grid/hex-grid";
import type { HiveCoord } from "../grid/hive-levels";
import {
  hiveKey,
  isLevelInBounds,
  parseHiveKey,
  verticalNeighbor,
} from "../grid/hive-levels";
import type { CellStateComponent } from "./ecs/components/colony-components";

export interface CellLookup {
  has(key: string): boolean;
  getBuilt(key: string): CellStateComponent | undefined;
}

/**
 * Returns whether the player may place a new foundation at `coord`.
 */
export const canPlaceFoundation = (coord: HiveCoord, cells: CellLookup): boolean => {
  const k = hiveKey(coord);
  if (cells.has(k)) {
    return false;
  }
  if (!isLevelInBounds(coord.level)) {
    return false;
  }
  for (const n of hexNeighbors(coord)) {
    const nk = hiveKey({ ...n, level: coord.level });
    const st = cells.getBuilt(nk);
    if (st?.built) {
      return true;
    }
  }
  const below = verticalNeighbor(coord, -1);
  if (below) {
    const bk = hiveKey(below);
    const st = cells.getBuilt(bk);
    if (st?.built) {
      return true;
    }
  }
  const above = verticalNeighbor(coord, 1);
  if (above) {
    const ak = hiveKey(above);
    const st = cells.getBuilt(ak);
    if (st?.built) {
      return true;
    }
  }
  return false;
};

/**
 * Returns empty axial positions on `level` where {@link canPlaceFoundation} is true.
 * Candidates are derived from hex and vertical neighbors of all built cells (any level).
 */
export const eligibleFoundationCoordsForLevel = (
  level: number,
  cells: CellLookup,
  builtCoords: readonly HiveCoord[],
): HiveCoord[] => {
  const candidateKeys = new Set<string>();
  for (const coord of builtCoords) {
    for (const n of hexNeighbors(coord)) {
      candidateKeys.add(hiveKey({ ...n, level: coord.level }));
    }
    const up = verticalNeighbor(coord, 1);
    if (up) {
      candidateKeys.add(hiveKey(up));
    }
    const down = verticalNeighbor(coord, -1);
    if (down) {
      candidateKeys.add(hiveKey(down));
    }
  }
  const out: HiveCoord[] = [];
  for (const key of candidateKeys) {
    const c = parseHiveKey(key);
    if (c.level !== level) {
      continue;
    }
    if (canPlaceFoundation(c, cells)) {
      out.push(c);
    }
  }
  return out;
};
