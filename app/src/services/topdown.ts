/* ===== Top-down orthographic snapshot of a GLB =====
   Renders a model straight down (-Y) with an orthographic camera so the 2D plan can
   draw the object's real silhouette instead of a generic rectangle. The model is
   normalised to a unit footprint and rendered into a square, transparent PNG; the
   plan then stretches that square into the object's W×D box (matching the non-uniform
   scaling the 3D view applies). Results are cached per source URL.

   Everything (three + the GLTF loader) is lazy-imported so the 2D view stays light
   until an actual mesh-backed object needs a thumbnail. */

const SIZE = 256;

let rendererP: Promise<{
  THREE: typeof import("three");
  renderer: import("three").WebGLRenderer;
}> | null = null;

async function getRenderer() {
  if (!rendererP) {
    rendererP = (async () => {
      const THREE = await import("three");
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(SIZE, SIZE);
      renderer.setClearColor(0x000000, 0); // transparent — floor shows through in the plan
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      return { THREE, renderer };
    })();
  }
  return rendererP;
}

const cache = new Map<string, Promise<string | null>>();

/** Render (and cache) a top-down PNG data URL for the GLB at `url`, or null on failure. */
export function topDownImage(url: string): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = render(url).catch((err) => {
      console.warn("[topdown] render failed for", url, err);
      cache.delete(url); // allow a later retry
      return null;
    });
    cache.set(url, p);
  }
  return p;
}

async function render(url: string): Promise<string> {
  const [{ THREE, renderer }, { GLTFLoader }] = await Promise.all([
    getRenderer(),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
  ]);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  // Centre the model and normalise its footprint to a 1×1 square (non-uniform on X/Z,
  // matching how the 3D view scales the mesh into its bounding box). Height is
  // squashed into the unit too — it doesn't affect the top-down projection.
  const bb = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3(), center = new THREE.Vector3();
  bb.getSize(size); bb.getCenter(center);
  model.position.sub(center);
  model.scale.set(1 / (size.x || 1), 1 / (size.y || 1), 1 / (size.z || 1));

  const scene = new THREE.Scene();
  scene.add(model);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(0.4, 2, 0.6);
  scene.add(key);

  // Look straight down. up = -Z makes image-right = +X and image-down = +Z, i.e. the
  // plan's (x → right, y/depth → down) convention, so the snapshot aligns with the box.
  const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.001, 10);
  cam.position.set(0, 4, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);

  renderer.render(scene, cam);
  const dataUrl = renderer.domElement.toDataURL("image/png");

  // Free the per-model GPU resources (the shared renderer/context stays alive).
  model.traverse((o) => {
    const m = o as import("three").Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      const mat = m.material;
      (Array.isArray(mat) ? mat : [mat]).forEach((mm) => mm?.dispose());
    }
  });

  return dataUrl;
}
