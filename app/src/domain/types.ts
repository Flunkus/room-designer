/* ===== Domain types =====
   Coordinate system (ported from prototype data.js): centimetres.
   Plan: x = right, y = depth (down on the 2D plan).
   In 3D the plan-y axis maps to world -z, and object height (h/z) maps to world +y. */

export interface Vec2 {
  x: number;
  y: number;
}

export type FurnitureType =
  | "sofa" | "chair" | "table" | "storage" | "tv" | "plant" | "lamp"
  | "bed" | "desk" | "rug" | "box";

export type GenStatus = "ready" | "generating" | "error";

/** A placeable object. pos = centre (cm); rot in degrees (cw); dims w(x) d(y) h(z) cm. */
export interface Furniture {
  id: string;
  name: string;
  type: FurnitureType | string;
  x: number;
  y: number;
  rot: number;
  w: number;
  d: number;
  h: number;
  color: string;
  status: GenStatus;
  /** id of the room this object lives in (by centroid containment); used for grouping + cleanup. */
  roomId?: string | null;
  /** flat objects (rugs) render as a thin floor plate and are excluded from clearance/collision. */
  flat?: boolean;
  /** id of the object this is nested under — coords then resolve in the parent's local frame. */
  parent?: string | null;
  /** local height offset (cm) when nested on a parent (e.g. TV sitting on a console). */
  localZ?: number;
  hidden?: boolean;
  /** URL of a generated GLB mesh; when present the box placeholder is swapped for the mesh. */
  meshUrl?: string | null;
  /** the mesh bytes for this object live in IndexedDB keyed by its id (uploaded model or
      cached remote GLB). Persists across reload; drives rehydration (see store.rehydrateMeshes). */
  meshStored?: boolean;
}

export type OpeningType = "door" | "window";

/** A hole cut into a wall via CSG. Positioned by wall-segment index + offset + size. */
export interface Opening {
  id: string;
  type: OpeningType;
  /** id of the room whose wall this opening is cut into */
  roomId: string;
  /** index into the room polygon's edge list */
  wall: number;
  /** distance (cm) from the wall segment's start vertex to the opening's near edge */
  offset: number;
  width: number;
  height: number;
  /** sill height (cm) for windows; 0 / undefined for doors (floor-anchored) */
  sill?: number;
  label?: string;
}

export type MaterialSource = "ai" | "pbr" | "swatch";

/** A unified PBR material for walls/floors. */
export interface Material {
  id: string;
  name: string;
  kind: string;
  /** base color hex (also used as a flat fallback when no maps are present) */
  base: string;
  /** texture repeat scale, in cm per tile */
  scale: number;
  /** texture rotation, degrees 0–360 */
  rotation: number;
  /** roughness 0–1 */
  roughness: number;
  source: MaterialSource;
  /** optional PBR map URLs (manual upload or AI-generated) */
  maps?: {
    base?: string | null;
    normal?: string | null;
    roughness?: string | null;
  };
}

export interface Room {
  id: string;
  closed: boolean;
  polygon: Vec2[];
  name: string;
}

export interface View2D {
  zoom: number;
  pan: Vec2;
}

export interface View3D {
  /** azimuth (orbit) in degrees */
  az: number;
  zoom: number;
  /** derived projection scale (px per cm) for the 2D fit math — kept for parity */
  scale: number;
  ox: number;
  oy: number;
  /** camera field of view, degrees (orbit mode) */
  fov: number;
}

export interface Proxy {
  x: number;
  y: number;
  rot: number;
}

export type ViewMode = "2d" | "3d" | "walk";
export type Tool = "select" | "draw" | "pan";
export type InspectorTab = "object" | "room" | "materials";
export type ModalKind = "furniture" | "texture" | "room" | null;
export type MaterialKey = "floor" | "walls";

/** A catalog entry for the "add furniture" pipeline. */
export interface CatalogItem {
  id: string;
  name: string;
  type: FurnitureType | string;
  w: number;
  d: number;
  h: number;
}

/** The complete serializable scene — what gets persisted and what "Demo Room" injects. */
export interface SceneState {
  rooms: Room[];
  furniture: Furniture[];
  openings: Opening[];
  materials: Record<MaterialKey, Material>;
  wallHeight: number;
}
