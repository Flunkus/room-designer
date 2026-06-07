/* ===== Model library helpers — save scene objects / uploads into "My models" =====
   Orchestrates the durable library: render a top-down thumbnail (best-effort) and
   write the model bytes + metadata into IndexedDB so a model can be re-placed later
   without re-uploading or re-sizing. Kept separate from meshStore so that module
   stays free of the (heavy) three.js snapshot dependency. */
import { getMesh, saveLibraryModel } from "./meshStore";
import { topDownImage } from "./topdown";
import type { Furniture } from "../domain/types";

/** Save raw model bytes to the library with a thumbnail. Returns the new entry. */
export async function saveModelToLibrary(
  meta: { name: string; type?: string; w: number; d: number; h: number; color?: string; mime: string },
  bytes: ArrayBuffer,
  meshUrl?: string,
) {
  const thumb = meshUrl ? await topDownImage(meshUrl).catch(() => null) : null;
  return saveLibraryModel(
    { name: meta.name, type: meta.type ?? "box", w: meta.w, d: meta.d, h: meta.h, color: meta.color, mime: meta.mime, thumb, createdAt: Date.now() },
    bytes,
  );
}

/** Save an already-placed object to the library at its current name + size. Prefers
    the durable IndexedDB bytes; falls back to fetching its session URL. */
export async function saveFurnitureToLibrary(o: Furniture): Promise<boolean> {
  if (!o.meshUrl) return false; // nothing to save for a plain box
  let bytes: ArrayBuffer;
  let mime = "model/gltf-binary";
  const stored = await getMesh(o.id);
  if (stored) {
    bytes = stored.bytes;
    mime = stored.mime || mime;
  } else {
    try {
      const res = await fetch(o.meshUrl);
      bytes = await res.arrayBuffer();
      mime = res.headers.get("content-type") || mime;
    } catch {
      return false;
    }
  }
  await saveModelToLibrary({ name: o.name, type: o.type, w: o.w, d: o.d, h: o.h, color: o.color, mime }, bytes, o.meshUrl);
  return true;
}
