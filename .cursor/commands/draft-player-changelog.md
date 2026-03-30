---
description: Draft player-facing changelog bullets from git history (review before editing JSON)
---

Use `src/data/player-changelog.json` field `asOfCommit` as the default **from** revision. Run `git log <asOfCommit>..HEAD --oneline` and inspect diffs that touch gameplay (`src/colony/`, `src/ui/`, balance constants, player-visible copy).

Produce **draft** bullet points in plain language for players—balance, timing, new rules, fixes that change behavior—not refactors, tests, or internal names.

Edit `player-changelog.json` automatically, bumps `currentReleaseId`, updates `releases[0]` (newest first), sets `asOfCommit` to the current `git rev-parse --short=7 HEAD`, and runs `npm run build` so Zod validation passes. The maintainer reviews the changes before committing them.
