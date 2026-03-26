import { System, SystemPriority, SystemType, type Query, type World } from "excalibur";
import {
  BeeLevelComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  JobComponent,
} from "../components/colony-components";
import { findHexPathWorldPoints } from "../../pathfinding/hex-path";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import type { HiveCoord } from "../../../grid/hive-levels";
import { hexToWorld, worldToHex } from "../../../grid/hex-grid";
import { isBeeAssignableToJobKind } from "../job-eligibility";
import { planFeedLarvaeLeg } from "../../feed-larvae-path";

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

  override update(_elapsed: number): void {
    const jobEntities = this.jobs.entities
      .filter((e) => e.get(JobComponent)!.status !== "done")
      .sort((a, b) => b.get(JobComponent)!.priority - a.get(JobComponent)!.priority);

    for (const je of jobEntities) {
      const job = je.get(JobComponent)!;
      const still = job.beesNeeded - job.reservedBeeIds.length;
      if (still <= 0) {
        continue;
      }
      const targetWorld = hexToWorld(
        { q: job.targetQ, r: job.targetR },
        COLONY.hexSize,
      );
      const goal: HiveCoord = {
        q: job.targetQ,
        r: job.targetR,
        level: job.targetLevel,
      };
      const candidates = this.colony.scene.actors.filter((a) =>
        isBeeAssignableToJobKind(a.get(BeeRoleComponent)!.role, job.kind),
      );
      const sorted = candidates
        .filter((a) => {
          const w = a.get(BeeWorkComponent)!;
          return w.availability === "available" && !w.currentJobEntityId;
        })
        .sort((a, b) => {
          const da = a.pos.sub(targetWorld).size;
          const db = b.pos.sub(targetWorld).size;
          return da - db;
        });
      for (let i = 0; i < still && i < sorted.length; i++) {
        const bee = sorted[i]!;
        const w = bee.get(BeeWorkComponent)!;
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
          job.kind === "adultFeed" ||
          job.kind === "waterDeliver"
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
