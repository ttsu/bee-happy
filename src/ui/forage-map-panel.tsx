import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { HudIcon } from "./colony-hud";

type Props = {
  readonly snap: ColonyUiSnapshot;
  readonly colony: ColonyRuntime | null;
};

const OPTIONS = [
  { layer: "pollen", label: "Pollen" },
  { layer: "nectar", label: "Nectar" },
] as const;

/**
 * Forage heat map toggle: Off / Pollen / Nectar.
 *
 * Only one layer shows at a time — overlapping the amber and green ramps just reads as mud.
 */
export const ForageMapPanel = ({ snap, colony }: Props) => {
  const active = snap.forageHeatmapLayer;

  return (
    <div className="forage-map-panel" role="radiogroup" aria-label="Forage heat map">
      <span className="forage-map-panel-label">Forage</span>
      <div className="forage-map-panel-options">
        <button
          type="button"
          role="radio"
          aria-checked={active === null}
          className={`forage-map-option${active === null ? " is-selected" : ""}`}
          onClick={() => {
            colony?.setForageHeatmapLayer(null);
          }}
        >
          Off
        </button>
        {OPTIONS.map(({ layer, label }) => (
          <button
            key={layer}
            type="button"
            role="radio"
            aria-checked={active === layer}
            aria-label={`${label} heat map`}
            className={`forage-map-option forage-map-option--${layer}${
              active === layer ? " is-selected" : ""
            }`}
            onClick={() => {
              colony?.setForageHeatmapLayer(active === layer ? null : layer);
            }}
          >
            <HudIcon kind={layer} label={label} />
          </button>
        ))}
      </div>
    </div>
  );
};
