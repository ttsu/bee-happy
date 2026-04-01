import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeAgeComponent,
  BeeLevelComponent,
  BeeRoleComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hexToWorld } from "../../../grid/hex-grid";
import { JobPriority } from "../../job-priority";
import { getWorkerLifecycleStage } from "../../worker-lifecycle";
import { releaseJobBees } from "../job-release";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const MAX_GUARD_JOBS = 2;

/** Hive entrance patrol target (built brood center in seed layout). */
const GUARD_TARGET_Q = 0;
const GUARD_TARGET_R = 0;

/**
 * Spawns guard jobs for guard-stage workers and completes timed watch at the entrance.
 */
export class GuardSystem extends System {
  static override priority = SystemPriority.Lower;
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
    let guardStageWorkers = 0;
    for (const actor of this.colony.scene.actors) {
      const role = actor.get(BeeRoleComponent);
      const age = actor.get(BeeAgeComponent);
      if (role?.role !== "worker" || !age) {
        continue;
      }
      if (getWorkerLifecycleStage(age.ageMs) === 4) {
        guardStageWorkers += 1;
      }
    }

    let guardJobCount = 0;
    for (const ent of this.world.entities) {
      const j = ent.get(JobComponent);
      if (j && j.kind === "guardHive" && j.status !== "done") {
        guardJobCount += 1;
      }
    }

    const desired = Math.min(MAX_GUARD_JOBS, guardStageWorkers);
    while (guardJobCount < desired) {
      const job = new JobComponent(
        "guardHive",
        JobPriority.guardHive,
        GUARD_TARGET_Q,
        GUARD_TARGET_R,
        0,
        1,
      );
      this.colony.createJob(job);
      guardJobCount += 1;
    }

    const center = hexToWorld({ q: GUARD_TARGET_Q, r: GUARD_TARGET_R }, COLONY.hexSize);
    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.kind !== "guardHive" || job.status === "done") {
        continue;
      }
      const beeId = job.reservedBeeIds[0];
      const bee = beeId ? findEntityById(this.world, beeId) : undefined;
      if (!bee) {
        continue;
      }
      const bl = bee.get(BeeLevelComponent);
      if (
        bee.pos.sub(center).size > COLONY.selfFeedWorkRadiusPx ||
        !bl ||
        bl.level !== job.targetLevel
      ) {
        job.guardHiveTimerMs = 0;
        continue;
      }
      job.guardHiveTimerMs += elapsed;
      if (job.guardHiveTimerMs >= COLONY.guardHiveDurationMs) {
        job.status = "done";
        releaseJobBees(this.world, job);
        ent.kill();
      }
    }
  }
}
