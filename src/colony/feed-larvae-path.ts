import type { Actor, World } from "excalibur";
import { hexAxialDistance } from "../grid/hex-grid";
import type { HexCoord } from "../grid/hex-grid";
import { hexToWorld, worldToHex } from "../grid/hex-grid";
import type { HiveCoord } from "../grid/hive-levels";
import { hiveKey } from "../grid/hive-levels";
import { findHexPathWorldPoints } from "./pathfinding/hex-path";
import { COLONY } from "./constants";
import type { ColonyRuntime } from "./colony-runtime";
import {
  BeeCarryComponent,
  BeeLevelComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  JobComponent,
} from "./ecs/components/colony-components";
import {
  nectarCellHasHoneyForFeeding,
  nectarCellHasNectarForFeeding,
} from "./nectar-cell-helpers";

/**
 * Nearest built pollen cell with at least {@link minPollen} units, by axial distance from {@link from}.
 */
const findNearestPollenCellWithStock = (
  colony: ColonyRuntime,
  level: number,
  from: HexCoord,
  minPollen: number,
): HiveCoord | null => {
  let best: HiveCoord | null = null;
  let bestD = Infinity;
  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    const st = ent.get(CellStateComponent)!;
    if (c.level !== level || !st.built || st.cellType !== "pollen") {
      continue;
    }
    if (st.pollenStored < minPollen) {
      continue;
    }
    const d = hexAxialDistance(from, { q: c.q, r: c.r });
    if (d < bestD) {
      bestD = d;
      best = { q: c.q, r: c.r, level: c.level };
    }
  }
  return best;
};

const levelHasLarvaeNectarSupply = (colony: ColonyRuntime, level: number): boolean => {
  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    const cellSt = ent.get(CellStateComponent)!;
    if (c.level !== level || !cellSt.built || cellSt.cellType !== "nectar") {
      continue;
    }
    if (nectarCellHasNectarForFeeding(cellSt, 1)) {
      return true;
    }
  }
  return false;
};

const levelHasLarvaeHoneySupply = (colony: ColonyRuntime, level: number): boolean => {
  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    const cellSt = ent.get(CellStateComponent)!;
    if (c.level !== level || !cellSt.built || cellSt.cellType !== "nectar") {
      continue;
    }
    if (nectarCellHasHoneyForFeeding(cellSt, COLONY.larvaeFeedHoneyCost)) {
      return true;
    }
  }
  return false;
};

/**
 * Nearest nectar cell for one larvae portion: prefer nectar; otherwise one honey load (integer cost, 4× portions).
 */
const findNearestLarvaeNectarOrHoneyPickup = (
  colony: ColonyRuntime,
  level: number,
  from: HexCoord,
  larvaeNectarRemaining: number,
): { coord: HiveCoord; kind: "nectar" | "honey" } | null => {
  const allowHoney =
    larvaeNectarRemaining >= COLONY.honeyNutrientMultiplier;
  let bestN: HiveCoord | null = null;
  let bestNd = Infinity;
  let bestH: HiveCoord | null = null;
  let bestHd = Infinity;
  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    const cellSt = ent.get(CellStateComponent)!;
    if (c.level !== level || !cellSt.built || cellSt.cellType !== "nectar") {
      continue;
    }
    const d = hexAxialDistance(from, { q: c.q, r: c.r });
    if (nectarCellHasNectarForFeeding(cellSt, 1) && d < bestNd) {
      bestNd = d;
      bestN = { q: c.q, r: c.r, level: c.level };
    }
    if (
      allowHoney &&
      nectarCellHasHoneyForFeeding(cellSt, COLONY.larvaeFeedHoneyCost) &&
      d < bestHd
    ) {
      bestHd = d;
      bestH = { q: c.q, r: c.r, level: c.level };
    }
  }
  if (bestN) {
    return { coord: bestN, kind: "nectar" };
  }
  if (bestH) {
    return { coord: bestH, kind: "honey" };
  }
  return null;
};

/**
 * Whether a feed-larvae job can be opened: brood still needs food and a storage cell
 * plus colony stock exist for at least one required leg.
 */
