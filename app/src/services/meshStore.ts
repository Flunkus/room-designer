/* ===== Durable mesh store (IndexedDB) =====
   Uploaded models (and cached remote-generated GLBs) are kept here as raw bytes,
   keyed by furniture id. The Zustand store strips blob: URLs on persist (so a
   reload never 404s on a dead session URL) — IndexedDB is the durable backing:
   on load we rehydrate a fresh blob URL from the stored bytes (see
   store.rehydrateMeshes). localStorage stays small; multi-MB models are fine here.

   Dependency-free promise wrapper over IDB — no npm package. */

const DB_NAME = "roomscale";
const STORE = "meshes";
/** Persistent "My models" catalogue — survives reload AND "New house" (it's separate
    from the scene), so generated/uploaded models stay available to re-place. */
const LIB_STORE = "library";
const DB_VERSION = 2;

export interface StoredMesh {
  bytes: ArrayBuffer;
  mime: string;
  name?: string;
}

/** A saved model in the reusable library. Master bytes live in the `meshes` store
    keyed by this `id`; placing one copies those bytes onto a new furniture instance. */
export interface LibraryEntry {
  id: string;
  name: string;
  type: string;
  w: number;
  d: number;
  h: number;
  color?: string;
  mime: string;
  /** top-down PNG data URL for the picker thumbnail (optional) */
  thumb?: string | null;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(LIB_STORE)) db.createObjectStore(LIB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Persist model bytes under a furniture id. */
export function putMesh(id: string, bytes: ArrayBuffer, mime: string, name?: string): Promise<void> {
  const value: StoredMesh = { bytes, mime, name };
  return tx<IDBValidKey>(STORE, "readwrite", (s) => s.put(value, id)).then(() => undefined);
}

export function getMesh(id: string): Promise<StoredMesh | undefined> {
  return tx<StoredMesh | undefined>(STORE, "readonly", (s) => s.get(id) as IDBRequest<StoredMesh | undefined>);
}

export function deleteMesh(id: string): Promise<void> {
  return tx<undefined>(STORE, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
}

/* ---------------- Reusable model library ---------------- */

/** Save a model into the durable library: store its bytes under a fresh master id,
    then record the catalogue entry. Returns the created entry. */
export async function saveLibraryModel(
  meta: Omit<LibraryEntry, "id" | "createdAt"> & { createdAt: number },
  bytes: ArrayBuffer,
): Promise<LibraryEntry> {
  const id = "lib-" + meta.createdAt.toString(36) + "-" + Math.round(meta.w + meta.d + meta.h).toString(36);
  await putMesh(id, bytes, meta.mime, meta.name);
  const entry: LibraryEntry = { ...meta, id };
  await tx<IDBValidKey>(LIB_STORE, "readwrite", (s) => s.put(entry, id));
  return entry;
}

/** All saved library entries, newest first. */
export async function listLibrary(): Promise<LibraryEntry[]> {
  const all = await tx<LibraryEntry[]>(LIB_STORE, "readonly", (s) => s.getAll() as IDBRequest<LibraryEntry[]>);
  return (all || []).sort((a, b) => b.createdAt - a.createdAt);
}

/** Remove a library entry and its master bytes. */
export async function deleteLibraryModel(id: string): Promise<void> {
  await tx<undefined>(LIB_STORE, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
  await deleteMesh(id);
}

/** Copy stored bytes from one id to another (used when duplicating furniture). */
export async function copyMesh(from: string, to: string): Promise<void> {
  const m = await getMesh(from);
  if (m) await putMesh(to, m.bytes, m.mime, m.name);
}

/** Rehydrate a session blob URL from stored bytes, or null if nothing is stored. */
export async function meshObjectUrl(id: string): Promise<string | null> {
  try {
    const m = await getMesh(id);
    if (!m) return null;
    return URL.createObjectURL(new Blob([m.bytes], { type: m.mime || "model/gltf-binary" }));
  } catch (err) {
    console.warn("[meshStore] rehydrate failed for", id, err);
    return null;
  }
}

/** Download a remote GLB and cache its bytes under a furniture id so it survives
    reload (Meshy asset URLs expire). Returns false on any failure (e.g. CORS) —
    the caller then degrades to persisting the https URL only. */
export async function cacheRemoteMesh(id: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const bytes = await res.arrayBuffer();
    const mime = res.headers.get("content-type") || "model/gltf-binary";
    await putMesh(id, bytes, mime);
    return true;
  } catch (err) {
    console.warn("[meshStore] cacheRemoteMesh failed for", id, err);
    return false;
  }
}
