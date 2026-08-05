# Repository Guidelines

## Project

Wolf-Notes is a Vue 3 + Vite狼人杀记录台. The main entry is `src/main.js`; `src/App.vue` selects the home, setup, and record views. Session state, migrations, round flow, private-information handling, and prompt generation live in `src/lib/gameSession.js`; UI coordination is in `src/composables/useBoard.js`.

## Layout

- `src/views/`: home, setup, main board, and legacy views.
- `src/components/`: board, player, settings, and private-information components.
- `src/stores/`: Pinia game-mode data.
- `src/data/`: game-mode configuration.
- `test/`: Node's built-in test runner tests for migration, setup, rounds, prompts, and role review.
- `.github/workflows/deploy.yml`: builds and publishes `dist/` to GitHub Pages on pushes to `main`.

## Commands

```text
npm install
npm run dev
npm test
npm run build
npm run preview
```

Use `npm test`, `npm run build`, and `git diff --check` for focused verification. `npm run build:all`, `npm run docs:dev`, and `npm run docs:build` are for the optional VitePress documentation tree.

## Code and tests

Prefer the existing plain JavaScript/Vue patterns and the standard library. Keep session schema keys and localStorage compatibility stable. Put shared migration, normalization, round, and prompt behavior in `src/lib/gameSession.js`; keep view-specific state wiring in composables/components. Add a small `node:test` regression test for non-trivial behavior changes, especially data preservation and identity/privacy boundaries.

## Git and PRs

Use short, single-purpose commit messages. Inspect the final diff before committing, stage only intended files, and report tests/build results. PRs target `main`; do not merge, publish, or release without explicit authorization. GitHub Pages deployment is triggered by a push to `main`.

## Safety and configuration

Do not commit `.env`, credentials, tokens, keys, local caches, `dist/`, `node_modules/`, screenshots, ZIP review packages, or browser artifacts. Data is intentionally local-first; do not add an AI API or silently change storage keys. Keep the original MIT `LICENSE` and source attribution intact. Do not expose the local monitoring data or introduce unrelated dependencies.

## Agent boundaries

Make the smallest change that satisfies the request. Preserve unrelated user changes. Do not use force push, rebase, reset, or bulk cleanup. Before handoff, verify the intended files, `git diff --check`, relevant tests/build, branch/upstream synchronization, and worktree status.
