import { Entity, vec } from "excalibur";
import { refreshActiveColonyConstantsFromMeta } from "./colony-active-constants";
import { COLONY } from "./constants";
import {
  ActiveLevelComponent,
  BeeRoleComponent,
  CellStateComponent,
  ColonyTimeComponent,
  HoneyRunComponent,
  JobComponent,
  QueenTimerComponent,
  YearlyStatsComponent,
} from "./ecs/components/colony-components";
import { releaseJobBees } from "./ecs/job-release";
import {
  appendLineageEntry,
  readMetaProgressFromStorage,
  writeMetaProgressToStorage,
  type LineageEntry,
  type SuccessionReason,
} from "./meta/meta-progress";
import { seedLevelZero, spawnQueenAndBootstrapWorkers } from "./colony-seed";
import { buildColonyUiSnapshot } from "./colony-ui-snapshot";
import type { ColonyRuntime } from "./colony-runtime";

/**
 * Removes stored honey from built nectar cells (succession shop spend). No-op if amount ≤ 0.
 */
export const deductHoneyFromNectarCells = (
  colony: ColonyRuntime,
  honeyToSpend: number,
): void => {
  if (honeyToSpend <= 0) {
    return;
  }
  let remaining = honeyToSpend;
  for (const [, ent] of colony.cellsByKey) {
    if (remaining <= 0) {
      break;
    }
    const st = ent.get(CellStateComponent)!;
    if (!st.built || st.cellType !== "nectar" || st.honeyStored <= 0) {
      continue;
    }
    const take = Math.min(remaining, st.honeyStored);
    st.honeyStored -= take;
    remaining -= take;
  }
};

const copyYearlyStats = (
  from: YearlyStatsComponent,
  to: YearlyStatsComponent,
): void => {
  to.yearNumber = from.yearNumber;
  to.isYearReviewOpen = from.isYearReviewOpen;
  to.honeyProcessedTotal = from.honeyProcessedTotal;
  to.nectarCollectedTotal = from.nectarCollectedTotal;
  to.pollenCollectedTotal = from.pollenCollectedTotal;
  to.beesHatchedTotal = from.beesHatchedTotal;
  to.happyBeeSecondsTotal = from.happyBeeSecondsTotal;
  to.remainingBeesAtYearEnd = from.remainingBeesAtYearEnd;
};

/**
 * Keeps comb and colony timeline; kills jobs and bees; applies shop honey; spawns new queen and remaining workers.
 *
 * @param workersToKeep - From `Math.floor((workers + queens) / 2)` before any bees are removed.
 */
const applySuccessionKeepNestInColony = (
  colony: ColonyRuntime,
  honeySpentInShop: number,
  workersToKeep: number,
): void => {
  deductHoneyFromNectarCells(colony, honeySpentInShop);

  const world = colony.scene.world;
  const old = colony.controllerEntity;
  const colonyElapsedMs = old.get(ColonyTimeComponent)!.colonyElapsedMs;
  const yearlySrc = old.get(YearlyStatsComponent)!;
  const activeSrc = old.get(ActiveLevelComponent)!;
  const activeLevel = activeSrc.activeLevel;

  for (const e of [...world.entities]) {
    const job = e.get(JobComponent);
    if (job) {
      releaseJobBees(world, job);
      e.kill();
    }
  }

  for (const a of [...colony.scene.actors]) {
    a.kill();
  }

  old.kill();

  const yearly = new YearlyStatsComponent();
  copyYearlyStats(yearlySrc, yearly);

  const active = new ActiveLevelComponent();
  active.activeLevel = activeLevel;
  active.transition = "idle";
  active.pendingLevel = null;
  active.transitionT = 0;

  const time = new ColonyTimeComponent();
  time.colonyElapsedMs = colonyElapsedMs;

  colony.controllerEntity = new Entity({
    name: "colony-controller",
    components: [
      active,
      new QueenTimerComponent(),
      time,
      yearly,
      new HoneyRunComponent(),
    ],
  });
  colony.controllerEntity.addTag("colonyController");
  world.add(colony.controllerEntity);
  colony.controllerEntity.get(QueenTimerComponent)!.layCooldownMs = 3500;

  colony.pendingCellTypeKey = null;
  colony.cellTypeChangeError = null;
  colony.cellTypeChangeDiscardTarget = null;
  colony.selectedPlacementCellType = "brood";
  colony.hoverHiveKey = null;
  colony.transitionOverlay = 0;

  spawnQueenAndBootstrapWorkers(colony, workersToKeep);

  refreshActiveColonyConstantsFromMeta(colony.lineageSystemEnabled);
  colony.emitUiSnapshotImmediate();
};

/**
 * Opens optional succession ignoring bee threshold and queen presence (for dev shortcuts / QA).
 */
