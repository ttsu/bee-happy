import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ColonyRuntime } from "../colony/colony-runtime";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";

const HUD_MINIMIZED_KEY = "bee-happy-hud-minimized";
const DELTA_TICK_MS = 1100;

type HudMetricKey = "workers" | "pollen" | "honey" | "nectar" | "beeswax" | "happiness";

export type HudIconKind = HudMetricKey | "brood";

const HUD_METRIC_KEYS: readonly HudMetricKey[] = [
  "workers",
  "pollen",
  "honey",
  "nectar",
  "beeswax",
  "happiness",
] as const;

type HudMetrics = Record<HudMetricKey, number>;

type DeltaTick = {
  readonly id: number;
  readonly delta: number;
};

type Props = {
  readonly snap: ColonyUiSnapshot;
  readonly colony: ColonyRuntime | null;
};

const DROP_PATH =
  "M8 2.5c2.8 3.2 4.5 5.2 4.5 7.2a4.5 4.5 0 1 1-9 0C3.5 7.7 5.2 5.7 8 2.5z";

const readHudMinimized = (): boolean => {
  try {
    return localStorage.getItem(HUD_MINIMIZED_KEY) === "1";
  } catch {
    return false;
  }
};

const metricsFromSnap = (snap: ColonyUiSnapshot): HudMetrics => ({
  workers: snap.workers,
  pollen: Math.round(snap.pollen),
  honey: Math.round(snap.honey),
  nectar: Math.round(snap.nectar),
  beeswax: Math.round(snap.beeswax),
  happiness: snap.happinessPct,
});

const formatDelta = (delta: number): string => (delta > 0 ? `+${delta}` : `${delta}`);

const meterPct = (value: number, capacity: number): number =>
  capacity > 0 ? Math.min(100, Math.max(0, (value / capacity) * 100)) : 0;

/** Liquid drop with layered gradients for depth, highlight, and refraction. */
const DropIcon = ({
  bodyId,
  rimId,
  highlightId,
  clipId,
  stops,
  rimStops,
}: {
  readonly bodyId: string;
  readonly rimId: string;
  readonly highlightId: string;
  readonly clipId: string;
  readonly stops: readonly { readonly offset: string; readonly color: string }[];
  readonly rimStops: readonly {
    readonly offset: string;
    readonly color: string;
    readonly opacity?: string;
  }[];
}) => (
  <svg viewBox="0 0 16 16" width="14" height="14">
    <defs>
      <clipPath id={clipId}>
        <path d={DROP_PATH} />
      </clipPath>
      <radialGradient id={bodyId} cx="32%" cy="26%" r="78%">
        {stops.map((s) => (
          <stop key={s.offset} offset={s.offset} stopColor={s.color} />
        ))}
      </radialGradient>
      <linearGradient id={rimId} x1="15%" y1="5%" x2="90%" y2="95%">
        {rimStops.map((s) => (
          <stop
            key={s.offset}
            offset={s.offset}
            stopColor={s.color}
            stopOpacity={s.opacity ?? "1"}
          />
        ))}
      </linearGradient>
      <radialGradient id={highlightId} cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Soft contact shadow for lift */}
    <ellipse cx="8" cy="14.15" rx="3.4" ry="0.9" fill="#000000" opacity="0.28" />
    {/* Deep underside offset for thickness */}
    <path
      d={DROP_PATH}
      fill={stops[stops.length - 1]?.color ?? "#000"}
      opacity="0.65"
      transform="translate(0 0.55)"
    />
    {/* Main body */}
    <path d={DROP_PATH} fill={`url(#${bodyId})`} />
    {/* Inner refraction / glass rim */}
    <path
      d={DROP_PATH}
      fill="none"
      stroke={`url(#${rimId})`}
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
    <g clipPath={`url(#${clipId})`}>
      {/* Specular highlight (upper-left) */}
      <ellipse
        cx="5.9"
        cy="6.2"
        rx="2.05"
        ry="2.85"
        fill={`url(#${highlightId})`}
        transform="rotate(-24 5.9 6.2)"
      />
      {/* Bottom-right caustic */}
      <circle cx="9.7" cy="11" r="1.05" fill="#ffffff" opacity="0.32" />
      {/* Edge light streak */}
      <path
        d="M9.9 4.4c1.15 0.95 1.85 2.05 2.05 3.15"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.85"
        strokeLinecap="round"
        opacity="0.42"
      />
    </g>
  </svg>
);

