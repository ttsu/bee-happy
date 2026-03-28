# AGENTS.md

## Cursor Cloud specific instructions

**Bee Happy** is a client-side browser game (Excalibur.js + React + Vite). No backend, database, or external services are needed.

### Quick reference

| Task | Command |
|---|---|
| Dev server | `npm run dev` (Vite, port 5173) |
| Lint | `npm run lint` (Prettier) |
| Type check | `npx tsc --noEmit` |
| Build | `npm run build` (runs lint + tsc + vite build) |
| E2E tests | `npm run test` (builds first, then Playwright on port 4173) |
| Update snapshots | `npm run test:integration-update` |
| Format fix | `npm run format` |

### Gotchas

- `.nvmrc` pins Node **22.22.2**. Run `nvm use` before any npm commands if the shell default differs.
- `npm run build` includes `prettier --check`; a pre-existing formatting issue in `src/colony/ecs/systems/brood-system.ts` will cause it to fail. Run `npm run format` first if you need a clean build.
- Playwright tests use a **preview server** on port 4173 (not the dev server on 5173). The `npm run test` script handles building and serving automatically.
- Playwright only runs the **chromium** project; Firefox and WebKit are commented out.
- Husky + commitlint enforce [Conventional Commits](https://www.conventionalcommits.org/) on commit messages (set up automatically by `npm install` via the `prepare` script).
