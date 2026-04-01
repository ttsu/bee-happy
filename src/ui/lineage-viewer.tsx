import { getLineageAffixById, tradeoffMagnitudeForTier } from "../data/lineage-affixes";
import type { LineageEntry } from "../colony/meta/meta-progress";
import { successionReasonShortLabel } from "../data/succession-reason-copy";
import { readMetaProgressFromStorage } from "../colony/meta/meta-progress";

type Props = {
  readonly onClose: () => void;
};

const tierClass = (t: number): string => {
  if (t <= 1) {
    return "tier-1";
  }
  if (t === 2) {
    return "tier-2";
  }
  if (t === 3) {
    return "tier-3";
  }
  if (t === 4) {
    return "tier-4";
  }
  return "tier-5";
};

function LineageAffixStatLines({ entry }: { readonly entry: LineageEntry }) {
  const affix = getLineageAffixById(entry.affixId);
  if (!affix) {
    return (
      <span className="lineage-stats lineage-stats--legacy">
        +{(entry.magnitude * 100).toFixed(0)}% primary
      </span>
    );
  }
  const tradeoff = tradeoffMagnitudeForTier(affix, entry.tier);
  return (
    <span className="lineage-stats">
      <span className="lineage-stat-primary">
        {affix.formatPrimaryLine(entry.magnitude)}
      </span>
      <span className="lineage-stat-trade">{affix.formatTradeoffLine(tradeoff)}</span>
    </span>
  );
}

/**
 * Read-only timeline of lineage picks from meta storage.
 */
export const LineageViewer = ({ onClose }: Props) => {
  const meta = readMetaProgressFromStorage();
  const lineage = meta.lineage;

  return (
    <div
      className="lineage-backdrop"
      role="dialog"
      aria-modal
      aria-labelledby="lineage-title"
    >
      <div className="lineage-card">
        <h2 id="lineage-title" className="lineage-title">
          Your lineage
        </h2>
        {lineage.length === 0 ? (
          <p className="lineage-empty">
            Your first queen&apos;s story will appear here after succession.
          </p>
        ) : (
          <div className="lineage-track" role="list">
            {lineage.map((entry, i) => (
              <div
                key={`${entry.recordedAtIso}-${entry.generationIndex}`}
                className="lineage-step"
              >
                {i > 0 ? (
                  <div className="lineage-connector" aria-hidden>
                    <span className="lineage-connector-line" />
                    <span className="lineage-connector-label">
                      {successionReasonShortLabel[entry.successionReason]}
                    </span>
                  </div>
                ) : null}
                <div
                  className={`lineage-node ${tierClass(entry.tier)}`}
                  role="listitem"
                >
                  <span className="lineage-gen">
                    Generation {entry.generationIndex + 1}
                  </span>
                  <span className="lineage-name">{entry.displayName}</span>
                  <span className="lineage-meta">Tier {entry.tier}</span>
                  <LineageAffixStatLines entry={entry} />
                  <span className="lineage-reason">
                    {successionReasonShortLabel[entry.successionReason]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="lineage-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};
