/* ===== House export / import =====
   Serialises the whole house (rooms, furniture + placement, openings, materials, wall
   height, proxy, house name) to a single .json file, with the uploaded/generated model
   bytes bundled inline (base64) so the file is portable across browsers and devices.
   Import writes the model bytes back into IndexedDB, loads the scene, and rehydrates. */
import { useStore } from "../state/store";
import { getMesh, putMesh } from "./meshStore";
import type { Furniture, Opening, Proxy, Room, SceneState, WallImage } from "../domain/types";

const FORMAT = "roomscale-house";
const ephemeral = (u?: string | null) => !!u && u.startsWith("blob:");

interface StoredMeshB64 { mime: string; name?: string; bytes: string }
interface HousePayload {
  houseName: string;
  rooms: Room[];
  activeRoomId: string | null;
  furniture: Furniture[];
  openings: Opening[];
  wallImages: WallImage[];
  materials: SceneState["materials"];
  wallHeight: number;
  gridSize: number;
  showRoomLabels: boolean;
  proxy: Proxy;
}
interface HouseFile { format: string; version: number; exportedAt: number; house: HousePayload; meshes?: Record<string, StoredMeshB64> }

function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}
function b64ToAb(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Build the export payload (bundling durable model bytes) and trigger a download. */
export async function exportHouse(): Promise<void> {
  const s = useStore.getState();
  const meshes: Record<string, StoredMeshB64> = {};
  for (const f of s.furniture) {
    if (!f.meshStored) continue;
    const m = await getMesh(f.id);
    if (m) meshes[f.id] = { mime: m.mime, name: m.name, bytes: abToB64(m.bytes) };
  }
  // wall-image bytes live in the same IDB store, keyed by the wall-image id
  for (const wi of s.wallImages) {
    if (!wi.stored) continue;
    const m = await getMesh(wi.id);
    if (m) meshes[wi.id] = { mime: m.mime, name: m.name, bytes: abToB64(m.bytes) };
  }
  const data: HouseFile = {
    format: FORMAT, version: 1, exportedAt: Date.now(),
    house: {
      houseName: s.houseName,
      rooms: s.rooms,
      activeRoomId: s.activeRoomId,
      // drop session blob URLs — the bytes travel in `meshes` and rehydrate on import
      furniture: s.furniture.map((f) => ({ ...f, meshUrl: f.meshStored || ephemeral(f.meshUrl) ? null : f.meshUrl })),
      openings: s.openings,
      wallImages: s.wallImages.map((w) => ({ ...w, url: w.stored || ephemeral(w.url) ? null : w.url })),
      materials: s.materials,
      wallHeight: s.wallHeight,
      gridSize: s.gridSize,
      showRoomLabels: s.showRoomLabels,
      proxy: s.proxy,
    },
    meshes,
  };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (s.houseName || "house").replace(/[^a-z0-9_\- ]/gi, "").trim() || "house";
  a.href = url;
  a.download = `${safe}.roomscale.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Load a previously exported house file: restore model bytes + scene, then rehydrate. */
export async function importHouse(file: File): Promise<void> {
  const data = JSON.parse(await file.text()) as HouseFile;
  if (!data || data.format !== FORMAT || !data.house) throw new Error("That isn't a Roomscale house file.");
  // restore bundled model bytes to IndexedDB first, so rehydrate finds them
  if (data.meshes) {
    for (const [id, m] of Object.entries(data.meshes)) await putMesh(id, b64ToAb(m.bytes), m.mime, m.name);
  }
  const h = data.house;
  const cur = useStore.getState();
  useStore.setState({
    houseName: h.houseName ?? "Imported house",
    rooms: h.rooms ?? [],
    activeRoomId: h.activeRoomId ?? (h.rooms?.[0]?.id ?? null),
    furniture: (h.furniture ?? []).map((f) => ({ ...f, meshUrl: f.meshStored || ephemeral(f.meshUrl) ? null : f.meshUrl })),
    openings: h.openings ?? [],
    wallImages: (h.wallImages ?? []).map((w) => ({ ...w, url: w.stored || ephemeral(w.url) ? null : w.url })),
    materials: h.materials ?? cur.materials,
    wallHeight: h.wallHeight ?? cur.wallHeight,
    gridSize: h.gridSize ?? cur.gridSize,
    showRoomLabels: h.showRoomLabels ?? cur.showRoomLabels,
    proxy: h.proxy ?? cur.proxy,
    selectedId: null, drafting: false, draftPoints: [], draftRoomId: null, tool: "select", mode: "2d", inspectorTab: "room",
  });
  cur.rehydrateMeshes();
  useStore.getState().fit();
}
