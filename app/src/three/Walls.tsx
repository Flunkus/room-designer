/* ===== Walls — extruded perimeter with CSG-punched door/window openings =====
   Each polygon edge becomes a box wall; door/window Openings are subtracted via
   three-bvh-csg (BVH-accelerated). Walls whose outward normal faces the camera
   are hidden each frame so the room reads as an open dollhouse you can orbit. */
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { edges } from "../domain/geometry";
import type { Material, Opening, Vec2 } from "../domain/types";
import { M } from "./coords";
import { createMaterial, applyMaterialParams } from "./materials/pbr";

const WALL_THICKNESS = 0.12; // m (12 cm)

export interface WallPiece {
  geometry: THREE.BufferGeometry;
  /** outward normal in world space (plan nx,ny → x,z) */
  normal: THREE.Vector3;
  center: THREE.Vector3;
}

export function buildWalls(polygon: Vec2[], openings: Opening[], wallHeightCm: number, removed?: number[]): WallPiece[] {
  if (polygon.length < 3) return [];
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  const H = wallHeightCm * M;
  const TH = WALL_THICKNESS;
  const pieces: WallPiece[] = [];

  edges(polygon).forEach((e, i) => {
    if (removed?.includes(i)) return; // wall removed (opened) — skip it entirely
    const len = e.len;
    if (len < 1) return;
    const L = len * M;
    const ux = (e.b.x - e.a.x) / len, uy = (e.b.y - e.a.y) / len; // unit dir in plan
    const theta = Math.atan2(-uy, ux); // Y-rotation: local +X → (ux,0,uy)
    const midX = ((e.a.x + e.b.x) / 2) * M, midZ = ((e.a.y + e.b.y) / 2) * M;

    let brush: Brush = new Brush(new THREE.BoxGeometry(L, H, TH));
    brush.position.set(midX, H / 2, midZ);
    brush.rotation.y = theta;
    brush.updateMatrixWorld(true);

    openings.filter((op) => op.wall === i).forEach((op) => {
      const openH = op.height * M;
      const sill = (op.type === "door" ? 0 : (op.sill ?? 90)) * M;
      const d = op.offset + op.width / 2; // distance along edge from vertex a
      const cx = (e.a.x + ux * d) * M, cz = (e.a.y + uy * d) * M;
      const cy = sill + openH / 2;
      const cut = new Brush(new THREE.BoxGeometry(op.width * M, openH, TH + 0.2));
      cut.position.set(cx, cy, cz);
      cut.rotation.y = theta;
      cut.updateMatrixWorld(true);
      brush = evaluator.evaluate(brush, cut, SUBTRACTION);
    });

    // Bake the slab's world transform into the geometry: the mesh below renders with
    // no transform, but both the raw box and the CSG result are in brush-local space
    // (the evaluator keeps the result in operand A's frame). Without this every wall
    // collapses to the world origin, half-sunk into the floor.
    brush.updateMatrixWorld(true);
    const geometry = brush.geometry.clone();
    geometry.applyMatrix4(brush.matrixWorld);
    pieces.push({
      geometry,
      normal: new THREE.Vector3(e.nx, 0, e.ny),
      center: new THREE.Vector3(midX, H / 2, midZ),
    });
  });

  return pieces;
}

export function Walls({ polygon, openings, wallHeightCm, material, cutaway = true, removed }: {
  polygon: Vec2[]; openings: Opening[]; wallHeightCm: number; material: Material; cutaway?: boolean; removed?: number[];
}) {
  const pieces = useMemo(() => buildWalls(polygon, openings, wallHeightCm, removed), [polygon, openings, wallHeightCm, removed]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const mat = useMemo(() => {
    const built = createMaterial(material);
    built.side = THREE.DoubleSide; // visible from inside (walk) and through cutaways
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.base, material.kind, material.maps]);

  useEffect(() => { applyMaterialParams(mat, material); }, [mat, material.scale, material.rotation, material.roughness, material]);

  useEffect(() => () => { pieces.forEach((p) => p.geometry.dispose()); }, [pieces]);
  useEffect(() => () => { mat.dispose(); }, [mat]);

  // Hide walls whose outward normal faces the camera (dollhouse cutaway).
  const dir = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    meshRefs.current.forEach((m, i) => {
      if (!m) return;
      if (!cutaway) { m.visible = true; return; }
      const p = pieces[i];
      dir.current.copy(camera.position).sub(p.center).normalize();
      m.visible = dir.current.dot(p.normal) <= 0.12;
    });
  });

  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} ref={(el) => { meshRefs.current[i] = el; }} geometry={p.geometry} material={mat} castShadow receiveShadow />
      ))}
    </group>
  );
}
