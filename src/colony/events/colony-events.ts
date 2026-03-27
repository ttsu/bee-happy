import type { HiveCoord } from "../../grid/hive-levels";

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
  readonly wax: number;
  readonly transitionOverlay: number;
  readonly pendingCellTypeKey: string | null;
  /** 1-based colony calendar day (same scale as worker bee-days). */
  readonly currentColonyDay: number;
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
