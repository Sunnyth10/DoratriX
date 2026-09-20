# ⚡ DoratriX — Task Log

> Every checkbox here is a version of the app that didn't exist yesterday.

Legend: `[x]` done · `[~]` in progress / needs a final pass · `[ ]` not started yet

---

## 🏗️ Phase 0 — Foundation

- [x] Scaffold React + Vite project
- [x] Install Leaflet + react-leaflet (no API key, no billing — the free path)
- [x] Confirm base map renders and zooms/pans correctly
- [x] `git init`, first commit, and a habit of committing after every working phase

---

## 🕸️ Phase 1 — Get a Real Map on Screen

- [x] `MapView` component rendering a full-screen Leaflet map
- [x] Centered on a real city location, sensible default zoom
- [x] Confirmed: real streets visible, no blank/broken tile rendering

---

## 🧬 Phase 2 — Fetch and Build the Real Road Graph

- [x] Overpass API query for `highway` ways in a bounding box
- [x] Parse raw OSM response into a clean node/edge graph
- [x] Haversine distance function to weight every edge
- [x] Road network drawn as thin polylines to visually confirm parsing
- [x] **Bug found & fixed:** intersection nodes not merging correctly, causing bogus detours
- [x] **Bug found & fixed:** disconnected road segments (split OSM ways not linking)
- [~] Widen `highway` type filter to catch smaller connecting roads (residential, service, unclassified) — confirm this was actually widened, not just diagnosed

---

## 📍 Phase 3 — Start / End Point Selection

- [x] Click-to-place start (green) and end (red) markers
- [x] Snap raw clicks to the nearest graph node, not raw coordinates
- [x] **UX fix:** draggable markers instead of a punishing "3rd click resets everything" flow
- [x] Explicit Reset button, separate from click behavior
- [ ] Max-distance guard on snapping — reject clicks/searches that are absurdly far from any road instead of silently snapping

---

## 🧮 Phase 4 — Dijkstra, No Animation Yet

- [x] Hand-written Dijkstra implementation (no shortest-path library)
- [x] Returns `{ path, distance }`
- [x] "Find Shortest Path" draws the route as a bold polyline
- [x] Verified against multiple start/end pairs, including routes that must bend around obstacles

---

## 🎞️ Phase 5 — Instrument the Algorithm

- [x] Dijkstra records `frames`: `currentNode`, `frontier`, `visited` at every step
- [x] Verified non-trivial frame count and sane first/last frame contents

---

## 🎬 Phase 6 — Animate the Search

- [x] `useSearchAnimation` hook — play / pause / reset / scrub
- [x] Color-coded nodes: gray (visited), yellow (frontier), red (current)
- [x] Final path draws in once animation completes
- [~] "Wave"-style batched animation (group nodes by distance layer, so it expands in rings instead of one node at a time) — explored, confirm final version matches the look you wanted from the reference videos
- [~] Path itself animates in with a "growing line" effect (not an instant draw) — included in the UI redesign prompt, confirm it's actually wired in and looks smooth

---

## ⚔️ Phase 7 — A* and Comparison Mode

- [x] Hand-written A* using haversine distance as the heuristic
- [x] Compare mode: both algorithms run on the same start/end pair
- [x] Stats side by side: nodes explored, time taken, final distance
- [x] Verified A* explores fewer nodes while matching Dijkstra's distance

---

## 🔍 Phase 8 — Search by Name (Beyond Clicking)

- [x] Nominatim geocoding wired in, feeding into the existing `findNearestNode` pipeline
- [x] Graceful failure message when a searched location isn't found
- [ ] **Dynamic bounding box:** re-fetch a new graph centered on wherever the user searches, instead of only working inside one fixed hardcoded area
- [ ] Loading indicator while a new graph is being fetched after a search

---

## 🎨 Phase 9 — UI/UX Overhaul

- [x] First redesign pass: dashboard-style layout, sectioned cards, custom color palette
- [x] Second redesign pass: compact floating control card (icons, toggle, side-by-side stats)
- [x] Rebranded as **DoratriX** — logo, tagline, header
- [x] Fixed network-node styling (smaller, semi-transparent, less "clumped dark mass" when zoomed out)
- [x] Recovered from a broken redesign via `git stash` — lesson learned, logic and styling now requested as separate prompts going forward
- [ ] Full functionality audit after the latest redesign (click, drag, clear, debug toggle, both algorithms, play/pause/reset, slider) — confirm nothing silently broke again
- [ ] Consolidate "Find Shortest Path" and "Compare Algorithms" into a single mode selector + one primary action button
- [ ] Subtle UI micro-animations (button press feedback, marker drop-in, card hover states)

---

## 🧹 Phase 10 — Cleanup & Hardening

- [ ] Remove or gate Debug Mode behind a hidden flag (`?debug=true`) — it's a dev tool, not a user-facing feature
- [ ] Performance: swap the linear nearest-node scan for a spatial index (`kdbush` or `rbush`) once bounding box grows
- [ ] Loading states everywhere a fetch happens (Overpass, Nominatim) — no frozen-looking UI
- [ ] Mobile responsiveness pass — real phone or DevTools device emulation
- [ ] Attribution check — OpenStreetMap + Nominatim usage policy compliance, visible but unobtrusive

---

## 📸 Phase 11 — Ship It

- [ ] Record a short demo video/GIF of the search animation + comparison mode
- [x] `README.md` — what it is, how it works
- [x] `PRD.md` — the why and the pitch
- [x] `ARCHITECTURE.md` — the how, under the hood
- [ ] Deploy to GitHub Pages / Vercel — get a real, shareable live link
- [ ] Final end-to-end test on the deployed version (not just localhost)

---

## 🔮 Someday / Maybe (Not Blocking "Done")

- [ ] Satellite view toggle (Esri World Imagery — free, no billing)
- [ ] "Open in Google Maps" comparison button
- [ ] Language selection (i18n via react-i18next)
- [ ] Custom cost functions (avoid a road, minimize turns, weight by anything)
- [ ] Python/FastAPI backend migration — algorithms move server-side, caching unlocked
- [ ] Third algorithm added to Compare mode (BFS, for a full "naive vs. smart vs. smartest" showdown)

---

**Current state: the hard part — the actual algorithmic core — is done and working. What's left is mostly polish, cleanup, and the click of a "Deploy" button.**
