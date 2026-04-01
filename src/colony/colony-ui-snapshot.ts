import { COLONY } from "./constants";
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
  for (const [, e] of colony.cellsByKey) {
    const st = e.get(CellStateComponent)!;
    if (st.cellType !== "brood" || !st.built) {
      continue;
    }
    broodTotal += 1;
    if (
      st.stage === "egg" ||
      st.stage === "larvae" ||
      st.stage === "sealed" ||
      st.stage === "cleaning"
    ) {
      broodOccupied += 1;
    }
  }
  const time = colony.controllerEntity.get(ColonyTimeComponent)!;
  const yearly = colony.controllerEntity.get(YearlyStatsComponent)!;
  const msPerBeeDay = COLONY.workerLifespanMs / 50;
  const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;
  const { season: currentColonySeason } = getSeasonForColonyDay(currentColonyDay);
  return {
    beesTotal: workers + queens,
    workers,
    queens,
    pollen: colony.sumPollenStored(),
    honey: colony.sumHoneyStored(),
    nectar: colony.sumNectarStored(),
    happinessPct: Math.min(
      100,
      Math.max(0, totalNeeds > 0 ? Math.round((happy / totalNeeds) * 100) : 100),
    ),
    broodOccupied,
    broodTotal,
    activeLevel: colony.activeLevel,
    transitionOverlay: colony.transitionOverlay,
    pendingCellTypeKey: colony.pendingCellTypeKey,
    pendingCellTypeAnchor: colony.getPendingCellTypeAnchorPage(),
    cellTypeChangeError: colony.cellTypeChangeError,
    cellTypeChangeDiscardTarget: colony.cellTypeChangeDiscardTarget,
    currentColonyDay,
    currentColonySeason,
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
      colony.successionModal == null &&
      queens > 0 &&
      workers + queens > COLONY.successionOptionalBeeThreshold,
  };
};
