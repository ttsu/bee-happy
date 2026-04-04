import { Entity, vec } from "excalibur";
import { refreshActiveColonyConstantsFromMeta } from "./colony-active-constants";
import { COLONY } from "./constants";
import {
  ActiveLevelComponent,
  BeeRoleComponent,
  ColonyTimeComponent,
  HoneyRunComponent,
  QueenTimerComponent,
  YearlyStatsComponent,
} from "./ecs/components/colony-components";
import {
  appendLineageEntry,
  readMetaProgressFromStorage,
  writeMetaProgressToStorage,
  type LineageEntry,
  type SuccessionReason,
} from "./meta/meta-progress";
import { seedLevelZero } from "./colony-seed";
import { buildColonyUiSnapshot } from "./colony-ui-snapshot";
import type { ColonyRuntime } from "./colony-runtime";

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
 * Persists lineage meta and resets the colony to a fresh hive (new queen).
 */
export const applySuccessionChoice = (
  colony: ColonyRuntime,
  entry: Omit<LineageEntry, "generationIndex">,
): void => {
  const meta = readMetaProgressFromStorage();
  const snap = buildColonyUiSnapshot(colony);
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
  resetWorldAfterSuccession(colony);
};

/**
 * Clears the simulation and re-seeds level 0 (after lineage write).
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
