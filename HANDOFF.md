# Handoff Notes

_Last updated: 2026-09-24, after `audi fix` (bd32b0a)._ 

## Current state
- Branch: `master`, merged to master: yes; `HEAD` matches `origin/master` at `bd32b0a`. Worktree is clean.
- DoratriX routing and animation core: implemented and committed; algorithm phases 4–7 in [TASKS.md](TASKS.md) are marked done.
- Name search and dynamic road-graph reload: implemented in code and committed (`e0da9a1`, `bd32b0a`), but Phase 8 still marks dynamic bounds and loading indicator incomplete; verify those checklist entries against current behavior before updating them.
- UI redesign and DoratriX branding: committed (`530df8c`); Phase 9 functionality audit and listed follow-ups remain open.
- Latest commit preserves selected points/routes if a requested graph reload fails. `sec-branch` is an older branch at `fe8c1de`, not merged into current `master`.

## In progress / next step
- First audit graph reload/search behavior and the latest UI interactions, then reconcile stale Phase 8–9 checkboxes in `TASKS.md` based on what works. The concrete Phase 9 audit items are click, drag, clear, debug toggle, both algorithms, animation controls, and slider.
- Read [TASKS.md](TASKS.md), [ARCHITECTURE.md](ARCHITECTURE.md), then `src/components/MapView.jsx` and `src/lib/graph.js` before changing search, reload, or map state.

## Known gotchas (do not redo these mistakes)
- OSM intersections must be deduplicated by OSM node ID, and split road ways must connect through shared nodes; otherwise the graph disconnects and routes take bogus detours. See Phase 2 and the graph invariant in `ARCHITECTURE.md`.
- Road search can trigger a graph reload outside current bounds. If it fails, retain the previous graph and restore its selected points and route; `MapView.jsx` now snapshots/restores this state around reloads (`bd32b0a`).
- `src/lib/graph.js` uses the official OSM map endpoint only in development, then falls back to Overpass. Keep that guard: production must not request the local `/osm-api` proxy (`d72dc8f`).
- A prior redesign broke the app and was recovered with `git stash`; keep logic and styling changes separate and check the current UI after redesign work (Phase 9 note).
- `roadNetworkHalfSideKilometers` must stay at `0.75` and `ROAD_DATA_TIMEOUT_MS` must stay at `30000` (in `src/lib/graph.js`). An earlier attempt enlarged the half-side to `1.5` without raising the timeout from its old value of `8000ms` — the larger Overpass query then got aborted by the client before the server could respond, on every provider and the dev-mode OSM fallback simultaneously. This looked exactly like “all map APIs are down” but was actually a self-inflicted timeout, compounded by Overpass IP rate-limiting after repeated retries. Do not shrink `ROAD_DATA_TIMEOUT_MS` or enlarge `roadNetworkHalfSideKilometers` without deliberately re-testing both together.
