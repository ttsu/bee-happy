import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeWorkComponent,
  CellStateComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJobBees = (world: World, job: JobComponent): void => {
  for (const id of job.reservedBeeIds) {
    const bee = world.entities.find((e) => e.id === id);
    const w = bee?.get(BeeWorkComponent);
    if (w) {
      w.availability = "available";
      w.currentJobEntityId = null;
      w.pathIndex = 0;
      w.idleWanderTarget = null;
      w.idleWanderPauseRemainingMs = 0;
    }
  }
  job.reservedBeeIds = [];
};

/**
 * Consumes wax and advances foundation builds; completes build jobs.
 */
export class BuildSystem extends System {
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
    const res = this.colony.resources;
    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.kind !== "buildCell" || job.status === "done") {
        continue;
      }
      const key = hiveKey({
        q: job.targetQ,
        r: job.targetR,
        level: job.targetLevel,
      });
      const cellEnt = this.colony.getCellAt(key);
      if (!cellEnt) {
        continue;
      }
      const cell = cellEnt.get(CellStateComponent)!;
      const center = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
      let builders = 0;
      for (const id of job.reservedBeeIds) {
        const bee = findEntityById(this.world, id);
        if (!bee) {
          continue;
        }
        const w = bee.get(BeeWorkComponent)!;
        const atPathEnd =
          job.pathPoints.length > 0 && w.pathIndex >= job.pathPoints.length - 1;
        const atSite =
          bee.pos.sub(center).size <= COLONY.buildWorkRadiusPx && atPathEnd;
        if (atSite) {
          builders += 1;
        }
      }
      if (builders > 0 && res.wax > 0) {
        const rate = COLONY.waxPerBuilderPerSec * builders * (elapsed / 1000);
        const use = Math.min(rate, res.wax);
        res.wax -= use;
        const progressPerWax =
          1 / (COLONY.waxPerBuilderPerSec * COLONY.cellBuildTargetSec);
        cell.buildProgress += use * progressPerWax;
      }
      if (cell.buildProgress >= 1) {
        cell.built = true;
        cell.stage = "empty";
        cell.buildProgress = 1;
        job.status = "done";
        releaseJobBees(this.world, job);
        this.colony.events.emit({ type: "CellBuilt", cellKey: key });
        ent.kill();
      }
    }
  }
}
