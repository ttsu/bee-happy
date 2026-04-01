import { hexToWorld } from "../../grid/hex-grid";
import { hiveKey } from "../../grid/hive-levels";
import { getActiveColonyConstants } from "../colony-active-constants";
import {
  CellCoordComponent,
  CellStateComponent,
} from "../ecs/components/colony-components";
import {
  cellBlocksNectarDepositDueToRetype,
  cellBlocksPollenDepositDueToRetype,
} from "../cell-retype-capacity";
import { nectarCellCanAcceptNectarDeposit } from "../nectar-cell-helpers";
import type { ColonyRuntime } from "../colony-runtime";

export type DepositPick = { key: string; q: number; r: number; level: number };

export const anyPollenDepositCapacity = (colony: ColonyRuntime): boolean => {
  const C = getActiveColonyConstants();
  for (const [key, e] of colony.cellsByKey) {
    const st = e.get(CellStateComponent)!;
    if (
      st.built &&
      st.cellType === "pollen" &&
      st.pollenStored < C.pollenCellCapacity &&
      !cellBlocksPollenDepositDueToRetype(key, st)
    ) {
      return true;
    }
  }
  return false;
};

export const anyNectarDepositCapacity = (colony: ColonyRuntime): boolean => {
  for (const [key, e] of colony.cellsByKey) {
    const st = e.get(CellStateComponent)!;
    if (
      st.built &&
      nectarCellCanAcceptNectarDeposit(st) &&
      !cellBlocksNectarDepositDueToRetype(key, st)
    ) {
      return true;
    }
  }
  return false;
};

export const findNearestPollenDeposit = (
  colony: ColonyRuntime,
  beeWorldX: number,
  beeWorldY: number,
): DepositPick | null => {
  const C = getActiveColonyConstants();
  let best: DepositPick | null = null;
  let bestD = Infinity;
  for (const [cellKey, e] of colony.cellsByKey) {
    const coord = e.get(CellCoordComponent)!;
    const st = e.get(CellStateComponent)!;
    if (
      !st.built ||
      st.cellType !== "pollen" ||
      st.pollenStored >= C.pollenCellCapacity ||
      cellBlocksPollenDepositDueToRetype(cellKey, st)
    ) {
      continue;
    }
    const c = hexToWorld({ q: coord.q, r: coord.r }, C.hexSize);
    const d = Math.hypot(c.x - beeWorldX, c.y - beeWorldY);
    if (d < bestD) {
      bestD = d;
      best = {
        key: hiveKey({ q: coord.q, r: coord.r, level: coord.level }),
        q: coord.q,
        r: coord.r,
        level: coord.level,
      };
    }
  }
  return best;
};

export const findNearestNectarDeposit = (
  colony: ColonyRuntime,
  beeWorldX: number,
  beeWorldY: number,
): DepositPick | null => {
  const C = getActiveColonyConstants();
  let best: DepositPick | null = null;
  let bestD = Infinity;
  for (const [cellKey, e] of colony.cellsByKey) {
    const coord = e.get(CellCoordComponent)!;
    const st = e.get(CellStateComponent)!;
    if (
      !st.built ||
      !nectarCellCanAcceptNectarDeposit(st) ||
      cellBlocksNectarDepositDueToRetype(cellKey, st)
    ) {
      continue;
    }
    const c = hexToWorld({ q: coord.q, r: coord.r }, C.hexSize);
    const d = Math.hypot(c.x - beeWorldX, c.y - beeWorldY);
    if (d < bestD) {
      bestD = d;
      best = {
        key: hiveKey({ q: coord.q, r: coord.r, level: coord.level }),
        q: coord.q,
        r: coord.r,
        level: coord.level,
      };
    }
  }
  return best;
};
