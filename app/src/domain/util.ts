/* ===== Small helpers (ported from prototype data.js) ===== */

export function cm(n: number): string {
  return Math.round(n) + " cm";
}

export function uid(p?: string): string {
  return (p || "id") + "-" + Math.random().toString(36).slice(2, 8);
}
