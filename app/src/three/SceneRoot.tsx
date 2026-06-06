/* ===== SceneRoot — R3F canvas, lighting, camera, orbit controls, fit + FOV ===== */
import { useRef, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../state/store";
import { bounds } from "../domain/geometry";
import { M } from "./coords";
import { Floor } from "./Floor";
import { Walls } from "./Walls";
import { FurnitureLayer } from "./FurnitureMesh";
import { ClearanceLayer } from "./ClearanceZone";
import { HumanProxy } from "./HumanProxy";
import { Icon } from "../components/Icon";
import { Slider } from "../components/fields";

interface OrbitApi { zoom: (factor: number) => void; fit: () => void; }

/** Computes a framing for the current room and applies it to camera + controls. */
function fitCamera(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void } | null,
  polygon: { x: number; y: number }[],
  wallHeightCm: number,
) {
  if (polygon.length < 3 || !controls) return;
  const b = bounds(polygon);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const widthW = (b.maxX - b.minX) * M;
  const depthW = (b.maxY - b.minY) * M;
  const heightW = wallHeightCm * M;
  const span = Math.max(widthW, depthW, heightW);
  const dist = span * 1.7 + 1;
  const az = (-28 * Math.PI) / 180;
  const el = (32 * Math.PI) / 180;
  const horiz = dist * Math.cos(el);
  const center = new THREE.Vector3(cx * M, heightW * 0.45, cy * M);
  camera.position.set(center.x + horiz * Math.sin(az), center.y + dist * Math.sin(el), center.z + horiz * Math.cos(el));
  controls.target.copy(center);
  controls.update();
}

function CameraRig({ apiRef }: { apiRef: React.MutableRefObject<OrbitApi | null> }) {
  const rooms = useStore((s) => s.rooms);
  const wallHeight = useStore((s) => s.wallHeight);
  const fitTick = useStore((s) => s.fitTick);
  // combined footprint of every room → frames the whole house
  const housePts = rooms.flatMap((r) => r.polygon);
  const { camera, controls, scene } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    scene: THREE.Scene;
  };

  // dev-only inspection hook (used for verification; harmless in prod build)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __roomscale3d?: unknown }).__roomscale3d = { scene, camera, get controls() { return controls; } };
    }
  }, [scene, camera, controls]);

  // (re)fit on mount, room change, and explicit fit requests
  useEffect(() => {
    fitCamera(camera, controls, housePts, wallHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick, rooms.length, controls]);

  // expose zoom/fit to the HTML overlay
  useEffect(() => {
    apiRef.current = {
      zoom: (factor: number) => {
        if (!controls) return;
        const target = controls.target;
        const offset = camera.position.clone().sub(target);
        offset.multiplyScalar(1 / factor);
        const len = offset.length();
        if (len > 0.6 && len < 80) camera.position.copy(target).add(offset);
        controls.update();
      },
      fit: () => fitCamera(camera, controls, housePts, wallHeight),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, rooms, wallHeight]);

  return null;
}

export function SceneRoot({ bare }: { bare?: boolean }) {
  const rooms = useStore((s) => s.rooms);
  const openings = useStore((s) => s.openings);
  const materials = useStore((s) => s.materials);
  const wallHeight = useStore((s) => s.wallHeight);
  const furniture = useStore((s) => s.furniture);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const fov = useStore((s) => s.view3d.fov);
  const setFov = useStore((s) => s.setFov);
  const showClearance = useStore((s) => s.showClearance);
  const showProxy = useStore((s) => s.showProxy);
  const proxy = useStore((s) => s.proxy);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#3b82f6";

  const apiRef = useRef<OrbitApi | null>(null);
  const closedRooms = rooms.filter((r) => r.closed && r.polygon.length >= 3);
  const hasRoom = closedRooms.length > 0;

  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#eef0f2,#e4e6e9)" }}>
      <Canvas shadows dpr={[1, 2]} onPointerMissed={() => select(null)} gl={{ antialias: true }}>
        <color attach="background" args={["#e9ebee"]} />
        <PerspectiveCamera makeDefault fov={fov} near={0.05} far={500} position={[6, 5, 6]} />
        <hemisphereLight args={["#ffffff", "#cfcabd", 0.55]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[6, 11, 4]} intensity={1.15} castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-12} shadow-camera-right={12}
          shadow-camera-top={12} shadow-camera-bottom={-12}
          shadow-camera-near={0.5} shadow-camera-far={50}
        />
        {hasRoom && (
          <>
            {closedRooms.map((room) => (
              <group key={room.id}>
                <Floor polygon={room.polygon} material={materials.floor} />
                <Walls polygon={room.polygon} openings={openings.filter((op) => op.roomId === room.id)} wallHeightCm={wallHeight} material={materials.walls} />
              </group>
            ))}
            <FurnitureLayer furniture={furniture} selectedId={selectedId} accent={accent} onSelect={select} />
            {showClearance && <ClearanceLayer furniture={furniture} />}
            {showProxy && <HumanProxy proxy={proxy} accent={accent} />}
          </>
        )}
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={0.8} maxDistance={60} />
        <CameraRig apiRef={apiRef} />
      </Canvas>

      {/* orbit hint */}
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", background: "rgba(27,27,30,0.82)", color: "#fff", borderRadius: 99, fontSize: 12.5, fontWeight: 500, backdropFilter: "blur(6px)", pointerEvents: "none" }}>
        <Icon name="orbit" size={15} /><span>Drag to orbit · scroll to zoom · right-drag to pan</span>
      </div>

      {/* zoom + FOV controls (right side) */}
      <div style={{ position: "absolute", right: bare ? 330 : 14, bottom: 16, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", zIndex: 8 }}>
        <div style={{ width: 168, background: "var(--panel)", borderRadius: 10, boxShadow: "var(--sh-2)", padding: "10px 12px" }}>
          <Slider label="Field of view" value={Math.round(fov)} min={25} max={90} unit="°" onChange={(v) => setFov(v)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, background: "var(--panel)", borderRadius: 10, boxShadow: "var(--sh-2)", padding: 4 }}>
          <button className="icon-btn" title="Zoom in" onClick={() => apiRef.current?.zoom(1.18)}><Icon name="zoomIn" /></button>
          <button className="icon-btn" title="Zoom out" onClick={() => apiRef.current?.zoom(1 / 1.18)}><Icon name="zoomOut" /></button>
          <button className="icon-btn" title="Fit" onClick={() => apiRef.current?.fit()}><Icon name="fit" /></button>
        </div>
      </div>
    </div>
  );
}
