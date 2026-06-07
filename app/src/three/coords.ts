/* ===== 3D coordinate mapping =====
   Plan is centimetres: x = right, y = depth (down on the 2D plan).
   World is metres (three.js, y-up):
     world X =  plan.x / 100
     world Z =  plan.y / 100   (plan depth → world +z)
     world Y =  height (object z / 100), up
   A box's plan rotation (deg, clockwise top-down) maps to a Y-axis rotation. */

import { rad } from "../domain/geometry";
import type { Furniture, Vec2 } from "../domain/types";

/** cm → world-metre scale */
export const M = 0.01;

export function planToWorldXZ(p: Vec2): [number, number] {
  return [p.x * M, p.y * M];
}

/** Y-axis rotation (radians) for a plan rotation in degrees.
    Local +X aligns with the edge/forward direction under this convention. */
export function yRotation(deg: number): number {
  return -rad(deg);
}

export interface Resolved extends Furniture {
  /** base height (cm) the box sits on (0 = floor; parent top for nested) */
  z0: number;
}

/** Resolve an object's absolute plan transform, binding nested children to the
    parent's geometry (Req 3 scene graph). A child is centred on the parent and
    pushed to the parent's front edge, lifted to localZ (or the parent's top),
    with the offset rotated into the parent's frame so it follows rotation too. */
export function resolve(o: Furniture, all: Furniture[]): Resolved {
  // floor objects sit at z0 = their Z transform (localZ, default 0); nested objects
  // resolve against the parent below.
  if (!o.parent) return { ...o, z0: o.localZ ?? 0 };
  const p = all.find((f) => f.id === o.parent);
  if (!p) return { ...o, z0: 0 };
  const offX = 0;
  const offY = -p.d / 2 + o.d / 2; // toward the parent's front (−depth)
  const r = rad(p.rot || 0), ca = Math.cos(r), sa = Math.sin(r);
  return {
    ...o,
    x: p.x + offX * ca - offY * sa,
    y: p.y + offX * sa + offY * ca,
    z0: o.localZ != null ? o.localZ : p.h,
    rot: (p.rot || 0) + (o.rot || 0),
  };
}
