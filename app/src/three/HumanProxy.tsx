/* ===== Human proxy (3D) — 60×40×180 cm draggable dummy block =====
   Visualises the gap-tester in the 3D dollhouse. Grab the block and drag it across
   the floor; movement is resolved against furniture + the room boundary with the same
   rules as the 2D plan (see domain/proxy). Dragging it here updates the shared proxy
   state, so the 2D plan and 3D view always agree. */
import { useEffect, useRef, useState } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Proxy } from "../domain/types";
import { useStore } from "../state/store";
import { resolveProxy, proxyHalf } from "../domain/proxy";
import { M, yRotation } from "./coords";

export function HumanProxy({ proxy, accent, onDragChange }: {
  proxy: Proxy; accent: string;
  /** report drag state to the parent so it can suspend OrbitControls while dragging */
  onDragChange?: (dragging: boolean) => void;
}) {
  const color = new THREE.Color(accent);
  const setProxy = useStore((s) => s.setProxy);
  const furniture = useStore((s) => s.furniture);
  const rooms = useStore((s) => s.rooms);
  const PW = proxy.w ?? 60, PD = proxy.d ?? 40, PH = proxy.h ?? 180; // cm
  const [dragging, setDragging] = useState(false);
  // offset (cm) between the proxy centre and the grab point, so the block doesn't jump
  const grabOff = useRef({ x: 0, y: 0 });

  const setCursor = (c: string) => { document.body.style.cursor = c; };

  const start = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    grabOff.current = { x: proxy.x - e.point.x / M, y: proxy.y - e.point.z / M };
    setDragging(true);
    onDragChange?.(true); // parent suspends orbit while dragging the dummy
    setCursor("grabbing");
    (e.target as Element)?.setPointerCapture?.(e.pointerId);
  };

  const drag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    e.stopPropagation();
    const desired = { x: e.point.x / M + grabOff.current.x, y: e.point.z / M + grabOff.current.y };
    const others = furniture.filter((f) => !f.flat && !f.hidden);
    setProxy(resolveProxy(desired, proxy, others, rooms.map((r) => r.polygon), proxyHalf(proxy)));
  };

  const end = () => {
    if (!dragging) return;
    setDragging(false);
    onDragChange?.(false);
    setCursor("");
  };

  // Safety net: a pointer-up anywhere (e.g. released over the sky, off the floor
  // catcher) still ends the drag and re-enables orbit.
  useEffect(() => {
    if (!dragging) return;
    const up = () => end();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  return (
    <group>
      <group
        position={[proxy.x * M, (PH / 2) * M, proxy.y * M]}
        rotation={[0, yRotation(proxy.rot || 0), 0]}
        onPointerDown={start}
        onPointerOver={() => { if (!dragging) setCursor("grab"); }}
        onPointerOut={() => { if (!dragging) setCursor(""); }}
      >
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

      {/* invisible floor catcher — only mounted while dragging, so it never steals
          clicks from furniture/walls otherwise. Tracks the cursor across the ground. */}
      {dragging && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}
          onPointerMove={drag} onPointerUp={end} onPointerLeave={end}
        >
          <planeGeometry args={[2000, 2000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
