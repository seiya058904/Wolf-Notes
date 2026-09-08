# Repository Guidelines

## Project

Wolf-Notes is a Vue 3 + Vite 狼人杀记录台, built with Pinia and Element Plus. It is local-first: state is persisted to `localStorage` under the `lrsNotesGameSession` key, and the app generates AI strategy prompts for the user to copy elsewhere rather than calling an AI API. The entry point is `src/main.js`, which mounts `src/App.vue`; `App.vue` switches between the home, setup, werewolf board, and undercover views with `v-if` — no router is mounted. Session state, migrations, round flow, private-information handling, and prompt generation live in `src/lib/gameSession.js`; UI coordination is in `src/composables/useBoard.js`.

## Layout

- `src/lib/gameSession.js`: session schema, migrations, rounds, private information, and prompt building.
- `src/views/`: `home.vue`, `setup.vue`, `main.vue` (board), and `spy.vue` (undercover mode).
- `src/components/`: board, player, settings, and private-information components.
- `src/composables/`: board, background, and device-detection state wiring.
- `src/stores/` and `src/data/`: Pinia game-mode store and its JSON configuration.
- `test/`: Node's built-in test runner tests for migration, setup, rounds, prompts, and role review.
- `docs/`: optional VitePress documentation tree.
- `.github/workflows/deploy.yml`: builds and publishes `dist/` to GitHub Pages on pushes to `main`.

Inactive code — do not wire it up unless asked: `src/router/index.js` is unused (`vue-router` is installed but never mounted), and `src/api/leancloud.js` imports `leancloud-storage`, which is not in `package.json`. `src/views/full.vue`, `old.vue`, `login.vue`, `testMain.vue`, and `notFound.vue` are unreferenced legacy views.

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

Do not commit `.env`, credentials, tokens, keys, local caches, `dist/`, `node_modules/`, screenshots, ZIP review packages, or browser artifacts. Data is intentionally local-first; do not add an AI API or silently change storage keys. Keep the original MIT `LICENSE` and source attribution intact. The Pages build injects `VITE_LEANCLOUD_APP_ID`, `VITE_LEANCLOUD_APP_KEY`, and `VITE_LEANCLOUD_SERVER_URL` from repository secrets; never read, print, or hardcode their values. Do not introduce unrelated dependencies.

## Agent boundaries

## Personal Knowledge Context

The user's shared long-term AI context lives at `D:\xia zai\AI project\Knowledge`.

This repository's `AGENTS.md` / `CLAUDE.md` / docs and Git state are the source of truth for this project's long-term context. The user's shared cross-project reusable knowledge (prompts, protocols, workflows) lives at `D:\xia zai\AI project\Knowledge`; consult its `AGENTS.md` only when the task needs one of those reusable items or to locate this project's repository. Do not mirror project context back into Knowledge — it is a collection, not project memory.

When the user explicitly says the project/task is ready to “收工” or gives an equivalent finalization instruction, read and follow `D:\xia zai\AI project\Knowledge\02-AI\Prompts\项目收工提示词.md`. This trigger does not expand current task permissions; do not merge, deploy, force-push, resolve remote conflicts, or modify unrelated files unless separately authorized.

Make the smallest change that satisfies the request. Preserve unrelated user changes. Do not use force push, rebase, reset, or bulk cleanup. Before handoff, verify the intended files, `git diff --check`, relevant tests/build, branch/upstream synchronization, and worktree status.
