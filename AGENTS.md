# AGENTS.md

## Cursor Cloud specific instructions

**Bee Happy** is a client-side browser game (Excalibur.js + React + Vite). No backend, database, or external services are needed.

### Quick reference

| Task             | Command                                                     |
| ---------------- | ----------------------------------------------------------- |
| Dev server       | `npm run dev` (Vite, port 5173)                             |
| Lint             | `npm run lint` (Prettier)                                   |
| Type check       | `npx tsc --noEmit`                                          |
| Build            | `npm run build` (runs lint + tsc + vite build)              |
| E2E tests        | `npm run test` (builds first, then Playwright on port 4173) |
| Update snapshots | `npm run test:integration-update`                           |
| Format fix       | `npm run format`                                            |

### Gotchas

- `.nvmrc` pins Node **22.22.2**. Run `nvm use` before any npm commands if the shell default differs.
- Playwright tests use a **preview server** on port 4173 (not the dev server on 5173). The `npm run test` script handles building and serving automatically.
- Playwright only runs the **chromium** project; Firefox and WebKit are commented out.
- Husky + commitlint enforce [Conventional Commits](https://www.conventionalcommits.org/) on commit messages (set up automatically by `npm install` via the `prepare` script).

### Player-facing changelog (What’s new)

- Source of truth: [`src/data/player-changelog.json`](src/data/player-changelog.json). It is validated at build time with Zod ([`src/changelog/player-changelog.ts`](src/changelog/player-changelog.ts)). Keep **`releases` newest-first**; **`releases[0].id` must equal `currentReleaseId`**.
- **`asOfCommit`**: short git hash recorded when you publish notes so the [draft changelog Cursor command](.cursor/commands/draft-player-changelog.md) can default to `git log <asOfCommit>..HEAD`.
- **When shipping an update players should hear about:** bump `currentReleaseId` (and [`package.json`](package.json) version in lockstep), add a new first object to `releases` with player-facing `items`, update `asOfCommit` to the current `git rev-parse --short=7 HEAD`, run `npm run build`.
- First-time visitors do not see the modal; starting a game calls `acknowledgeCurrentReleaseIfUnset()` so the next deploy can compare. Returning players see **What’s new** when their stored last-seen id is older than `currentReleaseId`.
