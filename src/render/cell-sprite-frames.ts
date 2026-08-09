/**
 * Hive cell sheet: `/images/cell_sprites.png` is a 4×4 grid of 246×280 px frames.
 * {@link drawCellSpriteSheetFrame} in `cell-renderer-actor.ts` uses 1-based frame indices (top-left = 1).
 */
export const CELL_SPRITE_SRC_W = 246;
export const CELL_SPRITE_SRC_H = 280;

export const CELL_SPRITE_SHEET_COLS = 4;
export const CELL_SPRITE_SHEET_ROWS = 4;

/** Public URL for the cell sprite sheet (respects Vite `base`). */
export const cellSpriteSheetUrl = (): string =>
  `${import.meta.env.BASE_URL}images/cell_sprites.png`;

/**
 * 1-based sprite indices for UI icons (matches renderer frames).
 * Honey uses the uncapped honey cell; nectar / pollen / brood match the cell-type picker.
 */
export const CELL_TYPE_PICKER_ICON_FRAMES = {
  nectar: 4,
  honey: 5,
  pollen: 9,
  brood: 12,
} as const;

export type CellSpriteIconKind = keyof typeof CELL_TYPE_PICKER_ICON_FRAMES;

/** CSS properties for a single cell-sheet frame as a background sprite. */
export type CellSpriteIconStyle = {
  readonly width: number;
  readonly height: number;
  readonly backgroundImage: string;
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
  readonly backgroundRepeat: "no-repeat";
  readonly backgroundClip?: "content-box";
  readonly borderRadius?: number;
  readonly display: "inline-block";
  readonly flexShrink: 0;
};

export const cellSpriteIconStyle = (
  frame1Based: number,
  options?: {
    readonly scale?: number;
    readonly borderRadius?: number;
    readonly backgroundClipContentBox?: boolean;
  },
): CellSpriteIconStyle => {
  const scale = options?.scale ?? 0.25;
  const sheetCols = CELL_SPRITE_SHEET_COLS;
  const sheetRows = CELL_SPRITE_SHEET_ROWS;
  const bgW = CELL_SPRITE_SRC_W * sheetCols * scale;
  const bgH = CELL_SPRITE_SRC_H * sheetRows * scale;
  const iconBoxW = CELL_SPRITE_SRC_W * scale;
  const iconBoxH = CELL_SPRITE_SRC_H * scale;
  const idx = Math.min(16, Math.max(1, Math.floor(frame1Based))) - 1;
  const col = idx % sheetCols;
  const row = (idx / sheetCols) | 0;
  const posX = col * CELL_SPRITE_SRC_W * scale;
  const posY = row * CELL_SPRITE_SRC_H * scale;
  return {
    width: iconBoxW,
    height: iconBoxH,
    backgroundImage: `url(${cellSpriteSheetUrl()})`,
    backgroundSize: `${bgW}px ${bgH}px`,
    backgroundPosition: `-${posX}px -${posY}px`,
    backgroundRepeat: "no-repeat",
    ...(options?.backgroundClipContentBox
      ? { backgroundClip: "content-box" as const }
      : {}),
    ...(options?.borderRadius != null ? { borderRadius: options.borderRadius } : {}),
    display: "inline-block",
    flexShrink: 0,
  };
};
