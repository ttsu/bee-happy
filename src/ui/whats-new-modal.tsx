import {
  PLAYER_CHANGELOG_CATEGORIES,
  type PlayerReleaseEntry,
} from "../changelog/player-changelog";

type Props = {
  readonly releases: readonly PlayerReleaseEntry[];
  readonly onDismiss: () => void;
};

/**
 * Formats a changelog `YYYY-MM-DD` string for display in the user's locale.
 * Parses as a calendar date (not UTC midnight) so the day does not shift by timezone.
 *
 * @param ymd - ISO date string from player changelog JSON
 * @returns Long locale date (e.g. April 8, 2026) or the original string if unparsable
 */
const formatChangelogDate = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    return ymd;
  }
  const y = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, monthIndex, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== y ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return ymd;
  }
  try {
    return d.toLocaleDateString(undefined, {
      dateStyle: "long",
    });
  } catch {
    return ymd;
  }
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
          🐝 What's new 🐝
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
                {rel.date ? (
                  <time className="whats-new-date" dateTime={rel.date}>
                    {formatChangelogDate(rel.date)}
                  </time>
                ) : null}
              </h3>
              {PLAYER_CHANGELOG_CATEGORIES.map(({ key, label, emoji }) => {
                const lines = rel[key];
                if (!lines?.length) {
                  return null;
                }
                return (
                  <div key={key} className="whats-new-category">
                    <h4 className="whats-new-category-heading">
                      <span aria-hidden>{emoji}</span> {label}
                    </h4>
                    <ul className="whats-new-list">
                      {lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
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
