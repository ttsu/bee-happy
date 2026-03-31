import { useCallback, useState } from "react";
import {
  deleteSaveSlot,
  listSaveSlotsNewestFirst,
  type SaveIndexEntry,
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
import { WhatsNewModal } from "./whats-new-modal";

type Props = {
  readonly onNewGame: () => void;
  readonly onContinue: (slotId: string) => void;
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
export const LaunchMenu = ({ onNewGame, onContinue }: Props) => {
  const [slots, setSlots] = useState<SaveIndexEntry[]>(() =>
    listSaveSlotsNewestFirst(),
  );
  const [deleteTarget, setDeleteTarget] = useState<SaveIndexEntry | null>(null);
  const [lastSeenReleaseId, setLastSeenReleaseId] = useState<string | null>(() =>
    readLastSeenReleaseId(),
  );

  const refreshSlots = useCallback(() => {
    setSlots(listSaveSlotsNewestFirst());
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
                    <span className="launch-save-label">{s.slotLabel}</span>
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
          <button
            type="button"
            className="launch-menu-btn launch-menu-btn--neutral"
            onClick={() => {
              onNewGame();
            }}
          >
            New game
            <span className="launch-menu-hint">Creates a new colony save</span>
          </button>
        </div>
      </div>
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
