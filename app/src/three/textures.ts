/* ===== Procedural surface textures =====
   Canvas-drawn seamless tiles used as the default PBR base map so texture
   scale/rotation are immediately visible on floors/walls. Also reused by the
   mock AI texture generator (exported to a data URL). */
import * as THREE from "three";

function shadeHex(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) { r *= f; g *= f; b *= f; } else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

export type SurfaceKind = "wood" | "paint" | "plaster" | "stone" | "generic";

/** A deterministic pseudo-random so tiles are stable across renders. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Draw a seamless surface tile onto a fresh canvas. */
export function makeSurfaceCanvas(kind: SurfaceKind, base: string, size = 512): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rand = rng(0xc0ffee);

  if (kind === "wood") {
    const planks = 6, ph = size / planks;
    for (let i = 0; i < planks; i++) {
      const y = i * ph;
      ctx.fillStyle = shadeHex(base, 0.92 + rand() * 0.16);
      ctx.fillRect(0, y, size, ph);
      // grain streaks
      for (let g = 0; g < 28; g++) {
        ctx.strokeStyle = shadeHex(base, 0.8 + rand() * 0.1);
        ctx.globalAlpha = 0.18 + rand() * 0.18;
        ctx.lineWidth = 0.6 + rand();
        const gy = y + rand() * ph;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(size * 0.33, gy + (rand() - 0.5) * 6, size * 0.66, gy + (rand() - 0.5) * 6, size, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // plank seam (drawn at top edge → tiles seamlessly)
      ctx.fillStyle = shadeHex(base, 0.6);
      ctx.fillRect(0, y, size, 1.5);
    }
  } else if (kind === "stone") {
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = shadeHex(base, 0.85 + rand() * 0.3);
      const r = 1 + rand() * 3;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // paint / plaster / generic — fine subtle noise
    const dots = kind === "generic" ? 2200 : 5000;
    for (let i = 0; i < dots; i++) {
      ctx.fillStyle = shadeHex(base, 0.97 + rand() * 0.06);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rand() * size, rand() * size, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }
  return cv;
}

export function makeSurfaceTexture(kind: SurfaceKind, base: string): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(makeSurfaceCanvas(kind, base));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Data URL of a generated seamless tile — for the mock AI texture provider. */
export function makeSurfaceDataUrl(kind: SurfaceKind, base: string): string {
  return makeSurfaceCanvas(kind, base).toDataURL("image/png");
}
