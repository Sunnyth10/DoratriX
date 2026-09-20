# ⚡ DoratriX — Product Requirements Document

> **Find Shortest Paths. Visualize the Journey.**

---

## 🎯 The One-Sentence Pitch

**DoratriX doesn't just tell you the shortest way home — it shows you the mind of the algorithm figuring it out, live, on a real map, made of real roads.**

---

## 🧠 The Origin Story (a.k.a. Why This Exists)

Every routing app on Earth — Google Maps, Apple Maps, Waze — gives you an answer wrapped in a black box. You tap two pins, a blue line appears, and the *how* is a corporate secret buried under a billion dollars of infrastructure you'll never see.

DoratriX rips the lid off that box.

This isn't an attempt to out-route Google — that's a battle nobody wins solo. This is something Google will never give you: **a front-row seat to the algorithm itself**, hunting node by node, wave by wave, through a real city's actual road network, until it finds the answer — and then racing a smarter algorithm against a classic one to prove, visually, why "smarter" wins.

---

## 🚨 The Problem

- Routing tools are **answer machines**, not **teaching tools** — nobody sees the search happen
- Computer science students learn Dijkstra and A* from **whiteboard diagrams and toy graphs**, never on data that reflects the chaotic, beautiful mess of a real city
- "I built a shortest-path app" is a portfolio line recruiters have seen a thousand times — with no way to tell if you actually understand the algorithm or just called an API

---

## 💡 The Solution

DoratriX is a **from-scratch pathfinding visualizer** that:

1. Pulls a **real road network** from OpenStreetMap for any area
2. Builds an actual graph — intersections as nodes, streets as weighted edges — **no shortcuts, no pre-built routing library**
3. Runs **hand-implemented Dijkstra and A\*** algorithms directly on that graph
4. **Animates the search itself** — not just the final route — so you watch the frontier expand, node by node, like watching a mind think
5. Puts both algorithms **head-to-head** on the same start and end point, so the difference between "explores everywhere" and "explores smart" is something you *see*, not something you're told

---

## 🏆 What Makes This Different (The "Bro, Google Maps Already Does This" Answer)

| Google Maps | DoratriX |
|---|---|
| Gives you an answer | Shows you the *search* for the answer |
| Black-box routing engine | Every line of the algorithm is yours, visible, explainable |
| One algorithm, hidden | Dijkstra vs. A*, racing, side by side, in the open |
| Optimizes for what Google wants | Optimizes for whatever cost function *you* define |
| A product | A demonstration of how the product category even works |

DoratriX isn't a Maps competitor. It's the **X-ray view** of what Maps refuses to show you.

---

## 👥 Who This Is For

- **You, right now** — a CSE (AI & ML) student who needs a portfolio piece that proves real algorithmic chops, not just API-wiring skills
- **Recruiters and interviewers** — who'll immediately understand "I implemented Dijkstra and A* from scratch on real map data with a live animated visualizer" as a genuine signal, not a tutorial clone
- **Curious strangers on the internet** — who stumble onto the link, click two points on a map, and get a small "oh that's cool" moment watching the search unfold
- **Future-you** — who wants to remember that you *can* build something with real depth when you commit to it

---

## 🧩 Core Features (MVP — What Exists Today)

- 🗺️ **Interactive map** (Leaflet + OpenStreetMap tiles) — zero API keys, zero billing
- 📍 **Click-to-place start/end**, with **drag-to-adjust** and an explicit Reset — no accidental do-overs
- 🕸️ **Real road graph**, built live from the Overpass API for any bounding box
- 🧮 **Dijkstra's algorithm**, implemented from scratch — no shortest-path libraries
- ⭐ **A\* algorithm**, implemented from scratch, using haversine distance as the heuristic
- 🎬 **Step-by-step search animation** — visited nodes, frontier nodes, and the current node, all color-coded and watchable frame by frame, with Play / Pause / Reset / Scrub
- ⚔️ **Compare mode** — Dijkstra and A* side by side: nodes explored, time taken, final distance, so the *efficiency gap* is visible, not just claimed
- 🔍 **Location search** — type a place name, geocode it (via Nominatim), snap it onto the graph like a click
- 🐛 **Debug mode** — internal tooling to catch graph connectivity issues (the "why is it routing around the lake instead of through the obvious road" class of bug)

---

## 🔮 Where This Goes Next (Post-MVP Ideas)

- 🌐 **Dynamic bounding box** — search anywhere, not just one fixed city block; the graph re-fetches and re-centers itself on demand
- 🎛️ **Custom cost functions** — avoid a road type, minimize turns, weight by anything you want — something no black-box API lets you touch
- 🛰️ **Satellite view toggle** — Esri World Imagery, no billing required
- 🌍 **Language selection** — i18n'd UI for a global audience
- 🐍 **Python/FastAPI backend migration** — move the graph-building and algorithms server-side, unlocking caching, bigger cities, and genuine full-stack credibility
- 🧭 **MIDI-export-style extras** — export a computed route, or compare more than two algorithms (BFS vs Dijkstra vs A*, a full algorithmic showdown)

---

## 🛠️ Tech Stack

**Frontend:** React (Vite) · Leaflet + react-leaflet · Vanilla CSS/animations
**Data/API:** OpenStreetMap · Overpass API (road network) · Nominatim (geocoding search)
**Algorithms:** Hand-rolled Dijkstra & A*, JavaScript, running client-side
**Hosting:** GitHub Pages / Vercel (fully static, zero backend required for MVP)


---

## 🚫 What This Is Deliberately NOT

- ❌ Not trying to beat Google Maps at real-world routing (traffic, closures, live conditions) — that's not the game being played
- ❌ Not using any pre-built shortest-path library — the algorithm being visible and self-written **is the entire point**
- ❌ Not (yet) a production service handling thousands of users — it's a demonstration, a portfolio piece, a love letter to a computer science fundamental

---

## 📏 What "Done" Looks Like

You give someone the link. They click two points on a real map of their own city. They hit Play. They watch a search algorithm — written by you, from scratch — hunt through real streets and find them the shortest way home, and then watch a smarter one do it in a fraction of the steps.

They don't ask "what's special about this?" anymore. They just watch.

---

**Built by a CSE (AI & ML) student who got tired of algorithms living only on whiteboards.**
