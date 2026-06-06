/* ===== Unified PBR material system =====
   Builds a THREE.MeshStandardMaterial from a domain Material, supporting both
   ingestion tracks: AI-generated tiles + manual Base/Normal/Roughness map URLs,
   with a procedural fallback texture so scale/rotation are always visible.

   Split into a heavy createMaterial (builds textures) and a cheap
   applyMaterialParams (repeat / rotation / roughness) so dragging the sliders
   doesn't rebuild textures every tick. */
import * as THREE from "three";
import type { Material } from "../../domain/types";
import { M } from "../coords";
import { makeSurfaceTexture, type SurfaceKind } from "../textures";

const loader = new THREE.TextureLoader();

function loadMap(url: string, srgb: boolean): THREE.Texture {
  const tex = loader.load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.center.set(0.5, 0.5);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function kindFor(material: Material): SurfaceKind {
  const k = material.kind;
  if (k === "wood" || k === "paint" || k === "plaster" || k === "stone") return k;
  return "generic";
}

/** Heavy build: textures + material. Rebuild only when base/kind/maps change. */
export function createMaterial(material: Material): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color("#ffffff"), metalness: 0, side: THREE.FrontSide });

  if (material.maps?.base) {
    m.map = loadMap(material.maps.base, true);
  } else {
    // procedural fallback tinted by base color → tiling is always demonstrable
    m.map = makeSurfaceTexture(kindFor(material), material.base);
  }
  if (material.maps?.normal) m.normalMap = loadMap(material.maps.normal, false);
  if (material.maps?.roughness) m.roughnessMap = loadMap(material.maps.roughness, false);

  applyMaterialParams(m, material);
  return m;
}

/** Cheap update: repeat (texture scale), rotation, roughness. */
export function applyMaterialParams(m: THREE.MeshStandardMaterial, material: Material): void {
  m.roughness = THREE.MathUtils.clamp(material.roughness, 0, 1);
  // UVs on the floor ShapeGeometry are world-metre coords → one tile spans
  // `scale` cm when repeat = 1 / (scale * M).
  const rep = 1 / Math.max(0.05, material.scale * M);
  const rot = (material.rotation * Math.PI) / 180;
  for (const t of [m.map, m.normalMap, m.roughnessMap]) {
    if (!t) continue;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.center.set(0.5, 0.5);
    t.repeat.set(rep, rep);
    t.rotation = rot;
    t.needsUpdate = true;
  }
  m.needsUpdate = true;
}
