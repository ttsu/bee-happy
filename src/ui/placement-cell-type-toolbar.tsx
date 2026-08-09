import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import {
  CELL_TYPE_PICKER_ICON_FRAMES,
  cellSpriteIconStyle,
} from "../render/cell-sprite-frames";

type Props = {
  readonly snap: ColonyUiSnapshot;
  readonly colony: ColonyRuntime | null;
};

/**
 * Bottom bar: select which cell type new foundations will use when the player taps an empty hex.
 */
export const PlacementCellTypeToolbar = ({ snap, colony }: Props) => {
  const selected = snap.selectedPlacementCellType;

  const option = (
    type: "brood" | "pollen" | "nectar",
    label: string,
    frame: number,
  ) => (
    <button
      type="button"
      role="radio"
      aria-checked={selected === type}
      className={`placement-cell-type-option${selected === type ? " is-selected" : ""}`}
      aria-label={label}
      style={cellSpriteIconStyle(frame, {
        scale: 0.25,
        borderRadius: 8,
        backgroundClipContentBox: true,
      })}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.button !== 0 && e.button !== -1) {
          return;
        }
        colony?.setSelectedPlacementCellType(type);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") {
          return;
        }
        e.preventDefault();
        colony?.setSelectedPlacementCellType(type);
      }}
    >
      <span className="sr-only">{label}</span>
    </button>
  );

  return (
    <div
      className="placement-cell-type-toolbar"
      role="radiogroup"
      aria-label="Cell type to place"
    >
      <span className="placement-cell-type-toolbar-label">Build</span>
      <div className="placement-cell-type-toolbar-options">
        {option("brood", "Brood", CELL_TYPE_PICKER_ICON_FRAMES.brood)}
        {option("pollen", "Pollen", CELL_TYPE_PICKER_ICON_FRAMES.pollen)}
        {option("nectar", "Nectar", CELL_TYPE_PICKER_ICON_FRAMES.nectar)}
      </div>
    </div>
  );
};
