/* ===== Zustand store — house = many rooms (ported & extended from prototype app.jsx) ===== */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Furniture, InspectorTab, MaterialKey, ModalKind, Opening, Proxy,
  Room, SceneState, Tool, Vec2, View2D, View3D, ViewMode,
} from "../domain/types";
import { bounds, centroid, pointInPoly } from "../domain/geometry";
import { uid } from "../domain/util";
import { makeDemoScene, makeEmptyScene } from "./demoRoom";

export interface RoomState {
  // ---- view / interaction ----
  mode: ViewMode;
  tool: Tool;
  selectedId: string | null;
  inspectorTab: InspectorTab;
  modal: ModalKind;
  /** which surface the texture modal applies to (walls | floor) */
  materialTarget: MaterialKey;

  // ---- scene (persisted) ----
  rooms: Room[];
  /** the room currently selected / edited (drives the inspector, draw + furniture target) */
  activeRoomId: string | null;
  furniture: Furniture[];
  openings: Opening[];
  materials: SceneState["materials"];
  wallHeight: number;

  // ---- drafting ----
  drafting: boolean;
  draftPoints: Vec2[];
  /** when re-tracing an existing room, the id being replaced; null while drawing a brand-new room */
  draftRoomId: string | null;
  /** snap increment (cm) for drawing walls + nudging furniture on the plan */
  gridSize: number;
  /** show room name + area labels on the 2D plan */
  showRoomLabels: boolean;
  /** one-shot: focus the room-name field (set when a room is freshly created) */
  focusRoomName: boolean;

  // ---- cameras ----
  view2d: View2D;
  view3d: View3D;

  // ---- verification (persisted) ----
  showClearance: boolean;
  showProxy: boolean;
  proxy: Proxy;

  // bump to request a camera "fit" in the canvases
  fitTick: number;

