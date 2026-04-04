import { useCallback, useState } from "react";
import {
  deleteSaveSlot,
  listSaveSlotsNewestFirstWithRuleFlags,
  type SaveIndexEntry,
  type SaveSlotWithRuleFlags,
} from "../colony/colony-save";
import {
  CURRENT_RELEASE_ID,
  getUnseenReleases,
  shouldShowWhatsNew,
} from "../changelog/player-changelog";
import {
  readLastSeenReleaseId,
  writeLastSeenReleaseId,
} from "../changelog/last-seen-release";
import {
  BUILDER_MODE_CASUAL_SETTINGS,
  NORMAL_MODE_SETTINGS,
  type NewGameOptions,
} from "../colony/game-settings";
import { WhatsNewModal } from "./whats-new-modal";
import { NewGameOptionsModal } from "./new-game-options-modal";

type Props = {
  readonly onStartNewGame: (options: NewGameOptions) => void;
  readonly onContinue: (slotId: string) => void;
};

const ruleFlagsAriaLabel = (s: SaveSlotWithRuleFlags): string | undefined => {
  const parts: string[] = [];
  if (s.lineageSystemEnabled) {
    parts.push("lineage system on");
  }
  if (s.intrudersEnabled) {
    parts.push("intruders on");
  }
  return parts.length > 0 ? `Save options: ${parts.join(", ")}` : undefined;
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
 * First screen: start fresh or pick a saved colony from this browser.
 */
export const LaunchMenu = ({ onStartNewGame, onContinue }: Props) => {
  const [slots, setSlots] = useState<SaveSlotWithRuleFlags[]>(() =>
    listSaveSlotsNewestFirstWithRuleFlags(),
  );
  const [newGameOptionsOpen, setNewGameOptionsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SaveIndexEntry | null>(null);
  const [lastSeenReleaseId, setLastSeenReleaseId] = useState<string | null>(() =>
    readLastSeenReleaseId(),
  );

  const refreshSlots = useCallback(() => {
    setSlots(listSaveSlotsNewestFirstWithRuleFlags());
  }, []);

  const showWhatsNew =
    shouldShowWhatsNew(lastSeenReleaseId) &&
    getUnseenReleases(lastSeenReleaseId).length > 0;

  const dismissWhatsNew = () => {
    writeLastSeenReleaseId(CURRENT_RELEASE_ID);
    setLastSeenReleaseId(CURRENT_RELEASE_ID);
  };

  const hasSaves = slots.length > 0;

  return (
    <div
      className="launch-menu"
      role="dialog"
      aria-modal
      aria-labelledby="launch-title"
    >
      <div className="launch-menu-card launch-menu-card--wide">
        <h1 id="launch-title" className="launch-menu-title">
          Bee Happy
        </h1>
        <p className="launch-menu-sub">Choose how to begin.</p>

        {hasSaves ? (
          <div className="launch-save-section">
            <h2 className="launch-save-heading">Saved games</h2>
            <ul className="launch-save-list" aria-label="Saved games">
              {slots.map((s) => (
                <li key={s.slotId} className="launch-save-row">
                  <button
                    type="button"
                    className="launch-save-resume"
                    onClick={() => {
                      onContinue(s.slotId);
                    }}
                  >
                    <span className="launch-save-resume-top">
                      <span className="launch-save-label">{s.slotLabel}</span>
                      {s.lineageSystemEnabled || s.intrudersEnabled ? (
                        <span
                          className="launch-save-rule-flags"
                          aria-label={ruleFlagsAriaLabel(s)}
                        >
                          {s.lineageSystemEnabled ? (
                            <span
                              className="launch-save-rule-flag launch-save-rule-flag--lineage"
                              title="Lineage system enabled"
                              aria-hidden
                            >
                              👑
                            </span>
                          ) : null}
                          {s.intrudersEnabled ? (
                            <span
                              className="launch-save-rule-flag launch-save-rule-flag--intruders"
                              title="Intruders enabled"
                            >
                              I
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <span className="launch-save-meta">
                      {formatSavedLabel(s.savedAtIso)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="launch-save-delete"
                    aria-label={`Delete save ${s.slotLabel}`}
                    onClick={() => {
                      setDeleteTarget(s);
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="launch-menu-empty">
            No saves yet. Start a new colony — it will appear here after the first
            autosave.
          </p>
        )}

        <div className="launch-menu-actions">
          <h2 className="launch-new-game-heading">New game</h2>
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--primary"
            onClick={() => {
              onStartNewGame(BUILDER_MODE_CASUAL_SETTINGS);
            }}
          >
            Casual Mode
            <span className="launch-menu-hint">
              No intruders or lineage; default season length and workers
            </span>
          </button>
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--neutral"
            onClick={() => {
              onStartNewGame(NORMAL_MODE_SETTINGS);
            }}
          >
            Normal Mode
            <span className="launch-menu-hint">
              Intruders and lineage on; default season length and workers
            </span>
          </button>
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--neutral"
            onClick={() => {
              setNewGameOptionsOpen(true);
            }}
          >
            Custom Mode
            <span className="launch-menu-hint">
              Choose days per season, workers, and toggles
            </span>
          </button>
        </div>
      </div>
      {newGameOptionsOpen ? (
        <NewGameOptionsModal
          onCancel={() => {
            setNewGameOptionsOpen(false);
          }}
          onConfirm={(options) => {
            setNewGameOptionsOpen(false);
            onStartNewGame(options);
          }}
        />
      ) : null}
      {showWhatsNew ? (
        <WhatsNewModal
          releases={getUnseenReleases(lastSeenReleaseId)}
          onDismiss={dismissWhatsNew}
        />
      ) : null}
      {deleteTarget ? (
        <div
          className="launch-confirm-backdrop"
          role="dialog"
          aria-modal
          aria-labelledby="launch-delete-title"
        >
          <div className="launch-confirm-card">
            <h2 id="launch-delete-title" className="launch-confirm-title">
              Delete this save?
            </h2>
            <p className="launch-confirm-text">
              &ldquo;{deleteTarget.slotLabel}&rdquo; will be removed from this browser.
              You cannot undo this.
            </p>
            <div className="launch-confirm-buttons">
              <button
                type="button"
                className="launch-menu-btn launch-menu-btn--danger"
                onClick={() => {
                  deleteSaveSlot(deleteTarget.slotId);
                  setDeleteTarget(null);
                  refreshSlots();
                }}
              >
                Delete save
              </button>
              <button
                type="button"
                className="launch-menu-btn launch-menu-btn--neutral"
                onClick={() => {
                  setDeleteTarget(null);
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
