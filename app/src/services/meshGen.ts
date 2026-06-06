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
}

export interface MeshGenJob {
  jobId: string;
  /** URL of the generated GLB, or null if the provider returned a box-only result */
  meshUrl: string | null;
  status: "succeeded" | "failed";
}

export interface MeshGenProvider {
  generate(spec: MeshGenSpec): Promise<MeshGenJob>;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Mock provider — simulates an async job, then synthesises a recognisable GLB
    for the furniture type (procedural model exported to a binary GLB blob URL).
    The scene loads it and rescales it to the exact bounding box, demonstrating
    the placeholder→mesh swap a real provider (Meshy/Tripo) would drive. */
export const MockMeshGenProvider: MeshGenProvider = {
  async generate(spec: MeshGenSpec): Promise<MeshGenJob> {
    const jobId = "job-" + Math.random().toString(36).slice(2, 9);
    // Image jobs take a touch longer than text-only, mirroring real services.
    await delay(spec.sourceImage ? 2600 : 2000);
    // Lazy-import so the exporter/three only load when a generation actually runs.
    const { modelToGlbUrl } = await import("../three/procedural");
    const meshUrl = await modelToGlbUrl(spec.type);
    return { jobId, meshUrl, status: "succeeded" };
  },
};

export const activeMeshGenProvider: MeshGenProvider = MockMeshGenProvider;

export function generateFurnitureMesh(spec: MeshGenSpec): Promise<MeshGenJob> {
  return activeMeshGenProvider.generate(spec);
}
