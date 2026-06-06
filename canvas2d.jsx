/* ===== Canvas2D — interactive drafting / plan view ===== */
(function () {
  const { useRef, useState, useEffect, useCallback } = React;
  const G = window.GEO;

  function useSize(ref) {
    const [s, setS] = useState({ w: 800, h: 600 });
    useEffect(() => {
      if (!ref.current) return;
      const ro = new ResizeObserver(() => {
        const r = ref.current.getBoundingClientRect();
        setS({ w: r.width, h: r.height });
      });
      ro.observe(ref.current);
      return () => ro.disconnect();
    }, []);
    return s;
  }

  function Canvas2D(props) {
    const { S, A } = props;
    const wrapRef = useRef(null);
    const { w, h } = useSize(wrapRef);
    const view = S.view2d;
    const [drag, setDrag] = useState(null); // {type, id, ...}
    const [cursor, setCursor] = useState(null); // world pt while drawing
    const drawing = S.tool === "draw";
    const GRID = 25; // cm snap
    const accent = props.accent;
    const DRAG_THRESH = 4; // px before an object actually starts moving

    // ---- hold-to-pan: spacebar (any tool) ----
    const spaceRef = useRef(false);
    const [spaceHeld, setSpaceHeld] = useState(false);
    useEffect(() => {
      const isTyping = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      const kd = (e) => {
        if (e.code === "Space" && !e.repeat && !isTyping(e.target)) {
          spaceRef.current = true; setSpaceHeld(true); e.preventDefault();
        }
      };
      const ku = (e) => { if (e.code === "Space") { spaceRef.current = false; setSpaceHeld(false); } };
      const blur = () => { spaceRef.current = false; setSpaceHeld(false); };
      window.addEventListener("keydown", kd);
      window.addEventListener("keyup", ku);
      window.addEventListener("blur", blur);
      return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur); };
    }, []);
    // true when this pointer event should pan regardless of what's under it
    const wantsPan = (e) => spaceRef.current || e.button === 1;
    const movedRef = useRef(false); // suppress the click that follows a real drag/pan

    // ---- draw-mode keys: Esc cancels, Enter closes the loop ----
    useEffect(() => {
      if (!drawing) return;
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); A.cancelDraw(); }
        else if (e.key === "Enter" && S.draftPoints.length >= 3) { e.preventDefault(); A.closeRoom(); }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [drawing, S.draftPoints.length]);

    // ---- coordinate helpers ----
    const toWorld = useCallback((cx, cy) => {
      const r = wrapRef.current.getBoundingClientRect();
      return { x: (cx - r.left - view.pan.x) / view.zoom, y: (cy - r.top - view.pan.y) / view.zoom };
    }, [view]);
    const snap = (p) => ({ x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID });

    // ---- fit to content on mount / room change ----
    useEffect(() => {
      if (!w) return;
      const pts = S.room.closed ? S.room.polygon : (S.draftPoints.length ? S.draftPoints : S.room.polygon);
      if (!pts.length) { A.setView2d({ pan: { x: w / 2, y: h / 2 }, zoom: 0.6 }); return; }
      const b = G.bounds(pts);
      const pad = 90;
      const zoom = Math.min((w - pad * 2) / Math.max(1, b.maxX - b.minX), (h - pad * 2) / Math.max(1, b.maxY - b.minY), 1.4);
      A.setView2d({ zoom, pan: { x: (w - (b.maxX + b.minX) * zoom) / 2, y: (h - (b.maxY + b.minY) * zoom) / 2 } });
    }, [w, h, S.room.closed, S.fitTick]);

    // ---- wheel zoom toward cursor ----
    const onWheel = (e) => {
      e.preventDefault();
      const r = wrapRef.current.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const k = Math.exp(-e.deltaY * 0.0014);
      const z2 = Math.max(0.12, Math.min(3.5, view.zoom * k));
      A.setView2d({
        zoom: z2,
        pan: { x: mx - (mx - view.pan.x) * (z2 / view.zoom), y: my - (my - view.pan.y) * (z2 / view.zoom) },
      });
    };

    // ---- pointer handlers ----
    const onDown = (e) => {
      movedRef.current = false;
      // hold-to-pan beats everything (space / middle mouse / pan tool)
      if (wantsPan(e) || S.tool === "pan") {
        setDrag({ type: "pan", sx: e.clientX, sy: e.clientY, p0: { ...view.pan } });
        return;
      }
      if (drawing) return; // handled by click
      setDrag({ type: "pan-bg", sx: e.clientX, sy: e.clientY, p0: { ...view.pan }, moved: false });
    };
    const onObjDown = (e, o) => {
      e.stopPropagation();
      movedRef.current = false;
      // when panning, drag the canvas instead of the object
      if (wantsPan(e)) {
        setDrag({ type: "pan", sx: e.clientX, sy: e.clientY, p0: { ...view.pan } });
        return;
      }
      A.select(o.id);
      const wpt = toWorld(e.clientX, e.clientY);
      setDrag({ type: "move", id: o.id, off: { x: wpt.x - o.x, y: wpt.y - o.y }, sx: e.clientX, sy: e.clientY, started: false });
    };
    const onProxyDown = (e) => {
      e.stopPropagation();
      const wpt = toWorld(e.clientX, e.clientY);
      setDrag({ type: "proxy", off: { x: wpt.x - S.proxy.x, y: wpt.y - S.proxy.y } });
    };
    const onRotDown = (e, o) => {
      e.stopPropagation();
      setDrag({ type: "rotate", id: o.id });
    };

    useEffect(() => {
      if (!drag) return;
      const move = (e) => {
        if (drag.type === "pan" || (drag.type === "pan-bg")) {
          A.setView2d({ ...view, pan: { x: drag.p0.x + (e.clientX - drag.sx), y: drag.p0.y + (e.clientY - drag.sy) } });
          if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 3) { drag.moved = true; movedRef.current = true; }
        } else if (drag.type === "move") {
          // require a small movement before nudging — a plain click just selects
          if (!drag.started) {
            if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_THRESH) return;
            drag.started = true;
          }
          const wpt = toWorld(e.clientX, e.clientY);
          const np = snap({ x: wpt.x - drag.off.x, y: wpt.y - drag.off.y });
          A.moveFurniture(drag.id, np);
        } else if (drag.type === "proxy") {
          const wpt = toWorld(e.clientX, e.clientY);
          A.setProxy({ x: Math.round(wpt.x - drag.off.x), y: Math.round(wpt.y - drag.off.y) });
        } else if (drag.type === "rotate") {
          const o = S.furniture.find((f) => f.id === drag.id);
          const wpt = toWorld(e.clientX, e.clientY);
          let deg = Math.atan2(wpt.y - o.y, wpt.x - o.x) * 180 / Math.PI + 90;
          deg = Math.round(deg / 15) * 15;
          A.moveFurniture(drag.id, { rot: deg });
        }
      };
      const up = (e) => {
        if (drag.type === "pan-bg" && !drag.moved) A.select(null);
        setDrag(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    }, [drag]);

    // ---- drawing clicks ----
    const onSvgClick = (e) => {
      if (movedRef.current) { movedRef.current = false; return; } // ignore click after a pan
      if (!drawing || spaceRef.current) return;
      const p = snap(toWorld(e.clientX, e.clientY));
      const pts = S.draftPoints;
      if (pts.length >= 3 && G.dist(p, pts[0]) < 35) { A.closeRoom(); return; }
      A.addPoint(p);
    };
    const onSvgMove = (e) => {
      if (drawing) setCursor(snap(toWorld(e.clientX, e.clientY)));
    };

    // ---- render ----
    const blueprint = props.gridStyle === "blueprint";
    const bg = blueprint ? "#1f3a6b" : "var(--canvas)";
    const tx = (n) => n.toFixed(1);

    // grid lines
    const gridEls = [];
    if (w && view.zoom) {
      const step = 100, minor = 50;
      const wl = (-view.pan.x) / view.zoom, wr = (w - view.pan.x) / view.zoom;
      const wt = (-view.pan.y) / view.zoom, wb = (h - view.pan.y) / view.zoom;
      const lineColor = blueprint ? "rgba(255,255,255,0.16)" : "var(--border)";
      const majColor = blueprint ? "rgba(255,255,255,0.30)" : "var(--border-strong)";
      if (props.gridStyle === "dots") {
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

    const roomPts = S.room.closed ? S.room.polygon : S.draftPoints;
    const roomEdges = S.room.closed ? G.edges(S.room.polygon) : [];

    const cursorStyle = (spaceHeld || S.tool === "pan") ? "grab" : drawing ? "crosshair" : "default";

    return (
      <div ref={wrapRef} className="cv2d-wrap" style={{ position: "absolute", inset: 0, background: bg, overflow: "hidden", cursor: drag && (drag.type === "pan" || drag.type === "pan-bg") ? "grabbing" : cursorStyle }}
        onWheel={onWheel} onPointerDown={onDown} onClick={onSvgClick} onPointerMove={onSvgMove} onMouseLeave={() => setCursor(null)}>
        <svg width={w} height={h} style={{ display: "block" }}>
          <g transform={`translate(${tx(view.pan.x)} ${tx(view.pan.y)}) scale(${view.zoom})`}>
            {gridEls}

            {/* existing scene — dimmed + click-through while tracing a new room */}
            <g opacity={drawing ? 0.28 : 1} style={{ pointerEvents: drawing ? "none" : "auto" }}>
            {/* room fill */}
            {roomPts.length >= 2 && (
              <path d={"M" + roomPts.map((p) => p.x + " " + p.y).join(" L ") + (S.room.closed ? " Z" : "")}
                fill={S.room.closed ? (blueprint ? "rgba(255,255,255,0.06)" : "#ffffff") : "none"}
                stroke={blueprint ? "#ffffff" : "var(--text)"} strokeWidth={2.4 / view.zoom} strokeLinejoin="round" />
            )}

            {/* clearance zones */}
            {S.room.closed && S.showClearance && S.furniture.filter((f) => !f.flat).map((o) => {
              const cl = 60;
              return <g key={"cl" + o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0})`}>
                <rect x={-(o.w / 2 + cl)} y={-(o.d / 2 + cl)} width={o.w + cl * 2} height={o.d + cl * 2}
                  rx={10} fill="rgba(245,158,11,0.10)" stroke="rgba(245,158,11,0.5)" strokeWidth={1.4 / view.zoom} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`} />
              </g>;
            })}

            {/* furniture footprints */}
            {S.room.closed && S.furniture.map((o) => {
              const sel = S.selectedId === o.id;
              const fill = o.flat ? o.color : G.shade(o.color, 1.08);
              return (
                <g key={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0})`} style={{ cursor: "move" }}
                  onPointerDown={(e) => onObjDown(e, o)}>
                  <rect x={-o.w / 2} y={-o.d / 2} width={o.w} height={o.d} rx={o.flat ? 6 : 4}
                    fill={fill} fillOpacity={o.flat ? 0.7 : 1}
                    stroke={sel ? accent : (blueprint ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.35)")}
                    strokeWidth={(sel ? 2.4 : 1.2) / view.zoom} />
                  {!o.flat && <line x1={0} y1={-o.d / 2} x2={0} y2={-o.d / 2 + Math.min(o.d * 0.32, 22)} stroke="rgba(0,0,0,0.4)" strokeWidth={1.4 / view.zoom} />}
                  {!o.flat && o.w * view.zoom > 38 && (
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
            {S.room.closed && (() => {
              const o = S.furniture.find((f) => f.id === S.selectedId);
              if (!o) return null;
              return <g transform={`translate(${o.x} ${o.y}) rotate(${o.rot || 0})`} style={{ pointerEvents: "none" }}>
                <DimLabel x={0} y={-o.d / 2 - 16 / view.zoom} z={view.zoom} text={Math.round(o.w) + ""} accent={accent} />
                <DimLabel x={o.w / 2 + 18 / view.zoom} y={0} z={view.zoom} text={Math.round(o.d) + ""} accent={accent} vert />
                <g style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(e) => onRotDown(e, o)}>
                  <line x1={0} y1={-o.d / 2} x2={0} y2={-o.d / 2 - 26 / view.zoom} stroke={accent} strokeWidth={1.4 / view.zoom} />
                  <circle cx={0} cy={-o.d / 2 - 30 / view.zoom} r={6 / view.zoom} fill="#fff" stroke={accent} strokeWidth={2 / view.zoom} />
                </g>
              </g>;
            })()}

            {/* wall dimension labels */}
            {roomEdges.map((e, i) => {
              const ox = e.nx * (14 / view.zoom), oy = e.ny * (14 / view.zoom);
              return <DimLabel key={"wd" + i} x={e.mid.x + ox} y={e.mid.y + oy} z={view.zoom} text={(e.len / 100).toFixed(2) + " m"} muted={!blueprint} light={blueprint} />;
            })}
            </g>

            {/* draft drawing */}
            {drawing && S.draftPoints.length >= 2 && (
              <polyline points={S.draftPoints.map((p) => p.x + "," + p.y).join(" ")}
                fill={S.draftPoints.length >= 3 ? accent : "none"} fillOpacity={S.draftPoints.length >= 3 ? 0.08 : 0}
                stroke={accent} strokeWidth={2.4 / view.zoom} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {drawing && S.draftPoints.map((p, i) => {
              const isFirst = i === 0;
              const near = cursor && S.draftPoints.length >= 3 && isFirst && G.dist(cursor, p) < 35;
              return <circle key={"dp" + i} cx={p.x} cy={p.y} r={(near ? 9 : 5) / view.zoom} fill={near ? accent : "#fff"} stroke={accent} strokeWidth={2 / view.zoom} />;
            })}
            {drawing && cursor && S.draftPoints.length > 0 && (() => {
              const last = S.draftPoints[S.draftPoints.length - 1];
              const len = G.dist(last, cursor);
              return <g style={{ pointerEvents: "none" }}>
                <line x1={last.x} y1={last.y} x2={cursor.x} y2={cursor.y} stroke={accent} strokeWidth={1.6 / view.zoom} strokeDasharray={`${5 / view.zoom} ${4 / view.zoom}`} />
                <DimLabel x={(last.x + cursor.x) / 2} y={(last.y + cursor.y) / 2 - 14 / view.zoom} z={view.zoom} text={(len / 100).toFixed(2) + " m"} accent={accent} />
              </g>;
            })()}

            {/* human proxy */}
            {S.room.closed && S.showProxy && (
              <g transform={`translate(${S.proxy.x} ${S.proxy.y}) rotate(${S.proxy.rot || 0})`} style={{ cursor: "move" }} onPointerDown={onProxyDown}>
                <rect x={-30} y={-20} width={60} height={40} rx={6} fill="rgba(59,130,246,0.18)" stroke={accent} strokeWidth={1.8 / view.zoom} />
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

        {/* draw-mode helper */}
        {drawing && (
          <div className="draw-hint" style={hintStyle} onPointerDown={(e) => e.stopPropagation()}>
            <Icon name="pen" size={15} />
            <span>{S.draftPoints.length === 0 ? "Click on the canvas to drop the first corner" : S.draftPoints.length < 3 ? "Keep clicking to trace walls" : "Click the first point — or press Enter — to close the room"}</span>
            {S.draftPoints.length > 0 && <button className="btn ghost sm" style={hintBtn} onClick={(e) => { e.stopPropagation(); A.undoPoint(); }}>Undo</button>}
            {S.draftPoints.length >= 3 && <button className="btn sm" style={hintBtn} onClick={(e) => { e.stopPropagation(); A.closeRoom(); }}>Close room</button>}
            <button className="btn ghost sm" style={hintBtn} onClick={(e) => { e.stopPropagation(); A.cancelDraw(); }}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  function DimLabel({ x, y, z, text, accent, muted, light, vert }) {
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

  const hintStyle = {
    position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
    display: "flex", alignItems: "center", gap: 9, padding: "8px 12px 8px 14px",
    background: "var(--text)", color: "#fff", borderRadius: 99, fontSize: 13, fontWeight: 500,
    boxShadow: "var(--sh-3)", animation: "popIn .2s ease",
  };
  const hintBtn = {
    marginLeft: 2, height: 26, padding: "0 10px", borderColor: "rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)", color: "#fff",
  };

  window.Canvas2D = Canvas2D;
})();
