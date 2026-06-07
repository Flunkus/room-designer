/* ===== Wall images — flat 2D image panels mounted on a wall face =====
   Each WallImage is positioned on its room's wall like an opening (edge index +
   offset + sill) and rendered as an unlit textured quad sitting just inside the
   inner wall surface, so it reads as a window view / mural / artwork. */
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { edges } from "../domain/geometry";
import type { Room, WallImage } from "../domain/types";
import { M } from "./coords";

const WALL_TH = 0.12; // m — matches Walls.tsx, so the panel hugs the inner face

function placeOnWall(room: Room, wi: WallImage): { pos: [number, number, number]; theta: number } | null {
  const e = edges(room.polygon)[wi.wall];
  if (!e) return null;
  const len = e.len || 1;
  const ux = (e.b.x - e.a.x) / len, uy = (e.b.y - e.a.y) / len;
  const theta = Math.atan2(-uy, ux); // local +X runs along the wall
  const d = wi.offset + wi.width / 2; // centre, measured along the wall from vertex a
  let cx = (e.a.x + ux * d) * M, cz = (e.a.y + uy * d) * M;
  const cy = (wi.sill + wi.height / 2) * M;
  const push = WALL_TH / 2 + 0.012; // sit just inside the inner wall surface
  cx += -e.nx * push; cz += -e.ny * push;
  return { pos: [cx, cy, cz], theta };
}

function WallImagePlane({ room, wi }: { room: Room; wi: WallImage }) {
  const tex = useTexture(wi.url!);
  const place = placeOnWall(room, wi);
  if (!place) return null;
  return (
    <mesh position={place.pos} rotation={[0, place.theta, 0]}>
      <planeGeometry args={[wi.width * M, wi.height * M]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

export function WallImages({ rooms, wallImages }: { rooms: Room[]; wallImages: WallImage[] }) {
  return (
    <>
      {wallImages.map((wi) => {
        const room = rooms.find((r) => r.id === wi.roomId);
        if (!room || !wi.url || room.polygon.length < 3) return null;
        return <WallImagePlane key={wi.id} room={room} wi={wi} />;
      })}
    </>
  );
}
