import { System, SystemPriority, SystemType, vec, type World } from "excalibur";
import {
  BeeCarryComponent,
  BeeLevelComponent,
  BeeRoleComponent,
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
import { releaseJobBees } from "../job-release";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJob = (world: World, job: JobComponent): void => {
  releaseJobBees(world, job);
};

const countOpenJobsByKind = (world: World, kind: JobComponent["kind"]): number =>
  world.entities.filter((e) => {
    const j = e.get(JobComponent);
    return j && j.kind === kind && j.status !== "done";
  }).length;

type DepositPick = { key: string; q: number; r: number; level: number };

/**
 * Foraging (pollen/nectar/water), deposit legs, and honey processing.
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
    const idleWorkers = this.colony.scene.actors.filter((a) => {
      const role = a.get(BeeRoleComponent);
      const w = a.get(BeeWorkComponent);
      return (
        role?.role === "worker" &&
        w?.availability === "available" &&
        w.currentJobEntityId == null
      );
    }).length;
    if (idleWorkers > 0) {
      const pollenHasCapacity = this.anyPollenDepositCapacity();
      const nectarHasCapacity = this.anyNectarDepositCapacity();
      let openPollen = countOpenJobsByKind(this.world, "foragePollen");
      let openNectar = countOpenJobsByKind(this.world, "forageNectar");
      const openTotal = openPollen + openNectar;
      const toCreate = Math.max(0, idleWorkers - openTotal);
      for (let i = 0; i < toCreate; i++) {
        let kind: "foragePollen" | "forageNectar" | null = null;
        if (pollenHasCapacity && nectarHasCapacity) {
          kind = openPollen <= openNectar ? "foragePollen" : "forageNectar";
        } else if (pollenHasCapacity) {
          kind = "foragePollen";
        } else if (nectarHasCapacity) {
          kind = "forageNectar";
        }
        if (!kind) {
          break;
        }
        const j = new JobComponent(
          kind,
          kind === "foragePollen" ? JobPriority.foragePollen : JobPriority.forageNectar,
          0,
          0,
          0,
          1,
        );
        j.foragePhase = "outbound";
        if (kind === "foragePollen") {
          j.scratchX = 200;
          j.scratchY = -180;
          openPollen += 1;
        } else {
          j.scratchX = -220;
          j.scratchY = 160;
          openNectar += 1;
        }
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

  private anyPollenDepositCapacity(): boolean {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (
        st.built &&
        st.cellType === "pollen" &&
        st.pollenStored < COLONY.pollenCellCapacity
      ) {
        return true;
      }
    }
    return false;
  }

  private anyNectarDepositCapacity(): boolean {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (st.built && nectarCellCanAcceptNectarDeposit(st)) {
        return true;
      }
    }
    return false;
  }

  private findNearestPollenDeposit(
    beeWorldX: number,
    beeWorldY: number,
    level: number,
  ): DepositPick | null {
    let best: DepositPick | null = null;
    let bestD = Infinity;
    for (const [, e] of this.colony.cellsByKey) {
      const coord = e.get(CellCoordComponent)!;
      if (coord.level !== level) {
        continue;
      }
      const st = e.get(CellStateComponent)!;
      if (
        !st.built ||
        st.cellType !== "pollen" ||
        st.pollenStored >= COLONY.pollenCellCapacity
      ) {
        continue;
      }
      const c = hexToWorld({ q: coord.q, r: coord.r }, COLONY.hexSize);
      const d = Math.hypot(c.x - beeWorldX, c.y - beeWorldY);
      if (d < bestD) {
        bestD = d;
        best = {
          key: hiveKey({ q: coord.q, r: coord.r, level: coord.level }),
          q: coord.q,
          r: coord.r,
          level: coord.level,
        };
      }
    }
    return best;
  }

  private findNearestNectarDeposit(
    beeWorldX: number,
    beeWorldY: number,
    level: number,
  ): DepositPick | null {
    let best: DepositPick | null = null;
    let bestD = Infinity;
    for (const [, e] of this.colony.cellsByKey) {
      const coord = e.get(CellCoordComponent)!;
      if (coord.level !== level) {
        continue;
      }
      const st = e.get(CellStateComponent)!;
      if (!st.built || !nectarCellCanAcceptNectarDeposit(st)) {
        continue;
      }
      const c = hexToWorld({ q: coord.q, r: coord.r }, COLONY.hexSize);
      const d = Math.hypot(c.x - beeWorldX, c.y - beeWorldY);
      if (d < bestD) {
        bestD = d;
        best = {
          key: hiveKey({ q: coord.q, r: coord.r, level: coord.level }),
          q: coord.q,
          r: coord.r,
          level: coord.level,
        };
      }
    }
    return best;
  }

  private beginDepositPhase(job: JobComponent, bee: import("excalibur").Actor): void {
    const lvl = bee.get(BeeLevelComponent)!.level;
    const pick =
      job.kind === "foragePollen"
        ? this.findNearestPollenDeposit(bee.pos.x, bee.pos.y, lvl)
        : job.kind === "forageNectar"
          ? this.findNearestNectarDeposit(bee.pos.x, bee.pos.y, lvl)
          : null;
    if (!pick) {
      job.foragePhase = "capacityWait";
      job.forageCapacityPollMs = COLONY.forageCapacityPollIntervalMs;
      job.depositTargetKey = null;
      return;
    }
    job.depositTargetKey = pick.key;
    job.targetQ = pick.q;
    job.targetR = pick.r;
    job.targetLevel = pick.level;
    job.foragePhase = "depositing";
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
    const hiveReturn = hexToWorld({ q: 0, r: 0 }, COLONY.hexSize);
    const out = vec(job.scratchX, job.scratchY);

    if (job.kind === "forageWater") {
      this.updateWaterForage(ent, job, bee, hiveReturn, elapsed);
      return;
    }

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
        } else {
          job.carryPayload = "nectar";
        }
      }
    } else if (job.foragePhase === "return") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const to = hiveReturn.sub(bee.pos);
      if (to.size < 18) {
        this.beginDepositPhase(job, bee);
      } else {
        bee.pos = bee.pos.add(to.normalize().scale(step));
      }
    } else if (job.foragePhase === "capacityWait") {
      job.forageCapacityPollMs -= elapsed;
      if (job.forageCapacityPollMs > 0) {
        return;
      }
      job.forageCapacityPollMs = COLONY.forageCapacityPollIntervalMs;
      this.beginDepositPhase(job, bee);
    } else if (job.foragePhase === "depositing") {
      const key = job.depositTargetKey;
      if (!key) {
        this.beginDepositPhase(job, bee);
        return;
      }
      const cellEnt = this.colony.getCellAt(key);
      if (!cellEnt) {
        this.beginDepositPhase(job, bee);
        return;
      }
      const coord = cellEnt.get(CellCoordComponent)!;
      const dest = hexToWorld({ q: coord.q, r: coord.r }, COLONY.hexSize);
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const to = dest.sub(bee.pos);
      if (to.size < 18) {
        if (job.carryPayload === "pollen") {
          const st = cellEnt.get(CellStateComponent)!;
          st.pollenStored = Math.min(
            COLONY.pollenCellCapacity,
            st.pollenStored + COLONY.foragePollenDepositAmount,
          );
        } else if (job.carryPayload === "nectar") {
          const st = cellEnt.get(CellStateComponent)!;
          if (nectarCellCanAcceptNectarDeposit(st)) {
            st.nectarStored = Math.min(
              COLONY.nectarCellCapacity,
              st.nectarStored + COLONY.forageNectarDepositAmount,
            );
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

  private updateWaterForage(
    ent: import("excalibur").Entity,
    job: JobComponent,
    bee: import("excalibur").Actor,
    deposit: import("excalibur").Vector,
    elapsed: number,
  ): void {
    const out = vec(job.scratchX, job.scratchY);
    if (job.foragePhase === "outbound") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const to = out.sub(bee.pos);
      if (to.size < 12) {
        job.foragePhase = "wait";
        job.forageWaitMs = COLONY.waterForageMs;
      } else {
        bee.pos = bee.pos.add(to.normalize().scale(step));
      }
    } else if (job.foragePhase === "wait") {
      job.forageWaitMs -= elapsed;
      if (job.forageWaitMs <= 0) {
        job.foragePhase = "return";
        job.carryPayload = "water";
      }
    } else if (job.foragePhase === "return") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const to = deposit.sub(bee.pos);
      if (to.size < 18) {
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
      if (nectarCellReadyForHoneyProcessing(st) && !this.hasHoneyJobAt(coord)) {
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
