/* ===== AI texture generation service =====
   Returns a seamless tileable PBR set (Base / Normal / Roughness) for the
   material system. Mirrors AI texture APIs that take a photo or prompt and
   return tile maps. MockTextureGenProvider synthesises a preview swatch + base
   color with no network. Manual multi-file PBR upload is handled separately in
   the TextureModal (the other ingestion track). */

export interface PBRMaps {
  /** dominant/base color hex (used as fallback + material base) */
  baseColor: string;
  /** CSS background for the small preview swatch in the modal */
  preview: string;
  /** map URLs (object URLs / data URLs); null when not produced */
  base: string | null;
  normal: string | null;
  roughness: string | null;
}

export interface TextureGenProvider {
  generate(prompt: string): Promise<PBRMaps>;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** crude prompt→color heuristic so the mock preview reflects the request. */
function colorFor(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/oak|wood|timber|walnut|pine/.test(p)) return "#c89b6b";
  if (/marble|stone|concrete|grey|gray/.test(p)) return "#cdcbc6";
  if (/white|paint|plaster/.test(p)) return "#efe9e1";
  if (/green|sage|moss/.test(p)) return "#7f8f6e";
  if (/blue|navy|teal/.test(p)) return "#6f8aa6";
  if (/terracotta|clay|brick|rust/.test(p)) return "#b3744f";
  return "#c4b8a6";
}

export const MockTextureGenProvider: TextureGenProvider = {
  async generate(prompt: string): Promise<PBRMaps> {
    await delay(1400);
    const c = colorFor(prompt);
    // synthesise a real seamless tile (data URL) so the applied material shows
    // visible tiling — mirrors an AI texture API returning a tileable base map.
    const { makeSurfaceDataUrl } = await import("../three/textures");
    const kind = /oak|wood|timber|walnut|pine/.test(prompt.toLowerCase()) ? "wood"
      : /marble|stone|concrete|brick/.test(prompt.toLowerCase()) ? "stone" : "plaster";
    const base = makeSurfaceDataUrl(kind, c);
    return {
      baseColor: c,
      preview: `linear-gradient(135deg, ${c}, ${shade(c, 0.82)})`,
      base,
      normal: null,
      roughness: null,
    };
  },
};

// local copy to avoid importing geometry into the service layer
function shade(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((x) => x + x).join("") : m, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r *= f; g *= f; b *= f;
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

export const activeTextureGenProvider: TextureGenProvider = MockTextureGenProvider;

export function generateTexture(prompt: string): Promise<PBRMaps> {
  return activeTextureGenProvider.generate(prompt);
}
