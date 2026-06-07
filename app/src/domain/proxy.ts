/* ===== Human proxy collision — shared by the 2D plan and the 3D dollhouse =====
   The proxy is a 60×40 cm footprint the user drags around to test whether they fit
   through a gap. Both views resolve a desired position the same way: push it out of
   any furniture footprint, then keep its centre inside the walkable union of rooms. */
import { pointInPoly } from "./geometry";
import type { Vec2 } from "./types";

export const PROXY_HW = 30, PROXY_HD = 20; // default 60×40 cm half-extents

export interface Boxish { x: number; y: number; w: number; d: number; rot?: number }

/** Half-extents (cm) for a proxy of the given footprint, falling back to the default. */
export function proxyHalf(p: { w?: number; d?: number }) {
  return { hw: (p.w ?? PROXY_HW * 2) / 2, hd: (p.d ?? PROXY_HD * 2) / 2 };
}

/** Axis-aligned half-extents, accounting for 90°/270° rotation. */
export function effExtent(o: Boxish) {
  const r = (((o.rot || 0) % 360) + 360) % 360;
  const swap = r === 90 || r === 270;
  return { hw: (swap ? o.d : o.w) / 2, hd: (swap ? o.w : o.d) / 2 };
}

/** True if p falls inside any (closed) room polygon — the walkable union of the house. */
export function pointInAnyRoom(p: Vec2, polys: Vec2[][]): boolean {
  return polys.some((poly) => poly.length >= 3 && pointInPoly(p, poly));
}

/** Resolve the human proxy against furniture footprints + the house boundary so it
    physically can't overlap — letting the user test whether it fits through a gap. */
export function resolveProxy(desired: Vec2, current: Vec2, furniture: Boxish[], polys: Vec2[][], half: { hw: number; hd: number } = { hw: PROXY_HW, hd: PROXY_HD }): Vec2 {
  let x = desired.x, y = desired.y;
  // push out of any overlapping furniture box along the least-penetration axis
  for (const o of furniture) {
    const e = effExtent(o);
    const dx = x - o.x, dy = y - o.y;
    const ovx = half.hw + e.hw - Math.abs(dx);
    const ovy = half.hd + e.hd - Math.abs(dy);
    if (ovx > 0 && ovy > 0) {
      if (ovx < ovy) x = o.x + Math.sign(dx || 1) * (half.hw + e.hw);
      else y = o.y + Math.sign(dy || 1) * (half.hd + e.hd);
    }
  }
  // keep the centre inside the house (any room); revert the offending axis if it leaves
  const hasRoom = polys.some((p) => p.length >= 3);
  if (hasRoom && !pointInAnyRoom({ x, y }, polys)) {
    if (pointInAnyRoom({ x, y: current.y }, polys)) y = current.y;
    else if (pointInAnyRoom({ x: current.x, y }, polys)) x = current.x;
    else { x = current.x; y = current.y; }
  }
  return { x: Math.round(x), y: Math.round(y) };
}
