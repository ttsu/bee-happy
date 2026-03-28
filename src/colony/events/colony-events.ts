import type { HiveCoord } from "../../grid/hive-levels";
import type { Season } from "../seasons";

/** End-of-year summary numbers shown in the review modal. */
export interface YearlyReviewStats {
  readonly honeyProcessedTotal: number;
  readonly nectarCollectedTotal: number;
  readonly pollenCollectedTotal: number;
  readonly beesHatchedTotal: number;
  readonly remainingBees: number;
  /** Cumulative seconds bees spent happy this year (sum over bees). */
  readonly happyBeeSecondsTotal: number;
}

export type ColonyEvent =
  | { type: "PlacementIntent"; coord: HiveCoord }
  | { type: "CellBuildStarted"; cellKey: string }
  | { type: "CellBuilt"; cellKey: string }
  | { type: "BroodLarvaeReady"; cellKey: string }
  | { type: "BroodFed"; cellKey: string }
  | { type: "BroodWorkerEmerged"; cellKey: string }
  | { type: "LevelChangeRequested"; delta: 1 | -1 }
  | { type: "LevelChangeStarted"; from: number; to: number }
  | { type: "LevelChanged"; level: number }
  | { type: "HoneyProcessingInterrupted"; cellKey: string }
  | { type: "ColonySnapshot"; snapshot: ColonyUiSnapshot };

/** Throttled HUD / React payload. */
export interface ColonyUiSnapshot {
  readonly beesTotal: number;
  readonly workers: number;
  readonly queens: number;
  readonly pollen: number;
  readonly honey: number;
  readonly colonyNectar: number;
  readonly happinessPct: number;
  readonly broodOccupied: number;
  readonly broodTotal: number;
  readonly activeLevel: number;
  readonly transitionOverlay: number;
  readonly pendingCellTypeKey: string | null;
  /** Set when {@link ColonyRuntime.requestCellTypeChange} cannot apply (e.g. honey processing). */
  readonly cellTypeChangeError: string | null;
  /**
   * Matches the cell type button the player must press again to confirm discarding stored goods.
   */
  readonly cellTypeChangeDiscardTarget: "brood" | "pollen" | "nectar" | null;
  /** 1-based colony calendar day (same scale as worker bee-days). */
  readonly currentColonyDay: number;
  /** Current season within the 60-day seasonal cycle. */
  readonly currentColonySeason: Season;
  /** 1-based colony year (increments when the player continues after the year review). */
  readonly yearNumber: number;
  /** When true, the year-end modal is open and simulation is paused. */
  readonly isYearReviewOpen: boolean;
  /** Stats for the year that just ended (shown while {@link isYearReviewOpen} is true). */
  readonly yearlyReviewStats: YearlyReviewStats;
}

type Listener = (e: ColonyEvent) => void;

/**
 * Lightweight typed emitter for colony ↔ UI bridge.
 */
export class ColonyEventBus {
  private readonly listeners = new Set<Listener>();

  emit(event: ColonyEvent): void {
    for (const l of this.listeners) {
      l(event);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