export const debugOpenSuccessionOptional = (colony: ColonyRuntime): void => {
  if (!colony.lineageSystemEnabled || colony.successionModal != null) {
    return;
  }
  const snap = buildColonyUiSnapshot(colony);
  const honey = colony.sumHoneyStored();
  colony.successionModal = {
    mandatory: false,
    reason: "hiveExpanded",
    honeyBudget: honey,
    beesTotal: snap.beesTotal,
    colonyDay: snap.currentColonyDay,
  };
  colony.emitUiSnapshotImmediate();
};

/**
 * Opens the optional succession modal (player-initiated while hive is large).
 */
export const requestOptionalSuccession = (colony: ColonyRuntime): void => {
  if (!colony.lineageSystemEnabled || colony.successionModal != null) {
    return;
  }
  const snap = buildColonyUiSnapshot(colony);
  if (snap.queens < 1 || snap.beesTotal <= COLONY.successionOptionalBeeThreshold) {
    return;
  }
  const honey = colony.sumHoneyStored();
  colony.successionModal = {
    mandatory: false,
    reason: "hiveExpanded",
    honeyBudget: honey,
    beesTotal: snap.beesTotal,
    colonyDay: snap.currentColonyDay,
  };
  colony.emitUiSnapshotImmediate();
};

/**
 * Forces mandatory succession (queen death or end of reign).
 */
export const triggerMandatorySuccession = (
  colony: ColonyRuntime,
  reason: SuccessionReason,
): void => {
  if (!colony.lineageSystemEnabled || colony.successionModal != null) {
    return;
  }
  const snap = buildColonyUiSnapshot(colony);
  const honey = colony.sumHoneyStored();
  colony.successionModal = {
    mandatory: true,
    reason,
    honeyBudget: honey,
    beesTotal: snap.beesTotal,
    colonyDay: snap.currentColonyDay,
  };
  for (const a of colony.scene.actors) {
    if (a.get(BeeRoleComponent)?.role === "queen") {
      a.kill();
      break;
    }
  }
  colony.emitUiSnapshotImmediate();
};

export const dismissSuccessionModal = (colony: ColonyRuntime): void => {
  if (colony.successionModal?.mandatory) {
    return;
  }
  colony.successionModal = null;
  colony.emitUiSnapshotImmediate();
};

/**
 * Persists lineage meta, spends succession-shop honey from cells, and keeps the nest with half the bees (new queen).
 *
 * @param honeySpentInShop - Honey deducted from nectar cells (`honeyBudget - honeyLeft` from the modal).
 */
export const applySuccessionChoice = (
  colony: ColonyRuntime,
  entry: Omit<LineageEntry, "generationIndex">,
  honeySpentInShop: number,
): void => {
  const meta = readMetaProgressFromStorage();
  const snap = buildColonyUiSnapshot(colony);
  const workersToKeep = Math.floor((snap.workers + snap.queens) / 2);
  const next = appendLineageEntry(meta, {
    ...entry,
    generationIndex: meta.lineage.length,
  });
  next.lastSuccessionSummary = {
    endedAtIso: new Date().toISOString(),
    colonyDay: snap.currentColonyDay,
    beesTotal: snap.beesTotal,
    honeyProducedThisRun:
      colony.controllerEntity.get(HoneyRunComponent)?.honeyProducedThisRun ?? 0,
    successionReason: entry.successionReason,
  };
  writeMetaProgressToStorage(next);
  colony.successionModal = null;
  applySuccessionKeepNestInColony(colony, honeySpentInShop, workersToKeep);
};

/**
 * Full colony wipe and level-0 re-seed. Normal succession uses {@link applySuccessionChoice} instead (nest preserved).
 */
export const resetWorldAfterSuccession = (colony: ColonyRuntime): void => {
  const world = colony.scene.world;
  for (const e of [...world.entities]) {
    e.kill();
  }
  for (const a of [...colony.scene.actors]) {
    a.kill();
  }
  colony.cellsByKey.clear();
  colony.pendingCellTypeKey = null;
  colony.cellTypeChangeError = null;
  colony.cellTypeChangeDiscardTarget = null;
  colony.selectedPlacementCellType = "brood";
  colony.hoverHiveKey = null;
  colony.transitionOverlay = 0;

  colony.controllerEntity = new Entity({
    name: "colony-controller",
    components: [
      new ActiveLevelComponent(),
      new QueenTimerComponent(),
      new ColonyTimeComponent(),
      new YearlyStatsComponent(),
      new HoneyRunComponent(),
    ],
  });
  colony.controllerEntity.addTag("colonyController");
  world.add(colony.controllerEntity);
  colony.controllerEntity.get(QueenTimerComponent)!.layCooldownMs = 3500;

  colony.resetSeasonForNewColonyAfterSuccession();
  colony.scene.camera.pos = vec(0, 0);
  seedLevelZero(colony, colony.startingWorkers);
  refreshActiveColonyConstantsFromMeta(colony.lineageSystemEnabled);
  colony.emitUiSnapshotImmediate();
};
