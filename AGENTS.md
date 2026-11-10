# Repository Guidelines

## Project Structure & Module Organization
- `frontend/`: Vue 3 SPA. `src/main.js` boots the app and applies theme cookies before mounting `App.vue`. `App.vue` orchestrates data loading (`utils/dataLoader.js`), state stores for guesses, settings persistence via `utils/cookieSettings.js`, and renders either the standard boards or the puzzle board. `AppWrapper.vue` keeps a global layout shell when routing is enabled.
- `frontend/src/components/`: UI building blocks. `GameBoard.vue` lists guesses and computes per-tag comparisons, `ResultRow.vue` paints numeric deltas and tag matches, `GuessInput.vue` powers the search box with pinyin-aware filtering from `utils/pinyinCache.js`, and `PuzzleBoard.vue` drives the pixel-art reveal flow using mosaic blocks. Toast components (`ErrorToast.vue`) centralize notifications; `VirtualScroll.vue` offers list virtualization.
- `frontend/src/logic/`: Pure game services. `gameLogic.js` normalizes operator stats, compares guesses, and exposes helper filters; `puzzleService.js` handles art selection, caching and mosaic refinement via an integral-image worker.
- `frontend/src/utils/`: Shared helpers. `dataLoader.js` fetches JSON with abort guards, `imagePreloader.js` caches remote sprites with eviction limits, `workerManager.js` manages the integral-image worker lifecycle, `validator.js` centralizes input sanitisation, `imageUtils.js` derives media URLs, and `themes.js` stores theme cookies.
- `frontend/public/`: Static assets and `data/operators.json` for offline operator metadata. `frontend/dist/` is generated output—never edit manually.
- `server/`: Express + Socket.IO backend (`index.js`) that offers health checks and simple in-memory room management (currently dormant after removing challenge play).

## Build, Test, and Development Commands
- `cd frontend && npm install` once per environment to sync dependencies; repeat after lockfile updates.
- `npm run serve` (in `frontend/`) boots the local client with hot reload on `http://localhost:8080`.
- `cd server && npm install && npm start` launches the websocket backend on port 3012; run it alongside the client for multiplayer playtests.
- `npm run build` (frontend) emits production bundles in `dist/`; use `npm run lint` to validate formatting before every PR.

## Coding Style & Naming Conventions
- Use 2-space indentation and single quotes in JS/TS to match existing Vue and Node files.
- Prefer `PascalCase` for Vue single-file components, `camelCase` for functions/consts, and hyphenated class names in `styles/`.
- ESLint with `plugin:vue/vue3-essential` powers linting; resolve or explicitly justify any rule suppressions.
- Keep component files focused: template + script + scoped style in one `.vue` file; move shared helpers into `utils/`.

## Testing Guidelines
- There is no bundled unit suite yet; add Vue Test Utils or vitest specs under a new `frontend/tests/` folder and mirror feature names.
- Start each test filename with the module, e.g. `logic-puzzle.spec.js`, and assert both happy paths and failure states.
- Run `npm run lint` plus manual smoke tests in desktop and mobile browsers after each significant change.
- When touching `server/`, add lightweight integration checks using supertest or document manual API verifications in the PR.

## Commit & Pull Request Guidelines
- Follow the repo trend: short, imperative summaries (`fix scroll glitch`, `add sponsor banner`) with optional bilingual context.
- Reference issues in the body (`Fixes #12`) and describe user-visible impact alongside verification steps.
- Screenshot UI tweaks and attach gameplay recordings when puzzle flows change.
- Ensure PRs note required coordination (for example server and client deploy order) and call out schema or API adjustments upfront.

## Feature Flow Notes
- `App.vue` resets games by clearing `targetOperator`, repopulating guesses, and re-selecting a target on the next tick; UI boards now guard against the brief null window with a loading placeholder.
- Ordinary mode uses `compareOperators` for per-attribute hints; ranges tagged as numeric compute distance bands (`close`/`far`) and direction arrows rendered in `ResultRow.vue`.
- Puzzle mode (`PuzzleBoard.vue`) calls `loadPuzzleImage` to fetch MD5-based art paths via `imageUtils.js`, produces integral images in `workers/integralImageWorker.js`, and progressively refines blocks through `refineRandomBlocks` for each incorrect guess. Device capability heuristics in `logic/puzzleService.js` and `config/renderingConfig.js` scale workloads.
