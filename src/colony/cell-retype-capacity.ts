import { COLONY } from "./constants";
import {
  CellCoordComponent,
  CellStateComponent,
} from "./ecs/components/colony-components";
import { nectarCellCanAcceptNectarDeposit } from "./nectar-cell-helpers";
import type { ColonyRuntime } from "./colony-runtime";

/**
 * True when this cell must not receive pollen deposits while contents are being cleared for a type change.
 */
export const cellBlocksPollenDepositDueToRetype = (
  _cellKey: string,
  st: CellStateComponent,
): boolean =>
  st.cellType === "pollen" &&
  st.pendingCellType != null &&
  st.pollenStored > 0;

/**
 * True when this cell must not receive nectar deposits while contents are being cleared for a type change.
 */
export const cellBlocksNectarDepositDueToRetype = (
  _cellKey: string,
  st: CellStateComponent,
): boolean =>
  st.cellType === "nectar" &&
  st.pendingCellType != null &&
  (st.nectarStored > 0 || st.honeyStored > 0);

const sparePollenCapacityOnCell = (st: CellStateComponent): number => {
  if (!st.built || st.cellType !== "pollen") {
    return 0;
  }
  return Math.max(0, COLONY.pollenCellCapacity - st.pollenStored);
};

const spareNectarCapacityOnCell = (st: CellStateComponent): number => {
  if (!st.built || st.cellType !== "nectar" || !nectarCellCanAcceptNectarDeposit(st)) {
    return 0;
  }
  return Math.max(0, COLONY.nectarCellCapacity - st.nectarStored);
};

const spareHoneyCapacityOnCell = (st: CellStateComponent): number => {
  if (!st.built || st.cellType !== "nectar") {
    return 0;
  }
  return Math.max(0, COLONY.honeyCellCapacity - st.honeyStored);
};

/**
 * Whether pollen, nectar, and honey stored in the source can fit into other cells on the same level (excluding the source).
 */
export const canRelocateCellContentsForRetype = (
  colony: ColonyRuntime,
  sourceKey: string,
  level: number,
  st: CellStateComponent,
): boolean => {
  let pollenSpare = 0;
  let nectarSpare = 0;
  let honeySpare = 0;
  for (const [k, e] of colony.cellsByKey) {
    if (k === sourceKey) {
      continue;
    }
    const c = e.get(CellCoordComponent)!;
    if (c.level !== level) {
      continue;
    }
    const o = e.get(CellStateComponent)!;
    pollenSpare += sparePollenCapacityOnCell(o);
    nectarSpare += spareNectarCapacityOnCell(o);
    honeySpare += spareHoneyCapacityOnCell(o);
  }
  if (st.cellType === "pollen" && st.pollenStored > 0) {
    if (pollenSpare < st.pollenStored) {
      return false;
    }
  }
  if (st.cellType === "nectar") {
    if (st.nectarStored > 0 && nectarSpare < st.nectarStored) {
      return false;
    }
    if (st.honeyStored > 0 && honeySpare < st.honeyStored) {
      return false;
    }
  }
  return true;
};

/**
 * Moves up to `maxUnits` pollen from the source cell to other pollen cells on the same level (greedy).
 *
 * @returns Units actually moved.
 */
