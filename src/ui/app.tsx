import { useEffect, useState } from "react";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { getColonyBridge } from "../colony-bridge";
import { BUILD_HASH_SHORT } from "../build-info";
import { getSeasonDisplayLabel, getSeasonForColonyDay } from "../colony/seasons";
import {
  CellCoordComponent,
  CellStateComponent,
  type CellStage,
  type CellTypeKind,
} from "../colony/ecs/components/colony-components";

const defaultSnapshot: ColonyUiSnapshot = {
  beesTotal: 0,
  workers: 0,
  queens: 0,
  pollen: 0,
  honey: 0,
  colonyNectar: 0,
  happinessPct: 100,
  broodOccupied: 0,
  broodTotal: 0,
  activeLevel: 0,
  wax: 0,
  transitionOverlay: 0,
  pendingCellTypeKey: null,
  cellTypeChangeError: null,
  currentColonyDay: 1,
  currentColonySeason: "Spring",
  yearNumber: 1,
  isYearReviewOpen: false,
  yearlyReviewStats: {
    honeyProcessedTotal: 0,
    nectarCollectedTotal: 0,
    pollenCollectedTotal: 0,
    beesHatchedTotal: 0,
    remainingBees: 0,
    happyBeeSecondsTotal: 0,
  },
};

const LEVELS = [-2, -1, 0, 1, 2] as const;
const DRAG_LEVEL_THRESHOLD_PX = 48;
const STACK_MID_INDEX = 2;
const MINI_LEVEL_STEP_PX = 92;

type MiniCell = {
  readonly q: number;
  readonly r: number;
  readonly type: CellTypeKind;
  readonly stage: CellStage;
  readonly built: boolean;
  readonly pendingCellType: "brood" | "pollen" | "nectar" | null;
};

type MiniLevel = {
  readonly level: number;
  readonly cells: MiniCell[];
};

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

