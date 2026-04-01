/**
 * Hive cell sheet: `/images/cell_sprites.png` is a 4×4 grid of 246×280 px frames.
 * {@link drawCellSpriteSheetFrame} in `cell-renderer-actor.ts` uses 1-based frame indices (top-left = 1).
 */
export const CELL_SPRITE_SRC_W = 246;
export const CELL_SPRITE_SRC_H = 280;

/** 1-based sprite indices for cell-type picker icons (matches renderer frames). */
export const CELL_TYPE_PICKER_ICON_FRAMES = {
  nectar: 4,
  pollen: 9,
  brood: 12,
} as const;