export const relocatePollenChunkFromCell = (
  colony: ColonyRuntime,
  sourceKey: string,
  level: number,
  maxUnits: number,
): number => {
  const srcEnt = colony.getCellAt(sourceKey);
  if (!srcEnt) {
    return 0;
  }
  const srcSt = srcEnt.get(CellStateComponent)!;
  if (srcSt.pollenStored <= 0) {
    return 0;
  }
  let moved = 0;
  let remaining = Math.min(maxUnits, srcSt.pollenStored);
  const candidates: { key: string; spare: number }[] = [];
  for (const [k, e] of colony.cellsByKey) {
    if (k === sourceKey) {
      continue;
    }
    const c = e.get(CellCoordComponent)!;
    if (c.level !== level) {
      continue;
    }
    const st = e.get(CellStateComponent)!;
    const spare = sparePollenCapacityOnCell(st);
    if (spare > 0) {
      candidates.push({ key: k, spare });
    }
  }
  candidates.sort((a, b) => b.spare - a.spare);
  for (const { key, spare } of candidates) {
    if (remaining <= 0) {
      break;
    }
    const dest = colony.getCellAt(key)?.get(CellStateComponent)!;
    const take = Math.min(remaining, spare, srcSt.pollenStored);
    if (take <= 0) {
      continue;
    }
    dest.pollenStored += take;
    srcSt.pollenStored -= take;
    moved += take;
    remaining -= take;
  }
  return moved;
};

/**
 * Moves up to `maxUnits` nectar from the source to other nectar cells on the same level.
 */
export const relocateNectarChunkFromCell = (
  colony: ColonyRuntime,
  sourceKey: string,
  level: number,
  maxUnits: number,
): number => {
  const srcEnt = colony.getCellAt(sourceKey);
  if (!srcEnt) {
    return 0;
  }
  const srcSt = srcEnt.get(CellStateComponent)!;
  if (srcSt.nectarStored <= 0) {
    return 0;
  }
  let moved = 0;
  let remaining = Math.min(maxUnits, srcSt.nectarStored);
  const candidates: { key: string; spare: number }[] = [];
  for (const [k, e] of colony.cellsByKey) {
    if (k === sourceKey) {
      continue;
    }
    const c = e.get(CellCoordComponent)!;
    if (c.level !== level) {
      continue;
    }
    const st = e.get(CellStateComponent)!;
    const spare = spareNectarCapacityOnCell(st);
    if (spare > 0) {
      candidates.push({ key: k, spare });
    }
  }
  candidates.sort((a, b) => b.spare - a.spare);
  for (const { key, spare } of candidates) {
    if (remaining <= 0) {
      break;
    }
    const dest = colony.getCellAt(key)?.get(CellStateComponent)!;
    const take = Math.min(remaining, spare, srcSt.nectarStored);
    if (take <= 0) {
      continue;
    }
    dest.nectarStored += take;
    srcSt.nectarStored -= take;
    moved += take;
    remaining -= take;
  }
  return moved;
};

/**
 * Moves up to `maxUnits` honey from the source to other nectar cells with honey capacity.
 */
export const relocateHoneyChunkFromCell = (
  colony: ColonyRuntime,
  sourceKey: string,
  level: number,
  maxUnits: number,
): number => {
  const srcEnt = colony.getCellAt(sourceKey);
  if (!srcEnt) {
    return 0;
  }
  const srcSt = srcEnt.get(CellStateComponent)!;
  if (srcSt.honeyStored <= 0) {
    return 0;
  }
  let moved = 0;
  let remaining = Math.min(maxUnits, srcSt.honeyStored);
  const candidates: { key: string; spare: number }[] = [];
  for (const [k, e] of colony.cellsByKey) {
    if (k === sourceKey) {
      continue;
    }
    const c = e.get(CellCoordComponent)!;
    if (c.level !== level) {
      continue;
    }
    const st = e.get(CellStateComponent)!;
    const spare = spareHoneyCapacityOnCell(st);
    if (spare > 0) {
      candidates.push({ key: k, spare });
    }
  }
  candidates.sort((a, b) => b.spare - a.spare);
  for (const { key, spare } of candidates) {
    if (remaining <= 0) {
      break;
    }
    const dest = colony.getCellAt(key)?.get(CellStateComponent)!;
    const take = Math.min(remaining, spare, srcSt.honeyStored);
    if (take <= 0) {
      continue;
    }
    dest.honeyStored += take;
    srcSt.honeyStored -= take;
    moved += take;
    remaining -= take;
  }
  return moved;
};