const colorForMiniCell = (cell: MiniCell): string => {
  if (!cell.built) {
    return "#95a5a6";
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

const readMiniLevelsFromBridge = (): MiniLevel[] => {
  const byLevel = new Map<number, MiniCell[]>();
  for (const level of LEVELS) {
    byLevel.set(level, []);
  }
  const colony = getColonyBridge();
  if (!colony) {
    return LEVELS.map((level) => ({ level, cells: [] }));
  }
  for (const [, cell] of colony.cellsByKey) {
    const coord = cell.get(CellCoordComponent);
    const state = cell.get(CellStateComponent);
    if (!coord || !state) {
      continue;
    }
    if (!byLevel.has(coord.level)) {
      continue;
    }
    byLevel.get(coord.level)!.push({
      q: coord.q,
      r: coord.r,
      type: state.cellType,
      stage: state.stage,
      built: state.built,
      pendingCellType: state.pendingCellType,
    });
  }
  return LEVELS.map((level) => ({
    level,
    cells: byLevel.get(level) ?? [],
  }));
};

/**
 * Root React overlay: HUD, level strip, cell type picker, and transition dimmer.
 */
const HUD_MINIMIZED_KEY = "bee-happy-hud-minimized";

const readHudMinimized = (): boolean => {
  try {
    return localStorage.getItem(HUD_MINIMIZED_KEY) === "1";
  } catch {
    return false;
  }
};

export const App = () => {
  const [snap, setSnap] = useState<ColonyUiSnapshot>(defaultSnapshot);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hudMinimized, setHudMinimized] = useState(readHudMinimized);
  const [miniLevels, setMiniLevels] = useState<MiniLevel[]>(() =>
    readMiniLevelsFromBridge(),
  );
  const [dragLevelOffset, setDragLevelOffset] = useState(0);
  const [isStripDragging, setIsStripDragging] = useState(false);
  const [previewActiveLevel, setPreviewActiveLevel] = useState(snap.activeLevel);
  const [targetLevel, setTargetLevel] = useState<number | null>(null);
  const seasonInfo = getSeasonForColonyDay(snap.currentColonyDay);
  const activeLevelIndex = LEVELS.indexOf(
    previewActiveLevel as (typeof LEVELS)[number],
  );
  const stackTranslateY =
    (STACK_MID_INDEX - activeLevelIndex + dragLevelOffset) * MINI_LEVEL_STEP_PX;

  /**
   * Persists a minimal UI snapshot and exits the current page context when possible.
   */
  const saveAndQuit = () => {
    localStorage.setItem(
      "bee-happy-last-snapshot",
      JSON.stringify({
        savedAtIso: new Date().toISOString(),
        snapshot: snap,
      }),
    );
    setIsSettingsOpen(false);
    window.close();
    window.location.replace("about:blank");
  };

  useEffect(() => {
    const colony = getColonyBridge();
    if (!colony) {
      return;
    }
    const off = colony.events.subscribe((e) => {
      if (e.type === "ColonySnapshot") {
        setSnap(e.snapshot);
        setMiniLevels(readMiniLevelsFromBridge());
        if (!isStripDragging) {
          setPreviewActiveLevel(e.snapshot.activeLevel);
        }
      }
    });
    setSnap(colony.getUiSnapshot());
    setMiniLevels(readMiniLevelsFromBridge());
    return off;
  }, [isStripDragging]);

  useEffect(() => {
    try {
      localStorage.setItem(HUD_MINIMIZED_KEY, hudMinimized ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [hudMinimized]);

  useEffect(() => {
    if (targetLevel === null) {
      return;
    }
    if (snap.activeLevel === targetLevel) {
      setTargetLevel(null);
      return;
    }
    const step: 1 | -1 = targetLevel > snap.activeLevel ? 1 : -1;
    getColonyBridge()?.requestLevelChange(step);
  }, [snap.activeLevel, targetLevel]);

  return (
    <>
      <div
        className="transition-dim"
        style={{ opacity: snap.transitionOverlay }}
        aria-hidden
      />
      <div className="season-day-banner" aria-live="polite">
        <span>{getSeasonDisplayLabel(seasonInfo.season)}</span>
        <span className="season-day-divider" aria-hidden />
        <span>Year {snap.yearNumber}</span>
        <span className="season-day-divider" aria-hidden />
        <span>Day {seasonInfo.seasonDayOneBased}</span>
      </div>
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
      <div className="hud">
        <button
          type="button"
          className={`hud-card${hudMinimized ? " hud-card--minimized" : ""}`}
          aria-expanded={!hudMinimized}
          aria-label={hudMinimized ? "Show colony stats" : "Hide colony stats"}
          onClick={() => {
            setHudMinimized((m) => !m);
          }}
        >
          <strong>Bee Happy</strong>
          <div className="hud-stats" aria-hidden={hudMinimized}>
            <div>Bees: {snap.beesTotal}</div>
            <div>
              Workers {snap.workers} · Queen {snap.queens}
            </div>
            <div>Pollen: {snap.pollen.toFixed(0)}</div>
            <div>Honey: {snap.honey.toFixed(0)}</div>
            <div>Nectar: {snap.colonyNectar.toFixed(0)}</div>
            <div>Wax: {snap.wax.toFixed(0)}</div>
            <div>Happiness: {snap.happinessPct}%</div>
            <div>
              Brood: {snap.broodOccupied}/{snap.broodTotal}
            </div>
            <div>Level: {snap.activeLevel}</div>
            <div>Year: {snap.yearNumber}</div>
          </div>
        </button>
      </div>
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
                getColonyBridge()?.requestLevelChange(1);
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
                getColonyBridge()?.requestLevelChange(-1);
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
                  {level.cells.map((cell) => (
                    <span
                      key={`${level.level}:${cell.q},${cell.r}`}
                      className="mini-level-cell"
                      style={{
                        left: `${50 + (cell.q + cell.r * 0.5) * 10}%`,
                        top: `${50 + cell.r * 5.5}%`,
                        background: colorForMiniCell(cell),
                        boxShadow: cell.pendingCellType
                          ? "0 0 0 1.5px #e67e22"
                          : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <span className="level-strip-hint">tap or drag ↑↓</span>
      </div>
      {snap.pendingCellTypeKey ? (
        <div className="picker-backdrop" role="dialog" aria-modal>
          <div className="picker-card">
            <p>Choose cell type</p>
            {snap.cellTypeChangeError ? (
              <p className="picker-error" role="alert">
                {snap.cellTypeChangeError}
              </p>
            ) : null}
            <div className="picker-buttons">
              <button
                type="button"
                className="picker-btn"
                onClick={() => {
                  const bridge = getColonyBridge();
                  const k = bridge?.pendingCellTypeKey;
                  if (k) {
                    bridge.requestCellTypeChange(k, "brood");
                  }
                }}
              >
                Brood
              </button>
              <button
                type="button"
                className="picker-btn"
                onClick={() => {
                  const bridge = getColonyBridge();
                  const k = bridge?.pendingCellTypeKey;
                  if (k) {
                    bridge.requestCellTypeChange(k, "pollen");
                  }
                }}
              >
                Pollen
              </button>
              <button
                type="button"
                className="picker-btn"
                onClick={() => {
                  const bridge = getColonyBridge();
                  const k = bridge?.pendingCellTypeKey;
                  if (k) {
                    bridge.requestCellTypeChange(k, "nectar");
                  }
                }}
              >
                Nectar / honey
              </button>
            </div>
            <button
              type="button"
              className="picker-cancel"
              onClick={() => {
                getColonyBridge()?.dismissCellTypePicker();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
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
                getColonyBridge()?.continueToNextYear();
              }}
            >
              Continue to year {snap.yearNumber + 1}
            </button>
          </div>
        </div>
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
                className="settings-action-btn settings-action-btn--danger"
                onClick={() => {
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
      <div className="build-hash" aria-hidden>
        {BUILD_HASH_SHORT}
      </div>
    </>
  );
};
