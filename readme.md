# Bee Happy

**Bee Happy** is a bee hive builder: you grow and manage a colony inside the hive—laying out comb, tending brood, and keeping the bees busy. Store up honey to survive the winter and keep your bees happy! It is a client-side browser game built with [Excalibur.js](https://excaliburjs.com), React, and Vite. Everything runs in the browser; no backend or database is required.

## Requirements

- **Node.js 22** (see `.nvmrc`). With [nvm](https://github.com/nvm-sh/nvm): `nvm use`

## Quick start

```sh
npm install
npm run dev
```

Open the URL Vite prints (the dev server defaults to port **5173**).

## Scripts

| Command                           | Purpose                           |
| --------------------------------- | --------------------------------- |
| `npm run dev`                     | Start the Vite dev server         |
| `npm run build`                   | Lint, typecheck, production build |
| `npm run format`                  | Apply Prettier                    |
| `npm run lint`                    | Check Prettier                    |
| `npm run test`                    | Build, then Playwright E2E        |
| `npm run test:integration-update` | Update Playwright snapshots       |

Playwright tests use a preview server on port **4173**; `npm run test` handles build and serve. For commit message rules and other contributor notes, see [`AGENTS.md`](./AGENTS.md).

### Player changelog and Cursor

Player-facing release notes live in [`src/data/player-changelog.json`](./src/data/player-changelog.json) and power the **What’s new** dialog on the launch screen. Maintainer workflow is documented in [`AGENTS.md`](./AGENTS.md).

In Cursor, the repo includes a custom command **[draft-player-changelog](.cursor/commands/draft-player-changelog.md)** to draft bullets from git history; always review and edit before committing JSON changes.

## Engine

Excalibur.js documentation: [excaliburjs.com](https://excaliburjs.com)