  // ---- actions ----
  setMode: (m: ViewMode) => void;
  setTool: (t: Tool) => void;
  startDraw: () => void;
  redrawRoom: (id: string) => void;
  addPoint: (p: Vec2) => void;
  undoPoint: () => void;
  cancelDraw: () => void;
  closeRoom: () => void;
  starterRoom: (w?: number, d?: number, name?: string) => void;
  setGridSize: (n: number) => void;
  setFocusRoomName: (v: boolean) => void;
  selectRoom: (id: string) => void;
  renameRoom: (id: string, name: string) => void;
  removeRoom: (id: string) => void;
  newHouse: () => void;
  resetHouse: () => void;
  select: (id: string | null) => void;
  setInspectorTab: (t: InspectorTab) => void;
  openModal: (m: ModalKind) => void;
  closeModal: () => void;
  setMaterialTarget: (k: MaterialKey) => void;
  toggle: (k: "showClearance" | "showProxy" | "showRoomLabels") => void;
  setView2d: (v: View2D) => void;
  setView3d: (v: View3D) => void;
  setFov: (fov: number) => void;
  setProxy: (p: Partial<Proxy>) => void;
  fit: () => void;
  patch: (id: string, p: Partial<Furniture>) => void;
  moveFurniture: (id: string, p: Partial<Furniture>) => void;
  patchMaterial: (k: MaterialKey, p: Partial<SceneState["materials"][MaterialKey]>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  addFurniture: (spec: { name?: string; type?: string; w: number; d: number; h: number; meshUrl?: string | null }) => string;
  setFurnitureMesh: (id: string, meshUrl: string | null, status?: Furniture["status"]) => void;
  // openings (CSG)
  addOpening: (o: Omit<Opening, "id">) => void;
  patchOpening: (id: string, p: Partial<Opening>) => void;
  removeOpening: (id: string) => void;
}

/** session-scoped URLs (blob:) don't survive reload; data: URLs do. */
const isEphemeral = (u?: string | null) => !!u && u.startsWith("blob:");

function sanitizeFurniture(o: Furniture): Furniture {
  const meshUrl = isEphemeral(o.meshUrl) ? null : o.meshUrl;
  // drop in-flight generation state and dead blob meshes back to a stable box
  const status: Furniture["status"] = o.status === "generating" ? "ready" : o.status;
  return { ...o, meshUrl, status };
}

function sanitizeMaterials(m: RoomState["materials"]): RoomState["materials"] {
  const fix = (mat: RoomState["materials"]["floor"]) => {
    if (!mat.maps) return mat;
    const maps = {
      base: isEphemeral(mat.maps.base) ? null : mat.maps.base,
      normal: isEphemeral(mat.maps.normal) ? null : mat.maps.normal,
      roughness: isEphemeral(mat.maps.roughness) ? null : mat.maps.roughness,
    };
    return { ...mat, maps };
  };
  return { floor: fix(m.floor), walls: fix(m.walls) };
}

/** id of the (closed) room whose polygon contains point p, or null. */
function roomIdAt(p: Vec2, rooms: Room[]): string | null {
  for (const r of rooms) {
    if (r.closed && r.polygon.length >= 3 && pointInPoly(p, r.polygon)) return r.id;
  }
  return null;
}

/** Recompute room membership for every object (children inherit their parent's room). */
function reassignRooms(furniture: Furniture[], rooms: Room[]): Furniture[] {
  const byId = new Map(furniture.map((f) => [f.id, f]));
  const resolve = (f: Furniture, seen: Set<string>): string | null => {
    if (f.parent && !seen.has(f.parent)) {
      const p = byId.get(f.parent);
      if (p) { seen.add(f.parent); return resolve(p, seen); }
    }
    return roomIdAt({ x: f.x, y: f.y }, rooms) ?? f.roomId ?? null;
  };
  return furniture.map((f) => ({ ...f, roomId: resolve(f, new Set([f.id])) }));
}

/** Next auto room name ("Room N") that doesn't collide with existing names. */
function nextRoomName(rooms: Room[]): string {
  let n = rooms.length + 1;
  const names = new Set(rooms.map((r) => r.name));
  while (names.has(`Room ${n}`)) n++;
  return `Room ${n}`;
}

const demo = makeDemoScene();

export const useStore = create<RoomState>()(
  persist(
    (set, get) => ({
      mode: "2d",
      tool: "select",
      selectedId: "sofa",
      inspectorTab: "object",
      modal: null,
      materialTarget: "walls",

      rooms: demo.rooms,
      activeRoomId: demo.rooms[0]?.id ?? null,
      furniture: demo.furniture,
      openings: demo.openings,
      materials: demo.materials,
      wallHeight: demo.wallHeight,

      drafting: false,
      draftPoints: [],
      draftRoomId: null,
      gridSize: 25,
      showRoomLabels: true,
      focusRoomName: false,

      view2d: { zoom: 0.6, pan: { x: 200, y: 120 } },
      view3d: { az: -28, zoom: 1, scale: 0, ox: 0, oy: 0, fov: 55 },

      showClearance: false,
      showProxy: false,
      proxy: { x: 420, y: 250, rot: 0 },

      fitTick: 0,

      setMode: (m) => set({ mode: m, tool: "select" }),
      setTool: (t) => set({ tool: t }),

      // Trace a brand-new room as a non-destructive overlay: existing rooms stay
      // visible (dimmed) and we force a top-down 2D view. draftRoomId=null → adds on close.
      startDraw: () => set({ tool: "draw", drafting: true, draftPoints: [], draftRoomId: null, mode: "2d", selectedId: null }),
      // Re-trace an existing room's walls; replaces just that room on close.
      redrawRoom: (id) => set({ tool: "draw", drafting: true, draftPoints: [], draftRoomId: id, mode: "2d", selectedId: null, activeRoomId: id }),
      addPoint: (p) => set((s) => ({ draftPoints: [...s.draftPoints, p] })),
      undoPoint: () => set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),
      cancelDraw: () => set({ tool: "select", drafting: false, draftPoints: [], draftRoomId: null }),

      closeRoom: () => set((s) => {
        if (s.draftPoints.length < 3) {
          return { drafting: false, tool: "select", draftPoints: [], draftRoomId: null };
        }
        const polygon = s.draftPoints.map((p) => ({ ...p }));
        if (s.draftRoomId) {
          // replace only the re-traced room's polygon; keep everything else
          const rooms = s.rooms.map((r) => (r.id === s.draftRoomId ? { ...r, closed: true, polygon } : r));
          return {
            rooms, furniture: reassignRooms(s.furniture, rooms),
            drafting: false, tool: "select", draftPoints: [], draftRoomId: null,
            activeRoomId: s.draftRoomId, fitTick: s.fitTick + 1,
          };
        }
        // additive: append a new room, keep all existing rooms + furniture
        const id = uid("room");
        const rooms = [...s.rooms, { id, closed: true, polygon, name: nextRoomName(s.rooms) }];
        return {
          rooms, furniture: reassignRooms(s.furniture, rooms),
          drafting: false, tool: "select", draftPoints: [], draftRoomId: null,
          activeRoomId: id, selectedId: null, inspectorTab: "room", fitTick: s.fitTick + 1,
          focusRoomName: true,
        };
      }),

      // Drop a clean rectangular room of the given size, offset clear of any existing rooms. Additive.
      starterRoom: (w = 520, d = 420, name) => set((s) => {
        const ww = Math.max(50, Math.round(w)), hh = Math.max(50, Math.round(d));
        let ox = 0, oy = 0;
        const all = s.rooms.flatMap((r) => r.polygon);
        if (all.length) { const b = bounds(all); ox = b.maxX + 60; oy = b.minY; }
        const id = uid("room");
        const polygon = [{ x: ox, y: oy }, { x: ox + ww, y: oy }, { x: ox + ww, y: oy + hh }, { x: ox, y: oy + hh }];
        const rooms = [...s.rooms, { id, closed: true, polygon, name: name?.trim() || nextRoomName(s.rooms) }];
        return {
          rooms, drafting: false, tool: "select", draftPoints: [], draftRoomId: null, mode: "2d",
          selectedId: null, activeRoomId: id, inspectorTab: "room", fitTick: s.fitTick + 1,
          focusRoomName: true,
        };
      }),

      setGridSize: (n) => set({ gridSize: n }),
      setFocusRoomName: (v) => set({ focusRoomName: v }),

      selectRoom: (id) => set({ activeRoomId: id, selectedId: null, inspectorTab: "room" }),
      renameRoom: (id, name) => set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, name } : r)) })),

      removeRoom: (id) => set((s) => {
        const rooms = s.rooms.filter((r) => r.id !== id);
        return {
          rooms,
          furniture: s.furniture.filter((f) => f.roomId !== id),
          openings: s.openings.filter((op) => op.roomId !== id),
          activeRoomId: s.activeRoomId === id ? (rooms[0]?.id ?? null) : s.activeRoomId,
          selectedId: null, inspectorTab: "room", fitTick: s.fitTick + 1,
        };
      }),

      // Wipe the whole house and start tracing the first room.
      newHouse: () => {
        const e = makeEmptyScene();
        set({
          rooms: e.rooms, furniture: e.furniture, openings: e.openings, materials: e.materials,
          wallHeight: e.wallHeight, drafting: true, draftPoints: [], draftRoomId: null, tool: "draw", mode: "2d",
          selectedId: null, activeRoomId: null, inspectorTab: "room", showClearance: false, showProxy: false,
        });
      },

      resetHouse: () => {
        const d = makeDemoScene();
        set((s) => ({
          rooms: d.rooms, furniture: d.furniture, openings: d.openings, materials: d.materials,
          wallHeight: d.wallHeight, drafting: false, tool: "select", draftPoints: [], draftRoomId: null,
          selectedId: null, activeRoomId: d.rooms[0]?.id ?? null, inspectorTab: "room", fitTick: s.fitTick + 1,
        }));
      },

      select: (id) => set((s) => {
        if (!id) return { selectedId: null, inspectorTab: "room" };
        const o = s.furniture.find((f) => f.id === id);
        return { selectedId: id, inspectorTab: "object", activeRoomId: o?.roomId ?? s.activeRoomId };
      }),
      setInspectorTab: (t) => set({ inspectorTab: t, selectedId: null }),
      openModal: (m) => set({ modal: m }),
      closeModal: () => set({ modal: null }),
      setMaterialTarget: (k) => set({ materialTarget: k }),
      toggle: (k) => set((s) => ({ [k]: !s[k] } as Pick<RoomState, typeof k>)),
      setView2d: (v) => set({ view2d: v }),
      setView3d: (v) => set({ view3d: v }),
      setFov: (fov) => set((s) => ({ view3d: { ...s.view3d, fov } })),
      setProxy: (p) => set((s) => ({ proxy: { ...s.proxy, ...p } })),
      fit: () => set((s) => ({ fitTick: s.fitTick + 1 })),

      patch: (id, p) => set((s) => ({
        furniture: s.furniture.map((o) => {
          if (o.id !== id) return o;
          const n = { ...o, ...p };
          if (p.parent !== undefined) {
            const par = p.parent ? s.furniture.find((f) => f.id === p.parent) : null;
            n.roomId = par ? (par.roomId ?? null) : (roomIdAt({ x: n.x, y: n.y }, s.rooms) ?? n.roomId ?? null);
          }
          return n;
        }),
      })),

      moveFurniture: (id, p) => set((s) => ({
        furniture: s.furniture.map((o) => {
          if (o.id !== id) return o;
          const n = { ...o, ...p };
          // a parentless object moving across the plan re-homes to whatever room now contains it
          if (!n.parent && (p.x !== undefined || p.y !== undefined)) {
            n.roomId = roomIdAt({ x: n.x, y: n.y }, s.rooms) ?? n.roomId ?? null;
          }
          return n;
        }),
      })),

      patchMaterial: (k, p) => set((s) => ({ materials: { ...s.materials, [k]: { ...s.materials[k], ...p } } })),

      remove: (id) => set((s) => ({
        furniture: s.furniture.filter((o) => o.id !== id && o.parent !== id),
        selectedId: null, inspectorTab: "room",
      })),

      duplicate: (id) => set((s) => {
        const o = s.furniture.find((f) => f.id === id);
        if (!o) return {};
        const n: Furniture = { ...o, id: uid("f"), name: o.name + " copy", x: o.x + 40, y: o.y + 40, parent: null };
        n.roomId = roomIdAt({ x: n.x, y: n.y }, s.rooms) ?? o.roomId ?? null;
        return { furniture: [...s.furniture, n], selectedId: n.id, inspectorTab: "object" };
      }),

      addFurniture: (spec) => {
        const s = get();
        const room = s.rooms.find((r) => r.id === s.activeRoomId) ?? s.rooms[0];
        const poly = room?.polygon ?? [];
        const c = poly.length >= 3 ? centroid(poly) : { x: 0, y: 0 };
        const id = uid("f");
        const obj: Furniture = {
          id, name: spec.name || "Object", type: spec.type || "box",
          x: Math.round(c.x), y: Math.round(c.y), rot: 0,
          w: spec.w, d: spec.d, h: spec.h, color: "#b0a9a0",
          status: spec.meshUrl ? "ready" : "generating",
          meshUrl: spec.meshUrl ?? null,
          roomId: room?.id ?? null,
        };
        set((st) => ({ furniture: [...st.furniture, obj], selectedId: id, inspectorTab: "object" }));
        return id;
      },

      setFurnitureMesh: (id, meshUrl, status = "ready") =>
        set((s) => ({ furniture: s.furniture.map((o) => (o.id === id ? { ...o, meshUrl, status } : o)) })),

      addOpening: (o) => set((s) => ({ openings: [...s.openings, { ...o, id: uid("op") }] })),
      patchOpening: (id, p) => set((s) => ({ openings: s.openings.map((op) => (op.id === id ? { ...op, ...p } : op)) })),
      removeOpening: (id) => set((s) => ({ openings: s.openings.filter((op) => op.id !== id) })),
    }),
    {
      name: "roomscale.scene.v1",
      version: 3,
      // Persist only the scene + verification prefs; transient UI/camera state resets each load.
      // blob: mesh URLs and object: texture-map URLs are session-scoped — strip them so a
      // reload doesn't try to fetch dead URLs (it falls back to the placeholder box / base color).
      partialize: (s) => ({
        rooms: s.rooms,
        activeRoomId: s.activeRoomId,
        furniture: s.furniture.map(sanitizeFurniture),
        openings: s.openings,
        materials: sanitizeMaterials(s.materials),
        wallHeight: s.wallHeight,
        gridSize: s.gridSize,
        showRoomLabels: s.showRoomLabels,
        showClearance: s.showClearance,
        showProxy: s.showProxy,
        proxy: s.proxy,
      }),
      migrate: (persisted: unknown, version: number) => {
        const p = persisted as {
          room?: { id?: string; closed?: boolean; polygon?: Vec2[]; name?: string };
          rooms?: Room[];
          activeRoomId?: string | null;
          furniture?: Furniture[];
          openings?: Opening[];
          materials?: RoomState["materials"];
        } | undefined;
        if (!p) return p as unknown as RoomState;
        // v2 → v3: a single `room` becomes a one-element `rooms[]`; stamp roomId onto
        // furniture (by containment isn't needed — they all belonged to the one room) + openings.
        if (version < 3 && p.room && !p.rooms) {
          const rid = p.room.id || "room-main";
          p.rooms = [{ id: rid, closed: !!p.room.closed, polygon: p.room.polygon || [], name: p.room.name || "Room 1" }];
          p.activeRoomId = rid;
          if (Array.isArray(p.furniture)) p.furniture = p.furniture.map((f) => ({ ...f, roomId: f.roomId ?? rid }));
          if (Array.isArray(p.openings)) p.openings = p.openings.map((o) => ({ ...o, roomId: o.roomId ?? rid }));
          delete p.room;
        }
        if (p.furniture) p.furniture = p.furniture.map(sanitizeFurniture);
        if (p.materials) p.materials = sanitizeMaterials(p.materials);
        return p as unknown as RoomState;
      },
    },
  ),
);

// dev-only inspection hook (used for verification; tree-shaken from prod builds)
if (import.meta.env.DEV) {
  (window as unknown as { __store?: typeof useStore }).__store = useStore;
}