export const canSpawnFeedLarvaeJob = (
  colony: ColonyRuntime,
  coord: CellCoordComponent,
  st: CellStateComponent,
): boolean => {
  const from: HexCoord = { q: coord.q, r: coord.r };
  if (st.larvaePollenRemaining > 0) {
    if (
      findNearestPollenCellWithStock(
        colony,
        coord.level,
        from,
        COLONY.pollenPerFeedUnit,
      )
    ) {
      return true;
    }
  }
  if (st.larvaeNectarRemaining > 0) {
    if (levelHasLarvaeNectarSupply(colony, coord.level)) {
      return true;
    }
    if (
      st.larvaeNectarRemaining >= COLONY.honeyNutrientMultiplier &&
      levelHasLarvaeHoneySupply(colony, coord.level)
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Plans the next leg (pickup at food cell → deliver at brood) for an active feed-larvae job.
 *
 * @returns false when no leg is currently possible (waiting on stock or cells).
 */
export const planFeedLarvaeLeg = (
  colony: ColonyRuntime,
  job: JobComponent,
  bee: Actor,
): boolean => {
  const broodKey = hiveKey({
    q: job.targetQ,
    r: job.targetR,
    level: job.targetLevel,
  });
  const cellEnt = colony.getCellAt(broodKey);
  if (!cellEnt) {
    return false;
  }
  const st = cellEnt.get(CellStateComponent)!;
  if (st.stage !== "larvae") {
    return false;
  }

  const level = job.targetLevel;
  const w = bee.get(BeeWorkComponent)!;
  const startHex = worldToHex(bee.pos, COLONY.hexSize);
  const start: HiveCoord = {
    q: startHex.q,
    r: startHex.r,
    level: bee.get(BeeLevelComponent)!.level,
  };

  const tryPollen = (): boolean => {
    if (st.larvaePollenRemaining <= 0) {
      return false;
    }
    const src = findNearestPollenCellWithStock(
      colony,
      level,
      { q: startHex.q, r: startHex.r },
      COLONY.pollenPerFeedUnit,
    );
    if (!src) {
      return false;
    }
    job.feedCargoKind = "pollen";
    job.feedPickupQ = src.q;
    job.feedPickupR = src.r;
    job.feedPickupLevel = src.level;
    job.feedLarvaePhase = "toPickup";
    job.feedLarvaePhaseTimerMs = 0;
    job.carryPayload = "none";
    bee.get(BeeCarryComponent)!.carry = "none";
    const goal: HiveCoord = {
      q: job.feedPickupQ,
      r: job.feedPickupR,
      level: job.feedPickupLevel,
    };
    job.pathPoints = findHexPathWorldPoints(
      start,
      goal,
      COLONY.hexSize,
      colony.builtByLevel(),
    );
    w.pathIndex = 0;
    return true;
  };

  const tryNectar = (): boolean => {
    if (st.larvaeNectarRemaining <= 0) {
      return false;
    }
    const pick = findNearestLarvaeNectarOrHoneyPickup(
      colony,
      level,
      {
        q: startHex.q,
        r: startHex.r,
      },
      st.larvaeNectarRemaining,
    );
    if (!pick) {
      return false;
    }
    job.feedCargoKind = pick.kind;
    job.feedPickupQ = pick.coord.q;
    job.feedPickupR = pick.coord.r;
    job.feedPickupLevel = pick.coord.level;
    job.feedLarvaePhase = "toPickup";
    job.feedLarvaePhaseTimerMs = 0;
    job.carryPayload = "none";
    bee.get(BeeCarryComponent)!.carry = "none";
    const goal: HiveCoord = {
      q: job.feedPickupQ,
      r: job.feedPickupR,
      level: job.feedPickupLevel,
    };
    job.pathPoints = findHexPathWorldPoints(
      start,
      goal,
      COLONY.hexSize,
      colony.builtByLevel(),
    );
    w.pathIndex = 0;
    return true;
  };

  if (tryPollen()) {
    return true;
  }
  if (tryNectar()) {
    return true;
  }
  return false;
};

/**
 * Rebuilds path from bee to brood cell after picking up food.
 */
export const planFeedLarvaeDeliverPath = (
  colony: ColonyRuntime,
  job: JobComponent,
  bee: Actor,
): void => {
  const w = bee.get(BeeWorkComponent)!;
  const startHex = worldToHex(bee.pos, COLONY.hexSize);
  const start: HiveCoord = {
    q: startHex.q,
    r: startHex.r,
    level: bee.get(BeeLevelComponent)!.level,
  };
  const goal: HiveCoord = {
    q: job.targetQ,
    r: job.targetR,
    level: job.targetLevel,
  };
  job.feedLarvaePhase = "toDeliver";
  job.feedLarvaePhaseTimerMs = 0;
  job.pathPoints = findHexPathWorldPoints(
    start,
    goal,
    COLONY.hexSize,
    colony.builtByLevel(),
  );
  w.pathIndex = 0;
};

/** Re-path to the current food cell after leaving during collection. */
const refreshPathToPickup = (
  colony: ColonyRuntime,
  job: JobComponent,
  bee: Actor,
): void => {
  const w = bee.get(BeeWorkComponent)!;
  const startHex = worldToHex(bee.pos, COLONY.hexSize);
  const start: HiveCoord = {
    q: startHex.q,
    r: startHex.r,
    level: bee.get(BeeLevelComponent)!.level,
  };
  const goal: HiveCoord = {
    q: job.feedPickupQ,
    r: job.feedPickupR,
    level: job.feedPickupLevel,
  };
  job.pathPoints = findHexPathWorldPoints(
    start,
    goal,
    COLONY.hexSize,
    colony.builtByLevel(),
  );
  w.pathIndex = 0;
};

const FEED_PICKUP_REACH_PX = 45;
const FEED_DELIVER_REACH_PX = 45;

/**
 * Advances feed-larvae pickup and delivery when bees are in range.
 */
export const processFeedLarvaeJobs = (
  colony: ColonyRuntime,
  world: World,
  findActorById: (id: number) => Actor | undefined,
  releaseJob: (world: World, job: JobComponent) => void,
  onBroodFullyFed: (cellKey: string) => void,
  elapsed: number,
): void => {
  for (const je of world.entities) {
    const job = je.get(JobComponent);
    if (!job || job.kind !== "feedLarvae" || job.status === "done") {
      continue;
    }

    const broodKey = hiveKey({
      q: job.targetQ,
      r: job.targetR,
      level: job.targetLevel,
    });
    const cellEnt = colony.getCellAt(broodKey);
    if (!cellEnt) {
      continue;
    }
    const st = cellEnt.get(CellStateComponent)!;

    const beeId = job.reservedBeeIds[0];
    const bee = beeId ? findActorById(beeId) : undefined;
    if (!bee) {
      continue;
    }

    if (job.feedLarvaePhase === "toPickup" && job.pathPoints.length === 0) {
      planFeedLarvaeLeg(colony, job, bee);
      continue;
    }
    if (
      job.feedLarvaePhase === "toDeliver" &&
      job.pathPoints.length === 0 &&
      job.carryPayload !== "none"
    ) {
      planFeedLarvaeDeliverPath(colony, job, bee);
      continue;
    }

    const pickupCenter = hexToWorld(
      { q: job.feedPickupQ, r: job.feedPickupR },
      COLONY.hexSize,
    );
    const broodCenter = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
    const atPickup = bee.pos.sub(pickupCenter).size < FEED_PICKUP_REACH_PX;
    const atBrood = bee.pos.sub(broodCenter).size < FEED_DELIVER_REACH_PX;

    if (job.feedLarvaePhase === "toPickup" && atPickup) {
      job.feedLarvaePhase = "collecting";
      job.feedLarvaePhaseTimerMs = COLONY.feedLarvaeCollectMs;
    }

    if (job.feedLarvaePhase === "collecting") {
      if (!atPickup) {
        job.feedLarvaePhase = "toPickup";
        job.feedLarvaePhaseTimerMs = 0;
        refreshPathToPickup(colony, job, bee);
        continue;
      }
      job.feedLarvaePhaseTimerMs -= elapsed;
      if (job.feedLarvaePhaseTimerMs > 0) {
        continue;
      }
      if (job.feedCargoKind === "pollen") {
        const pk = hiveKey({
          q: job.feedPickupQ,
          r: job.feedPickupR,
          level: job.feedPickupLevel,
        });
        const pollenEnt = colony.getCellAt(pk);
        const pollenSt = pollenEnt?.get(CellStateComponent);
        if (!pollenSt || pollenSt.pollenStored < COLONY.pollenPerFeedUnit) {
          job.pathPoints = [];
          job.feedLarvaePhase = "toPickup";
          job.feedLarvaePhaseTimerMs = 0;
          continue;
        }
        pollenSt.pollenStored -= COLONY.pollenPerFeedUnit;
        job.carryPayload = "pollen";
        bee.get(BeeCarryComponent)!.carry = "pollen";
      } else if (job.feedCargoKind === "nectar") {
        const nk = hiveKey({
          q: job.feedPickupQ,
          r: job.feedPickupR,
          level: job.feedPickupLevel,
        });
        const pickupSt = colony.getCellAt(nk)?.get(CellStateComponent);
        if (!pickupSt || !nectarCellHasNectarForFeeding(pickupSt, 1)) {
          job.pathPoints = [];
          job.feedLarvaePhase = "toPickup";
          job.feedLarvaePhaseTimerMs = 0;
          continue;
        }
        pickupSt.nectarStored -= 1;
        job.carryPayload = "nectar";
        bee.get(BeeCarryComponent)!.carry = "nectar";
      } else if (job.feedCargoKind === "honey") {
        const hk = hiveKey({
          q: job.feedPickupQ,
          r: job.feedPickupR,
          level: job.feedPickupLevel,
        });
        const pickupSt = colony.getCellAt(hk)?.get(CellStateComponent);
        if (
          !pickupSt ||
          !nectarCellHasHoneyForFeeding(pickupSt, COLONY.larvaeFeedHoneyCost)
        ) {
          job.pathPoints = [];
          job.feedLarvaePhase = "toPickup";
          job.feedLarvaePhaseTimerMs = 0;
          continue;
        }
        pickupSt.honeyStored -= COLONY.larvaeFeedHoneyCost;
        job.carryPayload = "honey";
        bee.get(BeeCarryComponent)!.carry = "honey";
      } else {
        continue;
      }
      planFeedLarvaeDeliverPath(colony, job, bee);
      continue;
    }

    if (job.feedLarvaePhase === "toDeliver" && atBrood) {
      job.feedLarvaePhase = "depositing";
      job.feedLarvaePhaseTimerMs = COLONY.feedLarvaeDepositMs;
    }

    if (job.feedLarvaePhase === "depositing") {
      if (!atBrood) {
        job.feedLarvaePhase = "toDeliver";
        job.feedLarvaePhaseTimerMs = 0;
        planFeedLarvaeDeliverPath(colony, job, bee);
        continue;
      }
      job.feedLarvaePhaseTimerMs -= elapsed;
      if (job.feedLarvaePhaseTimerMs > 0) {
        continue;
      }
      if (job.feedCargoKind === "pollen") {
        st.larvaePollenRemaining = Math.max(0, st.larvaePollenRemaining - 1);
      } else if (job.feedCargoKind === "nectar") {
        st.larvaeNectarRemaining = Math.max(0, st.larvaeNectarRemaining - 1);
      } else if (job.feedCargoKind === "honey") {
        st.larvaeNectarRemaining = Math.max(
          0,
          st.larvaeNectarRemaining - COLONY.honeyNutrientMultiplier,
        );
      }
      job.carryPayload = "none";
      bee.get(BeeCarryComponent)!.carry = "none";
      job.feedCargoKind = "none";

      if (st.larvaePollenRemaining <= 0 && st.larvaeNectarRemaining <= 0) {
        st.stage = "sealed";
        st.sealedTimerMs = COLONY.sealedDurationMs;
        onBroodFullyFed(broodKey);
        job.status = "done";
        releaseJob(world, job);
        je.kill();
      } else if (!planFeedLarvaeLeg(colony, job, bee)) {
        job.feedLarvaePhase = "toPickup";
        job.pathPoints = [];
      }
    }
  }
};
