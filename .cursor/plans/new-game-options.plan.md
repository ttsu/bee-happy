# New game configuration (updated)

## Scope and assumptions

- **Starting bees** = starting **workers** (queen always one). Default **2**, max **50**.
- **Intruders**: no simulation today; persist `intrudersEnabled` for future hooks.
- **Lineage default off** for new games only. Legacy saves: `lineageSystemEnabled ?? true`.

## Lineage disabled: no succession, indefinite queen

When `lineageSystemEnabled === false`:

1. **Do not show succession**  
   - Never set `successionModal` (no optional pupa flow, no mandatory pupa flow).  
   - `requestOptionalSuccession` and `triggerMandatorySuccession` should **return immediately** (implement in [`colony-succession.ts`](src/colony/colony-succession.ts) / [`ColonyRuntime`](src/colony/colony-runtime.ts) wrappers) when lineage is off.  
   - Hide UI affordances that open succession ([`App`](src/ui/app.tsx) optional succession control).  
   - **Remove** the previously planned “minimal succession modal with Continue” — not applicable.

2. **Queen lives indefinitely**  
   - [`SeasonSystem`](src/colony/ecs/systems/season-system.ts): when lineage is off, **do not** call `triggerMandatorySuccession("queenAgedOut")` at the calendar year boundary (skip the `queenAgeOutYearNumber` branch for this mode). Year review / `yearNumber` can still advance when the player continues after the annual review, or follow existing year UI — only **succession** is removed, not necessarily the stats modal unless you choose to simplify later.  
   - **Other queen death → succession today**: [`adult-care-system.ts`](src/colony/ecs/systems/adult-care-system.ts) (`queenStarved`), [`level.ts`](src/level.ts) dev key shortcuts. To avoid a dead queen with no succession UI, **gate** `triggerMandatorySuccession` for those reasons when lineage is off **and** add a small simulation rule so the queen does not hit lethal starvation in this mode (e.g. queen-only needs floor, or skip the starvation kill branch when lineage off). Prefer one clear rule: **queen cannot be removed by succession-related death paths** while lineage is off.

3. **Lineage meta / constants**  
   - Keep `refreshActiveColonyConstantsFromMeta` behavior: lineage off ⇒ identity multipliers (ignore stored lineage).  
   - No `appendLineageEntry` on “succession” because succession never runs; meta lineage stays irrelevant for gameplay.

## Architecture (data flow)

Same as before: launch options → `PendingGameStart.newGameOptions` → `MyLevel` → `ColonyRuntime` with persisted `gameSettings`.

## Implementation areas (delta from prior plan)

| Topic | Change |
|--------|--------|
| Succession UI | **Never** render / open when lineage off; delete simplified-modal approach. |
| `SuccessionModal` | Only relevant when lineage on; optional early return if `snap.lineageSystemEnabled === false` as a safety net. |
| Season / year | Still use dynamic `daysPerSeason`; only **age-out → succession** is disabled when lineage off. |
| Queen survival | Explicit gating + non-lethal queen (or equivalent) when lineage off so the hive does not soft-lock. |

## Remaining plan sections

(Unchanged from the previous full plan: `game-settings` module, new-game modal UI, `getSeasonForColonyDay(daysPerSeason)`, runtime + save round-trip, starting worker ring seeding, HUD snapshot fields, Playwright updates for the options step.)

### Todos

- game-settings + `PendingGameStart` + entry flow  
- New game options modal + styles  
- Calendar refactor + `SeasonSystem` year length + economy season reads  
- Runtime fields, seed/save, **succession gates + queen age-out skip + queen starvation handling**  
- Lineage multipliers + hide lineage button; **no** succession UX when off  
- Snapshot schema + HUD + tests  
