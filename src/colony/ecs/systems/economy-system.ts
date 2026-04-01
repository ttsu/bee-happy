import { System, SystemPriority, SystemType, vec, type World } from "excalibur";
import {
  BeeCarryComponent,
  BeeLevelComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyTimeComponent,
  JobComponent,
  HoneyRunComponent,
  YearlyStatsComponent,
} from "../components/colony-components";
import { getActiveColonyConstants } from "../../colony-active-constants";
import type { ColonyRuntime } from "../../colony-runtime";
import {
  anyNectarDepositCapacity,
  anyPollenDepositCapacity,
  findNearestNectarDeposit,
  findNearestPollenDeposit,
} from "../../economy/deposit-queries";
import { hasHoneyJobAtCell } from "../../economy/honey-job-queries";
import {
  countOpenJobsByKind,
  findEntityById,
  releaseJob,
} from "../../economy/job-queries";
import { cancelWinterForageJobs } from "../../economy/winter-forage";
import { hiveKey, type HiveCoord } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import { findHexPathWorldPointsWithLevels } from "../../pathfinding/hex-path";
import { beeStartHiveCoord } from "../../self-feed-target";
import { JobPriority } from "../../job-priority";
import {
  nectarCellCanAcceptNectarDeposit,
  nectarCellReadyForHoneyProcessing,
} from "../../nectar-cell-helpers";
import { getSeasonForColonyDay } from "../../seasons";
import {
  advanceBeeVerticalTransition,
  startLevelTransitionTowardActorIfNeeded,
} from "../../bee-vertical-move";

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

    const C = getActiveColonyConstants();
    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    const msPerBeeDay = C.workerLifespanMs / 50;
    const currentColonyDay = time
      ? Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1
      : 1;
    const { season } = getSeasonForColonyDay(currentColonyDay);

    if (season === "Winter") {
      cancelWinterForageJobs(this.world);
    }

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
      const pollenHasCapacity = anyPollenDepositCapacity(this.colony);
      const nectarHasCapacity = anyNectarDepositCapacity(this.colony);
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
        this.updateForage(ent, job, elapsed);
      } else if (job.kind === "honeyProcess") {
        this.updateHoney(ent, job, elapsed);
      }
    }

    this.checkFullNectarCells();
  }

  private beginDepositPhase(job: JobComponent, bee: import("excalibur").Actor): void {
    const C = getActiveColonyConstants();
    const pick =
      job.kind === "foragePollen"
        ? findNearestPollenDeposit(this.colony, bee.pos.x, bee.pos.y)
        : job.kind === "forageNectar"
          ? findNearestNectarDeposit(this.colony, bee.pos.x, bee.pos.y)
          : null;
    if (!pick) {
      job.foragePhase = "capacityWait";
      job.forageCapacityPollMs = C.forageCapacityPollIntervalMs;
      job.depositTargetKey = null;
      job.pathPoints = [];
      job.pathLevels = [];
      return;
    }
    job.depositTargetKey = pick.key;
    job.targetQ = pick.q;
    job.targetR = pick.r;
    job.targetLevel = pick.level;
    const w = bee.get(BeeWorkComponent)!;
    const lvl = bee.get(BeeLevelComponent)!.level;
    const start: HiveCoord = beeStartHiveCoord(bee.pos, lvl);
    const goal: HiveCoord = { q: pick.q, r: pick.r, level: pick.level };
    const waypoints = findHexPathWorldPointsWithLevels(
      start,
      goal,
      C.hexSize,
      this.colony.builtByLevel(),
    );
    job.pathPoints = waypoints.map((p) => p.world);
    job.pathLevels = waypoints.map((p) => p.level);
    w.pathIndex = 0;
    job.foragePhase = "depositing";
  }

  private updateForage(
    ent: import("excalibur").Entity,
    job: JobComponent,
    elapsed: number,
  ): void {
    const C = getActiveColonyConstants();
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
      const step = C.beeSpeed * 1.2 * elapsed;
      const to = out.sub(bee.pos);
      if (to.size < 12) {
        job.foragePhase = "wait";
        job.forageWaitMs = C.forageWaitMs;
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
      const step = C.beeSpeed * 1.2 * elapsed;
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
        const dest = hexToWorld({ q: coord.q, r: coord.r }, C.hexSize);
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
      job.forageCapacityPollMs = C.forageCapacityPollIntervalMs;
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
      const w = bee.get(BeeWorkComponent)!;
      if (job.pathPoints.length > 0) {
        const lastPt = job.pathPoints[job.pathPoints.length - 1]!;
        const pathDone =
          w.pathIndex >= job.pathPoints.length - 1 && bee.pos.sub(lastPt).size < 20;
        if (!pathDone) {
          return;
        }
      }
      const coord = cellEnt.get(CellCoordComponent)!;
      const beeLvl = bee.get(BeeLevelComponent);
      if (!beeLvl || beeLvl.level !== coord.level) {
        return;
      }
      const dest = hexToWorld({ q: coord.q, r: coord.r }, C.hexSize);
      const step = C.beeSpeed * 1.2 * elapsed;
      const to = dest.sub(bee.pos);
      if (to.size < 18) {
        const yearlyStats = this.colony.controllerEntity.get(YearlyStatsComponent);
        if (job.carryPayload === "pollen") {
          const st = cellEnt.get(CellStateComponent)!;
          st.pollenStored = Math.min(
            C.pollenCellCapacity,
            st.pollenStored + C.foragePollenDepositAmount,
          );
          if (yearlyStats) {
            yearlyStats.pollenCollectedTotal += C.foragePollenDepositAmount;
          }
        } else if (job.carryPayload === "nectar") {
          const st = cellEnt.get(CellStateComponent)!;
          if (nectarCellCanAcceptNectarDeposit(st)) {
            const before = st.nectarStored;
            st.nectarStored = Math.min(
              C.nectarCellCapacity,
              st.nectarStored + C.forageNectarDepositAmount,
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
    const C = getActiveColonyConstants();
    const out = vec(job.scratchX, job.scratchY);
    if (job.foragePhase === "outbound") {
      const step = C.beeSpeed * 1.2 * elapsed;
      const to = out.sub(bee.pos);
      if (to.size < 12) {
        job.foragePhase = "wait";
        job.forageWaitMs = C.waterForageMs;
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
            a.id !== bee.id && (needs ? needs.thirst > C.thirstCareThreshold : false)
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
      const step = C.beeSpeed * 1.2 * elapsed;
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

      if (advanceBeeVerticalTransition(bee, elapsed)) {
        bee.pos = target.pos.clone();
        return;
      }
      const to = target.pos.sub(bee.pos);
      if (to.size < 18) {
        const wl = bee.get(BeeLevelComponent)!;
        const tl = target.get(BeeLevelComponent)?.level;
        if (tl != null && wl.level !== tl) {
          bee.pos = target.pos.clone();
          startLevelTransitionTowardActorIfNeeded(bee, target);
          return;
        }
        const n = target.get(BeeNeedsComponent)!;
        n.thirst = Math.max(0, n.thirst - C.thirstRelief);
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
    const C = getActiveColonyConstants();
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
    const center = hexToWorld({ q: job.targetQ, r: job.targetR }, C.hexSize);
    const beeId = job.reservedBeeIds[0];
    const bee = beeId ? findEntityById(this.world, beeId) : undefined;
    const bl = bee?.get(BeeLevelComponent);
    if (!bee || bee.pos.sub(center).size > 50 || !bl || bl.level !== job.targetLevel) {
      return;
    }
    const rate = C.honeyProcessRatePerSec * (elapsed / 1000);
    st.honeyProcessingProgress += rate;
    if (st.honeyProcessingProgress >= 1) {
      const convert = Math.min(st.nectarStored, C.nectarCellCapacity);
      const yearly = this.colony.controllerEntity.get(YearlyStatsComponent);
      if (yearly) {
        yearly.honeyProcessedTotal += convert;
      }
      const honeyRun = this.colony.controllerEntity.get(HoneyRunComponent);
      if (honeyRun) {
        honeyRun.honeyProducedThisRun += convert;
      }
      st.honeyStored = Math.min(C.honeyCellCapacity, st.honeyStored + convert);
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
      if (
        nectarCellReadyForHoneyProcessing(st) &&
        !hasHoneyJobAtCell(this.world, coord)
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
}
