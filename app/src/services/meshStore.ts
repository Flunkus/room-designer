/* ===== Durable mesh store (IndexedDB) =====
   Uploaded models (and cached remote-generated GLBs) are kept here as raw bytes,
   keyed by furniture id. The Zustand store strips blob: URLs on persist (so a
   reload never 404s on a dead session URL) — IndexedDB is the durable backing:
   on load we rehydrate a fresh blob URL from the stored bytes (see
   store.rehydrateMeshes). localStorage stays small; multi-MB models are fine here.

   Dependency-free promise wrapper over IDB — no npm package. */

const DB_NAME = "roomscale";
const STORE = "meshes";
const DB_VERSION = 1;

export interface StoredMesh {
  bytes: ArrayBuffer;
  mime: string;
  name?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** Persist model bytes under a furniture id. */
export function putMesh(id: string, bytes: ArrayBuffer, mime: string, name?: string): Promise<void> {
  const value: StoredMesh = { bytes, mime, name };
  return tx<IDBValidKey>("readwrite", (s) => s.put(value, id)).then(() => undefined);
}

export function getMesh(id: string): Promise<StoredMesh | undefined> {
  return tx<StoredMesh | undefined>("readonly", (s) => s.get(id) as IDBRequest<StoredMesh | undefined>);
}

export function deleteMesh(id: string): Promise<void> {
  return tx<undefined>("readwrite", (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
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
