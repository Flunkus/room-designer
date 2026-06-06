/* ===== Clearance zones (3D) — 60cm walking border projected from furniture =====
   A flat translucent amber ring on the floor around each furniture footprint,
   extending 60 cm outward (Req 5). Toggled by showClearance. */
import { useMemo } from "react";
import * as THREE from "three";
import type { Furniture } from "../domain/types";
import { M, yRotation, resolve } from "./coords";

const CLEAR = 60; // cm

function ringGeometry(w: number, d: number): THREE.ShapeGeometry {
  const hw = (w / 2) * M, hd = (d / 2) * M;
  const ow = hw + CLEAR * M, od = hd + CLEAR * M;
  const shape = new THREE.Shape();
  shape.moveTo(-ow, -od);
  shape.lineTo(ow, -od);
  shape.lineTo(ow, od);
  shape.lineTo(-ow, od);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-hw, -hd);
  hole.lineTo(-hw, hd);
  hole.lineTo(hw, hd);
  hole.lineTo(hw, -hd);
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape);
}

function ZoneItem({ o }: { o: Furniture & { z0: number } }) {
  const geo = useMemo(() => ringGeometry(o.w, o.d), [o.w, o.d]);
  return (
    <group position={[o.x * M, 0.02, o.y * M]} rotation={[0, yRotation(o.rot || 0), 0]}>
      <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function ClearanceLayer({ furniture }: { furniture: Furniture[] }) {
  return (
    <group>
      {furniture.filter((o) => !o.flat && !o.hidden && !o.parent).map((o) => (
        <ZoneItem key={o.id} o={resolve(o, furniture)} />
      ))}
    </group>
  );
}
