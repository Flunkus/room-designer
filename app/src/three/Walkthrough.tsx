/* ===== Walkthrough — first-person WASD camera with Rapier collision =====
   Eye height 180 cm. A kinematic capsule driven by Rapier's
   KinematicCharacterController (collide-and-slide) against wall trimeshes and
   furniture cuboids. Pointer-lock mouse look. Replaces the prototype's static
   SVG walk illustration. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import {
  Physics, RigidBody, CapsuleCollider, CuboidCollider, TrimeshCollider, useRapier,
  type RapierRigidBody, type RapierCollider,
} from "@react-three/rapier";
import * as THREE from "three";
import { useStore } from "../state/store";
import { bounds, centroid } from "../domain/geometry";
import { M, yRotation, resolve } from "./coords";
import { buildWalls } from "./Walls";
import { Floor } from "./Floor";
import { Walls } from "./Walls";
import { WallImages } from "./WallImages";
import { FurnitureLayer } from "./FurnitureMesh";
import { Icon } from "../components/Icon";

const EYE = 1.8; // m — standard human eye level
const CAP_HALF = 0.65, CAP_RADIUS = 0.25; // capsule: total ≈ 2*(half+radius) = 1.8 m

function trimeshArgs(geo: THREE.BufferGeometry): [Float32Array, Uint32Array] {
  const pos = geo.attributes.position.array;
  const vertices = pos instanceof Float32Array ? pos : new Float32Array(pos);
  let indices: Uint32Array;
  if (geo.index) {
    const a = geo.index.array;
    indices = a instanceof Uint32Array ? a : new Uint32Array(a);
  } else {
    indices = new Uint32Array(vertices.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }
  return [vertices, indices];
}

function Player({ spawn }: { spawn: { x: number; z: number } }) {
  const { world } = useRapier();
  const { camera, gl } = useThree();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const look = useRef({ yaw: 0, pitch: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const vy = useRef(0);

  const controller = useMemo(() => {
    const cc = world.createCharacterController(0.01);
    cc.enableAutostep(0.35, 0.2, true);
    cc.enableSnapToGround(0.35);
    cc.setApplyImpulsesToDynamicBodies(false);
    cc.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    return cc;
  }, [world]);
  useEffect(() => () => { try { world.removeCharacterController(controller); } catch { /* */ } }, [world, controller]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => { el.requestPointerLock(); };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      look.current.yaw -= e.movementX * 0.0024;
      look.current.pitch -= e.movementY * 0.0024;
      const lim = Math.PI / 2 - 0.05;
      look.current.pitch = Math.max(-lim, Math.min(lim, look.current.pitch));
    };
    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    return () => { el.removeEventListener("click", onClick); document.removeEventListener("mousemove", onMove); };
  }, [gl]);

  useFrame((_, dtRaw) => {
    const body = bodyRef.current, col = colliderRef.current;
    if (!body || !col) return;
    const dt = Math.min(dtRaw, 0.05);
    const { yaw, pitch } = look.current;
    const k = keys.current;
    const fb = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    const lr = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const speed = (k.ShiftLeft || k.ShiftRight) ? 4.4 : 2.6;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let mx = fx * fb + rx * lr, mz = fz * fb + rz * lr;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx = (mx / len) * speed * dt; mz = (mz / len) * speed * dt; }

    vy.current += -9.81 * dt;
    const dy = vy.current * dt;

    controller.computeColliderMovement(col, { x: mx, y: dy, z: mz });
    const mv = controller.computedMovement();
    if (controller.computedGrounded()) vy.current = 0;

    const t = body.translation();
    const nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z;
    body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });

    camera.position.set(nx, ny + (EYE - (CAP_HALF + CAP_RADIUS)), nz);
    camera.rotation.set(pitch, yaw, 0, "YXZ");

    if (import.meta.env.DEV) {
      (window as unknown as { __walk?: unknown }).__walk = {
        x: +nx.toFixed(2), y: +ny.toFixed(2), z: +nz.toFixed(2),
        grounded: controller.computedGrounded(), fb, lr,
        keys: Object.keys(k).filter((kk) => k[kk]).join(","),
      };
    }
  });

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[spawn.x, 1.1, spawn.z]}>
      <CapsuleCollider ref={colliderRef} args={[CAP_HALF, CAP_RADIUS]} />
    </RigidBody>
  );
}

