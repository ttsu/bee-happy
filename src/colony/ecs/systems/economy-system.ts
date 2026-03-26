import { System, SystemPriority, SystemType, vec, type World } from "excalibur";
import {
  BeeCarryComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyResourcesComponent,
  JobComponent,
} from "../components/colony-components";
import { asActor } from "../../actor-utils";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import { JobPriority } from "../../job-priority";
import {
  nectarCellCanAcceptNectarDeposit,
  nectarCellReadyForHoneyProcessing,
} from "../../nectar-cell-helpers";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJob = (world: World, job: JobComponent): void => {
  for (const id of job.reservedBeeIds) {
    const bee = findEntityById(world, id);
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

const hasJobKind = (world: World, kind: JobComponent["kind"]): boolean =>
  world.entities.some((e) => {
    const j = e.get(JobComponent);
    return j && j.kind === kind && j.status !== "done";
  });

/**
 * Foraging (pollen/nectar/water), nectar deposits, and honey processing.
 */
export class EconomySystem extends System {
  static override priority = SystemPriority.Lower;
  public readonly systemType = SystemType.Update;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(elapsed: number): void {
    const res = this.colony.resources;
    if (
      this.colony.sumPollenStored() < 25 &&
      !hasJobKind(this.world, "foragePollen")
    ) {
      const cell = this.findPollenCellWithDepositRoom();
      if (cell) {
        const c = cell.get(CellCoordComponent)!;
        const j = new JobComponent(
          "foragePollen",
          JobPriority.foragePollen,
          c.q,
          c.r,
          c.level,
          1,
        );
        j.foragePhase = "outbound";
        j.scratchX = c.q * 120 + 200;
        j.scratchY = c.r * 120 - 180;
        this.colony.createJob(j);
      }
    }

    if (
      res.colonyNectar < COLONY.colonyNectarForageThreshold &&
      !hasJobKind(this.world, "forageNectar")
    ) {
      const cell = this.findNectarCellForDeposit();
      if (cell) {
        const c = cell.get(CellCoordComponent)!;
        const j = new JobComponent(
          "forageNectar",
          JobPriority.forageNectar,
          c.q,
          c.r,
          c.level,
          1,
        );
        j.foragePhase = "outbound";
        j.scratchX = c.q * 120 - 220;
        j.scratchY = c.r * 120 + 160;
        this.colony.createJob(j);
      }
    }

    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.status === "done") {
        continue;
      }
      if (
        job.kind === "foragePollen" ||
        job.kind === "forageNectar" ||
        job.kind === "forageWater"
      ) {
        this.updateForage(ent, job, res, elapsed);
      } else if (job.kind === "honeyProcess") {
        this.updateHoney(ent, job, elapsed);
      }
    }

    this.checkFullNectarCells();
  }

  /**
   * A pollen cell that can accept a forage deposit (not at capacity).
   */
  private findPollenCellWithDepositRoom(): import("excalibur").Entity | undefined {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (
        st.built &&
        st.cellType === "pollen" &&
        st.pollenStored < COLONY.pollenCellCapacity
      ) {
        return e;
      }
    }
    return undefined;
  }

  /** Nectar cell that can still receive foraged nectar (no honey in cell). */
  private findNectarCellForDeposit(): import("excalibur").Entity | undefined {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (nectarCellCanAcceptNectarDeposit(st)) {
        return e;
      }
    }
    return undefined;
  }

  private updateForage(
    ent: import("excalibur").Entity,
    job: JobComponent,
    res: ColonyResourcesComponent,
    elapsed: number,
  ): void {
    const beeId = job.reservedBeeIds[0];
    const bee = beeId ? findEntityById(this.world, beeId) : undefined;
    if (!bee) {
      return;
    }
    const deposit = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
    const out = vec(job.scratchX, job.scratchY);
    if (job.foragePhase === "outbound") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const to = out.sub(bee.pos);
      if (to.size < 12) {
        job.foragePhase = "wait";
        job.forageWaitMs = COLONY.forageWaitMs;
      } else {
        bee.pos = bee.pos.add(to.normalize().scale(step));
      }
    } else if (job.foragePhase === "wait") {
      job.forageWaitMs -= elapsed;
      if (job.forageWaitMs <= 0) {
        job.foragePhase = "return";
        if (job.kind === "foragePollen") {
          job.carryPayload = "pollen";
        } else if (job.kind === "forageNectar") {
          job.carryPayload = "nectar";
        } else {
          job.carryPayload = "water";
        }
      }
    } else if (job.foragePhase === "return") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const to = deposit.sub(bee.pos);
      if (to.size < 18) {
        if (job.carryPayload === "pollen") {
          const cellKey = hiveKey({
            q: job.targetQ,
            r: job.targetR,
            level: job.targetLevel,
          });
          const cellEnt = this.colony.getCellAt(cellKey);
          if (cellEnt) {
            const st = cellEnt.get(CellStateComponent)!;
            st.pollenStored = Math.min(
              COLONY.pollenCellCapacity,
              st.pollenStored + 12,
            );
          }
        } else if (job.carryPayload === "nectar") {
          const cellKey = hiveKey({
            q: job.targetQ,
            r: job.targetR,
            level: job.targetLevel,
          });
          const cellEnt = this.colony.getCellAt(cellKey);
          if (cellEnt) {
            const st = cellEnt.get(CellStateComponent)!;
            if (nectarCellCanAcceptNectarDeposit(st)) {
              st.nectarStored = Math.min(
                COLONY.nectarCellCapacity,
                st.nectarStored + 10,
              );
            }
          }
        }
        bee.get(BeeCarryComponent)!.carry = "none";
        job.status = "done";
        releaseJob(this.world, job);
        ent.kill();
      } else {
        bee.pos = bee.pos.add(to.normalize().scale(step));
      }
    }
  }

  private updateHoney(
    ent: import("excalibur").Entity,
    job: JobComponent,
    elapsed: number,
  ): void {
    const key = hiveKey({
      q: job.targetQ,
      r: job.targetR,
      level: job.targetLevel,
    });
    const cellEnt = this.colony.getCellAt(key);
    if (!cellEnt) {
      return;
    }
    const st = cellEnt.get(CellStateComponent)!;
    if (st.honeyProcessingDirty) {
      job.status = "done";
      releaseJob(this.world, job);
      ent.kill();
      return;
    }
    const center = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
    const beeId = job.reservedBeeIds[0];
    const bee = beeId ? findEntityById(this.world, beeId) : undefined;
    if (!bee || bee.pos.sub(center).size > 50) {
      return;
    }
    const rate = COLONY.honeyProcessRatePerSec * (elapsed / 1000);
    st.honeyProcessingProgress += rate;
    if (st.honeyProcessingProgress >= 1) {
      const convert = Math.min(st.nectarStored, COLONY.nectarCellCapacity);
      st.honeyStored = Math.min(COLONY.honeyCellCapacity, st.honeyStored + convert);
      st.nectarStored = 0;
      st.honeyProcessingProgress = 0;
      st.honeyProcessingDirty = false;
      job.status = "done";
      releaseJob(this.world, job);
      ent.kill();
    }
  }

  private checkFullNectarCells(): void {
    for (const [, ent] of this.colony.cellsByKey) {
      const st = ent.get(CellStateComponent)!;
      const coord = ent.get(CellCoordComponent)!;
      if (
        nectarCellReadyForHoneyProcessing(st) &&
        !this.hasHoneyJobAt(coord)
      ) {
        st.honeyProcessingProgress = 0;
        st.honeyProcessingDirty = false;
        const j = new JobComponent(
          "honeyProcess",
          JobPriority.honeyProcess,
          coord.q,
          coord.r,
          coord.level,
          1,
        );
        this.colony.createJob(j);
      }
    }
  }

  private hasHoneyJobAt(coord: CellCoordComponent): boolean {
    const key = hiveKey({
      q: coord.q,
      r: coord.r,
      level: coord.level,
    });
    for (const e of this.world.entities) {
      const j = e.get(JobComponent);
      if (
        j &&
        j.kind === "honeyProcess" &&
        j.status !== "done" &&
        hiveKey({
          q: j.targetQ,
          r: j.targetR,
          level: j.targetLevel,
        }) === key
      ) {
        return true;
      }
    }
    return false;
  }
}
