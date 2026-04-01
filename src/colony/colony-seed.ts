import { COLONY } from "./constants";
import { getActiveColonyConstants } from "./colony-active-constants";
import { BeeAgeComponent } from "./ecs/components/colony-components";
import type { HiveCoord } from "../grid/hive-levels";
import type { ColonyRuntime } from "./colony-runtime";

/**
 * Seeds level 0 with starter cells and bees (new game or after succession).
 */
export const seedLevelZero = (colony: ColonyRuntime): void => {
  const C = getActiveColonyConstants();
  const seeds: { coord: HiveCoord; type: "brood" | "pollen" | "nectar" }[] = [
    { coord: { q: 0, r: 0, level: 0 }, type: "brood" },
    { coord: { q: 1, r: 0, level: 0 }, type: "pollen" },
    { coord: { q: -1, r: 0, level: 0 }, type: "nectar" },
  ];
  for (const s of seeds) {
    colony.createCellEntity(s.coord, {
      built: true,
      stage: "empty",
      buildProgress: 1,
      cellType: s.type,
      ...(s.type === "pollen" ? { pollenStored: C.initialPollen } : {}),
      ...(s.type === "nectar"
        ? {
            nectarStored: Math.min(C.nectarCellCapacity, 8),
            honeyStored: 0,
          }
        : {}),
    });
  }
  colony.spawnBee("queen", 0, { q: 0, r: 0 });
  const msPerDay = C.workerLifespanMs / 50;
  const spread =
    COLONY.bootstrapWorkerAgeMaxDays - COLONY.bootstrapWorkerAgeMinDays + 1;
  for (const hex of [
    { q: 0, r: 1 },
    { q: 1, r: -1 },
  ] as const) {
    const w = colony.spawnBee("worker", 0, hex);
    const dayRoll =
      COLONY.bootstrapWorkerAgeMinDays + Math.floor(Math.random() * spread);
    w.get(BeeAgeComponent)!.ageMs = (dayRoll - 1) * msPerDay;
  }
};
