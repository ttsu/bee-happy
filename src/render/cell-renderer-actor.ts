import { Color, type ExcaliburGraphicsContext, vec } from "excalibur";
import type { ColonyRuntime } from "../colony/colony-runtime";
import {
  CellCoordComponent,
  CellStateComponent,
} from "../colony/ecs/components/colony-components";
import { COLONY } from "../colony/constants";
import { hexToWorld } from "../grid/hex-grid";

const hexCorners = (cx: number, cy: number, r: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
};

const colorForCell = (st: InstanceType<typeof CellStateComponent>): Color => {
  if (!st.built) {
    return Color.fromHex("#7f8c8d");
  }
  if (st.stage === "foundation") {
    return Color.fromHex("#95a5a6");
  }
  switch (st.cellType) {
    case "brood":
      if (st.stage === "egg") {
        return Color.fromHex("#fdebd0");
      }
      if (st.stage === "larvae") {
        return Color.fromHex("#f8c471");
      }
      if (st.stage === "sealed") {
        return Color.fromHex("#d7bde2");
      }
      if (st.stage === "cleaning") {
        return Color.fromHex("#aed6f1");
      }
      return Color.fromHex("#fadbd8");
    case "pollen":
      return Color.fromHex("#f7dc6f");
    case "nectar":
      return Color.fromHex("#82e0aa");
    default:
      return Color.fromHex("#ecf0f1");
  }
};

/**
 * Draws hive cells for the active level (called from {@link Scene.onPostDraw}).
 */
export const drawHiveCells = (
  ctx: ExcaliburGraphicsContext,
  colony: ColonyRuntime,
): void => {
  const lvl = colony.activeLevel;
  const S = COLONY.hexSize;
  for (const [, ent] of colony.cellsByKey) {
    const c = ent.get(CellCoordComponent)!;
    if (c.level !== lvl) {
      continue;
    }
    const st = ent.get(CellStateComponent)!;
    const w = hexToWorld({ q: c.q, r: c.r }, S);
    const corners = hexCorners(w.x, w.y, S * 0.92);
    const stroke = Color.fromHex("#555555");
    for (let i = 0; i < 6; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 6]!;
      ctx.drawLine(vec(a[0], a[1]), vec(b[0], b[1]), stroke, 1.5);
    }
    const fill = colorForCell(st);
    ctx.drawCircle(w, S * 0.55, fill, Color.fromHex("#2c3e50"), 1);
  }
};
