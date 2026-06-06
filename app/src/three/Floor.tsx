/* ===== Floor — triangulated polygon floor plate with PBR material ===== */
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import type { Material, Vec2 } from "../domain/types";
import { M } from "./coords";
import { createMaterial, applyMaterialParams } from "./materials/pbr";

export function Floor({ polygon, material }: { polygon: Vec2[]; material: Material }) {
  const geometry = useMemo(() => {
    if (polygon.length < 3) return null;
    const shape = new THREE.Shape(polygon.map((p) => new THREE.Vector2(p.x * M, p.y * M)));
    const geo = new THREE.ShapeGeometry(shape);
    return geo;
  }, [polygon]);

  // heavy rebuild only when base/kind/maps change
  const mat = useMemo(() => {
    const built = createMaterial(material);
    built.side = THREE.DoubleSide; // flat plate viewed from above after the +90° rotation
    return built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.base, material.kind, material.maps]);

  // cheap param updates when sliders move
  useEffect(() => { applyMaterialParams(mat, material); }, [mat, material.scale, material.rotation, material.roughness, material]);

  useEffect(() => () => { geometry?.dispose(); }, [geometry]);
  useEffect(() => () => { mat.dispose(); }, [mat]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} material={mat} rotation={[Math.PI / 2, 0, 0]} receiveShadow />
  );
}
