import { COLONY } from "./constants";
import { getActiveColonyConstants } from "./colony-active-constants";
import { BeeAgeComponent } from "./ecs/components/colony-components";
import { hexAxialDistance, type HexCoord } from "../grid/hex-grid";
import type { HiveCoord } from "../grid/hive-levels";
import type { ColonyRuntime } from "./colony-runtime";

/**
 * Distinct level-0 hexes for bootstrap workers, spiraling outward from the hive center.
 */
const starterWorkerHexes = (count: number): HexCoord[] => {
  const candidates: HexCoord[] = [];
  const span = 14;
  for (let q = -span; q <= span; q++) {
    for (let r = -span; r <= span; r++) {
      if (q === 0 && r === 0) {
        continue;
      }
      candidates.push({ q, r });
    }
  }
  const origin: HexCoord = { q: 0, r: 0 };
  candidates.sort((a, b) => hexAxialDistance(a, origin) - hexAxialDistance(b, origin));
  return candidates.slice(0, count);
};

/**
 * Spawns a new queen at the hive center (level 0) and bootstrap workers on distinct hexes.
 * Does not create cells — used after queen succession when the nest is preserved.
 *
 * @param workerCount - Number of workers (0 allowed: queen only).
 */
export const spawnQueenAndBootstrapWorkers = (
  colony: ColonyRuntime,
  workerCount: number,
): void => {
  const C = getActiveColonyConstants();
  colony.spawnBee("queen", 0, { q: 0, r: 0 });
  const msPerDay = C.workerLifespanMs / 50;
  const spread =
    COLONY.bootstrapWorkerAgeMaxDays - COLONY.bootstrapWorkerAgeMinDays + 1;
  const hexes = starterWorkerHexes(workerCount);
  for (const hex of hexes) {
    const w = colony.spawnBee("worker", 0, hex);
    const dayRoll =
      COLONY.bootstrapWorkerAgeMinDays + Math.floor(Math.random() * spread);
    w.get(BeeAgeComponent)!.ageMs = (dayRoll - 1) * msPerDay;
  }
};

/**
 * Seeds level 0 with starter cells and bees (new game only).
 *
 * @param workerCount - Number of workers (default 2). Queen is always one.
 */
export const seedLevelZero = (colony: ColonyRuntime, workerCount = 2): void => {
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
  spawnQueenAndBootstrapWorkers(colony, workerCount);
};
