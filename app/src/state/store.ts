/* ===== Zustand store — mirrors the prototype useStore + A{} action set (app.jsx) ===== */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Furniture, InspectorTab, MaterialKey, ModalKind, Opening, Proxy,
  Room, SceneState, Tool, Vec2, View2D, View3D, ViewMode,
} from "../domain/types";
import { centroid } from "../domain/geometry";
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
  room: Room;
  furniture: Furniture[];
  openings: Opening[];
  materials: SceneState["materials"];
  wallHeight: number;

  // ---- drafting ----
  drafting: boolean;
  draftPoints: Vec2[];

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
  addPoint: (p: Vec2) => void;
  undoPoint: () => void;
  cancelDraw: () => void;
  closeRoom: () => void;
  newRoom: () => void;
  starterRoom: () => void;
  renameRoom: (name: string) => void;
  resetRoom: () => void;
  select: (id: string | null) => void;
  setInspectorTab: (t: InspectorTab) => void;
  openModal: (m: ModalKind) => void;
  closeModal: () => void;
  setMaterialTarget: (k: MaterialKey) => void;
  toggle: (k: "showClearance" | "showProxy") => void;
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

      room: demo.room,
      furniture: demo.furniture,
      openings: demo.openings,
      materials: demo.materials,
      wallHeight: demo.wallHeight,

      drafting: false,
      draftPoints: [],

      view2d: { zoom: 0.6, pan: { x: 200, y: 120 } },
      view3d: { az: -28, zoom: 1, scale: 0, ox: 0, oy: 0, fov: 55 },

      showClearance: false,
      showProxy: false,
      proxy: { x: 420, y: 250, rot: 0 },

      fitTick: 0,

      setMode: (m) => set({ mode: m, tool: "select" }),
      setTool: (t) => set({ tool: t }),

      // Draw a NEW perimeter as a non-destructive overlay: keep the existing
      // room + furniture visible (dimmed) and force a top-down 2D view.
      startDraw: () => set({ tool: "draw", drafting: true, draftPoints: [], mode: "2d", selectedId: null }),
      addPoint: (p) => set((s) => ({ draftPoints: [...s.draftPoints, p] })),
      undoPoint: () => set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),
      cancelDraw: () => set({ tool: "select", drafting: false, draftPoints: [] }),
      closeRoom: () => set((s) => ({
        room: { closed: true, polygon: s.draftPoints, name: s.room.name || "New Room" },
        drafting: false, tool: "select", draftPoints: [], fitTick: s.fitTick + 1,
      })),

      // Wipe everything and start tracing a fresh, empty room.
      newRoom: () => {
        const e = makeEmptyScene();
        set({
          room: e.room, furniture: e.furniture, openings: e.openings, materials: e.materials,
          wallHeight: e.wallHeight, drafting: true, draftPoints: [], tool: "draw", mode: "2d",
          selectedId: null, inspectorTab: "room", showClearance: false, showProxy: false,
        });
      },

      // Drop a clean rectangular starter room (used by the empty-state). Keeps furniture.
      starterRoom: () => set((s) => ({
        room: { closed: true, polygon: [{ x: 0, y: 0 }, { x: 520, y: 0 }, { x: 520, y: 420 }, { x: 0, y: 420 }], name: "New Room" },
        openings: [], drafting: false, tool: "select", draftPoints: [], mode: "2d",
        selectedId: null, inspectorTab: "room", fitTick: s.fitTick + 1,
      })),

      renameRoom: (name) => set((s) => ({ room: { ...s.room, name } })),

      resetRoom: () => {
        const d = makeDemoScene();
        set((s) => ({
          room: d.room, furniture: d.furniture, openings: d.openings, materials: d.materials,
          wallHeight: d.wallHeight, drafting: false, tool: "select", draftPoints: [],
          selectedId: null, inspectorTab: "room", fitTick: s.fitTick + 1,
        }));
      },

      select: (id) => set({ selectedId: id, inspectorTab: id ? "object" : "room" }),
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

      patch: (id, p) => set((s) => ({ furniture: s.furniture.map((o) => (o.id === id ? { ...o, ...p } : o)) })),
      moveFurniture: (id, p) => set((s) => ({ furniture: s.furniture.map((o) => (o.id === id ? { ...o, ...p } : o)) })),

      patchMaterial: (k, p) => set((s) => ({ materials: { ...s.materials, [k]: { ...s.materials[k], ...p } } })),

      remove: (id) => set((s) => ({
        furniture: s.furniture.filter((o) => o.id !== id && o.parent !== id),
        selectedId: null, inspectorTab: "room",
      })),

      duplicate: (id) => set((s) => {
        const o = s.furniture.find((f) => f.id === id);
        if (!o) return {};
        const n: Furniture = { ...o, id: uid("f"), name: o.name + " copy", x: o.x + 40, y: o.y + 40, parent: null };
        return { furniture: [...s.furniture, n], selectedId: n.id, inspectorTab: "object" };
      }),

      addFurniture: (spec) => {
        const s = get();
        const poly = s.room.polygon;
        const c = poly.length >= 3 ? centroid(poly) : { x: 0, y: 0 };
        const id = uid("f");
        const obj: Furniture = {
          id, name: spec.name || "Object", type: spec.type || "box",
          x: Math.round(c.x), y: Math.round(c.y), rot: 0,
          w: spec.w, d: spec.d, h: spec.h, color: "#b0a9a0",
          status: spec.meshUrl ? "ready" : "generating",
          meshUrl: spec.meshUrl ?? null,
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
      version: 2,
      // Persist only the scene + verification prefs; transient UI/camera state resets each load.
      // blob: mesh URLs and object: texture-map URLs are session-scoped — strip them so a
      // reload doesn't try to fetch dead URLs (it falls back to the placeholder box / base color).
      partialize: (s) => ({
        room: s.room,
        furniture: s.furniture.map(sanitizeFurniture),
        openings: s.openings,
        materials: sanitizeMaterials(s.materials),
        wallHeight: s.wallHeight,
        showClearance: s.showClearance,
        showProxy: s.showProxy,
        proxy: s.proxy,
      }),
      migrate: (persisted: unknown) => {
        const p = persisted as { furniture?: Furniture[]; materials?: RoomState["materials"] } | undefined;
        if (p?.furniture) p.furniture = p.furniture.map(sanitizeFurniture);
        if (p?.materials) p.materials = sanitizeMaterials(p.materials);
        return p as unknown as RoomState;
      },
    },
  ),
);

// dev-only inspection hook (used for verification; tree-shaken from prod builds)
if (import.meta.env.DEV) {
  (window as unknown as { __store?: typeof useStore }).__store = useStore;
}
