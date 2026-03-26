import type { Vector } from "excalibur";
import { COLONY } from "./constants";
import type { ColonyRuntime } from "./colony-runtime";
import {
  CellCoordComponent,
  CellStateComponent,
} from "./ecs/components/colony-components";
import { hiveKey, type HiveCoord } from "../grid/hive-levels";
import { hexToWorld, worldToHex } from "../grid/hex-grid";
import {
  nectarCellHasHoneyForFeeding,
  nectarCellHasNectarForFeeding,
} from "./nectar-cell-helpers";

export type SelfFeedPick = {
  readonly key: string;
  readonly coord: HiveCoord;
};

/**
 * Finds the nearest hive cell on {@link level} where a hungry worker can obtain food
 * (pollen cell, nectar/honey cell, or any nectar cell when colony buffer can pay).
 */
export const findNearestSelfFeedTarget = (
  colony: ColonyRuntime,
  beeWorldPos: Vector,
  level: number,
): SelfFeedPick | null => {
  const res = colony.resources;
  const picks: { pick: SelfFeedPick; dist: number }[] = [];

  for (const [, ent] of colony.cellsByKey) {
    const coord = ent.get(CellCoordComponent)!;
    if (coord.level !== level) {
      continue;
    }
    const st = ent.get(CellStateComponent)!;
    if (!st.built) {
      continue;
    }
    const hive: HiveCoord = { q: coord.q, r: coord.r, level: coord.level };
    const key = hiveKey(hive);
    const center = hexToWorld({ q: coord.q, r: coord.r }, COLONY.hexSize);
    const dist = beeWorldPos.sub(center).size;
    let usable = false;
    if (st.cellType === "pollen" && st.pollenStored >= COLONY.adultFeedPollenCost) {
      usable = true;
    }
    if (
      st.cellType === "nectar" &&
      (nectarCellHasNectarForFeeding(st, COLONY.adultFeedCellNectarCost) ||
        nectarCellHasHoneyForFeeding(st, COLONY.adultFeedHoneyCost))
    ) {
      usable = true;
    }
    if (
      st.cellType === "nectar" &&
      res.colonyNectar >= COLONY.adultFeedColonyNectarCost
    ) {
      usable = true;
    }
    if (usable) {
      picks.push({ pick: { key, coord: hive }, dist });
    }
  }

  if (picks.length === 0) {
    return null;
  }
  picks.sort((a, b) => a.dist - b.dist);
  return picks[0]!.pick;
};

/**
 * Hex under {@link beeWorldPos} for same-level path start.
 */
export const beeStartHiveCoord = (beeWorldPos: Vector, level: number): HiveCoord => {
  const h = worldToHex(beeWorldPos, COLONY.hexSize);
  return { q: h.q, r: h.r, level };
};
