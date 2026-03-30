import type { PlayerReleaseEntry } from "../changelog/player-changelog";

type Props = {
  readonly releases: readonly PlayerReleaseEntry[];
  readonly onDismiss: () => void;
};

/**
 * Overlay listing player-facing release notes (newest sections first).
 */
export const WhatsNewModal = ({ releases, onDismiss }: Props) => {
  return (
    <div
      className="whats-new-backdrop"
      role="dialog"
      aria-modal
      aria-labelledby="whats-new-title"
    >
      <div className="whats-new-card">
        <h2 id="whats-new-title" className="whats-new-title">
          What's new
        </h2>
        <div className="whats-new-scroll">
          {releases.map((rel) => (
            <section
              key={rel.id}
              className="whats-new-section"
              aria-label={rel.title ?? rel.id}
            >
              <h3 className="whats-new-release-heading">
                {rel.title ?? `Version ${rel.id}`}
                {rel.date ? <span className="whats-new-date">{rel.date}</span> : null}
              </h3>
              <ul className="whats-new-list">
                {rel.items.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button
          type="button"
          className="launch-menu-btn launch-menu-btn--primary whats-new-dismiss"
          onClick={onDismiss}
        >
          Got it
        </button>
      </div>
    </div>
  );
};
