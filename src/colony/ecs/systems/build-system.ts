import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeLevelComponent,
  BeeWorkComponent,
  CellStateComponent,
  JobComponent,
} from "../components/colony-components";
import { getActiveColonyConstants } from "../../colony-active-constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import { releaseJobBees } from "../job-release";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

/**
 * Advances foundation builds while workers are in range; completes build jobs.
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
    const C = getActiveColonyConstants();
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
      const center = hexToWorld({ q: job.targetQ, r: job.targetR }, C.hexSize);
      let builders = 0;
      for (const id of job.reservedBeeIds) {
        const bee = findEntityById(this.world, id);
        if (!bee) {
          continue;
        }
        const w = bee.get(BeeWorkComponent)!;
        const lvl = bee.get(BeeLevelComponent);
        const atPathEnd =
          job.pathPoints.length > 0 && w.pathIndex >= job.pathPoints.length - 1;
        const atSite =
          bee.pos.sub(center).size <= C.buildWorkRadiusPx &&
          atPathEnd &&
          !!lvl &&
          lvl.level === job.targetLevel;
        if (atSite) {
          builders += 1;
        }
      }
      if (builders > 0) {
        const progressDelta = (elapsed / 1000) * (builders / C.cellBuildTargetSec);
        const waxNeeded = progressDelta * C.cellBuildWaxCost;
        const stored = this.colony.getBeeswaxStored();
        if (stored <= 0) {
          releaseJobBees(this.world, job);
          job.status = "open";
        } else if (stored < waxNeeded) {
          cell.buildProgress += stored / C.cellBuildWaxCost;
          this.colony.tryConsumeBeeswax(stored);
          releaseJobBees(this.world, job);
          job.status = "open";
        } else {
          cell.buildProgress += progressDelta;
          this.colony.tryConsumeBeeswax(waxNeeded);
        }
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
