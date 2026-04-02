import type { CSSProperties } from "react";
import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import {
  CELL_SPRITE_SRC_H,
  CELL_SPRITE_SRC_W,
  CELL_TYPE_PICKER_ICON_FRAMES,
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

  const spriteScale = 0.25;
  const sheetCols = 4;
  const sheetRows = 4;
  const bgW = CELL_SPRITE_SRC_W * sheetCols * spriteScale;
  const bgH = CELL_SPRITE_SRC_H * sheetRows * spriteScale;
  const iconBoxW = CELL_SPRITE_SRC_W * spriteScale;
  const iconBoxH = CELL_SPRITE_SRC_H * spriteScale;

  const iconStyle = (frame1Based: number): CSSProperties => {
    const idx = Math.min(16, Math.max(1, Math.floor(frame1Based))) - 1;
    const col = idx % 4;
    const row = (idx / 4) | 0;
    const posX = col * CELL_SPRITE_SRC_W * spriteScale;
    const posY = row * CELL_SPRITE_SRC_H * spriteScale;
    return {
      width: iconBoxW,
      height: iconBoxH,
      backgroundImage: "url(/images/cell_sprites.png)",
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `-${posX}px -${posY}px`,
      backgroundClip: "content-box",
      borderRadius: 8,
    };
  };

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
      style={iconStyle(frame)}
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
