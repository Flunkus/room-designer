# Roomscale — Roadmap / deferred features

Things intentionally left for later, most-requested first. (The app lives in `app/`.)

## Sharing & files
- **Share** — share a house design via link / collaboration. *(The Share button was removed from the
  top bar on 2026-06-06 until this is real.)*
- **Project export / import** — Save/Load a house to a `.json` file (backup + move between browsers).
  Today the scene **auto-saves to the current browser** (localStorage); the Save button just confirms that.

## Rooms & geometry
- **Smart linked doorways** — a door placed on a wall shared by two adjacent rooms automatically opens
  both sides and is recognised as a passage between them. (Foundation is in place: rooms share one
  coordinate space and openings are per-room.)
- **Per-room materials** — currently wall/floor materials are shared house-wide; allow overrides per room.
- **Custom / 1 cm grid increment** — the snap selector offers 5/10/25/50/100 cm; add a free-entry option.

## Views
- **Walkthrough (first-person) polish** — the Walk mode renders all rooms but was out of scope during the
  multi-room refactor; needs spawn/collision tuning across multiple rooms.

## Editor
- **Undo / redo** — the top-bar undo/redo buttons are not yet wired up.
