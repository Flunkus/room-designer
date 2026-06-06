/* ===== Canvas3D — isometric "dollhouse" orbit view (mocked 3D) ===== */
(function () {
  const { useRef, useState, useEffect } = React;
  const G = window.GEO;

  function useSize(ref) {
    const [s, setS] = useState({ w: 800, h: 600 });
    useEffect(() => {
      if (!ref.current) return;
      const ro = new ResizeObserver(() => { const r = ref.current.getBoundingClientRect(); setS({ w: r.width, h: r.height }); });
      ro.observe(ref.current);
      return () => ro.disconnect();
    }, []);
    return s;
  }

  // resolve absolute world position of an object (handles parent nesting)
  function resolve(o, all) {
    if (!o.parent) return { ...o, _z0: o.flat ? 0 : 0 };
    const p = all.find((f) => f.id === o.parent);
    if (!p) return { ...o, _z0: 0 };
    const r = G.rad(p.rot || 0), ca = Math.cos(r), sa = Math.sin(r);
    // child placed at parent centre, lifted to parent top
    return { ...o, x: p.x, y: p.y - p.d / 2 + o.d / 2, _z0: (o.localZ != null ? o.localZ : p.h) };
  }

  function Canvas3D(props) {
    const { S, A } = props;
    const wrapRef = useRef(null);
    const { w, h } = useSize(wrapRef);
    const v = S.view3d;
    const [drag, setDrag] = useState(null);
    const accent = props.accent;
    const M = window.MATERIALS;

    const cen = G.centroid(S.room.polygon);

    useEffect(() => {
      if (!w) return;
      const b = G.bounds(S.room.polygon);
      const diag = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) + window.WALL_HEIGHT;
      const scale = Math.min(w, h) / (diag * 1.15);
      A.setView3d({ ...v, scale: scale * (v.zoom || 1), ox: w / 2, oy: h / 2 + 60 });
    }, [w, h, S.fitTick]);

    const onDown = (e) => setDrag({ az: v.az, sx: e.clientX, sy: e.clientY });
    useEffect(() => {
      if (!drag) return;
      const move = (e) => A.setView3d({ ...v, az: drag.az + (e.clientX - drag.sx) * 0.4 });
      const up = () => setDrag(null);
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    }, [drag, v]);

    const onWheel = (e) => {
      e.preventDefault();
      const z = Math.max(0.4, Math.min(2.6, (v.zoom || 1) * Math.exp(-e.deltaY * 0.0012)));
      A.setView3d({ ...v, zoom: z });
    };

    if (!v.scale) return <div ref={wrapRef} style={{ position: "absolute", inset: 0 }} />;
    const proj = G.makeProjector({ az: v.az, scale: v.scale, ox: v.ox, oy: v.oy, cx: cen.x, cy: cen.y });

    // ---- build draw list ----
    const els = [];

    // floor
    const floorPts = S.room.polygon.map((p) => proj.p({ x: p.x, y: p.y, z: 0 }));
    els.push(
      <g key="floor">
        <path d={G.polyPath(floorPts)} fill={M.floor.base} stroke={G.shade(M.floor.base, 0.8)} strokeWidth="1.5" strokeLinejoin="round" />
        {/* floor plank hint */}
        <path d={G.polyPath(floorPts)} fill="url(#plank)" opacity="0.5" />
      </g>
    );

    // back walls (cutaway)
    const H = window.WALL_HEIGHT;
    G.edges(S.room.polygon).forEach((e, i) => {
      if (!proj.isFar(e.nx, e.ny)) return;
      const a0 = proj.p({ x: e.a.x, y: e.a.y, z: 0 }), b0 = proj.p({ x: e.b.x, y: e.b.y, z: 0 });
      const b1 = proj.p({ x: e.b.x, y: e.b.y, z: H }), a1 = proj.p({ x: e.a.x, y: e.a.y, z: H });
      const rn = (e.nx) * Math.cos(G.rad(v.az)) - e.ny * Math.sin(G.rad(v.az));
      const tone = rn > 0 ? 0.93 : 1.0;
      els.push(
        <path key={"wall" + i} d={`M${a0.sx} ${a0.sy} L${b0.sx} ${b0.sy} L${b1.sx} ${b1.sy} L${a1.sx} ${a1.sy} Z`}
          fill={G.shade(M.walls.base, tone)} stroke={G.shade(M.walls.base, 0.82)} strokeWidth="1" strokeLinejoin="round" />
      );
    });

    // clearance discs on floor
    if (S.showClearance) {
      S.furniture.filter((o) => !o.flat && !o.parent).map((o) => resolve(o, S.furniture)).forEach((o) => {
        const cl = 60;
        const corners = [
          { x: -(o.w / 2 + cl), y: -(o.d / 2 + cl) }, { x: o.w / 2 + cl, y: -(o.d / 2 + cl) },
          { x: o.w / 2 + cl, y: o.d / 2 + cl }, { x: -(o.w / 2 + cl), y: o.d / 2 + cl },
        ].map((c) => {
          const r = G.rad(o.rot || 0);
          return proj.p({ x: o.x + c.x * Math.cos(r) - c.y * Math.sin(r), y: o.y + c.x * Math.sin(r) + c.y * Math.cos(r), z: 1 });
        });
        els.push(<path key={"cl3" + o.id} d={G.polyPath(corners)} fill="rgba(245,158,11,0.16)" stroke="rgba(245,158,11,0.55)" strokeWidth="1.3" strokeDasharray="5 4" />);
      });
    }

    // furniture boxes (depth sorted)
    const items = S.furniture.map((o) => resolve(o, S.furniture))
      .sort((a, b) => proj.depth({ x: a.x, y: a.y }) - proj.depth({ x: b.x, y: b.y }));

    items.forEach((o) => {
      const sel = S.selectedId === o.id;
      const c = G.boxCorners(o, o._z0);
      const P = c.map((pt) => proj.p(pt));
      // shadow
      const shadow = [c[0], c[1], c[2], c[3]].map((pt) => proj.p({ x: pt.x, y: pt.y, z: 1 }));
      els.push(<path key={"sh" + o.id} d={G.polyPath(shadow)} fill="rgba(20,20,25,0.10)" />);

      if (o.flat) {
        els.push(<path key={"flat" + o.id} d={G.polyPath([P[4], P[5], P[6], P[7]])} fill={o.color} stroke={G.shade(o.color, 0.85)} strokeWidth="1" />);
        return;
      }
      const sides = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
      const localMid = [{ x: 0, y: -o.d / 2 }, { x: o.w / 2, y: 0 }, { x: 0, y: o.d / 2 }, { x: -o.w / 2, y: 0 }];
      const r = G.rad(o.rot || 0), ca = Math.cos(r), sa = Math.sin(r);
      const az = G.rad(v.az);
      const faceEls = [];
      sides.forEach((s, fi) => {
        const m = localMid[fi];
        const nx = m.x * ca - m.y * sa, ny = m.x * sa + m.y * ca; // world normal dir (approx)
        const rnx = nx * Math.cos(az) - ny * Math.sin(az), rny = nx * Math.sin(az) + ny * Math.cos(az);
        if (rnx + rny > 0) return; // back face cull
        const tone = (rnx - rny) > 0 ? 0.82 : 0.92;
        faceEls.push(<path key={"f" + o.id + fi} d={G.polyPath([P[s[0]], P[s[1]], P[s[2]], P[s[3]]])}
          fill={G.shade(o.color, tone)} stroke={sel ? accent : G.shade(o.color, 0.7)} strokeWidth={sel ? 2 : 0.8} strokeLinejoin="round" />);
      });
      els.push(<g key={"box" + o.id} style={{ cursor: "pointer" }} onPointerDown={(e) => { e.stopPropagation(); A.select(o.id); }}>{faceEls}
        <path d={G.polyPath([P[4], P[5], P[6], P[7]])} fill={G.shade(o.color, 1.12)} stroke={sel ? accent : G.shade(o.color, 0.7)} strokeWidth={sel ? 2 : 0.8} strokeLinejoin="round" />
      </g>);
    });

    return (
      <div ref={wrapRef} style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#eef0f2,#e4e6e9)", cursor: drag ? "grabbing" : "grab", overflow: "hidden" }}
        onPointerDown={onDown} onWheel={onWheel}>
        <svg width={w} height={h} style={{ display: "block" }}>
          <defs>
            <pattern id="plank" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform={`rotate(${30 + v.az})`}>
              <rect width="40" height="40" fill="none" />
              <line x1="0" y1="0" x2="40" y2="0" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
            </pattern>
            <radialGradient id="vign" cx="50%" cy="42%" r="62%">
              <stop offset="60%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
            </radialGradient>
          </defs>
          {els}
          <rect x="0" y="0" width={w} height={h} fill="url(#vign)" style={{ pointerEvents: "none" }} />
        </svg>
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", background: "rgba(27,27,30,0.82)", color: "#fff", borderRadius: 99, fontSize: 12.5, fontWeight: 500, backdropFilter: "blur(6px)", pointerEvents: "none" }}>
          <Icon name="orbit" size={15} /><span>Drag to orbit · scroll to zoom</span>
        </div>
      </div>
    );
  }

  window.Canvas3D = Canvas3D;
})();
