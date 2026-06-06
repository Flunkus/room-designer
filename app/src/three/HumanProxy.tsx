/* ===== Human proxy (3D) — 60×40×180 cm dummy block =====
   Visualises the draggable gap-tester in the 3D views. Dragging + collision is
   driven from the 2D plan (Canvas2D); here we just render its current pose. */
import * as THREE from "three";
import type { Proxy } from "../domain/types";
import { M, yRotation } from "./coords";

const PW = 60, PD = 40, PH = 180; // cm

export function HumanProxy({ proxy, accent }: { proxy: Proxy; accent: string }) {
  const color = new THREE.Color(accent);
  return (
    <group position={[proxy.x * M, (PH / 2) * M, proxy.y * M]} rotation={[0, yRotation(proxy.rot || 0), 0]}>
      {/* body block */}
      <mesh>
        <boxGeometry args={[PW * M, PH * M, PD * M]} />
        <meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.6} metalness={0} />
      </mesh>
      {/* head marker so orientation reads at human scale */}
      <mesh position={[0, (PH / 2) * M + 0.12, 0]}>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color={color} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
