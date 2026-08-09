import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { serializeColonySave, writeColonySaveToStorage } from "../colony/colony-save";
import { createDefaultColonyUiSnapshot } from "../schemas/colony-snapshot";
import { useColonyBridge } from "./colony-bridge-context";
import { BUILD_HASH_SHORT } from "../build-info";
import {
  getSeasonDisplayLabel,
  getSeasonEmoji,
  getSeasonForColonyDay,
} from "../colony/seasons";
import {
  CellCoordComponent,
  CellStateComponent,
  type CellStage,
  type CellTypeKind,
} from "../colony/ecs/components/colony-components";
import { eligibleFoundationCoordsForLevel } from "../colony/placement";
import { hiveKey, type HiveCoord } from "../grid/hive-levels";
import { useTutorial } from "../tutorial/use-tutorial";
import { TutorialOverlay } from "./tutorial-overlay";
import { SuccessionModal } from "./succession-modal";
import { LineageViewer } from "./lineage-viewer";
import { readMetaProgressFromStorage } from "../colony/meta/meta-progress";
import { CellTypePicker } from "./cell-type-picker";
import { PlacementCellTypeToolbar } from "./placement-cell-type-toolbar";
import { registerSaveBeforeReload } from "../pwa/update-policy";
import { UpdateAvailableBanner } from "./update-available-banner";
import { ColonyHud } from "./colony-hud";
import { DemandPanel } from "./demand-panel";

const LEVELS = [-2, -1, 0, 1, 2] as const;
const DRAG_LEVEL_THRESHOLD_PX = 36;
const STACK_MID_INDEX = 2;
/** Vertical pitch between floor cards in the compact reel (px). */
const MINI_LEVEL_STEP_PX = 52;
const MINI_LEVEL_CARD_HEIGHT_PX = 48;
const STACK_VIEWPORT_HEIGHT_PX = 132;
/** Shifts the track so the mid floor sits in the active slot when translateY is 0. */
const STACK_CENTER_OFFSET_PX =
  (STACK_VIEWPORT_HEIGHT_PX - MINI_LEVEL_CARD_HEIGHT_PX) / 2 -
  STACK_MID_INDEX * MINI_LEVEL_STEP_PX;

/**
 * Axial hex → isometric screen offset for tight honeycomb previews.
 * Pixel steps are sized to the foreshortened hex so neighbors edge-share
 * instead of stacking on top of each other.
 */
const MINI_ISO_STEP_X_PX = 6;
/** Half of X so vertical/horizontal edge gaps stay even in the 2:1 iso lattice. */
const MINI_ISO_STEP_Y_PX = 3;

