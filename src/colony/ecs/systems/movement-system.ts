import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeLevelComponent,
  BeeWorkComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import {
  advanceBeeVerticalTransition,
  startLevelTransitionTowardActorIfNeeded,
} from "../../bee-vertical-move";

/** Returns any ECS entity by id (jobs are Entity, not Actor). */
const findWorldEntityById = (world: World, id: number) =>
  world.entities.find((e) => e.id === id);

/** Returns a scene Actor by id (e.g. bees). */
const findActorById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

/**
 * Moves reserved bees along shared job paths.
 */
export class MovementSystem extends System {
  static override priority = SystemPriority.Average;
  public readonly systemType = SystemType.Update;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(elapsed: number): void {
    if (this.colony.isSimulationPaused()) {
      return;
    }
    for (const actor of this.colony.scene.actors) {
      const w = actor.get(BeeWorkComponent);
      if (!w?.currentJobEntityId) {
        continue;
      }
      const jobEnt = findWorldEntityById(this.world, w.currentJobEntityId);
      if (!jobEnt) {
        continue;
      }
      const job = jobEnt.get(JobComponent)!;
      if (job.status === "done") {
        continue;
      }
      if (job.kind === "forageWater") {
        continue;
      }
      const forageDepositPath =
        (job.kind === "foragePollen" || job.kind === "forageNectar") &&
        job.foragePhase === "depositing" &&
        job.pathPoints.length > 0;
      if (job.kind === "foragePollen" || job.kind === "forageNectar") {
        if (!forageDepositPath) {
          continue;
        }
        this.followPath(actor, w, job, elapsed);
        continue;
      }
      if (
        job.kind === "feedLarvae" &&
        (job.feedLarvaePhase === "collecting" || job.feedLarvaePhase === "depositing")
      ) {
        continue;
      }
      if (job.kind === "clearCellForRetype" && job.retypePhase === "clearing") {
        continue;
      }
      const selfFeedPath =
        job.kind === "adultFeed" &&
        job.adultFeedTargetBeeId === actor.id &&
        job.pathPoints.length > 0;
      if (selfFeedPath) {
        this.followPath(actor, w, job, elapsed);
        continue;
      }
      if (job.kind === "waterDeliver") {
        const target = job.adultFeedTargetBeeId
          ? findActorById(this.world, job.adultFeedTargetBeeId)
          : undefined;
        if (target) {
          if (advanceBeeVerticalTransition(actor, elapsed)) {
            actor.pos = target.pos.clone();
            continue;
          }
          const to = target.pos.sub(actor.pos);
          const step = COLONY.beeSpeed * elapsed;
          if (to.size > step + 2) {
            actor.pos = actor.pos.add(to.normalize().scale(step));
          } else {
            actor.pos = target.pos.clone();
            startLevelTransitionTowardActorIfNeeded(actor, target);
          }
        }
        continue;
      }
      if (job.kind === "feedQueen") {
        const target = job.adultFeedTargetBeeId
          ? findActorById(this.world, job.adultFeedTargetBeeId)
          : undefined;
        if (target) {
          if (advanceBeeVerticalTransition(actor, elapsed)) {
            actor.pos = target.pos.clone();
            continue;
          }
          const to = target.pos.sub(actor.pos);
          const step = COLONY.beeSpeed * elapsed;
          if (to.size > step + 2) {
            actor.pos = actor.pos.add(to.normalize().scale(step));
          } else {
            actor.pos = target.pos.clone();
            startLevelTransitionTowardActorIfNeeded(actor, target);
          }
        }
        continue;
      }
      if (!job.pathPoints.length) {
        continue;
      }
      this.followPath(actor, w, job, elapsed);
    }
  }

  private followPath(
    actor: import("excalibur").Actor,
    w: BeeWorkComponent,
    job: JobComponent,
    elapsed: number,
  ): void {
    const lvl = actor.get(BeeLevelComponent)!;
    if (lvl.verticalTransitionTargetLevel !== null) {
      lvl.verticalTransitionElapsedMs += elapsed;
      if (lvl.verticalTransitionElapsedMs >= COLONY.beeLevelTransitionMs) {
        lvl.level = lvl.verticalTransitionTargetLevel;
        lvl.verticalTransitionTargetLevel = null;
        lvl.verticalTransitionElapsedMs = 0;
        if (w.pathIndex < job.pathPoints.length - 1) {
          w.pathIndex += 1;
        }
      }
      return;
    }

    const idx = Math.min(w.pathIndex, job.pathPoints.length - 1);
    const target = job.pathPoints[idx]!;
    const to = target.sub(actor.pos);
    const dist = to.size;
    const step = COLONY.beeSpeed * elapsed;
    if (dist <= step + 2) {
      actor.pos = target.clone();
      const prevLevel = lvl.level;
      const levelAtWaypoint =
        job.pathLevels[idx] ??
        job.pathLevels[job.pathLevels.length - 1] ??
        job.targetLevel;
      const crossLevel =
        job.pathLevels.length > 0 &&
        levelAtWaypoint !== prevLevel &&
        idx < job.pathLevels.length;
      if (crossLevel) {
        lvl.verticalTransitionTargetLevel = levelAtWaypoint;
        lvl.verticalTransitionElapsedMs = 0;
      } else {
        lvl.level = levelAtWaypoint;
        if (w.pathIndex < job.pathPoints.length - 1) {
          w.pathIndex += 1;
        }
      }
    } else {
      actor.pos = actor.pos.add(to.normalize().scale(step));
    }
  }
}
