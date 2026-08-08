import { COLONY } from "./constants";
import { getActiveColonyConstants } from "./colony-active-constants";
import type { ColonyUiSnapshot } from "./events/colony-events";
import {
  BeeNeedsComponent,
  BeeRoleComponent,
  CellStateComponent,
  ColonyTimeComponent,
  YearlyStatsComponent,
} from "./ecs/components/colony-components";
import { getSeasonForColonyDay } from "./seasons";
import type { ColonyRuntime } from "./colony-runtime";

/**
 * Builds the throttled HUD / React payload from the current simulation state.
 */
export const buildColonyUiSnapshot = (colony: ColonyRuntime): ColonyUiSnapshot => {
  const C = getActiveColonyConstants();
  let workers = 0;
  let queens = 0;
  for (const a of colony.scene.actors) {
    const br = a.get(BeeRoleComponent);
    if (!br) {
      continue;
    }
    if (br.role === "queen") {
      queens += 1;
    } else {
      workers += 1;
    }
  }
  let happy = 0;
  let totalNeeds = 0;
  for (const a of colony.scene.actors) {
    const n = a.get(BeeNeedsComponent);
    if (!n) {
      continue;
    }
    totalNeeds += 1;
    if (n.hunger <= COLONY.happyHungerMax && n.thirst <= COLONY.happyThirstMax) {
      happy += 1;
    }
  }
  let broodOccupied = 0;
  let broodTotal = 0;
  let broodPupae = 0;
  let broodLarvae = 0;
  let broodEmpty = 0;
  let pollenCells = 0;
  let nectarCells = 0;
  for (const [, e] of colony.cellsByKey) {
    const st = e.get(CellStateComponent)!;
    if (!st.built) {
      continue;
    }
    if (st.cellType === "pollen") {
      pollenCells += 1;
    } else if (st.cellType === "nectar") {
      nectarCells += 1;
    }
    if (st.cellType !== "brood") {
      continue;
    }
    broodTotal += 1;
    if (st.stage === "sealed") {
      broodPupae += 1;
      broodOccupied += 1;
    } else if (st.stage === "larvae" || st.stage === "egg") {
      // Eggs share the larvae stack segment in the expanded HUD.
      broodLarvae += 1;
      broodOccupied += 1;
    } else if (st.stage === "empty" || st.stage === "cleaning") {
      // Cleaning shares the empty stack segment (cell freeing up).
      broodEmpty += 1;
      if (st.stage === "cleaning") {
        broodOccupied += 1;
      }
    } else {
      // Unexpected built brood stage — keep stack segments summing to broodTotal.
      broodEmpty += 1;
    }
  }
  const time = colony.controllerEntity.get(ColonyTimeComponent)!;
  const yearly = colony.controllerEntity.get(YearlyStatsComponent)!;
  const msPerBeeDay = COLONY.workerLifespanMs / 50;
  const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;
  const daysPerSeason = colony.daysPerSeason;
  const { season: currentColonySeason } = getSeasonForColonyDay(
    currentColonyDay,
    daysPerSeason,
  );
  return {
    beesTotal: workers + queens,
    workers,
    queens,
    pollen: colony.sumPollenStored(),
    pollenCapacity: pollenCells * C.pollenCellCapacity,
    honey: colony.sumHoneyStored(),
    honeyCapacity: nectarCells * C.honeyCellCapacity,
    nectar: colony.sumNectarStored(),
    nectarCapacity: nectarCells * C.nectarCellCapacity,
    beeswax: colony.getBeeswaxStored(),
    beeswaxCapacity: colony.getBeeswaxCapacity(),
    happinessPct: Math.min(
      100,
      Math.max(0, totalNeeds > 0 ? Math.round((happy / totalNeeds) * 100) : 100),
    ),
    broodOccupied,
    broodTotal,
    broodPupae,
    broodLarvae,
    broodEmpty,
    activeLevel: colony.activeLevel,
    transitionOverlay: colony.transitionOverlay,
    pendingCellTypeKey: colony.pendingCellTypeKey,
    pendingCellTypeAnchor: colony.getPendingCellTypeAnchorPage(),
    cellTypeChangeError: colony.cellTypeChangeError,
    cellTypeChangeDiscardTarget: colony.cellTypeChangeDiscardTarget,
    selectedPlacementCellType: colony.selectedPlacementCellType,
    currentColonyDay,
    currentColonySeason,
    daysPerSeason,
    lineageSystemEnabled: colony.lineageSystemEnabled,
    intrudersEnabled: colony.intrudersEnabled,
    yearNumber: yearly.yearNumber,
    isYearReviewOpen: yearly.isYearReviewOpen,
    yearlyReviewStats: {
      honeyProcessedTotal: yearly.honeyProcessedTotal,
      nectarCollectedTotal: yearly.nectarCollectedTotal,
      pollenCollectedTotal: yearly.pollenCollectedTotal,
      beesHatchedTotal: yearly.beesHatchedTotal,
      remainingBees: yearly.remainingBeesAtYearEnd,
      happyBeeSecondsTotal: yearly.happyBeeSecondsTotal,
    },
    successionModal: colony.successionModal,
    optionalSuccessionAvailable:
      colony.lineageSystemEnabled &&
      colony.successionModal == null &&
      queens > 0 &&
      workers + queens > COLONY.successionOptionalBeeThreshold,
  };
};
