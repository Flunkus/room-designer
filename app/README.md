# Roomscale — Spatial Planning & Interior Design

A real, browser-based spatial planner and interior-design tool: draft a floor plan in 2D,
auto-generate extruded 3D walls with CSG door/window openings, orbit a dollhouse view, and walk
through it in first person with physical collision. Built off the Claude Design prototype (the
`*.jsx` files in the parent directory) — the design system, component layout, data model, and
geometry math are ported faithfully.

> Primary scenario: planning a new property in **Berowra, Sydney** — precise spatial math
> (centimetre units) and high-fidelity 3D.

## Stack

| Concern | Choice |
|---|---|
| Build / framework | Vite + React 19 + TypeScript |
| 3D engine | three.js via @react-three/fiber + @react-three/drei |
| CSG (wall openings) | three-bvh-csg |
| Walkthrough physics | @react-three/rapier (Rapier kinematic character controller) |
| State + persistence | Zustand (+ `persist` middleware → localStorage) |
| LLM spec parser | @anthropic-ai/sdk (`claude-haiku-4-5`), env-gated; regex fallback |

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

The app runs with **zero secrets** — all AI/async features use built-in mocks.

## Features (by requirement)

1. **Views & navigation** — 2D drafting grid; 3D orbit (mouse orbit/pan/zoom + adjustable FOV);
   first-person walkthrough (WASD, mouse-look, **180 cm** eye height, collision).
2. **Drafting & rooms** — point-by-point polygon drawing on a 25 cm grid; the space stays 2D until you
   snap the loop closed; closing auto-generates the 3D floor + extruded walls (default 270 cm) with
   **CSG-punched** door/window holes.
3. **Furniture pipeline** — async image→3D with an immediate bounding-box placeholder that swaps to the
   downloaded GLB (preserving position/scale); non-uniform **dimension scaling** to exact W/D/H; **LLM
   spec parsing** from messy text; **modular snapping** of pieces; **parent/child nesting** (a child binds
   to the parent's local frame).
4. **Materials** — unified PBR system for walls/floors; dual ingestion (AI tileable texture **and** manual
   Base/Normal/Roughness uploads); live texture **scale**, **rotation** (0–360°), and **roughness**.
5. **Verification UX** — toggleable 60 cm **clearance zones** projected from furniture; a 60×40×180 cm
   draggable **human proxy** with collision to test gap clearances.
6. **State & persistence** — autosaves to localStorage (survives refresh); loads a complete **Demo Room**
   on first visit; **New Room** wipes to a clean slate.

## Swapping in real providers

All AI/async features sit behind small interfaces in `src/services/` with mock implementations.
To go live, implement the interface and point the `active*` export at it — no UI changes needed:

- `src/services/meshGen.ts` — `MeshGenProvider` (image→3D; e.g. Meshy / Tripo / Rodin: submit → poll → GLB).
- `src/services/textureGen.ts` — `TextureGenProvider` (AI tileable PBR maps).
- `src/services/specParser.ts` — `SpecParser`. The real **Claude** parser activates automatically when
  `VITE_ANTHROPIC_API_KEY` is set (see `.env.example`). A browser-exposed key is **dev-only** — in
  production proxy Anthropic calls through a backend.

## Architecture notes

- **Coordinates** (`src/domain/`, `src/three/coords.ts`): centimetres; plan x→world x, plan y→world z
  (depth), object height→world y. cm→metre scale `M = 0.01`.
- **Scene graph** = the nesting requirement: `resolve()` binds a child to its parent's geometry.
- **Cutaway**: walls whose outward normal faces the camera are hidden each frame for the dollhouse read.
- **Persistence** strips session-scoped `blob:` URLs (generated meshes / uploaded maps) so a reload never
  fetches a dead URL; a `MeshErrorBoundary` falls back to the placeholder box if a mesh fails to load.
- The 3D engine is **code-split** — the 2D editor loads first; three.js/Rapier are fetched on first 3D/Walk.

## Layouts & tweaks

A floating **Tweaks** panel (gear button, bottom-right, or `Alt+T`) toggles the two design directions
(A — classic editor, B — immersive), accent color, panel density, and grid style — ported from the
prototype's design scaffold.
