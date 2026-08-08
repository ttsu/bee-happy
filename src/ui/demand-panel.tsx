import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { HudIcon, type HudIconKind } from "./colony-hud";

type Props = {
  readonly snap: ColonyUiSnapshot;
};

type DemandKind = "pollen" | "nectar" | "brood";

const DEMAND_ROWS: readonly {
  readonly kind: DemandKind;
  readonly icon: HudIconKind;
  readonly label: string;
  readonly fillClass: string;
}[] = [
  {
    kind: "pollen",
    icon: "pollen",
    label: "Pollen",
    fillClass: "demand-bar-fill--pollen",
  },
  {
    kind: "nectar",
    icon: "nectar",
    label: "Nectar",
    fillClass: "demand-bar-fill--nectar",
  },
  {
    kind: "brood",
    icon: "brood",
    label: "Brood",
    fillClass: "demand-bar-fill--brood",
  },
] as const;

const demandLevelLabel = (value: number): string => {
  if (value >= 0.75) {
    return "high";
  }
  if (value >= 0.35) {
    return "medium";
  }
  if (value > 0.05) {
    return "low";
  }
  return "none";
};

const demandValue = (snap: ColonyUiSnapshot, kind: DemandKind): number => {
  switch (kind) {
    case "pollen":
      return snap.demandPollen;
    case "nectar":
      return snap.demandNectar;
    case "brood":
      return snap.demandBrood;
  }
};

/**
 * Bottom-left SimCity-style build demand meters (pollen / nectar / brood).
 */
export const DemandPanel = ({ snap }: Props) => (
  <aside className="demand-panel hud-card" aria-label="Demand">
    <div className="demand-panel-title">Demand</div>
    <div className="demand-panel-bars">
      {DEMAND_ROWS.map((row) => {
        const value = Math.min(1, Math.max(0, demandValue(snap, row.kind)));
        const pct = Math.round(value * 100);
        const level = demandLevelLabel(value);
        return (
          <div key={row.kind} className="demand-bar-col">
            <div
              className="demand-bar-track"
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${row.label} demand ${level}`}
              title={`${row.label} demand ${level}`}
            >
              <div
                className={`demand-bar-fill ${row.fillClass}`}
                style={{ height: `${pct}%` }}
              />
            </div>
            <HudIcon kind={row.icon} label={row.label} />
          </div>
        );
      })}
    </div>
  </aside>
);
