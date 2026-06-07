/* ===== Canvas2D — interactive drafting / plan view (ported from prototype canvas2d.jsx) ===== */
import { useRef, useState, useEffect, useCallback, type CSSProperties } from "react";
import { Icon, TYPE_ICON } from "../components/Icon";
import { useStore } from "../state/store";
import { area, bounds, centroid, dist, edges, shade } from "../domain/geometry";
import { effExtent, resolveProxy, proxyHalf, type Boxish } from "../domain/proxy";
import { topDownImage } from "../services/topdown";
import type { GridStyle } from "../components/Tweaks";
import type { Vec2 } from "../domain/types";

function useSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [s, setS] = useState({ w: 800, h: 600 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      const r = ref.current!.getBoundingClientRect();
      setS({ w: r.width, h: r.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

type Drag =
  | { type: "pan" | "pan-bg"; sx: number; sy: number; p0: Vec2; moved?: boolean; roomId?: string }
  | { type: "move"; id: string; off: Vec2; sx: number; sy: number; started: boolean }
  | { type: "proxy"; off: Vec2 }
  | { type: "rotate"; id: string };

/** Modular snapping: pull a moving object flush against / aligned with its
    neighbours so component pieces snap together on the grid (Req 3). */
function snapModular(np: Vec2, moving: Boxish, others: Boxish[]): Vec2 {
  const SNAP = 14; // cm
  const m = effExtent(moving);
  let bx = np.x, by = np.y, bestX = SNAP + 1, bestY = SNAP + 1;
  for (const o of others) {
    const e = effExtent(o);
    const yOverlap = Math.abs(np.y - o.y) < m.hd + e.hd - 2;
    const xOverlap = Math.abs(np.x - o.x) < m.hw + e.hw - 2;
    if (yOverlap) {
      // flush edges + aligned edges/centres on X
      for (const cand of [o.x - e.hw - m.hw, o.x + e.hw + m.hw, o.x, o.x - e.hw + m.hw, o.x + e.hw - m.hw]) {
        const dd = Math.abs(cand - np.x);
        if (dd < bestX) { bestX = dd; bx = cand; }
      }
    }
    if (xOverlap) {
      for (const cand of [o.y - e.hd - m.hd, o.y + e.hd + m.hd, o.y, o.y - e.hd + m.hd, o.y + e.hd - m.hd]) {
        const dd = Math.abs(cand - np.y);
        if (dd < bestY) { bestY = dd; by = cand; }
      }
    }
  }
  return { x: bestX <= SNAP ? Math.round(bx) : np.x, y: bestY <= SNAP ? Math.round(by) : np.y };
}

export function Canvas2D({ accent, gridStyle }: { accent: string; gridStyle: GridStyle }) {
  const s = useStore();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { w, h } = useSize(wrapRef);
  const view = s.view2d;
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [hoverWall, setHoverWall] = useState<{ room: string; i: number } | null>(null);
  const drawing = s.tool === "draw";
  const GRID = s.gridSize || 25; // cm snap (user-configurable)
  const DRAG_THRESH = 4; // px before an object actually starts moving

  // ---- hold-to-pan: spacebar (any tool) ----
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isTyping(e.target)) {
        spaceRef.current = true; setSpaceHeld(true); e.preventDefault();
      }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") { spaceRef.current = false; setSpaceHeld(false); } };
    const blur = () => { spaceRef.current = false; setSpaceHeld(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); };
  }, []);
  const wantsPan = (e: React.PointerEvent | PointerEvent) => spaceRef.current || (e as PointerEvent).button === 1;
  const movedRef = useRef(false);

  // ---- draw-mode keys: Esc cancels, Enter closes the loop ----
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); s.cancelDraw(); }
      else if (e.key === "Enter" && s.draftPoints.length >= 3) { e.preventDefault(); s.closeRoom(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, s.draftPoints.length]);

  // ---- coordinate helpers ----
  const toWorld = useCallback((cx: number, cy: number): Vec2 => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (cx - r.left - view.pan.x) / view.zoom, y: (cy - r.top - view.pan.y) / view.zoom };
  }, [view]);
  const snap = (p: Vec2): Vec2 => ({ x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID });

  // ---- fit to content on mount / room change ---- (frames the whole house)
  useEffect(() => {
    if (!w) return;
    const allPts = s.rooms.flatMap((r) => r.polygon);
    const pts = s.drafting && s.draftPoints.length ? s.draftPoints : (allPts.length ? allPts : s.draftPoints);
    if (!pts.length) { s.setView2d({ pan: { x: w / 2, y: h / 2 }, zoom: 0.6 }); return; }
    const b = bounds(pts);
    const pad = 90;
    const zoom = Math.min((w - pad * 2) / Math.max(1, b.maxX - b.minX), (h - pad * 2) / Math.max(1, b.maxY - b.minY), 1.4);
    s.setView2d({ zoom, pan: { x: (w - (b.maxX + b.minX) * zoom) / 2, y: (h - (b.maxY + b.minY) * zoom) / 2 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, s.rooms.length, s.fitTick]);

  // ---- wheel zoom toward cursor ----
  const onWheel = (e: React.WheelEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0014);
    const z2 = Math.max(0.12, Math.min(3.5, view.zoom * k));
    s.setView2d({
      zoom: z2,
      pan: { x: mx - (mx - view.pan.x) * (z2 / view.zoom), y: my - (my - view.pan.y) * (z2 / view.zoom) },
    });
  };

  // ---- pointer handlers ----
  const onDown = (e: React.PointerEvent) => {
    movedRef.current = false;
    if (wantsPan(e) || s.tool === "pan") {
      setDrag({ type: "pan", sx: e.clientX, sy: e.clientY, p0: { ...view.pan } });
      return;
    }
    if (drawing) return;
    setDrag({ type: "pan-bg", sx: e.clientX, sy: e.clientY, p0: { ...view.pan }, moved: false });
  };
  const onObjDown = (e: React.PointerEvent, o: { id: string; x: number; y: number }) => {
    e.stopPropagation();
    movedRef.current = false;
    if (wantsPan(e)) {
      setDrag({ type: "pan", sx: e.clientX, sy: e.clientY, p0: { ...view.pan } });
      return;
    }
    s.select(o.id);
    const wpt = toWorld(e.clientX, e.clientY);
    setDrag({ type: "move", id: o.id, off: { x: wpt.x - o.x, y: wpt.y - o.y }, sx: e.clientX, sy: e.clientY, started: false });
  };
  const onProxyDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const wpt = toWorld(e.clientX, e.clientY);
    setDrag({ type: "proxy", off: { x: wpt.x - s.proxy.x, y: wpt.y - s.proxy.y } });
  };
  // pressing on a room's floor pans like the background, but a click (no drag) selects that room
  const onRoomDown = (e: React.PointerEvent, roomId: string) => {
    if (wantsPan(e) || s.tool === "pan") { onDown(e); return; }
    e.stopPropagation();
    movedRef.current = false;
    setDrag({ type: "pan-bg", sx: e.clientX, sy: e.clientY, p0: { ...view.pan }, moved: false, roomId });
  };
  const onRotDown = (e: React.PointerEvent, o: { id: string }) => {
    e.stopPropagation();
    setDrag({ type: "rotate", id: o.id });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (drag.type === "pan" || drag.type === "pan-bg") {
        s.setView2d({ ...view, pan: { x: drag.p0.x + (e.clientX - drag.sx), y: drag.p0.y + (e.clientY - drag.sy) } });
        if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) { drag.moved = true; movedRef.current = true; }
      } else if (drag.type === "move") {
        if (!drag.started) {
          if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_THRESH) return;
          drag.started = true;
        }
        const wpt = toWorld(e.clientX, e.clientY);
        let np = snap({ x: wpt.x - drag.off.x, y: wpt.y - drag.off.y });
        const mv = s.furniture.find((f) => f.id === drag.id);
        if (mv && !mv.flat && !mv.parent) {
          const others = s.furniture.filter((f) => f.id !== drag.id && !f.parent && !f.flat && !f.hidden);
          np = snapModular(np, mv, others);
        }
        s.moveFurniture(drag.id, np);
      } else if (drag.type === "proxy") {
        const wpt = toWorld(e.clientX, e.clientY);
        const desired = { x: wpt.x - drag.off.x, y: wpt.y - drag.off.y };
        const others = s.furniture.filter((f) => !f.flat && !f.hidden);
        const adj = resolveProxy(desired, s.proxy, others, s.rooms.map((r) => r.polygon), proxyHalf(s.proxy));
        s.setProxy(adj);
      } else if (drag.type === "rotate") {
        const o = s.furniture.find((f) => f.id === drag.id);
        if (!o) return;
        const wpt = toWorld(e.clientX, e.clientY);
        let deg = Math.atan2(wpt.y - o.y, wpt.x - o.x) * 180 / Math.PI + 90;
        deg = Math.round(deg / 15) * 15;
        s.moveFurniture(drag.id, { rot: deg });
      }
    };
    const up = () => {
      if (drag.type === "pan-bg" && !drag.moved) {
        if (drag.roomId) s.selectRoom(drag.roomId); else s.select(null);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // ---- drawing clicks ----
  const onSvgClick = (e: React.MouseEvent) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (!drawing || spaceRef.current) return;
    const p = snap(toWorld(e.clientX, e.clientY));
    const pts = s.draftPoints;
    if (pts.length >= 3 && dist(p, pts[0]) < 35) { s.closeRoom(); return; }
    s.addPoint(p);
  };
  const onSvgMove = (e: React.PointerEvent) => {
    if (drawing) setCursor(snap(toWorld(e.clientX, e.clientY)));
  };

  // ---- render ----
  const blueprint = gridStyle === "blueprint";
  const bg = blueprint ? "#1f3a6b" : "var(--canvas)";
  const tx = (n: number) => n.toFixed(1);

  // grid lines
  const gridEls: React.ReactNode[] = [];
  if (w && view.zoom) {
    const step = 100, minor = 50;
    const wl = (-view.pan.x) / view.zoom, wr = (w - view.pan.x) / view.zoom;
    const wt = (-view.pan.y) / view.zoom, wb = (h - view.pan.y) / view.zoom;
    const lineColor = blueprint ? "rgba(255,255,255,0.16)" : "var(--border)";
    const majColor = blueprint ? "rgba(255,255,255,0.30)" : "var(--border-strong)";
    if (gridStyle === "dots") {
      for (let x = Math.floor(wl / step) * step; x < wr; x += step)
        for (let y = Math.floor(wt / step) * step; y < wb; y += step)
          gridEls.push(<circle key={"d" + x + "_" + y} cx={x} cy={y} r={1.4 / view.zoom} fill="#c9c9c4" />);
    } else {
      for (let x = Math.floor(wl / minor) * minor; x < wr; x += minor)
        gridEls.push(<line key={"vx" + x} x1={x} y1={wt} x2={x} y2={wb} stroke={x % step === 0 ? majColor : lineColor} strokeWidth={(x % step === 0 ? 1 : 0.6) / view.zoom} />);
      for (let y = Math.floor(wt / minor) * minor; y < wb; y += minor)
        gridEls.push(<line key={"hy" + y} x1={wl} y1={y} x2={wr} y2={y} stroke={y % step === 0 ? majColor : lineColor} strokeWidth={(y % step === 0 ? 1 : 0.6) / view.zoom} />);
    }
  }

  const hasAnyRoom = s.rooms.some((r) => r.closed && r.polygon.length >= 3);
  const selectedObj = s.furniture.find((f) => f.id === s.selectedId);

  const cursorStyle = (spaceHeld || s.tool === "pan") ? "grab" : drawing ? "crosshair" : "default";

  return (
    <div ref={wrapRef} className="cv2d-wrap" style={{ position: "absolute", inset: 0, background: bg, overflow: "hidden", touchAction: "none", cursor: drag && (drag.type === "pan" || drag.type === "pan-bg") ? "grabbing" : cursorStyle }}
      onWheel={onWheel} onPointerDown={onDown} onClick={onSvgClick} onPointerMove={onSvgMove} onMouseLeave={() => setCursor(null)}>
      <svg width={w} height={h} style={{ display: "block" }}>
        <g transform={`translate(${tx(view.pan.x)} ${tx(view.pan.y)}) scale(${view.zoom})`}>
          {gridEls}

          {/* existing scene — dimmed + click-through while tracing a new room */}
          <g opacity={drawing ? 0.28 : 1} style={{ pointerEvents: drawing ? "none" : "auto" }}>
            {/* room floors — every room; the active room is tinted + accent-outlined */}
            {s.rooms.map((room) => {
              if (room.polygon.length < 2) return null;
              const active = !s.selectedId && room.id === s.activeRoomId;
              return (
                <path key={room.id}
                  d={"M" + room.polygon.map((p) => p.x + " " + p.y).join(" L ") + " Z"}
                  onPointerDown={(e) => onRoomDown(e, room.id)} style={{ cursor: "pointer" }}
                  fill={active ? (blueprint ? "rgba(120,170,255,0.18)" : shade(accent, 1.86)) : (blueprint ? "rgba(255,255,255,0.06)" : "#ffffff")}
                  stroke="none" />
              );
            })}

            {/* wall segments — click one to open (remove) it or restore it. Removed walls
                show as a dashed gap; the room footprint (interior) is unchanged. */}
            {hasAnyRoom && s.rooms.filter((r) => r.closed && r.polygon.length >= 3).flatMap((room) => {
              const active = !s.selectedId && room.id === s.activeRoomId;
              const removedSet = room.openWalls ?? [];
              return edges(room.polygon).map((e, i) => {
                const removed = removedSet.includes(i);
                const hot = hoverWall?.room === room.id && hoverWall?.i === i;
                const baseCol = blueprint ? "#ffffff" : "var(--text)";
                const col = removed ? (blueprint ? "rgba(255,255,255,0.30)" : "rgba(40,40,46,0.30)") : hot || active ? accent : baseCol;
                return (
                  <g key={room.id + "w" + i}>
                    <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                      stroke={col} strokeWidth={((removed ? 1.6 : active ? 3.4 : 2.2) + (hot ? 1.4 : 0)) / view.zoom}
                      strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray={removed ? `${11 / view.zoom} ${8 / view.zoom}` : undefined}
                      style={{ pointerEvents: "none" }} />
                    <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}
                      stroke="transparent" strokeWidth={16 / view.zoom} strokeLinecap="round" style={{ cursor: "pointer" }}
                      onPointerEnter={() => setHoverWall({ room: room.id, i })}
                      onPointerLeave={() => setHoverWall((h) => (h?.room === room.id && h?.i === i ? null : h))}
                      onPointerDown={(ev) => { if (spaceRef.current || ev.button === 1) return; ev.stopPropagation(); }}
                      onClick={(ev) => { if (movedRef.current) return; ev.stopPropagation(); s.toggleWall(room.id, i); }}>
                      <title>{removed ? "Click to restore this wall" : "Click to remove this wall (open the space)"}</title>
                    </line>
                  </g>
                );
              });
            })}

            {/* clearance zones */}
            {hasAnyRoom && s.showClearance && s.furniture.filter((f) => !f.flat && !f.hidden).map((o) => {
              const cl = 60;
              return <g key={"cl" + o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0})`}>
                <rect x={-(o.w / 2 + cl)} y={-(o.d / 2 + cl)} width={o.w + cl * 2} height={o.d + cl * 2}
                  rx={10} fill="rgba(245,158,11,0.10)" stroke="rgba(245,158,11,0.5)" strokeWidth={1.4 / view.zoom} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`} />
              </g>;
            })}

            {/* furniture footprints */}
            {hasAnyRoom && s.furniture.filter((o) => !o.hidden).map((o) => {
              const sel = s.selectedId === o.id;
              const fill = o.flat ? o.color : shade(o.color, 1.08);
              // mesh-backed objects render their true top-down silhouette instead of the box icon
              const hasMesh = !!o.meshUrl && o.status === "ready" && !o.flat;
              return (
                <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0})`} style={{ cursor: "move" }}
                  onPointerDown={(e) => onObjDown(e, o)}>
                  <rect x={-o.w / 2} y={-o.d / 2} width={o.w} height={o.d} rx={o.flat ? 6 : 4}
                    fill={hasMesh ? (blueprint ? "rgba(255,255,255,0.12)" : "#f6f4f0") : fill} fillOpacity={o.flat ? 0.7 : 1}
                    stroke={sel ? accent : (blueprint ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.35)")}
                    strokeWidth={(sel ? 2.4 : 1.2) / view.zoom} />
                  {hasMesh && <TopDownFootprint key={o.meshUrl} url={o.meshUrl!} w={o.w} d={o.d} />}
                  {!o.flat && <line x1={0} y1={-o.d / 2} x2={0} y2={-o.d / 2 + Math.min(o.d * 0.32, 22)} stroke="rgba(0,0,0,0.4)" strokeWidth={1.4 / view.zoom} />}
                  {!o.flat && !hasMesh && o.w * view.zoom > 38 && (
                    <g transform={`scale(${1 / view.zoom})`} style={{ pointerEvents: "none" }}>
                      <foreignObject x={-16} y={-16} width={32} height={32}>
                        <div style={{ color: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32 }}>
                          <Icon name={TYPE_ICON[o.type] || "box"} size={20} />
                        </div>
                      </foreignObject>
                    </g>
                  )}
                </g>
              );
            })}

            {/* selection dims + rotate handle */}
            {hasAnyRoom && selectedObj && (
              <g transform={`translate(${selectedObj.x} ${selectedObj.y}) rotate(${selectedObj.rot || 0})`} style={{ pointerEvents: "none" }}>
                <DimLabel x={0} y={-selectedObj.d / 2 - 16 / view.zoom} z={view.zoom} text={Math.round(selectedObj.w) + ""} accent={accent} />
                <DimLabel x={selectedObj.w / 2 + 18 / view.zoom} y={0} z={view.zoom} text={Math.round(selectedObj.d) + ""} accent={accent} vert />
                <g style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(e) => onRotDown(e, selectedObj)}>
                  <line x1={0} y1={-selectedObj.d / 2} x2={0} y2={-selectedObj.d / 2 - 26 / view.zoom} stroke={accent} strokeWidth={1.4 / view.zoom} />
                  <circle cx={0} cy={-selectedObj.d / 2 - 30 / view.zoom} r={6 / view.zoom} fill="#fff" stroke={accent} strokeWidth={2 / view.zoom} />
                </g>
              </g>
            )}

            {/* wall dimension labels — per room */}
            {s.rooms.filter((r) => r.closed && r.polygon.length >= 3).flatMap((room) =>
              edges(room.polygon).map((e, i) => {
                const ox = e.nx * (14 / view.zoom), oy = e.ny * (14 / view.zoom);
                return <DimLabel key={room.id + "wd" + i} x={e.mid.x + ox} y={e.mid.y + oy} z={view.zoom} text={(e.len / 100).toFixed(2) + " m"} muted={!blueprint} light={blueprint} />;
              }),
            )}

            {/* room name + area labels (centred) — optional */}
            {s.showRoomLabels && s.rooms.filter((r) => r.closed && r.polygon.length >= 3).map((room) => {
              const c = centroid(room.polygon);
              const aM2 = (area(room.polygon) / 10000).toFixed(1) + " m²";
              const halo = blueprint ? "rgba(31,58,107,0.55)" : "rgba(255,255,255,0.9)";
              return (
                <g key={room.id + "name"} transform={`translate(${c.x} ${c.y}) scale(${1 / view.zoom})`} style={{ pointerEvents: "none" }}>
                  <text textAnchor="middle" y={-1} fontFamily="var(--ui)" fontSize={13.5} fontWeight={700}
                    stroke={halo} strokeWidth={3.5} style={{ paintOrder: "stroke" }} fill={blueprint ? "#fff" : "var(--text)"}>{room.name}</text>
                  <text textAnchor="middle" y={15} fontFamily="var(--mono)" fontSize={10.5} fontWeight={600}
                    stroke={halo} strokeWidth={3} style={{ paintOrder: "stroke" }} fill={blueprint ? "rgba(255,255,255,0.85)" : "var(--text-3)"}>{aM2}</text>
                </g>
              );
            })}
          </g>

          {/* draft drawing */}
          {drawing && s.draftPoints.length >= 2 && (
            <polyline points={s.draftPoints.map((p) => p.x + "," + p.y).join(" ")}
              fill={s.draftPoints.length >= 3 ? accent : "none"} fillOpacity={s.draftPoints.length >= 3 ? 0.08 : 0}
              stroke={accent} strokeWidth={2.4 / view.zoom} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {drawing && s.draftPoints.map((p, i) => {
            const isFirst = i === 0;
            const near = cursor && s.draftPoints.length >= 3 && isFirst && dist(cursor, p) < 35;
            return <circle key={"dp" + i} cx={p.x} cy={p.y} r={(near ? 9 : 5) / view.zoom} fill={near ? accent : "#fff"} stroke={accent} strokeWidth={2 / view.zoom} />;
          })}
          {drawing && cursor && s.draftPoints.length > 0 && (() => {
            const last = s.draftPoints[s.draftPoints.length - 1];
            const len = dist(last, cursor);
            return <g style={{ pointerEvents: "none" }}>
              <line x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y} stroke={accent} strokeWidth={1.6 / view.zoom} strokeDasharray={`${5 / view.zoom} ${4 / view.zoom}`} />
              <DimLabel x={(last.x + cursor.x) / 2} y={(last.y + cursor.y) / 2 - 14 / view.zoom} z={view.zoom} text={(len / 100).toFixed(2) + " m"} accent={accent} />
            </g>;
          })()}

          {/* human proxy */}
          {hasAnyRoom && s.showProxy && (
            <g transform={`translate(${s.proxy.x} ${s.proxy.y}) rotate(${s.proxy.rot || 0})`} style={{ cursor: "move" }} onPointerDown={onProxyDown}>
              <rect x={-(s.proxy.w ?? 60) / 2} y={-(s.proxy.d ?? 40) / 2} width={s.proxy.w ?? 60} height={s.proxy.d ?? 40} rx={6} fill="rgba(59,130,246,0.18)" stroke={accent} strokeWidth={1.8 / view.zoom} />
              <g transform={`scale(${1 / view.zoom})`} style={{ pointerEvents: "none" }}>
                <foreignObject x={-13} y={-13} width={26} height={26}>
                  <div style={{ color: accent, display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26 }}>
                    <Icon name="person" size={18} />
                  </div>
                </foreignObject>
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* snap-increment selector — sets the grid the walls (and furniture nudges) snap to */}
      <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", left: 14, top: 56, display: "flex", alignItems: "center", gap: 7, padding: "5px 9px 5px 11px", background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-1)", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", zIndex: 8 }}>
        <Icon name="grid" size={14} />
        <span>Grid</span>
        <select value={s.gridSize} onChange={(e) => s.setGridSize(Number(e.target.value))}
          style={{ border: "1px solid var(--border-strong)", borderRadius: 7, background: "var(--panel-2)", font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--text)", padding: "2px 4px", cursor: "pointer", outline: "none" }}>
          {[5, 10, 25, 50, 100].map((v) => <option key={v} value={v}>{v} cm</option>)}
        </select>
        <span style={{ width: 1, height: 18, background: "var(--border)" }} />
        <button onClick={() => s.toggle("showRoomLabels")} title={s.showRoomLabels ? "Hide room labels" : "Show room labels"}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", border: "none", borderRadius: 99, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, background: s.showRoomLabels ? "var(--accent-soft)" : "transparent", color: s.showRoomLabels ? "var(--accent-600)" : "var(--text-3)" }}>
          <Icon name={s.showRoomLabels ? "eye" : "eyeOff"} size={14} /> Labels
        </button>
      </div>

      {/* draw-mode helper */}
      {drawing && (
        <div className="draw-hint" style={hintStyle} onPointerDown={(e) => e.stopPropagation()}>
          <Icon name="pen" size={15} />
          <span>{s.draftPoints.length === 0 ? "Click on the canvas to drop the first corner" : s.draftPoints.length < 3 ? "Keep clicking to trace walls" : "Click the first point — or press Enter — to close the room"}</span>
          {s.draftPoints.length > 0 && <button className="btn ghost sm" style={hintBtn} onClick={(e) => { e.stopPropagation(); s.undoPoint(); }}>Undo</button>}
          {s.draftPoints.length >= 3 && <button className="btn sm" style={hintBtn} onClick={(e) => { e.stopPropagation(); s.closeRoom(); }}>Close room</button>}
          <button className="btn ghost sm" style={hintBtn} onClick={(e) => { e.stopPropagation(); s.cancelDraw(); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** Draws an object's orthographic top-down silhouette into its W×D footprint. The
    snapshot is rendered + cached lazily; until it's ready nothing is drawn (the box
    fill/icon shows through). preserveAspectRatio="none" stretches the unit-footprint
    render to the exact box, matching the 3D view's non-uniform scaling. */
function TopDownFootprint({ url, w, d }: { url: string; w: number; d: number }) {
  // Keyed by url at the call site, so a url change remounts this and resets src to null.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    topDownImage(url).then((data) => { if (alive) setSrc(data); });
    return () => { alive = false; };
  }, [url]);
  if (!src) return null;
  return (
    <image href={src} x={-w / 2} y={-d / 2} width={w} height={d}
      preserveAspectRatio="none" style={{ pointerEvents: "none" }} />
  );
}

function DimLabel({ x, y, z, text, accent, muted, light, vert }: {
  x: number; y: number; z: number; text: string; accent?: string; muted?: boolean; light?: boolean; vert?: boolean;
}) {
  void muted;
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / z})`} style={{ pointerEvents: "none" }}>
      <g transform={vert ? "rotate(-90)" : ""}>
        <rect x={-text.length * 3.7 - 6} y={-9} width={text.length * 7.4 + 12} height={18} rx={4}
          fill={accent ? accent : light ? "rgba(31,58,107,0.9)" : "#ffffff"} stroke={accent || light ? "none" : "var(--border-strong)"} strokeWidth={1} />
        <text x={0} y={4} textAnchor="middle" fontFamily="var(--mono)" fontSize={11} fontWeight={600}
          fill={accent || light ? "#fff" : "var(--text-2)"}>{text}</text>
      </g>
    </g>
  );
}

const hintStyle: CSSProperties = {
  position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
  display: "flex", alignItems: "center", gap: 9, padding: "8px 12px 8px 14px",
  background: "var(--text)", color: "#fff", borderRadius: 99, fontSize: 13, fontWeight: 500,
  boxShadow: "var(--sh-3)", animation: "popIn .2s ease",
};
const hintBtn: CSSProperties = {
  marginLeft: 2, height: 26, padding: "0 10px", borderColor: "rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.12)", color: "#fff",
};
