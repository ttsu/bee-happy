import { COLONY } from "./constants";
import type { CellStateComponent } from "./ecs/components/colony-components";

const HONEY_EPS = 1e-9;

/**
 * Whether a nectar cell may receive new nectar: no honey in the cell (nectar and honey do not co‑exist).
 */
export const nectarCellCanAcceptNectarDeposit = (st: CellStateComponent): boolean =>
  st.built &&
  st.cellType === "nectar" &&
  st.honeyStored <= HONEY_EPS &&
  st.nectarStored < COLONY.nectarCellCapacity;

/**
 * Full nectar, no honey yet — eligible to queue honey processing.
 */
export const nectarCellReadyForHoneyProcessing = (st: CellStateComponent): boolean =>
  st.built &&
  st.cellType === "nectar" &&
  st.honeyStored <= HONEY_EPS &&
  st.nectarStored >= COLONY.nectarCellCapacity;

/**
 * Cell nectar usable for feeding (not while the cell holds honey).
 */
export const nectarCellHasNectarForFeeding = (
  st: CellStateComponent,
  minNectar: number,
): boolean =>
  st.built &&
  st.cellType === "nectar" &&
  st.honeyStored <= HONEY_EPS &&
  st.nectarStored >= minNectar;

/**
 * Cell honey usable for feeding (larvae or adults).
 */
export const nectarCellHasHoneyForFeeding = (
  st: CellStateComponent,
  minHoney: number,
): boolean =>
  st.built && st.cellType === "nectar" && st.honeyStored >= minHoney - HONEY_EPS;
