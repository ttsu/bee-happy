import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import {
  CELL_SPRITE_SRC_H,
  CELL_SPRITE_SRC_W,
  CELL_TYPE_PICKER_ICON_FRAMES,
} from "../render/cell-sprite-frames";

const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

type Props = {
  readonly snap: ColonyUiSnapshot;
  readonly colony: ColonyRuntime | null;
};

/**
 * Anchored cell-type chooser with sprite icons; pointer-up hit-testing (capture)
 * supports swipe-from-cell to option without relying on synthetic click.
 */
export const CellTypePicker = ({ snap, colony }: Props) => {
  const anchor = snap.pendingCellTypeAnchor;
  const popoverRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ left: number; top: number } | null>(null);

  const applyLayout = useCallback(() => {
    if (!anchor || !popoverRef.current) {
      return;
    }
    const margin = 8;
    const ax = anchor.pageX - window.scrollX;
    const ay = anchor.pageY - window.scrollY;
    const el = popoverRef.current;
    const r = el.getBoundingClientRect();
    const halfW = r.width / 2;
    const gap = 12;
    let left = clamp(ax, margin + halfW, window.innerWidth - margin - halfW);
    let top = ay;
    const topEdge = top - gap - r.height;
    if (topEdge < margin) {
      top = margin + gap + r.height;
    }
    if (top > window.innerHeight - margin) {
      top = window.innerHeight - margin;
    }
    setLayout({ left, top });
  }, [anchor]);

  useLayoutEffect(() => {
    applyLayout();
  }, [applyLayout, snap.pendingCellTypeKey, snap.cellTypeChangeError]);

  useEffect(() => {
    const onResize = (): void => {
      applyLayout();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [applyLayout]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        colony?.dismissCellTypePicker();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [colony]);

  useEffect(() => {
    /** Dismiss only; selection runs on option buttons (after this capture returns). */
    const onPointerUpCapture = (e: PointerEvent): void => {
      if (!colony?.pendingCellTypeKey) {
        return;
      }
      const topEl = document.elementFromPoint(e.clientX, e.clientY);
      if (topEl?.closest?.("[data-cell-type-option]")) {
        return;
      }
      if (topEl?.closest?.(".cell-type-popover")) {
        colony.dismissCellTypePicker();
        return;
      }
      const canvas = document.getElementById("game-canvas");
      if (canvas && topEl && (canvas === topEl || canvas.contains(topEl))) {
        const key = colony.hiveKeyUnderPagePoint(e.pageX, e.pageY);
        if (key === colony.pendingCellTypeKey) {
          return;
        }
        colony.dismissCellTypePicker();
        return;
      }
      colony.dismissCellTypePicker();
    };
    window.addEventListener("pointerup", onPointerUpCapture, true);
    return () => {
      window.removeEventListener("pointerup", onPointerUpCapture, true);
    };
  }, [colony]);

  const spriteScale = 0.25;
  const sheetCols = 4;
  const sheetRows = 4;
  const bgW = CELL_SPRITE_SRC_W * sheetCols * spriteScale;
  const bgH = CELL_SPRITE_SRC_H * sheetRows * spriteScale;
  const iconBoxW = CELL_SPRITE_SRC_W * spriteScale;
  const iconBoxH = CELL_SPRITE_SRC_H * spriteScale;

  const pick = (targetType: "brood" | "pollen" | "nectar"): void => {
    const k = colony?.pendingCellTypeKey;
    if (k) {
      colony?.requestCellTypeChange(k, targetType);
    }
  };

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

  if (!snap.pendingCellTypeKey) {
    return null;
  }

  const fallbackPage = {
    pageX: typeof window !== "undefined" ? window.innerWidth / 2 + window.scrollX : 0,
    pageY: typeof window !== "undefined" ? window.innerHeight / 2 + window.scrollY : 0,
  };
  const effectiveAnchor = anchor ?? fallbackPage;

  const left =
    layout?.left ??
    effectiveAnchor.pageX - (typeof window !== "undefined" ? window.scrollX : 0);
  const top =
    layout?.top ??
    effectiveAnchor.pageY - (typeof window !== "undefined" ? window.scrollY : 0);

  return (
    <div
      ref={popoverRef}
      className="cell-type-popover"
      role="dialog"
      aria-modal
      aria-label="Choose cell type"
      style={{
        left,
        top,
        transform: "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <p className="cell-type-popover-title">Choose cell type</p>
      {snap.cellTypeChangeError ? (
        <p className="cell-type-popover-error" role="alert">
          {snap.cellTypeChangeError}
        </p>
      ) : null}
      <div className="cell-type-popover-options">
        <button
          type="button"
          data-cell-type-option
          data-cell-type="brood"
          className="cell-type-option"
          aria-label="Brood cell"
          style={iconStyle(CELL_TYPE_PICKER_ICON_FRAMES.brood)}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (e.button !== 0 && e.button !== -1) {
              return;
            }
            pick("brood");
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") {
              return;
            }
            e.preventDefault();
            pick("brood");
          }}
        >
          <span className="sr-only">Brood</span>
        </button>
        <button
          type="button"
          data-cell-type-option
          data-cell-type="pollen"
          className="cell-type-option"
          aria-label="Pollen cell"
          style={iconStyle(CELL_TYPE_PICKER_ICON_FRAMES.pollen)}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (e.button !== 0 && e.button !== -1) {
              return;
            }
            pick("pollen");
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") {
              return;
            }
            e.preventDefault();
            pick("pollen");
          }}
        >
          <span className="sr-only">Pollen</span>
        </button>
        <button
          type="button"
          data-cell-type-option
          data-cell-type="nectar"
          className="cell-type-option"
          aria-label="Nectar and honey cell"
          style={iconStyle(CELL_TYPE_PICKER_ICON_FRAMES.nectar)}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (e.button !== 0 && e.button !== -1) {
              return;
            }
            pick("nectar");
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") {
              return;
            }
            e.preventDefault();
            pick("nectar");
          }}
        >
          <span className="sr-only">Nectar / honey</span>
        </button>
      </div>
    </div>
  );
};
