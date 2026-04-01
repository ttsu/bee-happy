import type { World } from "excalibur";
import { hiveKey } from "../../grid/hive-levels";
import { CellCoordComponent, JobComponent } from "../ecs/components/colony-components";

export const hasHoneyJobAtCell = (world: World, coord: CellCoordComponent): boolean => {
  const key = hiveKey({
    q: coord.q,
    r: coord.r,
    level: coord.level,
  });
  for (const e of world.entities) {
    const j = e.get(JobComponent);
    if (
      j &&
      j.kind === "honeyProcess" &&
      j.status !== "done" &&
      hiveKey({
        q: j.targetQ,
        r: j.targetR,
        level: j.targetLevel,
      }) === key
    ) {
      return true;
    }
  }
  return false;
};
