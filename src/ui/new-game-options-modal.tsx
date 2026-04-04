import { useState } from "react";
import {
  DEFAULT_NEW_GAME_SETTINGS,
  DAYS_PER_SEASON_MAX,
  DAYS_PER_SEASON_MIN,
  gameSettingsSchema,
  STARTING_WORKERS_MAX,
  STARTING_WORKERS_MIN,
  type NewGameOptions,
} from "../colony/game-settings";

type Props = {
  readonly onCancel: () => void;
  readonly onConfirm: (options: NewGameOptions) => void;
};

/**
 * Pre-start panel: toggles and sliders for a new colony (launch menu).
 */
export const NewGameOptionsModal = ({ onCancel, onConfirm }: Props) => {
  const [opts, setOpts] = useState<NewGameOptions>(() => ({
    ...DEFAULT_NEW_GAME_SETTINGS,
  }));

  const start = () => {
    const parsed = gameSettingsSchema.safeParse(opts);
    if (parsed.success) {
      onConfirm(parsed.data);
    }
  };

  return (
    <div
      className="launch-confirm-backdrop launch-new-game-backdrop"
      role="dialog"
      aria-modal
      aria-labelledby="new-game-options-title"
    >
      <div className="launch-confirm-card launch-new-game-card">
        <h2 id="new-game-options-title" className="launch-confirm-title">
          New game options
        </h2>
        <p className="launch-new-game-lead">
          Adjust rules for this colony. You can change these only before starting.
        </p>

        <fieldset className="launch-new-game-fieldset">
          <legend className="visually-hidden">Feature toggles</legend>
          <label className="launch-new-game-check">
            <input
              type="checkbox"
              checked={opts.intrudersEnabled}
              onChange={(e) => {
                setOpts((o) => ({ ...o, intrudersEnabled: e.target.checked }));
              }}
            />
            <span>Enable intruders (coming soon)</span>
          </label>
          <label className="launch-new-game-check">
            <input
              type="checkbox"
              checked={opts.lineageSystemEnabled}
              onChange={(e) => {
                setOpts((o) => ({ ...o, lineageSystemEnabled: e.target.checked }));
              }}
            />
            <span>Enable lineage system</span>
          </label>
        </fieldset>

        <div className="launch-new-game-slider-block">
          <label className="launch-new-game-slider-label" htmlFor="days-per-season">
            Days per season:{" "}
            <span className="launch-new-game-slider-value">{opts.daysPerSeason}</span>
          </label>
          <input
            id="days-per-season"
            type="range"
            className="launch-new-game-range"
            min={DAYS_PER_SEASON_MIN}
            max={DAYS_PER_SEASON_MAX}
            step={1}
            value={opts.daysPerSeason}
            aria-valuemin={DAYS_PER_SEASON_MIN}
            aria-valuemax={DAYS_PER_SEASON_MAX}
            aria-valuenow={opts.daysPerSeason}
            aria-valuetext={`${opts.daysPerSeason} days per season`}
            onChange={(e) => {
              const n = Number(e.target.value);
              setOpts((o) => ({ ...o, daysPerSeason: n }));
            }}
          />
        </div>

        <div className="launch-new-game-slider-block">
          <label className="launch-new-game-slider-label" htmlFor="starting-workers">
            Starting workers:{" "}
            <span className="launch-new-game-slider-value">{opts.startingWorkers}</span>
          </label>
          <input
            id="starting-workers"
            type="range"
            className="launch-new-game-range"
            min={STARTING_WORKERS_MIN}
            max={STARTING_WORKERS_MAX}
            step={1}
            value={opts.startingWorkers}
            aria-valuemin={STARTING_WORKERS_MIN}
            aria-valuemax={STARTING_WORKERS_MAX}
            aria-valuenow={opts.startingWorkers}
            aria-valuetext={`${opts.startingWorkers} workers`}
            onChange={(e) => {
              const n = Number(e.target.value);
              setOpts((o) => ({ ...o, startingWorkers: n }));
            }}
          />
        </div>

        <div className="launch-confirm-buttons launch-new-game-actions">
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--primary"
            onClick={start}
          >
            Start colony
          </button>
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--neutral"
            onClick={onCancel}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};