function WalkColliders() {
  const rooms = useStore((s) => s.rooms);
  const openings = useStore((s) => s.openings);
  const wallHeight = useStore((s) => s.wallHeight);
  const furniture = useStore((s) => s.furniture);

  const wallPieces = useMemo(() => {
    const closed = rooms.filter((r) => r.closed && r.polygon.length >= 3);
    return closed.flatMap((r) => buildWalls(r.polygon, openings.filter((o) => o.roomId === r.id), wallHeight, r.openWalls));
  }, [rooms, openings, wallHeight]);
  const b = useMemo(() => {
    const pts = rooms.flatMap((r) => r.polygon);
    return bounds(pts.length ? pts : [{ x: 0, y: 0 }]);
  }, [rooms]);
  const cx = ((b.minX + b.maxX) / 2) * M, cz = ((b.minY + b.maxY) / 2) * M;
  const hx = ((b.maxX - b.minX) / 2) * M + 0.5, hz = ((b.maxY - b.minY) / 2) * M + 0.5;

  return (
    <>
      {/* ground slab */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hx, 0.05, hz]} position={[cx, -0.05, cz]} />
      </RigidBody>
      {/* walls (trimesh, with door/window holes) */}
      <RigidBody type="fixed" colliders={false}>
        {wallPieces.map((p, i) => (
          <TrimeshCollider key={i} args={trimeshArgs(p.geometry)} />
        ))}
      </RigidBody>
      {/* furniture (cuboids) */}
      <RigidBody type="fixed" colliders={false}>
        {furniture.filter((o) => !o.flat && !o.hidden).map((o) => {
          const r = resolve(o, furniture);
          return (
            <CuboidCollider
              key={o.id}
              args={[(r.w / 2) * M, (r.h / 2) * M, (r.d / 2) * M]}
              position={[r.x * M, (r.z0 + r.h / 2) * M, r.y * M]}
              rotation={[0, yRotation(r.rot || 0), 0]}
            />
          );
        })}
      </RigidBody>
    </>
  );
}

function WalkScene() {
  const rooms = useStore((s) => s.rooms);
  const openings = useStore((s) => s.openings);
  const materials = useStore((s) => s.materials);
  const wallHeight = useStore((s) => s.wallHeight);
  const furniture = useStore((s) => s.furniture);
  const wallImages = useStore((s) => s.wallImages);
  const closed = rooms.filter((r) => r.closed && r.polygon.length >= 3);

  const spawn = useMemo(() => {
    const r0 = rooms.find((r) => r.closed && r.polygon.length >= 3);
    const c = r0 ? centroid(r0.polygon) : { x: 0, y: 0 };
    return { x: c.x * M, z: c.y * M };
  }, [rooms]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={72} near={0.04} far={500} />
      <hemisphereLight args={["#ffffff", "#cfcabd", 0.6]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 11, 4]} intensity={1.1} />
      {closed.map((r) => (
        <group key={r.id}>
          <Floor polygon={r.polygon} material={materials.floor} />
          <Walls polygon={r.polygon} openings={openings.filter((o) => o.roomId === r.id)} wallHeightCm={wallHeight} material={materials.walls} cutaway={false} removed={r.openWalls} />
        </group>
      ))}
      <WallImages rooms={closed} wallImages={wallImages} />
      <FurnitureLayer furniture={furniture} selectedId={null} accent="#3b82f6" onSelect={() => {}} />
      <Physics gravity={[0, -9.81, 0]}>
        <Player spawn={spawn} />
        <WalkColliders />
      </Physics>
    </>
  );
}

export function Walkthrough() {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#d9dde2 0%,#eceef0 50%,#cdb892 50%,#c2a877 100%)" }}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#dfe2e6"]} />
        <WalkScene />
      </Canvas>

      {/* crosshair */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.7)", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)", pointerEvents: "none" }} />

      {/* eye height badge */}
      <div style={{ position: "absolute", top: 16, left: 16, padding: "7px 13px", background: "rgba(255,255,255,0.85)", borderRadius: 99, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", gap: 7, pointerEvents: "none" }}>
        <Icon name="person" size={15} /> Eye height 1.80 m
      </div>

      {/* controls bar */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: "rgba(27,27,30,0.8)", color: "#fff", borderRadius: 12, fontSize: 13, backdropFilter: "blur(8px)", pointerEvents: "none" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> move
        </span>
        <span style={{ opacity: 0.5 }}>·</span><span><Kbd>Shift</Kbd> run</span>
        <span style={{ opacity: 0.5 }}>·</span><span>mouse to look</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#9fd4ff" }}><Icon name="check" size={14} /> collision on</span>
      </div>

      {/* click-to-look prompt */}
      {!locked && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ padding: "12px 20px", background: "rgba(27,27,30,0.78)", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 500, backdropFilter: "blur(8px)" }}>
            Click to look around · Esc to release
          </div>
        </div>
      )}
    </div>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 5px", background: "rgba(255,255,255,0.16)", borderRadius: 5, fontSize: 11, fontFamily: "var(--mono)", border: "1px solid rgba(255,255,255,0.2)" }}>{children}</kbd>
);
