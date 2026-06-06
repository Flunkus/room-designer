/* ===== Image→3D mesh generation service =====
   Async-job abstraction modelling real providers (Meshy / Tripo / Rodin):
   submit → poll → download GLB. The UI places a bounding-box placeholder
   immediately (store.addFurniture with status:"generating") and swaps to the
   returned meshUrl when the job resolves — preserving position/scale.

   MockMeshGenProvider simulates the latency with no network/keys. Swap in a real
   provider later by implementing MeshGenProvider; the store/UI contract is stable. */

export interface MeshGenSpec {
  name: string;
  type: string;
  w: number;
  d: number;
  h: number;
  /** whether the request originated from an uploaded source image */
  sourceImage?: boolean;
  /** base64 data URI of the source image (image→3D); when present a real provider runs */
  imageDataUrl?: string;
}

export interface MeshGenJob {
  jobId: string;
  /** URL of the generated GLB, or null if the provider returned a box-only result */
  meshUrl: string | null;
  status: "succeeded" | "failed";
}

/** Optional progress callback (0–100) reported while a real provider polls its job. */
export type MeshGenProgress = (percent: number) => void;

export interface MeshGenProvider {
  generate(spec: MeshGenSpec, onProgress?: MeshGenProgress): Promise<MeshGenJob>;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Mock provider — simulates an async job, then synthesises a recognisable GLB
    for the furniture type (procedural model exported to a binary GLB blob URL).
    The scene loads it and rescales it to the exact bounding box, demonstrating
    the placeholder→mesh swap a real provider (Meshy/Tripo) would drive. */
export const MockMeshGenProvider: MeshGenProvider = {
  async generate(spec: MeshGenSpec, onProgress?: MeshGenProgress): Promise<MeshGenJob> {
    const jobId = "job-" + Math.random().toString(36).slice(2, 9);
    // Image jobs take a touch longer than text-only, mirroring real services.
    const total = spec.sourceImage || spec.imageDataUrl ? 2600 : 2000;
    const steps = 4;
    for (let i = 1; i <= steps; i++) { await delay(total / steps); onProgress?.((i / steps) * 100); }
    // Lazy-import so the exporter/three only load when a generation actually runs.
    const { modelToGlbUrl } = await import("../three/procedural");
    const meshUrl = await modelToGlbUrl(spec.type);
    return { jobId, meshUrl, status: "succeeded" };
  },
};

/* ===== Real provider — Meshy Image to 3D =====
   Browser key = LOCAL DEV ONLY. Requests go to the relative "/meshy" path, which the
   Vite dev server proxies to https://api.meshy.ai (see vite.config.ts) to sidestep CORS.
   PRODUCTION: replace this seam with a call to your own backend that holds the key and
   proxies to Meshy — never ship VITE_MESHY_API_KEY to real users. */
const MESHY_KEY = import.meta.env.VITE_MESHY_API_KEY as string | undefined;
const MESHY_BASE = "/meshy/openapi/v1/image-to-3d";
const MESHY_ASSET_HOST = "https://assets.meshy.ai";
const POLL_INTERVAL = 4000;
const POLL_TIMEOUT = 5 * 60 * 1000; // give up after 5 min

/** Meshy's asset CDN has no CORS headers, so a direct browser fetch fails. Route the GLB
    through the same-origin "/meshy-asset" dev proxy so three's loader + the IDB cache can read
    it. PRODUCTION: point this at your backend asset proxy instead. */
function proxyAssetUrl(url: string): string {
  return url.startsWith(MESHY_ASSET_HOST) ? url.replace(MESHY_ASSET_HOST, "/meshy-asset") : url;
}

interface MeshyTask {
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress?: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

export const MeshyMeshGenProvider: MeshGenProvider = {
  async generate(spec: MeshGenSpec, onProgress?: MeshGenProgress): Promise<MeshGenJob> {
    // Only image→3D is a real Meshy job; catalog/describe have no image → procedural mock.
    if (!spec.imageDataUrl || !MESHY_KEY) return MockMeshGenProvider.generate(spec, onProgress);

    const headers = { Authorization: `Bearer ${MESHY_KEY}`, "Content-Type": "application/json" };
    const create = await fetch(MESHY_BASE, {
      method: "POST",
      headers,
      body: JSON.stringify({ image_url: spec.imageDataUrl, target_formats: ["glb"], should_texture: true }),
    });
    if (!create.ok) throw new Error(`Meshy create failed: ${create.status} ${await create.text().catch(() => "")}`);
    const created = (await create.json()) as { result?: string; id?: string };
    const jobId = created.result ?? created.id;
    if (!jobId) throw new Error("Meshy create returned no task id");

    // Poll until the task resolves (or times out). The UI shows the placeholder box meanwhile.
    const started = Date.now();
    for (;;) {
      await delay(POLL_INTERVAL);
      const res = await fetch(`${MESHY_BASE}/${jobId}`, { headers });
      if (!res.ok) throw new Error(`Meshy poll failed: ${res.status}`);
      const task = (await res.json()) as MeshyTask;
      onProgress?.(task.progress ?? 0);
      if (task.status === "SUCCEEDED") {
        const glb = task.model_urls?.glb;
        if (!glb) throw new Error("Meshy succeeded but returned no GLB url");
        return { jobId, meshUrl: proxyAssetUrl(glb), status: "succeeded" };
      }
      if (task.status === "FAILED" || task.status === "CANCELED") {
        throw new Error(`Meshy job ${task.status.toLowerCase()}: ${task.task_error?.message ?? ""}`);
      }
      if (Date.now() - started > POLL_TIMEOUT) throw new Error("Meshy job timed out");
    }
  },
};

/** Active provider: real Meshy when a key is present, else the procedural mock. */
export const activeMeshGenProvider: MeshGenProvider = MESHY_KEY ? MeshyMeshGenProvider : MockMeshGenProvider;

export function generateFurnitureMesh(spec: MeshGenSpec, onProgress?: MeshGenProgress): Promise<MeshGenJob> {
  return activeMeshGenProvider.generate(spec, onProgress);
}
