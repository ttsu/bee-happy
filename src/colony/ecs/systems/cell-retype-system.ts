import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeLevelComponent,
  BeeWorkComponent,
  CellStateComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import {
  relocateHoneyChunkFromCell,
  relocateNectarChunkFromCell,
  relocatePollenChunkFromCell,
} from "../../cell-retype-capacity";
import { releaseJobBees } from "../job-release";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJob = (world: World, job: JobComponent): void => {
  releaseJobBees(world, job);
};

/**
 * Completes `clearCellForRetype` jobs: worker reaches the cell, then moves stored goods elsewhere.
 */
export class CellRetypeSystem extends System {
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

    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.kind !== "clearCellForRetype" || job.status === "done") {
        continue;
      }
      const key = hiveKey({
        q: job.targetQ,
        r: job.targetR,
        level: job.targetLevel,
      });
      const cellEnt = this.colony.getCellAt(key);
      if (!cellEnt) {
        job.status = "done";
        releaseJob(this.world, job);
        ent.kill();
        continue;
      }
      const st = cellEnt.get(CellStateComponent)!;
      const center = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
      const beeId = job.reservedBeeIds[0];
      const bee = beeId ? findEntityById(this.world, beeId) : undefined;
      if (!bee) {
        continue;
      }

      if (job.retypePhase === "toCell") {
        const w = bee.get(BeeWorkComponent)!;
        const lvl = bee.get(BeeLevelComponent);
        const atPathEnd =
          job.pathPoints.length > 0 && w.pathIndex >= job.pathPoints.length - 1;
        const atSite =
          bee.pos.sub(center).size <= COLONY.buildWorkRadiusPx &&
          atPathEnd &&
          !!lvl &&
          lvl.level === job.targetLevel;
        if (atSite) {
          job.retypePhase = "clearing";
          job.retypeClearAccumMs = 0;
        }
        continue;
      }

      job.retypeClearAccumMs += elapsed;
      if (job.retypeClearAccumMs < COLONY.retypeRelocateIntervalMs) {
        continue;
      }
      job.retypeClearAccumMs = 0;

      if (st.pollenStored > 0) {
        relocatePollenChunkFromCell(
          this.colony,
          key,
          job.targetLevel,
          COLONY.retypeRelocateChunkPollen,
        );
        this.colony.emitUiSnapshotImmediate();
        continue;
      }
      if (st.nectarStored > 0) {
        relocateNectarChunkFromCell(
          this.colony,
          key,
          job.targetLevel,
          COLONY.retypeRelocateChunkNectar,
        );
        this.colony.emitUiSnapshotImmediate();
        continue;
      }
      if (st.honeyStored > 0) {
        relocateHoneyChunkFromCell(
          this.colony,
          key,
          job.targetLevel,
          COLONY.retypeRelocateChunkHoney,
        );
        this.colony.emitUiSnapshotImmediate();
        continue;
      }

      const pending = st.pendingCellType;
      if (pending) {
        this.colony.applyResolvedCellType(key, pending);
      }
      job.status = "done";
      releaseJob(this.world, job);
      ent.kill();
      this.colony.emitUiSnapshotImmediate();
    }
  }
}
