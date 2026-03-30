import { System, SystemPriority, SystemType, type Query, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeAgeComponent,
  BeeLevelComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  JobComponent,
} from "../components/colony-components";
import {
  findHexPathWorldPoints,
  findHexPathWorldPointsWithLevels,
} from "../../pathfinding/hex-path";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import type { HiveCoord } from "../../../grid/hive-levels";
import { hexToWorld, worldToHex } from "../../../grid/hex-grid";
import {
  isBeeAssignableToJobKind,
  isWorkerEligibleForJobKind,
  workerJobPreferenceDistanceBonusPx,
} from "../job-eligibility";
import { planFeedLarvaeLeg } from "../../feed-larvae-path";
import { beeStartHiveCoord, findNearestSelfFeedTarget } from "../../self-feed-target";
import { jobResumeSortWeight } from "../job-resume-sort-weight";

const findActorById = (colony: ColonyRuntime, id: number) =>
  asActor(colony.scene.actors.find((a) => a.id === id));

/**
 * Reserves workers (and queen for lay-egg) for open jobs and assigns shared paths.
 */
export class JobAssignmentSystem extends System {
  static override priority = SystemPriority.Higher;
  public readonly systemType = SystemType.Update;
  private readonly jobs: Query<typeof JobComponent>;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
    this.jobs = world.query([JobComponent]);
  }

  /**
   * World position used to sort which bee is nearest to the job.
   */
  private resolveJobAnchorWorld(job: JobComponent): import("excalibur").Vector {
    if (job.kind === "waterDeliver" || job.kind === "feedQueen") {
      const id = job.adultFeedTargetBeeId;
      if (id != null) {
        const t = findActorById(this.colony, id);
        if (t) {
          return t.pos;
        }
      }
    }
    if (job.kind === "adultFeed" && job.adultFeedTargetBeeId != null) {
      const self = findActorById(this.colony, job.adultFeedTargetBeeId);
      if (self) {
        const lvl = self.get(BeeLevelComponent)!.level;
        const pick = findNearestSelfFeedTarget(this.colony, self.pos, lvl);
        if (pick) {
          return hexToWorld({ q: pick.coord.q, r: pick.coord.r }, COLONY.hexSize);
        }
        return self.pos;
      }
    }
    return hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
  }

  override update(_elapsed: number): void {
    if (this.colony.isSimulationPaused()) {
      return;
    }
    const openJobs = this.jobs.entities.filter(
      (e) => e.get(JobComponent)!.status !== "done",
    );
    const resumeWeightByEntityId = new Map<number, number>();
    for (const e of openJobs) {
      resumeWeightByEntityId.set(
        e.id,
        jobResumeSortWeight(this.colony, e.get(JobComponent)!),
      );
    }
    const jobEntities = openJobs.sort((a, b) => {
      const ja = a.get(JobComponent)!;
      const jb = b.get(JobComponent)!;
      const byPriority = jb.priority - ja.priority;
      if (byPriority !== 0) {
        return byPriority;
      }
      return (
        (resumeWeightByEntityId.get(b.id) ?? 0) -
        (resumeWeightByEntityId.get(a.id) ?? 0)
      );
    });

    for (const je of jobEntities) {
      const job = je.get(JobComponent)!;
      const still = job.beesNeeded - job.reservedBeeIds.length;
      if (still <= 0) {
        continue;
      }
      const anchor = this.resolveJobAnchorWorld(job);
      const goal: HiveCoord = {
        q: job.targetQ,
        r: job.targetR,
        level: job.targetLevel,
      };
      const candidates = this.colony.scene.actors.filter((a) => {
        const role = a.get(BeeRoleComponent)!.role;
        if (!isBeeAssignableToJobKind(role, job.kind)) {
          return false;
        }
        if (role === "worker") {
          const age = a.get(BeeAgeComponent);
          if (!age) {
            return false;
          }
          if (!isWorkerEligibleForJobKind(age.ageMs, job.kind)) {
            return false;
          }
        }
        if (job.kind === "adultFeed" && job.adultFeedTargetBeeId !== a.id) {
          return false;
        }
        return true;
      });
      const sorted = candidates
        .filter((a) => {
          const w = a.get(BeeWorkComponent)!;
          return w.availability === "available" && !w.currentJobEntityId;
        })
        .sort((a, b) => {
          const da = a.pos.sub(anchor).size;
          const db = b.pos.sub(anchor).size;
          const ba = a.get(BeeAgeComponent);
          const bb = b.get(BeeAgeComponent);
          const scoreA =
            da - (ba ? workerJobPreferenceDistanceBonusPx(ba.ageMs, job.kind) : 0);
          const scoreB =
            db - (bb ? workerJobPreferenceDistanceBonusPx(bb.ageMs, job.kind) : 0);
          return scoreA - scoreB;
        });
      for (let i = 0; i < still && i < sorted.length; i++) {
        const bee = sorted[i]!;
        const w = bee.get(BeeWorkComponent)!;

        if (job.kind === "adultFeed") {
          const lvl = bee.get(BeeLevelComponent)!.level;
          const pick = findNearestSelfFeedTarget(this.colony, bee.pos, lvl);
          if (!pick) {
            continue;
          }
          const start = beeStartHiveCoord(bee.pos, lvl);
          const waypoints = findHexPathWorldPointsWithLevels(
            start,
            pick.coord,
            COLONY.hexSize,
            this.colony.builtByLevel(),
          );
          if (!waypoints.length) {
            continue;
          }
          job.targetQ = pick.coord.q;
          job.targetR = pick.coord.r;
          job.targetLevel = pick.coord.level;
          job.selfFeedCellKey = pick.key;
          job.pathPoints = waypoints.map((p) => p.world);
          job.pathLevels = waypoints.map((p) => p.level);
          w.availability = "busy";
          w.currentJobEntityId = je.id;
          w.pathIndex = 0;
          w.idleWanderTarget = null;
          w.idleWanderPauseRemainingMs = 0;
          job.reservedBeeIds.push(bee.id);
          job.status = "active";
          continue;
        }

        w.availability = "busy";
        w.currentJobEntityId = je.id;
        w.pathIndex = 0;
        w.idleWanderTarget = null;
        w.idleWanderPauseRemainingMs = 0;
        job.reservedBeeIds.push(bee.id);
        job.status = "active";
        if (
          job.kind === "foragePollen" ||
          job.kind === "forageNectar" ||
          job.kind === "forageWater" ||
          job.kind === "waterDeliver" ||
          job.kind === "feedQueen"
        ) {
          job.pathPoints = [];
          continue;
        }
        if (job.kind === "feedLarvae") {
          const ok = planFeedLarvaeLeg(this.colony, job, bee);
          if (!ok) {
            job.reservedBeeIds.pop();
            w.availability = "available";
            w.currentJobEntityId = null;
            w.pathIndex = 0;
            if (job.reservedBeeIds.length === 0) {
              job.status = "open";
            }
            continue;
          }
          continue;
        }
        const startHex = worldToHex(bee.pos, COLONY.hexSize);
        const start: HiveCoord = {
          q: startHex.q,
          r: startHex.r,
          level: bee.get(BeeLevelComponent)!.level,
        };
        job.pathPoints = findHexPathWorldPoints(
          start,
          goal,
          COLONY.hexSize,
          this.colony.builtByLevel(),
        );
      }
    }
  }
}
