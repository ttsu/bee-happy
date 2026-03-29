import { System, SystemPriority, SystemType, vec, type World } from "excalibur";
import {
  BeeCarryComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyResourcesComponent,
  ColonyTimeComponent,
  JobComponent,
  YearlyStatsComponent,
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
import {
  cellBlocksNectarDepositDueToRetype,
  cellBlocksPollenDepositDueToRetype,
} from "../../cell-retype-capacity";
import { releaseJobBees } from "../job-release";
import { getSeasonForColonyDay } from "../../seasons";

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
    if (this.colony.isSimulationPaused()) {
      return;
    }

    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    const msPerBeeDay = COLONY.workerLifespanMs / 50;
    const currentColonyDay = time
      ? Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1
      : 1;
    const { season } = getSeasonForColonyDay(currentColonyDay);

    if (season === "Winter") {
      for (const ent of this.world.entities) {
        const job = ent.get(JobComponent);
        if (!job || job.status === "done") {
          continue;
        }
        if (job.kind === "foragePollen" || job.kind === "forageNectar") {
          releaseJob(this.world, job);
          ent.kill();
        }
      }
    }

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
    if (idleWorkers > 0 && season !== "Winter") {
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
    for (const [key, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (
        st.built &&
        st.cellType === "pollen" &&
        st.pollenStored < COLONY.pollenCellCapacity &&
        !cellBlocksPollenDepositDueToRetype(key, st)
      ) {
        return true;
      }
    }
    return false;
  }

  private anyNectarDepositCapacity(): boolean {
    for (const [key, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (
        st.built &&
        nectarCellCanAcceptNectarDeposit(st) &&
        !cellBlocksNectarDepositDueToRetype(key, st)
      ) {
        return true;
      }
    }
    return false;
  }

  private findNearestPollenDeposit(
    beeWorldX: number,
    beeWorldY: number,
  ): DepositPick | null {
    let best: DepositPick | null = null;
    let bestD = Infinity;
    for (const [cellKey, e] of this.colony.cellsByKey) {
      const coord = e.get(CellCoordComponent)!;
      const st = e.get(CellStateComponent)!;
      if (
        !st.built ||
        st.cellType !== "pollen" ||
        st.pollenStored >= COLONY.pollenCellCapacity ||
        cellBlocksPollenDepositDueToRetype(cellKey, st)
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
  ): DepositPick | null {
    let best: DepositPick | null = null;
    let bestD = Infinity;
    for (const [cellKey, e] of this.colony.cellsByKey) {
      const coord = e.get(CellCoordComponent)!;
      const st = e.get(CellStateComponent)!;
      if (
        !st.built ||
        !nectarCellCanAcceptNectarDeposit(st) ||
        cellBlocksNectarDepositDueToRetype(cellKey, st)
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

  private beginDepositPhase(job: JobComponent, bee: import("excalibur").Actor): void {
    const pick =
      job.kind === "foragePollen"
        ? this.findNearestPollenDeposit(bee.pos.x, bee.pos.y)
        : job.kind === "forageNectar"
          ? this.findNearestNectarDeposit(bee.pos.x, bee.pos.y)
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
    const out = vec(job.scratchX, job.scratchY);

    if (job.kind === "forageWater") {
      this.updateWaterForage(ent, job, bee, elapsed);
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
        if (job.kind === "foragePollen") {
          job.carryPayload = "pollen";
        } else {
          job.carryPayload = "nectar";
        }
        // Select a deposit cell now, so the bee flies directly there.
        this.beginDepositPhase(job, bee);
      }
    } else if (job.foragePhase === "return") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const key = job.depositTargetKey;
      if (key) {
        const cellEnt = this.colony.getCellAt(key);
        if (!cellEnt) {
          // Fallback for stale target keys.
          job.depositTargetKey = null;
          this.beginDepositPhase(job, bee);
          return;
        }
        const coord = cellEnt.get(CellCoordComponent)!;
        const dest = hexToWorld({ q: coord.q, r: coord.r }, COLONY.hexSize);
        const to = dest.sub(bee.pos);
        if (to.size < 18) {
          job.foragePhase = "depositing";
        } else {
          bee.pos = bee.pos.add(to.normalize().scale(step));
        }
      } else {
        // If we entered `return` without a target, don't fly to the hive center first.
        // Instead, pick a deposit target now (or capacity-wait).
        this.beginDepositPhase(job, bee);
        return;
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
        const yearlyStats = this.colony.controllerEntity.get(YearlyStatsComponent);
        if (job.carryPayload === "pollen") {
          const st = cellEnt.get(CellStateComponent)!;
          st.pollenStored = Math.min(
            COLONY.pollenCellCapacity,
            st.pollenStored + COLONY.foragePollenDepositAmount,
          );
          if (yearlyStats) {
            yearlyStats.pollenCollectedTotal += COLONY.foragePollenDepositAmount;
          }
        } else if (job.carryPayload === "nectar") {
          const st = cellEnt.get(CellStateComponent)!;
          if (nectarCellCanAcceptNectarDeposit(st)) {
            const before = st.nectarStored;
            st.nectarStored = Math.min(
              COLONY.nectarCellCapacity,
              st.nectarStored + COLONY.forageNectarDepositAmount,
            );
            if (yearlyStats) {
              yearlyStats.nectarCollectedTotal += st.nectarStored - before;
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

  private updateWaterForage(
    ent: import("excalibur").Entity,
    job: JobComponent,
    bee: import("excalibur").Actor,
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

        // Pick a thirsty target once per return-leg, then keep flying toward it.
        const thirstyActors = this.colony.scene.actors.filter((a) => {
          const needs = a.get(BeeNeedsComponent);
          return (
            a.id !== bee.id &&
            (needs ? needs.thirst > COLONY.thirstCareThreshold : false)
          );
        });
        const candidates =
          thirstyActors.length > 0
            ? thirstyActors
            : this.colony.scene.actors.filter(
                (a) => a.id !== bee.id && a.get(BeeNeedsComponent),
              );

        let best: import("excalibur").Actor | null = null;
        if (thirstyActors.length > 0) {
          // Nearest thirsty wins.
          let bestD = Infinity;
          for (const a of candidates) {
            const d = a.pos.sub(bee.pos).size;
            if (d < bestD) {
              bestD = d;
              best = a;
            }
          }
        } else {
          // No one is above threshold: highest thirst wins.
          let bestT = -Infinity;
          for (const a of candidates) {
            const n = a.get(BeeNeedsComponent)!;
            if (n.thirst > bestT) {
              bestT = n.thirst;
              best = a;
            }
          }
        }
        job.adultFeedTargetBeeId = best?.id ?? null;
      }
    } else if (job.foragePhase === "return") {
      const step = COLONY.beeSpeed * 1.2 * elapsed;
      const target = job.adultFeedTargetBeeId
        ? this.colony.scene.actors.find((a) => a.id === job.adultFeedTargetBeeId)
        : undefined;

      if (!target) {
        // Nothing to deliver to; finish safely.
        bee.get(BeeCarryComponent)!.carry = "none";
        job.status = "done";
        releaseJob(this.world, job);
        ent.kill();
        return;
      }

      const to = target.pos.sub(bee.pos);
      if (to.size < 18) {
        const n = target.get(BeeNeedsComponent)!;
        n.thirst = Math.max(0, n.thirst - COLONY.thirstRelief);
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
      const yearly = this.colony.controllerEntity.get(YearlyStatsComponent);
      if (yearly) {
        yearly.honeyProcessedTotal += convert;
      }
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
      if (st.pendingCellType != null) {
        continue;
      }
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
