/* ===== Furniture meshes — scaled box placeholder ↔ generated GLB swap =====
   While a job runs (status "generating", no meshUrl) we show a translucent
   bounding-box placeholder. When the GLB arrives we load it and rescale it to
   the exact W/D/H box (non-uniform), preserving the object's position/rotation —
   the placeholder→mesh swap of Req 3, plus the dimension-scaling requirement. */
import { Component, Suspense, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { Edges, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Furniture } from "../domain/types";
import { M, yRotation, resolve, type Resolved } from "./coords";
import { shade } from "../domain/geometry";

/** Falls back to its fallback if a child throws (e.g. a dead/blob mesh URL that
    fails to load) — so one bad mesh never crashes the whole 3D scene. */
class MeshErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — fallback box already shown */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function PlaceholderBox({ o }: { o: Resolved }) {
  const generating = o.status === "generating";
  const color = useMemo(() => new THREE.Color(generating ? "#b9b4ab" : o.color), [o.color, generating]);
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[o.w * M, o.h * M, o.d * M]} />
      <meshStandardMaterial
        color={color}
        roughness={o.flat ? 0.9 : 0.7}
        metalness={0}
        transparent={generating}
        opacity={generating ? 0.55 : 1}
        emissive={generating ? new THREE.Color(shade(o.color, 0.4)) : new THREE.Color("#000000")}
        emissiveIntensity={generating ? 0.15 : 0}
      />
    </mesh>
  );
}

/** Loads a GLB and rescales it (non-uniform) to fit exactly into w×h×d (cm). */
function GltfModel({ url, w, d, h }: { url: string; w: number; d: number; h: number }) {
  const gltf = useGLTF(url);
  const obj = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    const bb = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    bb.getSize(size); bb.getCenter(center);
    clone.position.sub(center); // recentre the model's bbox to the origin
    const wrap = new THREE.Group();
    wrap.add(clone);
    // scale so the model's bounding box matches the requested dimensions exactly
    wrap.scale.set((w * M) / (size.x || 1), (h * M) / (size.y || 1), (d * M) / (size.z || 1));
    return wrap;
  }, [gltf, w, d, h]);
  return <primitive object={obj} />;
}

function SelectionBox({ w, h, d, color }: { w: number; h: number; d: number; color: string }) {
  return (
    <mesh>
      <boxGeometry args={[w * M, h * M, d * M]} />
      <meshBasicMaterial visible={false} />
      <Edges scale={1.002} threshold={15} color={color} />
    </mesh>
  );
}

function FurnitureItem({ o, selected, accent, onSelect }: {
  o: Resolved; selected: boolean; accent: string; onSelect: (id: string) => void;
}) {
  const generating = o.status === "generating";
  const showMesh = !!o.meshUrl && o.status === "ready";

  const cx = o.x * M;
  const cy = (o.z0 + o.h / 2) * M;
  const cz = o.y * M;

  return (
    <group
      position={[cx, cy, cz]}
      rotation={[0, yRotation(o.rot || 0), 0]}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSelect(o.id); }}
    >
      {showMesh ? (
        <MeshErrorBoundary fallback={<PlaceholderBox o={o} />}>
          <Suspense fallback={<PlaceholderBox o={o} />}>
            <GltfModel url={o.meshUrl!} w={o.w} d={o.d} h={o.h} />
          </Suspense>
        </MeshErrorBoundary>
      ) : (
        <PlaceholderBox o={o} />
      )}
      {(selected || generating) && (
        <SelectionBox w={o.w} h={o.h} d={o.d} color={selected ? accent : "#9a958c"} />
      )}
    </group>
  );
}

export function FurnitureLayer({ furniture, selectedId, accent, onSelect }: {
  furniture: Furniture[]; selectedId: string | null; accent: string; onSelect: (id: string) => void;
}) {
  return (
    <group>
      {furniture.filter((o) => !o.hidden).map((o) => {
        const r = resolve(o, furniture);
        return <FurnitureItem key={o.id} o={r} selected={selectedId === o.id} accent={accent} onSelect={onSelect} />;
      })}
    </group>
  );
}
