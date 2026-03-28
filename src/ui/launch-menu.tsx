import { useMemo, useState } from "react";
import {
  clearColonySaveFromStorage,
  readColonySaveFromStorage,
} from "../colony/colony-save";

type Props = {
  readonly onNewGame: () => void;
  readonly onContinue: () => void;
};

const formatSavedLabel = (iso: string | undefined): string => {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  try {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

/**
 * First screen: start fresh or resume the last autosaved colony from this browser.
 */
export const LaunchMenu = ({ onNewGame, onContinue }: Props) => {
  const existing = useMemo(() => readColonySaveFromStorage(), []);
  const [confirmNew, setConfirmNew] = useState(false);

  return (
    <div
      className="launch-menu"
      role="dialog"
      aria-modal
      aria-labelledby="launch-title"
    >
      <div className="launch-menu-card">
        <h1 id="launch-title" className="launch-menu-title">
          Bee Happy
        </h1>
        <p className="launch-menu-sub">Choose how to begin.</p>
        <div className="launch-menu-actions">
          {existing ? (
            <button
              type="button"
              className="launch-menu-btn launch-menu-btn--primary"
              onClick={() => {
                onContinue();
              }}
            >
              Continue
              <span className="launch-menu-hint">
                Saved {formatSavedLabel(existing.savedAtIso)}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--neutral"
            onClick={() => {
              if (existing) {
                setConfirmNew(true);
                return;
              }
              onNewGame();
            }}
          >
            New game
            {existing ? (
              <span className="launch-menu-hint">Replaces the saved colony</span>
            ) : null}
          </button>
        </div>
      </div>
      {confirmNew ? (
        <div
          className="launch-confirm-backdrop"
          role="dialog"
          aria-modal
          aria-labelledby="launch-confirm-title"
        >
          <div className="launch-confirm-card">
            <h2 id="launch-confirm-title" className="launch-confirm-title">
              Start a new colony?
            </h2>
            <p className="launch-confirm-text">
              This removes the saved game in this browser. You cannot undo this.
            </p>
            <div className="launch-confirm-buttons">
              <button
                type="button"
                className="launch-menu-btn launch-menu-btn--danger"
                onClick={() => {
                  clearColonySaveFromStorage();
                  setConfirmNew(false);
                  onNewGame();
                }}
              >
                Start new game
              </button>
              <button
                type="button"
                className="launch-menu-btn launch-menu-btn--neutral"
                onClick={() => {
                  setConfirmNew(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
