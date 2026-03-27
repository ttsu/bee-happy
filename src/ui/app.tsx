import { useEffect, useState } from "react";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { getColonyBridge } from "../colony-bridge";
import { BUILD_HASH_SHORT } from "../build-info";
import { getSeasonForColonyDay } from "../colony/seasons";

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

/**
 * Root React overlay: HUD, level strip, cell type picker, and transition dimmer.
 */
export const App = () => {
  const [snap, setSnap] = useState<ColonyUiSnapshot>(defaultSnapshot);
  const seasonInfo = getSeasonForColonyDay(snap.currentColonyDay);

  useEffect(() => {
    const colony = getColonyBridge();
    if (!colony) {
      return;
    }
    const off = colony.events.subscribe((e) => {
      if (e.type === "ColonySnapshot") {
        setSnap(e.snapshot);
      }
    });
    setSnap(colony.getUiSnapshot());
    return off;
  }, []);

  return (
    <>
      <div
        className="transition-dim"
        style={{ opacity: snap.transitionOverlay }}
        aria-hidden
      />
      <div className="season-day-banner" aria-live="polite">
        <span>{seasonInfo.season}</span>
        <span className="season-day-divider" aria-hidden />
        <span>Year {snap.yearNumber}</span>
        <span className="season-day-divider" aria-hidden />
        <span>Day {seasonInfo.seasonDayOneBased}</span>
      </div>
      <div className="hud">
        <div className="hud-card">
          <strong>Bee Happy</strong>
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
      </div>
      <div
        className="level-strip"
        role="slider"
        aria-label="Change hive level"
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          let y0 = e.clientY;
          const onMove = (ev: PointerEvent) => {
            const dy = ev.clientY - y0;
            if (dy < -48) {
              getColonyBridge()?.requestLevelChange(1);
              y0 = ev.clientY;
            } else if (dy > 48) {
              getColonyBridge()?.requestLevelChange(-1);
              y0 = ev.clientY;
            }
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        <span className="level-strip-label">Level</span>
        <span className="level-strip-value">{snap.activeLevel}</span>
        <span className="level-strip-hint">drag ↑↓</span>
      </div>
      {snap.pendingCellTypeKey ? (
        <div className="picker-backdrop" role="dialog" aria-modal>
          <div className="picker-card">
            <p>Choose cell type</p>
            <div className="picker-buttons">
              <button
                type="button"
                className="picker-btn"
                onClick={() => {
                  const k = getColonyBridge()?.pendingCellTypeKey;
                  if (k) {
                    getColonyBridge()?.assignCellType(k, "brood");
                  }
                }}
              >
                Brood
              </button>
              <button
                type="button"
                className="picker-btn"
                onClick={() => {
                  const k = getColonyBridge()?.pendingCellTypeKey;
                  if (k) {
                    getColonyBridge()?.assignCellType(k, "pollen");
                  }
                }}
              >
                Pollen
              </button>
              <button
                type="button"
                className="picker-btn"
                onClick={() => {
                  const k = getColonyBridge()?.pendingCellTypeKey;
                  if (k) {
                    getColonyBridge()?.assignCellType(k, "nectar");
                  }
                }}
              >
                Nectar / honey
              </button>
            </div>
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
            <p className="year-review-kpi-value" aria-label="Cumulative happy bee seconds">
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
      <div className="build-hash" aria-hidden>
        {BUILD_HASH_SHORT}
      </div>
    </>
  );
};
