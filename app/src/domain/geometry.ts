/* ===== Geometry — polygon math (ported & typed from prototype geometry.jsx) ===== */
import type { Vec2 } from "./types";

const cos = Math.cos, sin = Math.sin, PI = Math.PI;
export const rad = (d: number) => (d * PI) / 180;

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function bounds(pts: Vec2[]): Bounds {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function centroid(pts: Vec2[]): Vec2 {
  let x = 0, y = 0;
  pts.forEach((p) => { x += p.x; y += p.y; });
  return { x: x / pts.length, y: y / pts.length };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** signed-area (shoelace) → absolute area in same units² */
export function area(pts: Vec2[]): number {
  if (!pts || pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function perimeter(pts: Vec2[]): number {
  if (!pts || pts.length < 2) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
  return s;
}

/** rough human-readable shape name from vertex count */
export function shapeName(pts: Vec2[]): string {
  const n = (pts || []).length;
  if (n === 4) return "Rectangle";
  if (n === 6) return "L-shape";
  if (n < 3) return "Open";
  return n + "-sided";
}

export interface Edge {
  a: Vec2;
  b: Vec2;
  mid: Vec2;
  /** outward unit normal (points away from centroid) */
  nx: number;
  ny: number;
  len: number;
  i: number;
}

/** edges of a closed polygon, with length + outward normal (points away from centroid) */
export function edges(pts: Vec2[]): Edge[] {
  const c = centroid(pts);
  const out: Edge[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    // flip to point away from centroid
    if ((mid.x - c.x) * nx + (mid.y - c.y) * ny < 0) { nx = -nx; ny = -ny; }
    out.push({ a, b, mid, nx, ny, len: dist(a, b), i });
  }
  return out;
}

export function pointInPoly(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > p.y) !== (yj > p.y)) && (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export interface Corner3 { x: number; y: number; z: number; }

/** 8 corners (world cm) of an object's box: centre (x,y), base at z0, dims, rot deg.
    Returns [b0..b3, t0..t3]. */
export function boxCorners(
  o: { x: number; y: number; w: number; d: number; h: number; rot?: number },
  z0?: number,
): Corner3[] {
  const hw = o.w / 2, hd = o.d / 2;
  const r = rad(o.rot || 0), ca = cos(r), sa = sin(r);
  const base = z0 || 0, top = base + o.h;
  const local = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  const c: Corner3[] = [];
  for (const z of [base, top]) {
    for (const [lx, ly] of local) {
      c.push({ x: o.x + lx * ca - ly * sa, y: o.y + lx * sa + ly * ca, z });
    }
  }
  return c;
}

/** shade a hex color by factor (1=same, <1 darker, >1 lighter) */
export function shade(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; }
  else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

export const GEO = {
  bounds, centroid, dist, area, perimeter, shapeName, edges, pointInPoly, boxCorners, shade, rad,
};