const miniCellMapPosition = (q: number, r: number): { left: string; top: string } => {
  const x = (q - r) * MINI_ISO_STEP_X_PX;
  const y = (q + r) * MINI_ISO_STEP_Y_PX;
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(54% + ${y}px)`,
  };
};

type MiniCell = {
  readonly q: number;
  readonly r: number;
  readonly type: CellTypeKind;
  readonly stage: CellStage;
  readonly built: boolean;
  readonly pendingCellType: "brood" | "pollen" | "nectar" | null;
  /** Eligible empty foundation shown as a faint comb outline. */
  readonly ghost: boolean;
};

type MiniLevel = {
  readonly level: number;
  readonly cells: MiniCell[];
};

/** Back-to-front paint order for isometric depth. */
const compareMiniCellsIso = (a: MiniCell, b: MiniCell): number =>
  a.q + a.r - (b.q + b.r) || a.q - b.q;

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

const colorForMiniCell = (cell: MiniCell): string => {
  if (cell.ghost || !cell.built) {
    return cell.ghost ? "rgba(148, 163, 184, 0.45)" : "#95a5a6";
  }
  if (cell.type === "brood") {
    switch (cell.stage) {
      case "egg":
        return "#fdebd0";
      case "larvae":
        return "#f8c471";
      case "sealed":
        return "#d7bde2";
      case "cleaning":
        return "#aed6f1";
      default:
        return "#fadbd8";
    }
  }
  if (cell.type === "pollen") {
    return "#f7dc6f";
  }
  if (cell.type === "nectar") {
    return "#82e0aa";
  }
  return "#ecf0f1";
};

const readMiniLevelsFromBridge = (colony: ColonyRuntime | null): MiniLevel[] => {
  const byLevel = new Map<number, MiniCell[]>();
  for (const level of LEVELS) {
    byLevel.set(level, []);
  }
  if (!colony) {
    return LEVELS.map((level) => ({ level, cells: [] }));
  }

  const occupied = new Set<string>();
  const builtCoords: HiveCoord[] = [];
  const lookup = {
    has: (k: string) => colony.cellsByKey.has(k),
    getBuilt: (k: string) => colony.cellsByKey.get(k)?.get(CellStateComponent),
  };

  for (const [, cell] of colony.cellsByKey) {
    const coord = cell.get(CellCoordComponent);
    const state = cell.get(CellStateComponent);
    if (!coord || !state) {
      continue;
    }
    if (!byLevel.has(coord.level)) {
      continue;
    }
    occupied.add(hiveKey(coord));
    if (state.built) {
      builtCoords.push({ q: coord.q, r: coord.r, level: coord.level });
    }
    byLevel.get(coord.level)!.push({
      q: coord.q,
      r: coord.r,
      type: state.cellType,
      stage: state.stage,
      built: state.built,
      pendingCellType: state.pendingCellType,
      ghost: false,
    });
  }

  for (const level of LEVELS) {
    const ghosts = eligibleFoundationCoordsForLevel(level, lookup, builtCoords);
    for (const h of ghosts) {
      const key = hiveKey(h);
      if (occupied.has(key)) {
        continue;
      }
      occupied.add(key);
      byLevel.get(level)!.push({
        q: h.q,
        r: h.r,
        type: "brood",
        stage: "empty",
        built: false,
        pendingCellType: null,
        ghost: true,
      });
    }
  }

  return LEVELS.map((level) => ({
    level,
    cells: (byLevel.get(level) ?? []).slice().sort(compareMiniCellsIso),
  }));
};

/**
 * Root React overlay: HUD, level strip, cell type picker, and transition dimmer.
 */
export const App = () => {
  const colony = useColonyBridge();
  const [snap, setSnap] = useState<ColonyUiSnapshot>(() =>
    createDefaultColonyUiSnapshot(),
  );
  const [lineageOpen, setLineageOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [miniLevels, setMiniLevels] = useState<MiniLevel[]>(() =>
    readMiniLevelsFromBridge(null),
  );
  const [dragLevelOffset, setDragLevelOffset] = useState(0);
  const [isStripDragging, setIsStripDragging] = useState(false);
  const [previewActiveLevel, setPreviewActiveLevel] = useState(snap.activeLevel);
  const [targetLevel, setTargetLevel] = useState<number | null>(null);
  const seasonInfo = getSeasonForColonyDay(snap.currentColonyDay, snap.daysPerSeason);
  const tutorial = useTutorial(colony, snap);
  const activeLevelIndex = LEVELS.indexOf(
    previewActiveLevel as (typeof LEVELS)[number],
  );
  const stackTranslateY =
    STACK_CENTER_OFFSET_PX +
    (STACK_MID_INDEX - activeLevelIndex + dragLevelOffset) * MINI_LEVEL_STEP_PX;

  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persistFullSave = useCallback(() => {
    if (!colony) {
      return;
    }
    try {
      writeColonySaveToStorage(serializeColonySave(colony));
    } catch {
      /* quota / private mode */
    }
  }, [colony]);

  const lineageCount = useMemo(
    () => readMetaProgressFromStorage().lineage.length,
    [snap],
  );

  /**
   * Writes the full game state and exits the tab when the browser allows it.
   */
  const saveAndQuit = () => {
    persistFullSave();
    setIsSettingsOpen(false);
    window.close();
    window.location.replace("about:blank");
  };

  useEffect(() => {
    if (!colony) {
      return;
    }
    const off = colony.events.subscribe((e) => {
      if (e.type === "ColonySnapshot") {
        setSnap(e.snapshot);
        setMiniLevels(readMiniLevelsFromBridge(colony));
        if (!isStripDragging) {
          setPreviewActiveLevel(e.snapshot.activeLevel);
        }
      }
    });
    setSnap(colony.getUiSnapshot());
    setMiniLevels(readMiniLevelsFromBridge(colony));
    return off;
  }, [colony, isStripDragging]);

  useEffect(() => {
    registerSaveBeforeReload(persistFullSave);
    return () => {
      registerSaveBeforeReload(null);
    };
  }, [persistFullSave]);

  useEffect(() => {
    if (!colony) {
      return;
    }
    persistFullSave();
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setInterval(() => {
      persistFullSave();
    }, 30_000);
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [colony, persistFullSave]);

  useEffect(() => {
    const onHide = () => {
      persistFullSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        onHide();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
    };
  }, [persistFullSave]);

  useEffect(() => {
    if (targetLevel === null) {
      return;
    }
    if (snap.activeLevel === targetLevel) {
      setTargetLevel(null);
      return;
    }
    const step: 1 | -1 = targetLevel > snap.activeLevel ? 1 : -1;
    colony?.requestLevelChange(step);
  }, [colony, snap.activeLevel, targetLevel]);

  return (
    <>
      <div
        className="transition-dim"
        style={{ opacity: snap.transitionOverlay }}
        aria-hidden
      />
      <div
        className={`top-chrome${
          snap.lineageSystemEnabled && lineageCount > 0
            ? " top-chrome--with-lineage"
            : ""
        }`}
      >
        <div className="season-day-banner">
          <div
            className="season-day-banner-info"
            aria-live="polite"
            aria-label={`${getSeasonDisplayLabel(seasonInfo.season)}, Year ${snap.yearNumber}, Day ${seasonInfo.seasonDayOneBased}`}
          >
            <span className="season-day-season-full" aria-hidden>
              {getSeasonDisplayLabel(seasonInfo.season)}
            </span>
            <span className="season-day-season-compact" aria-hidden>
              {getSeasonEmoji(seasonInfo.season)}
            </span>
            <span
              className="season-day-divider season-day-divider--wide-only"
              aria-hidden
            />
            <span className="season-day-year">Year {snap.yearNumber}</span>
            <span
              className="season-day-divider season-day-divider--wide-only"
              aria-hidden
            />
            <span>Day {seasonInfo.seasonDayOneBased}</span>
          </div>
          <button
            type="button"
            className="season-day-speed-toggle"
            aria-label={
              snap.simulationSpeed === 2
                ? "Fast forward on, switch to normal speed"
                : "Normal speed, switch to fast forward"
            }
            title={snap.simulationSpeed === 2 ? "Fast forward (2x)" : "Normal speed"}
            aria-pressed={snap.simulationSpeed === 2}
            disabled={!colony}
            onClick={() => {
              colony?.toggleSimulationSpeed();
            }}
          >
            {snap.simulationSpeed === 2 ? (
              <svg className="season-day-speed-icon" viewBox="0 0 24 24" aria-hidden>
                <path d="M4 5.5v13l8.5-6.5L4 5.5zm9 0v13l8.5-6.5L13 5.5z" />
              </svg>
            ) : (
              <svg className="season-day-speed-icon" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5.5v13l11-6.5L8 5.5z" />
              </svg>
            )}
          </button>
        </div>
        <ColonyHud snap={snap} colony={colony} />
      </div>
      <DemandPanel snap={snap} />
      {snap.lineageSystemEnabled && lineageCount > 0 ? (
        <button
          type="button"
          className="lineage-crown-button"
          aria-label="View lineage"
          title="View lineage"
          onClick={() => {
            setLineageOpen(true);
          }}
        >
          👑
        </button>
      ) : null}
      <button
        type="button"
        className="settings-button"
        aria-label="Open settings"
        onClick={() => {
          setIsSettingsOpen(true);
        }}
      >
        ⚙️
      </button>
      <div
        className="level-strip"
        role="slider"
        aria-label="Change hive level"
        aria-valuemin={-2}
        aria-valuemax={2}
        aria-valuenow={snap.activeLevel}
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setTargetLevel(null);
          setIsStripDragging(true);
          let y0 = e.clientY;
          let levelCursor = snap.activeLevel;
          const onMove = (ev: PointerEvent) => {
            const dy = ev.clientY - y0;
            setDragLevelOffset(clamp(dy / DRAG_LEVEL_THRESHOLD_PX, -1, 1));
            if (dy < -DRAG_LEVEL_THRESHOLD_PX) {
              const nextLevel = clamp(
                levelCursor + 1,
                LEVELS[0],
                LEVELS[LEVELS.length - 1],
              );
              if (nextLevel !== levelCursor) {
                colony?.requestLevelChange(1);
                levelCursor = nextLevel;
                setPreviewActiveLevel(nextLevel);
              }
              setDragLevelOffset(0);
              y0 = ev.clientY;
            } else if (dy > DRAG_LEVEL_THRESHOLD_PX) {
              const nextLevel = clamp(
                levelCursor - 1,
                LEVELS[0],
                LEVELS[LEVELS.length - 1],
              );
              if (nextLevel !== levelCursor) {
                colony?.requestLevelChange(-1);
                levelCursor = nextLevel;
                setPreviewActiveLevel(nextLevel);
              }
              setDragLevelOffset(0);
              y0 = ev.clientY;
            }
          };
          const onUp = () => {
            setDragLevelOffset(0);
            setIsStripDragging(false);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        <span className="level-strip-label">Level</span>
        <div className="level-strip-minimap-stack" aria-hidden>
          <span className="level-strip-active-slot" />
          <div
            className={`level-strip-minimap-track ${isStripDragging ? "is-dragging" : ""}`}
            style={{
              transform: `translateY(${stackTranslateY}px)`,
            }}
          >
            {miniLevels.map((level) => (
              <div
                key={level.level}
                className={`mini-level ${level.level === previewActiveLevel ? "is-active" : ""}`}
                data-level-preview
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setTargetLevel(level.level);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  setTargetLevel(level.level);
                }}
              >
                <span className="mini-level-label">{level.level}</span>
                <div className="mini-level-map">
                  {level.cells.map((cell) => {
                    const pos = miniCellMapPosition(cell.q, cell.r);
                    return (
                      <span
                        key={`${level.level}:${cell.q},${cell.r}`}
                        className={`mini-level-cell${cell.ghost ? " is-ghost" : ""}`}
                        style={{
                          left: pos.left,
                          top: pos.top,
                          background: colorForMiniCell(cell),
                          boxShadow: cell.pendingCellType
                            ? "0 0 0 1.5px #e67e22"
                            : undefined,
                          zIndex: cell.ghost ? 0 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className="level-strip-hint sr-only">
          Drag up or down, or tap a floor
        </span>
      </div>
      {colony &&
      !snap.isYearReviewOpen &&
      !snap.successionModal &&
      !isSettingsOpen &&
      !lineageOpen ? (
        <PlacementCellTypeToolbar snap={snap} colony={colony} />
      ) : null}
      {tutorial.showTutorial && !snap.isYearReviewOpen ? (
        <TutorialOverlay
          stepIndex={tutorial.stepIndex}
          advanceContinue={tutorial.advanceContinue}
          completeTutorial={tutorial.completeTutorial}
          skipTutorial={tutorial.skipTutorial}
        />
      ) : null}
      {snap.pendingCellTypeKey ? <CellTypePicker snap={snap} colony={colony} /> : null}
      {snap.isYearReviewOpen ? (
        <div
          className="year-review-backdrop"
          role="dialog"
          aria-modal
          aria-labelledby="year-review-title"
        >
          <div className="year-review-card">
            <h2 id="year-review-title" className="year-review-title">
              Year {snap.yearNumber} complete
            </h2>
            <p className="year-review-kpi-label">Happiness score</p>
            <p
              className="year-review-kpi-value"
              aria-label="Cumulative happy bee seconds"
            >
              {snap.yearlyReviewStats.happyBeeSecondsTotal.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="year-review-kpi-hint">
              Total time all bees spent fed and hydrated this year.
            </p>
            <ul className="year-review-stats">
              <li>
                Honey processed:{" "}
                {snap.yearlyReviewStats.honeyProcessedTotal.toLocaleString()}
              </li>
              <li>
                Nectar collected:{" "}
                {snap.yearlyReviewStats.nectarCollectedTotal.toLocaleString()}
              </li>
              <li>
                Pollen collected:{" "}
                {snap.yearlyReviewStats.pollenCollectedTotal.toLocaleString()}
              </li>
              <li>
                Bees hatched: {snap.yearlyReviewStats.beesHatchedTotal.toLocaleString()}
              </li>
              <li>
                Bees remaining: {snap.yearlyReviewStats.remainingBees.toLocaleString()}
              </li>
            </ul>
            <button
              type="button"
              className="year-review-continue"
              onClick={() => {
                colony?.continueToNextYear();
              }}
            >
              Continue to year {snap.yearNumber + 1}
            </button>
          </div>
        </div>
      ) : null}
      {snap.successionModal ? (
        <SuccessionModal snap={snap} onPersist={persistFullSave} />
      ) : null}
      {lineageOpen ? (
        <LineageViewer
          onClose={() => {
            setLineageOpen(false);
          }}
        />
      ) : null}
      {isSettingsOpen ? (
        <div
          className="settings-backdrop"
          role="dialog"
          aria-modal
          aria-labelledby="settings-title"
        >
          <div className="settings-card">
            <h2 id="settings-title" className="settings-title">
              Settings
            </h2>
            <div className="settings-buttons">
              <button
                type="button"
                className="settings-action-btn settings-action-btn--neutral"
                onClick={() => {
                  setLineageOpen(true);
                  setIsSettingsOpen(false);
                }}
              >
                View lineage
              </button>
              <button
                type="button"
                className="settings-action-btn settings-action-btn--danger"
                onClick={() => {
                  persistFullSave();
                  window.location.reload();
                }}
              >
                Restart game
              </button>
              <button
                type="button"
                className="settings-action-btn settings-action-btn--primary"
                onClick={() => {
                  saveAndQuit();
                }}
              >
                Save and quit
              </button>
              <button
                type="button"
                className="settings-action-btn settings-action-btn--neutral"
                onClick={() => {
                  setIsSettingsOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <UpdateAvailableBanner onBeforeApply={persistFullSave} />
      <div className="build-hash" aria-hidden>
        {BUILD_HASH_SHORT}
      </div>
    </>
  );
};