export const HudIcon = ({
  kind,
  label,
}: {
  readonly kind: HudIconKind;
  readonly label: string;
}) => {
  const uid = useId().replace(/:/g, "");
  return (
    <span className={`hud-icon hud-icon--${kind}`} aria-hidden title={label}>
      {kind === "workers" ? (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <ellipse cx="8" cy="9" rx="3.2" ry="4" fill="currentColor" opacity="0.9" />
          <circle cx="8" cy="4.2" r="2" fill="currentColor" />
          <path
            d="M3.5 7.5c1.2-1 2.4-.6 2.4-.6M12.5 7.5c-1.2-1-2.4-.6-2.4-.6"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {kind === "pollen" ? (
        <svg viewBox="0 0 16 16" width="14" height="14">
          {/* Three grains in a triangle; slight overlap + hue shift */}
          <circle cx="8" cy="5" r="3.25" fill="#f4d03f" />
          <circle cx="5.2" cy="9.9" r="3.25" fill="#f5b041" />
          <circle cx="10.8" cy="9.9" r="3.25" fill="#f9e79f" />
          {/* Soft edge rings so grains separate at 14px */}
          <circle
            cx="8"
            cy="5"
            r="3.25"
            fill="none"
            stroke="#d4ac0d"
            strokeWidth="0.4"
            opacity="0.5"
          />
          <circle
            cx="5.2"
            cy="9.9"
            r="3.25"
            fill="none"
            stroke="#d68910"
            strokeWidth="0.4"
            opacity="0.45"
          />
          <circle
            cx="10.8"
            cy="9.9"
            r="3.25"
            fill="none"
            stroke="#b7950b"
            strokeWidth="0.4"
            opacity="0.4"
          />
          {/* Soft grain highlights */}
          <circle cx="7.2" cy="4.1" r="0.95" fill="#fdebd0" opacity="0.7" />
          <circle cx="4.4" cy="9.05" r="0.85" fill="#fdebd0" opacity="0.5" />
          <circle cx="10" cy="9.05" r="0.9" fill="#ffffff" opacity="0.5" />
        </svg>
      ) : null}
      {kind === "honey" ? (
        <DropIcon
          bodyId={`honey-body-${uid}`}
          rimId={`honey-rim-${uid}`}
          highlightId={`honey-hl-${uid}`}
          clipId={`honey-clip-${uid}`}
          stops={[
            { offset: "0%", color: "#ffe9a8" },
            { offset: "35%", color: "#e8a317" },
            { offset: "100%", color: "#7d5608" },
          ]}
          rimStops={[
            { offset: "0%", color: "#fff8e1", opacity: "0.85" },
            { offset: "40%", color: "#e8a317", opacity: "0.08" },
            { offset: "100%", color: "#4a3004", opacity: "0.55" },
          ]}
        />
      ) : null}
      {kind === "nectar" ? (
        <DropIcon
          bodyId={`nectar-body-${uid}`}
          rimId={`nectar-rim-${uid}`}
          highlightId={`nectar-hl-${uid}`}
          clipId={`nectar-clip-${uid}`}
          stops={[
            { offset: "0%", color: "#ffffff" },
            { offset: "32%", color: "#fbf3c2" },
            { offset: "100%", color: "#e6c84a" },
          ]}
          rimStops={[
            { offset: "0%", color: "#ffffff", opacity: "0.9" },
            { offset: "40%", color: "#f9e79f", opacity: "0.08" },
            { offset: "100%", color: "#b7950b", opacity: "0.45" },
          ]}
        />
      ) : null}
      {kind === "beeswax" ? (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <rect x="2.5" y="5" width="11" height="7" rx="1.5" fill="#d4a574" />
          <rect x="4" y="3.5" width="8" height="2.5" rx="1" fill="#c4956a" />
        </svg>
      ) : null}
      {kind === "happiness" ? (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <circle cx="8" cy="8" r="5.5" fill="#82e0aa" opacity="0.35" />
          <circle
            cx="8"
            cy="8"
            r="5.5"
            fill="none"
            stroke="#82e0aa"
            strokeWidth="1.2"
          />
          <path
            d="M5.2 9.2c.8 1.2 1.8 1.8 2.8 1.8s2-.6 2.8-1.8"
            stroke="#82e0aa"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="5.8" cy="6.6" r="0.8" fill="#ecf0f1" />
          <circle cx="10.2" cy="6.6" r="0.8" fill="#ecf0f1" />
        </svg>
      ) : null}
      {kind === "brood" ? (
        <svg viewBox="0 0 16 16" width="14" height="14">
          {/* One plump grub: thick body nearly matching round tip bulbs */}
          <path
            d="M5.2 5.2A4.6 4.6 0 0 1 10.8 10.8"
            fill="none"
            stroke="#f5cba7"
            strokeWidth="5.8"
            strokeLinecap="round"
          />
          <path
            d="M5.2 5.2A4.6 4.6 0 0 1 10.8 10.8"
            fill="none"
            stroke="#fdebd0"
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <circle cx="5.2" cy="5.2" r="3.25" fill="#f5cba7" />
          <circle cx="5.2" cy="5.2" r="2.6" fill="#fef5e7" />
          <circle cx="10.8" cy="10.8" r="3.15" fill="#f5cba7" />
          <circle cx="10.8" cy="10.8" r="2.55" fill="#fdebd0" />
          <circle cx="5.95" cy="4.5" r="0.45" fill="#6e4c2a" opacity="0.45" />
        </svg>
      ) : null}
    </span>
  );
};

const DeltaBadge = ({ tick }: { readonly tick: DeltaTick | undefined }) => {
  if (!tick || tick.delta === 0) {
    return null;
  }
  return (
    <span
      key={tick.id}
      className={`hud-delta${tick.delta > 0 ? " hud-delta--up" : " hud-delta--down"}`}
      aria-hidden
    >
      {formatDelta(tick.delta)}
    </span>
  );
};

const MetricValue = ({
  value,
  suffix = "",
  tick,
}: {
  readonly value: string;
  readonly suffix?: string;
  readonly tick: DeltaTick | undefined;
}): ReactNode => (
  <span className="hud-metric-value">
    <span className="hud-metric-number">
      {value}
      {suffix}
    </span>
    <DeltaBadge tick={tick} />
  </span>
);

const HudResourceMeter = ({
  label,
  icon,
  value,
  capacity,
  fillClass,
  displayValue,
  tick,
  markerRatio,
  markerTitle,
}: {
  readonly label: string;
  readonly icon: HudIconKind;
  readonly value: number;
  readonly capacity: number;
  readonly fillClass: string;
  readonly displayValue: string;
  readonly tick?: DeltaTick;
  /** 0–1 position for an optional vertical marker on the bar. */
  readonly markerRatio?: number;
  readonly markerTitle?: string;
}) => {
  const markerPct =
    markerRatio == null ? null : Math.min(100, Math.max(0, markerRatio * 100));
  return (
    <div className="hud-resource-row">
      <span className="hud-stat-label">
        <HudIcon kind={icon} label={label} />
        {label}
      </span>
      <div
        className="hud-resource-bar"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={label}
        title={markerTitle}
      >
        <div
          className={`hud-resource-bar-fill ${fillClass}`}
          style={{ width: `${meterPct(value, capacity)}%` }}
        />
        {markerPct != null ? (
          <div
            className="hud-resource-bar-marker"
            style={{ left: `${markerPct}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <span className="hud-resource-value">
        <MetricValue value={displayValue} tick={tick} />
      </span>
    </div>
  );
};

const HudBroodMeter = ({
  pupae,
  larvae,
  empty,
  capacity,
  occupied,
}: {
  readonly pupae: number;
  readonly larvae: number;
  readonly empty: number;
  readonly capacity: number;
  readonly occupied: number;
}) => {
  const pupaePct = meterPct(pupae, capacity);
  const larvaePct = meterPct(larvae, capacity);
  const emptyPct = meterPct(empty, capacity);
  return (
    <div className="hud-resource-row">
      <span className="hud-stat-label">
        <HudIcon kind="brood" label="Brood" />
        Brood
      </span>
      <div
        className="hud-resource-bar hud-resource-bar--stacked"
        role="meter"
        aria-valuenow={occupied}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={`Brood: ${pupae} pupae, ${larvae} larvae, ${empty} empty`}
        title={`Pupae ${pupae} · Larvae ${larvae} · Empty ${empty}`}
      >
        {pupaePct > 0 ? (
          <div
            className="hud-resource-bar-fill hud-resource-bar-fill--brood-pupae"
            style={{ width: `${pupaePct}%` }}
          />
        ) : null}
        {larvaePct > 0 ? (
          <div
            className="hud-resource-bar-fill hud-resource-bar-fill--brood-larvae"
            style={{ width: `${larvaePct}%` }}
          />
        ) : null}
        {emptyPct > 0 ? (
          <div
            className="hud-resource-bar-fill hud-resource-bar-fill--brood-empty"
            style={{ width: `${emptyPct}%` }}
          />
        ) : null}
      </div>
      <span className="hud-resource-value">
        <MetricValue value={`${occupied}/${Math.round(capacity)}`} tick={undefined} />
      </span>
    </div>
  );
};

/**
 * Colony resource HUD: collapsed icon strip or expanded labeled rows, with delta ticks.
 */
export const ColonyHud = ({ snap, colony }: Props) => {
  const [hudMinimized, setHudMinimized] = useState(readHudMinimized);
  const [deltas, setDeltas] = useState<Partial<Record<HudMetricKey, DeltaTick>>>({});
  const prevMetricsRef = useRef<HudMetrics | null>(null);
  const tickIdRef = useRef(0);
  const clearTimersRef = useRef<
    Partial<Record<HudMetricKey, ReturnType<typeof setTimeout>>>
  >({});

  useEffect(() => {
    try {
      localStorage.setItem(HUD_MINIMIZED_KEY, hudMinimized ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [hudMinimized]);

  useEffect(() => {
    const current = metricsFromSnap(snap);
    const prev = prevMetricsRef.current;
    if (prev === null) {
      prevMetricsRef.current = current;
      return;
    }

    const updates: Partial<Record<HudMetricKey, DeltaTick>> = {};
    let hasUpdate = false;
    for (const key of HUD_METRIC_KEYS) {
      const delta = current[key] - prev[key];
      if (delta === 0) {
        continue;
      }
      hasUpdate = true;
      tickIdRef.current += 1;
      const tick: DeltaTick = { id: tickIdRef.current, delta };
      updates[key] = tick;
      const existing = clearTimersRef.current[key];
      if (existing) {
        clearTimeout(existing);
      }
      clearTimersRef.current[key] = setTimeout(() => {
        setDeltas((d) => {
          if (!d[key] || d[key]?.id !== tick.id) {
            return d;
          }
          const next = { ...d };
          delete next[key];
          return next;
        });
        delete clearTimersRef.current[key];
      }, DELTA_TICK_MS);
    }

    if (hasUpdate) {
      setDeltas((d) => ({ ...d, ...updates }));
    }
    prevMetricsRef.current = current;
  }, [
    snap.workers,
    snap.pollen,
    snap.honey,
    snap.nectar,
    snap.beeswax,
    snap.happinessPct,
  ]);

  useEffect(() => {
    return () => {
      for (const key of HUD_METRIC_KEYS) {
        const t = clearTimersRef.current[key];
        if (t) {
          clearTimeout(t);
        }
      }
    };
  }, []);

  const workers = snap.workers;
  const pollen = Math.round(snap.pollen);
  const pollenCap = Math.round(snap.pollenCapacity);
  const honey = Math.round(snap.honey);
  const honeyCap = Math.round(snap.honeyCapacity);
  const nectar = Math.round(snap.nectar);
  const nectarCap = Math.round(snap.nectarCapacity);
  const beeswax = Math.round(snap.beeswax);
  const beeswaxCap = Math.round(snap.beeswaxCapacity);
  const happiness = snap.happinessPct;

  const toggle = () => {
    setHudMinimized((m) => !m);
  };

  return (
    <div className="hud">
      <div className={`hud-card${hudMinimized ? " hud-card--minimized" : ""}`}>
        <button
          type="button"
          className="hud-toggle"
          aria-expanded={!hudMinimized}
          aria-label={hudMinimized ? "Expand colony stats" : "Collapse colony stats"}
          onClick={toggle}
        >
          <span className="hud-chevron" aria-hidden>
            {hudMinimized ? "▸" : "▾"}
          </span>
          {hudMinimized ? (
            <div className="hud-strip" aria-hidden={false}>
              <div className="hud-strip-item" title="Workers">
                <HudIcon kind="workers" label="Workers" />
                <MetricValue value={String(workers)} tick={deltas.workers} />
              </div>
              <div className="hud-strip-item" title="Pollen">
                <HudIcon kind="pollen" label="Pollen" />
                <MetricValue value={String(pollen)} tick={deltas.pollen} />
              </div>
              <div className="hud-strip-item" title="Honey">
                <HudIcon kind="honey" label="Honey" />
                <MetricValue value={String(honey)} tick={deltas.honey} />
              </div>
              <div className="hud-strip-item" title="Nectar">
                <HudIcon kind="nectar" label="Nectar" />
                <MetricValue value={String(nectar)} tick={deltas.nectar} />
              </div>
              <div className="hud-strip-item" title="Beeswax">
                <HudIcon kind="beeswax" label="Beeswax" />
                <MetricValue value={`${beeswax}/${beeswaxCap}`} tick={deltas.beeswax} />
              </div>
              <div className="hud-strip-item" title="Happiness">
                <HudIcon kind="happiness" label="Happiness" />
                <MetricValue
                  value={String(happiness)}
                  suffix="%"
                  tick={deltas.happiness}
                />
              </div>
            </div>
          ) : (
            <div className="hud-stats">
              <div className="hud-stat-row">
                <span className="hud-stat-label">
                  <HudIcon kind="workers" label="Workers" />
                  Workers
                </span>
                <MetricValue value={String(workers)} tick={deltas.workers} />
              </div>
              <HudResourceMeter
                label="Pollen"
                icon="pollen"
                value={snap.pollen}
                capacity={snap.pollenCapacity}
                fillClass="hud-resource-bar-fill--pollen"
                displayValue={`${pollen}/${pollenCap}`}
                tick={deltas.pollen}
              />
              <HudResourceMeter
                label="Honey"
                icon="honey"
                value={snap.honey}
                capacity={snap.honeyCapacity}
                fillClass="hud-resource-bar-fill--honey"
                displayValue={`${honey}/${honeyCap}`}
                tick={deltas.honey}
                markerRatio={
                  snap.honeyCapacity > 0
                    ? snap.winterHoneyNeed / snap.honeyCapacity
                    : undefined
                }
                markerTitle={
                  snap.winterHoneyNeed > 0
                    ? `Winter need: ${Math.ceil(snap.winterHoneyNeed)} honey`
                    : undefined
                }
              />
              <HudResourceMeter
                label="Nectar"
                icon="nectar"
                value={snap.nectar}
                capacity={snap.nectarCapacity}
                fillClass="hud-resource-bar-fill--nectar"
                displayValue={`${nectar}/${nectarCap}`}
                tick={deltas.nectar}
              />
              <HudBroodMeter
                pupae={snap.broodPupae}
                larvae={snap.broodLarvae}
                empty={snap.broodEmpty}
                capacity={snap.broodTotal}
                occupied={snap.broodOccupied}
              />
              <HudResourceMeter
                label="Beeswax"
                icon="beeswax"
                value={snap.beeswax}
                capacity={snap.beeswaxCapacity}
                fillClass="hud-resource-bar-fill--beeswax"
                displayValue={`${beeswax}/${beeswaxCap}`}
                tick={deltas.beeswax}
              />
              <HudResourceMeter
                label="Happiness"
                icon="happiness"
                value={happiness}
                capacity={100}
                fillClass="hud-resource-bar-fill--happiness"
                displayValue={`${happiness}%`}
                tick={deltas.happiness}
              />
            </div>
          )}
        </button>
        {!hudMinimized && snap.optionalSuccessionAvailable ? (
          <div className="hud-succession-hint">
            <button
              type="button"
              className="hud-ascend-btn"
              onClick={(e) => {
                e.stopPropagation();
                colony?.requestOptionalSuccession();
              }}
            >
              Ascend — new queen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
