import {
  System,
  SystemPriority,
  SystemType,
  vec,
  type Query,
  type Vector,
  type World,
} from "excalibur";
import {
  BeeLevelComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import type { HexCoord } from "../../../grid/hex-grid";
import { hexToWorld } from "../../../grid/hex-grid";
import { buildWalkableKeysForLevel } from "../../pathfinding/hex-path";
import {
  beeIsEligibleForOpenJobs,
  computeOpenJobAssignmentSlots,
  workerActorHasAssignableOpenJob,
} from "../job-eligibility";

const clearIdleMotion = (w: BeeWorkComponent): void => {
  w.idleWanderTarget = null;
  w.idleWanderPauseRemainingMs = 0;
};

const randomIdlePauseMs = (isQueen: boolean): number => {
  if (isQueen) {
    const { queenIdleWanderPauseMinMs: a, queenIdleWanderPauseMaxMs: b } = COLONY;
    return a + Math.random() * (b - a);
  }
  const { idleWanderPauseMinMs: a, idleWanderPauseMaxMs: b } = COLONY;
  return a + Math.random() * (b - a);
};

/** Built brood cells on a level for queen idle pacing (prefers {@link CellStateComponent.stage} `empty`). */
type BroodIdleSlot = { readonly qrKey: string; readonly isEmpty: boolean };

const collectBroodIdleSlots = (
  colony: ColonyRuntime,
  level: number,
): BroodIdleSlot[] => {
  const out: BroodIdleSlot[] = [];
  for (const ent of colony.cellsByKey.values()) {
    const coord = ent.get(CellCoordComponent)!;
    if (coord.level !== level) {
      continue;
    }
    const st = ent.get(CellStateComponent)!;
    if (!st.built || st.cellType !== "brood") {
      continue;
    }
    out.push({
      qrKey: `${coord.q},${coord.r}`,
      isEmpty: st.stage === "empty",
    });
  }
  return out;
};

const pickQueenBroodWanderWorldPoint = (
  slots: readonly BroodIdleSlot[],
  hexSize: number,
): Vector => {
  const emptySlots = slots.filter((s) => s.isEmpty);
  const preferEmpty =
    emptySlots.length > 0 && Math.random() < COLONY.queenIdlePreferEmptyBroodChance;
  const pool = preferEmpty ? emptySlots : slots;
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  const [q, r] = pick.qrKey.split(",").map(Number) as [number, number];
  const base = hexToWorld({ q, r }, hexSize);
  const j = COLONY.queenIdleWanderJitterPx;
  return vec(
    base.x + (Math.random() * 2 - 1) * j,
    base.y + (Math.random() * 2 - 1) * j,
  );
};

/**
 * Moves bees that have no job and cannot be assigned to any open job along random paths on the hive.
 * Idle bees move slower than working bees, glide to each wander point without snapping, then pause briefly.
 */
export class IdleWanderSystem extends System {
  static override priority = SystemPriority.Average;
  public readonly systemType = SystemType.Update;
  private readonly jobs: Query<typeof JobComponent>;

  constructor(
    world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
    this.jobs = world.query([JobComponent]);
  }

  override update(elapsed: number): void {
    const slots = computeOpenJobAssignmentSlots(this.jobs.entities);
    const builtByLevel = this.colony.builtByLevel();
    const jobEntities = this.jobs.entities;

    for (const actor of this.colony.scene.actors) {
      const w = actor.get(BeeWorkComponent);
      const role = actor.get(BeeRoleComponent);
      const lvl = actor.get(BeeLevelComponent);
      if (!w || !role || !lvl) {
        continue;
      }
      if (w.currentJobEntityId) {
        clearIdleMotion(w);
        continue;
      }
      if (w.availability !== "available") {
        clearIdleMotion(w);
        continue;
      }
      if (role.role === "queen" && beeIsEligibleForOpenJobs(role.role, slots)) {
        clearIdleMotion(w);
        continue;
      }
      if (
        role.role === "worker" &&
        workerActorHasAssignableOpenJob(actor, jobEntities)
      ) {
        clearIdleMotion(w);
        continue;
      }

      const walk = getWalkableKeysForLevel(lvl.level, builtByLevel);
      if (walk.size === 0) {
        clearIdleMotion(w);
        continue;
      }

      const isQueen = role.role === "queen";
      const idleSpeed =
        COLONY.beeSpeed *
        (isQueen
          ? COLONY.queenIdleWanderSpeedMultiplier
          : COLONY.idleWanderSpeedMultiplier);

      if (w.idleWanderPauseRemainingMs > 0) {
        w.idleWanderPauseRemainingMs = Math.max(
          0,
          w.idleWanderPauseRemainingMs - elapsed,
        );
        continue;
      }

      if (!w.idleWanderTarget) {
        if (isQueen) {
          const broodSlots = collectBroodIdleSlots(this.colony, lvl.level);
          w.idleWanderTarget =
            broodSlots.length > 0
              ? pickQueenBroodWanderWorldPoint(broodSlots, COLONY.hexSize)
              : pickRandomWalkableWorldPoint(
                  walk,
                  COLONY.hexSize,
                  COLONY.queenIdleWanderJitterPx,
                );
        } else {
          w.idleWanderTarget = pickRandomWalkableWorldPoint(walk, COLONY.hexSize);
        }
      }

      const target = w.idleWanderTarget;
      if (!target) {
        continue;
      }

      const to = target.sub(actor.pos);
      const dist = to.size;
      const step = idleSpeed * elapsed;

      // Already on target (e.g. after float noise).
      if (dist < 0.001) {
        w.idleWanderTarget = null;
        w.idleWanderPauseRemainingMs = randomIdlePauseMs(isQueen);
        continue;
      }

      const moveDist = Math.min(step, dist);
      actor.pos = actor.pos.add(to.normalize().scale(moveDist));

      if (moveDist >= dist - 1e-3) {
        w.idleWanderTarget = null;
        w.idleWanderPauseRemainingMs = randomIdlePauseMs(isQueen);
      }
    }
  }
}

const getWalkableKeysForLevel = (
  level: number,
  builtByLevel: Map<number, Set<string>>,
): Set<string> => {
  const builtCoords: HexCoord[] = [];
  const set = builtByLevel.get(level);
  if (set) {
    for (const k of set) {
      const [q, r] = k.split(",").map(Number) as [number, number];
      builtCoords.push({ q, r });
    }
  }
  return buildWalkableKeysForLevel(builtCoords);
};

const pickRandomWalkableWorldPoint = (
  walk: Set<string>,
  hexSize: number,
  jitterPx: number = COLONY.idleWanderJitterPx,
): Vector => {
  const keys = [...walk];
  const k = keys[Math.floor(Math.random() * keys.length)]!;
  const [q, r] = k.split(",").map(Number) as [number, number];
  const base = hexToWorld({ q, r }, hexSize);
  return vec(
    base.x + (Math.random() * 2 - 1) * jitterPx,
    base.y + (Math.random() * 2 - 1) * jitterPx,
  );
};
