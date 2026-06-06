/* ===== Procedural furniture models → GLB blob URLs =====
   The mock MeshGenProvider "generates" a recognisable model per furniture type,
   exports it to a binary GLB, and returns an object-URL. This authentically
   exercises the real pipeline a provider like Meshy/Tripo would drive:
   placeholder box → download GLB → load → scale to the exact bounding box.
   The models carry their own materials (as a downloaded mesh would). */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

function mat(color: string, roughness = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness: 0 });
}
function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(rTop: number, rBot: number, h: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20), mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

const WOOD = "#8a6a45", DARK = "#34343a", FABRIC = "#8a98a6", METAL = "#c2bdb2",
  GREEN = "#4c7a4c", POT = "#a9744e", PANEL = "#b8b0a4", MATTRESS = "#e7e2d8";

function legs(g: THREE.Group, w: number, d: number, legH: number, t = 0.06, color = WOOD) {
  const hx = w / 2 - t / 2 - 0.02, hz = d / 2 - t / 2 - 0.02;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(t, legH, t, color, sx * hx, legH / 2, sz * hz));
  }
}

function buildModel(type: string): THREE.Group {
  const g = new THREE.Group();
  switch (type) {
    case "chair": {
      legs(g, 0.5, 0.5, 0.45);
      g.add(box(0.5, 0.07, 0.5, FABRIC, 0, 0.49, 0));
      g.add(box(0.5, 0.5, 0.07, FABRIC, 0, 0.74, -0.215));
      break;
    }
    case "sofa": {
      g.add(box(2.0, 0.4, 0.9, FABRIC, 0, 0.2, 0));
      g.add(box(1.7, 0.22, 0.78, "#9aa6b4", 0, 0.5, 0.03));
      g.add(box(2.0, 0.55, 0.18, FABRIC, 0, 0.55, -0.36));
      g.add(box(0.18, 0.5, 0.9, FABRIC, -0.91, 0.45, 0));
      g.add(box(0.18, 0.5, 0.9, FABRIC, 0.91, 0.45, 0));
      legs(g, 1.9, 0.8, 0.1, 0.07, DARK);
      break;
    }
    case "table":
    case "desk": {
      legs(g, 1.2, 0.7, 0.72, 0.07);
      g.add(box(1.24, 0.06, 0.74, "#a87a4a", 0, 0.75, 0));
      break;
    }
    case "storage": {
      g.add(box(0.9, 1.0, 0.4, PANEL, 0, 0.5, 0));
      g.add(box(0.94, 0.03, 0.42, WOOD, 0, 0.34, 0));
      g.add(box(0.94, 0.03, 0.42, WOOD, 0, 0.67, 0));
      break;
    }
    case "bed": {
      g.add(box(1.6, 0.3, 2.0, WOOD, 0, 0.15, 0));
      g.add(box(1.55, 0.22, 1.9, MATTRESS, 0, 0.41, 0.03));
      g.add(box(0.7, 0.14, 0.4, "#f2eee6", -0.38, 0.55, -0.72));
      g.add(box(0.7, 0.14, 0.4, "#f2eee6", 0.38, 0.55, -0.72));
      g.add(box(1.6, 0.6, 0.08, WOOD, 0, 0.45, -1.0));
      break;
    }
    case "lamp": {
      g.add(cyl(0.18, 0.2, 0.04, DARK, 0, 0.02, 0));
      g.add(cyl(0.025, 0.025, 1.55, METAL, 0, 0.8, 0));
      const shade = cyl(0.16, 0.22, 0.26, "#efe7d6", 0, 1.62, 0);
      g.add(shade);
      break;
    }
    case "plant": {
      g.add(cyl(0.18, 0.14, 0.35, POT, 0, 0.175, 0));
      const foliage = [[0, 0.55, 0, 0.32], [0.18, 0.78, 0.05, 0.26], [-0.15, 0.72, -0.08, 0.24], [0.05, 0.98, 0.02, 0.2]];
      for (const [x, y, z, r] of foliage) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(GREEN, 0.85));
        s.position.set(x, y, z); s.castShadow = true; g.add(s);
      }
      break;
    }
    case "tv": {
      g.add(box(1.2, 0.7, 0.05, DARK, 0, 0.5, 0));
      g.add(box(1.12, 0.62, 0.02, "#11202e", 0, 0.5, 0.035));
      g.add(box(0.4, 0.04, 0.2, DARK, 0, 0.02, 0));
      g.add(box(0.06, 0.16, 0.06, DARK, 0, 0.12, 0));
      break;
    }
    case "rug": {
      g.add(box(2.0, 0.02, 1.4, "#dcd3c4", 0, 0.01, 0));
      break;
    }
    default: {
      g.add(box(0.8, 0.8, 0.8, PANEL, 0, 0.4, 0));
    }
  }
  return g;
}

/** Build the model for a type and export it as a binary GLB object-URL. */
export function modelToGlbUrl(type: string): Promise<string> {
  const group = buildModel(type);
  const exporter = new GLTFExporter();
  return new Promise<string>((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
        resolve(URL.createObjectURL(blob));
      },
      (err) => reject(err),
      { binary: true },
    );
  });
}
