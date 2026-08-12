import { Entity, vec } from "excalibur";
import { refreshActiveColonyConstantsFromMeta } from "./colony-active-constants";
import { COLONY } from "./constants";
import {
  ActiveLevelComponent,
  BeeRoleComponent,
  BeeswaxComponent,
  ColonyTimeComponent,
  HoneyRunComponent,
  JobComponent,
  QueenTimerComponent,
  RoyalJellyComponent,
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
import { beeswaxCapacity } from "./beeswax";
import { getActiveColonyConstants } from "./colony-active-constants";
import { buildColonyUiSnapshot } from "./colony-ui-snapshot";
import type { ColonyRuntime } from "./colony-runtime";

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
 * Keeps comb and colony timeline; kills jobs and bees; clears royal jelly; spawns new queen and remaining workers.
 *
 * @param workersToKeep - From `Math.floor((workers + queens) / 2)` before any bees are removed.
 */
const applySuccessionKeepNestInColony = (
  colony: ColonyRuntime,
  royalJellySpentInShop: number,
  workersToKeep: number,
): void => {
  colony.deductRoyalJellyAfterSuccession(royalJellySpentInShop);

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

  const waxSrc = old.get(BeeswaxComponent);
  const wax = new BeeswaxComponent();
  if (waxSrc) {
    wax.stored = waxSrc.stored;
  }

  const jelly = new RoyalJellyComponent();

  colony.controllerEntity = new Entity({
    name: "colony-controller",
    components: [
      active,
      new QueenTimerComponent(),
      time,
      yearly,
      new HoneyRunComponent(),
      wax,
      jelly,
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

  const C = getActiveColonyConstants();
  wax.stored = Math.min(wax.stored, beeswaxCapacity(colony.countWorkers(), C));

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
  colony.successionModal = {
    mandatory: false,
    reason: "hiveExpanded",
    royalJellyBudget: colony.getRoyalJellyStored(),
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
  colony.successionModal = {
    mandatory: false,
    reason: "hiveExpanded",
    royalJellyBudget: colony.getRoyalJellyStored(),
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
  colony.successionModal = {
    mandatory: true,
    reason,
    royalJellyBudget: colony.getRoyalJellyStored(),
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
 * Persists lineage meta, clears royal jelly after shop spend, and keeps the nest with half the bees (new queen).
 *
 * @param royalJellySpentInShop - Royal jelly spent in the succession shop UI.
 */
export const applySuccessionChoice = (
  colony: ColonyRuntime,
  entry: Omit<LineageEntry, "generationIndex">,
  royalJellySpentInShop: number,
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
  applySuccessionKeepNestInColony(colony, royalJellySpentInShop, workersToKeep);
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
      new BeeswaxComponent(),
      new RoyalJellyComponent(),
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
