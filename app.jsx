/* ===== Room Designer — app shell, state, A/B directions ===== */
(function () {
  const { useState, useEffect, useCallback } = React;
  const G = window.GEO;

  function useStore() {
    const [S, setS] = useState(() => ({
      mode: "2d",
      tool: "select",
      selectedId: "sofa",
      inspectorTab: "object",
      modal: null,
      room: { closed: true, polygon: window.ROOM_POLYGON, name: "Open-Plan Room" },
      drafting: false,
      draftPoints: [],
      furniture: window.FURNITURE.map((o) => ({ ...o })),
      view2d: { zoom: 0.6, pan: { x: 200, y: 120 } },
      view3d: { az: -28, zoom: 1, scale: 0, ox: 0, oy: 0 },
      showClearance: false,
      showProxy: false,
      proxy: { x: 420, y: 250, rot: 0 },
      fitTick: 0,
    }));
    const set = useCallback((p) => setS((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) })), []);
    return [S, set];
  }

  function App({ tweaks }) {
    const [S, set] = useStore();

    useEffect(() => {
      const r = document.documentElement.style;
      r.setProperty("--accent", tweaks.accent);
      r.setProperty("--accent-600", G.shade(tweaks.accent, 0.85));
      r.setProperty("--accent-soft", tweaks.accent + "20");
      r.setProperty("--space", tweaks.density === "compact" ? "0.8" : "1");
    }, [tweaks]);

    const A = {
      setMode: (m) => set({ mode: m, tool: "select" }),
      setTool: (t) => set({ tool: t }),
      // Draw a NEW perimeter as a non-destructive overlay: keep the existing
      // room + furniture visible (dimmed) and force a top-down 2D view.
      startDraw: () => set((s) => ({ tool: "draw", drafting: true, draftPoints: [], mode: "2d", selectedId: null })),
      addPoint: (p) => set((s) => ({ draftPoints: [...s.draftPoints, p] })),
      undoPoint: () => set((s) => ({ draftPoints: s.draftPoints.slice(0, -1) })),
      cancelDraw: () => set({ tool: "select", drafting: false, draftPoints: [] }),
      closeRoom: () => set((s) => ({ room: { closed: true, polygon: s.draftPoints, name: s.room.name || "New Room" }, drafting: false, tool: "select", draftPoints: [], fitTick: s.fitTick + 1 })),
      // Wipe everything and start tracing a fresh, empty room.
      newRoom: () => set((s) => ({ room: { closed: false, polygon: [], name: "New Room" }, furniture: [], drafting: true, draftPoints: [], tool: "draw", mode: "2d", selectedId: null, inspectorTab: "room", showClearance: false, showProxy: false })),
      // Drop a clean rectangular starter room (used by the empty-state). Keeps furniture.
      starterRoom: () => set((s) => ({ room: { closed: true, polygon: [{ x: 0, y: 0 }, { x: 520, y: 0 }, { x: 520, y: 420 }, { x: 0, y: 420 }], name: "New Room" }, drafting: false, tool: "select", draftPoints: [], mode: "2d", selectedId: null, inspectorTab: "room", fitTick: s.fitTick + 1 })),
      renameRoom: (name) => set((s) => ({ room: { ...s.room, name } })),
      resetRoom: () => set((s) => ({ room: { closed: true, polygon: window.ROOM_POLYGON, name: "Open-Plan Room" }, drafting: false, tool: "select", draftPoints: [], fitTick: s.fitTick + 1 })),
      select: (id) => set({ selectedId: id, inspectorTab: id ? "object" : "room" }),
      setInspectorTab: (t) => set({ inspectorTab: t, selectedId: null }),
      openModal: (m) => set({ modal: m }),
      closeModal: () => set({ modal: null }),
      toggle: (k) => set((s) => ({ [k]: !s[k] })),
      setView2d: (v) => set({ view2d: v }),
      setView3d: (v) => set({ view3d: v }),
      setProxy: (p) => set((s) => ({ proxy: { ...s.proxy, ...p } })),
      fit: () => set((s) => ({ fitTick: s.fitTick + 1 })),
      patch: (id, p) => set((s) => ({ furniture: s.furniture.map((o) => (o.id === id ? { ...o, ...p } : o)) })),
      moveFurniture: (id, p) => set((s) => ({ furniture: s.furniture.map((o) => (o.id === id ? { ...o, ...p } : o)) })),
      patchMaterial: (k, p) => { Object.assign(window.MATERIALS[k], p); set((s) => ({ fitTick: s.fitTick + 0 })); },
      remove: (id) => set((s) => ({ furniture: s.furniture.filter((o) => o.id !== id && o.parent !== id), selectedId: null, inspectorTab: "room" })),
      duplicate: (id) => set((s) => {
        const o = s.furniture.find((f) => f.id === id); if (!o) return {};
        const n = { ...o, id: window.uid("f"), name: o.name + " copy", x: o.x + 40, y: o.y + 40, parent: null };
        return { furniture: [...s.furniture, n], selectedId: n.id, inspectorTab: "object" };
      }),
      addFurniture: (spec) => {
        const c = G.centroid(S.room.polygon);
        const id = window.uid("f");
        const obj = { id, name: spec.name || "Object", type: spec.type || "box", x: Math.round(c.x), y: Math.round(c.y), rot: 0, w: spec.w, d: spec.d, h: spec.h, color: "#b0a9a0", status: "generating" };
        set((s) => ({ furniture: [...s.furniture, obj], selectedId: id, inspectorTab: "object" }));
        setTimeout(() => set((s) => ({ furniture: s.furniture.map((o) => o.id === id ? { ...o, status: "ready" } : o) })), 2200);
      },
    };

    const dir = tweaks.direction;
    const accent = tweaks.accent;

    return (
      <div className="app" style={{ gridTemplateRows: "auto 1fr" }}>
        <TopBar S={S} A={A} dir={dir} />
        {dir === "A"
          ? <LayoutA S={S} A={A} tweaks={tweaks} accent={accent} />
          : <LayoutB S={S} A={A} tweaks={tweaks} accent={accent} />}
        {S.modal === "furniture" && <FurnitureModal A={A} onClose={A.closeModal} />}
        {S.modal === "texture" && <TextureModal A={A} onClose={A.closeModal} />}
      </div>
    );
  }

  function TopBar({ S, A, dir }) {
    const Mode = ({ id, icon, label }) => (
      <button className={"pill" + (S.mode === id ? " active" : "")} onClick={() => A.setMode(id)} style={{ height: 32 }}>
        <Icon name={icon} size={15} /> {label}
      </button>
    );
    return (
      <header style={{ display: "flex", alignItems: "center", gap: 14, height: 56, padding: "0 14px", background: "var(--panel)", borderBottom: "1px solid var(--border)", zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="cube3d" size={17} /></div>
          <div style={{ fontWeight: 720, fontSize: 15, letterSpacing: "-0.01em" }}>Roomscale</div>
          <span className="tag gray" style={{ marginLeft: 2 }}>Berowra</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
          <button className="icon-btn" title="Undo"><Icon name="undo" size={17} /></button>
          <button className="icon-btn" title="Redo"><Icon name="redo" size={17} /></button>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {dir === "A" ? (
            <div style={{ display: "flex", gap: 6, background: "var(--panel-3)", padding: 4, borderRadius: 99 }}>
              <Mode id="2d" icon="plan2d" label="Plan" />
              <Mode id="3d" icon="cube3d" label="3D" />
              <Mode id="walk" icon="walk" label="Walk" />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: 12 }}>{S.room.closed && S.room.polygon.length >= 3 ? (S.room.name || "Untitled room") : "No room"}</span>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <span>autosaved</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn ghost sm" onClick={A.fit} title="Fit view"><Icon name="fit" size={16} /></button>
          <button className="btn sm"><Icon name="save" size={15} /> Save</button>
          <button className="btn primary sm">Share</button>
        </div>
      </header>
    );
  }

  function LayoutA({ S, A, tweaks, accent }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "52px 232px 1fr 304px", minHeight: 0 }}>
        <ToolRail S={S} A={A} mode={S.mode} />
        <div style={{ borderRight: "1px solid var(--border)", minHeight: 0 }}>
          <ObjectsPanel S={S} A={A} />
        </div>
        <Stage S={S} A={A} tweaks={tweaks} accent={accent} />
        <aside style={{ borderLeft: "1px solid var(--border)", background: "var(--panel)", minHeight: 0 }}>
          <Inspector S={S} A={A} />
        </aside>
      </div>
    );
  }

  function LayoutB({ S, A, tweaks, accent }) {
    const [objOpen, setObjOpen] = useState(true);
    return (
      <div style={{ position: "relative", height: "100%", minHeight: 0 }}>
        <Stage S={S} A={A} tweaks={tweaks} accent={accent} bare />
        <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, padding: 6, background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-2)", zIndex: 12 }}>
          {[["2d", "plan2d", "Plan"], ["3d", "orbit", "Orbit"], ["walk", "walk", "Walk"]].map(([id, ic, label]) => (
            <button key={id} className={"icon-btn" + (S.mode === id ? " active" : "")} title={label} onClick={() => A.setMode(id)} style={{ width: 42, height: 42, borderRadius: 99 }}><Icon name={ic} size={19} /></button>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 3, padding: 5, background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-2)", zIndex: 12 }}>
          {[["select", "select", "Select"], ["draw", "pen", "Draw"], ["pan", "hand", "Pan — or hold Space"]].map(([t, ic, label]) => (
            <button key={t} className={"icon-btn" + (S.tool === t ? " active" : "")} title={label} onClick={() => t === "draw" ? A.startDraw() : A.setTool(t)}><Icon name={ic} /></button>
          ))}
          <hr style={{ width: 1, height: 22, background: "var(--border)", border: 0, margin: "0 3px", alignSelf: "center" }} />
          <button className="icon-btn" title="Add furniture" onClick={() => A.openModal("furniture")}><Icon name="plus" /></button>
          <button className={"icon-btn" + (S.showClearance ? " active" : "")} title="Clearance" onClick={() => A.toggle("showClearance")}><Icon name="clearance" /></button>
          <button className={"icon-btn" + (S.showProxy ? " active" : "")} title="Human proxy" onClick={() => A.toggle("showProxy")}><Icon name="person" /></button>
        </div>
        <div style={{ position: "absolute", left: 74, top: 16, width: 224, maxHeight: "calc(100% - 32px)", background: "var(--panel)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-2)", overflow: "hidden", display: "flex", flexDirection: "column", zIndex: 11 }}>
          <button onClick={() => setObjOpen(!objOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", width: "100%" }}>
            <Icon name="layers" size={16} /><span style={{ fontWeight: 650, fontSize: 13.5, flex: 1, textAlign: "left" }}>Objects</span>
            <span style={{ transform: objOpen ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--text-3)" }}><Icon name="chevron" size={15} /></span>
          </button>
          {objOpen && <div style={{ borderTop: "1px solid var(--border)", overflow: "hidden", flex: 1, minHeight: 0, display: "flex" }}><ObjectsPanel S={S} A={A} /></div>}
        </div>
        <div style={{ position: "absolute", right: 16, top: 16, width: 300, maxHeight: "calc(100% - 32px)", background: "var(--panel)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-2)", overflow: "hidden", zIndex: 11, display: "flex", flexDirection: "column" }}>
          <Inspector S={S} A={A} />
        </div>
      </div>
    );
  }

  function Stage({ S, A, tweaks, accent, bare }) {
    return (
      <div style={{ position: bare ? "absolute" : "relative", inset: bare ? 0 : undefined, minHeight: 0, overflow: "hidden", background: "var(--canvas)" }}>
        {S.mode === "2d" && <Canvas2D S={S} A={A} accent={accent} gridStyle={tweaks.grid} />}
        {S.mode === "3d" && <Canvas3D S={S} A={A} accent={accent} />}
        {S.mode === "walk" && <WalkView S={S} A={A} accent={accent} />}
        {S.mode !== "walk" && (
          <div style={{ position: "absolute", right: bare ? 330 : 14, bottom: 16, display: "flex", flexDirection: "column", gap: 4, background: "var(--panel)", borderRadius: 10, boxShadow: "var(--sh-2)", padding: 4, zIndex: 8 }}>
            <button className="icon-btn" title="Zoom in" onClick={() => S.mode === "2d" ? A.setView2d({ ...S.view2d, zoom: Math.min(3.5, S.view2d.zoom * 1.2) }) : A.setView3d({ ...S.view3d, zoom: Math.min(2.6, (S.view3d.zoom || 1) * 1.15) })}><Icon name="zoomIn" /></button>
            <button className="icon-btn" title="Zoom out" onClick={() => S.mode === "2d" ? A.setView2d({ ...S.view2d, zoom: Math.max(0.12, S.view2d.zoom / 1.2) }) : A.setView3d({ ...S.view3d, zoom: Math.max(0.4, (S.view3d.zoom || 1) / 1.15) })}><Icon name="zoomOut" /></button>
            <button className="icon-btn" title="Fit" onClick={A.fit}><Icon name="fit" /></button>
          </div>
        )}
        {!bare && (
          <div style={{ position: "absolute", left: 14, top: 14, display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-1)", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", zIndex: 8 }}>
            <Icon name={S.mode === "2d" ? "plan2d" : S.mode === "3d" ? "orbit" : "walk"} size={15} />
            {S.mode === "2d" ? "2D Plan" : S.mode === "3d" ? "3D Dollhouse" : "Walkthrough"}
          </div>
        )}
      </div>
    );
  }

  function WalkView({ S, A, accent }) {
    return (
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#d9dde2 0%,#eceef0 48%,#cdb892 48%,#c2a877 100%)", overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efe9e1" /><stop offset="1" stopColor="#e3dccf" /></linearGradient>
          </defs>
          <polygon points="0,0 250,90 250,510 0,600" fill="#e8e1d6" />
          <polygon points="1000,0 750,90 750,510 1000,600" fill="#e2dace" />
          <rect x="250" y="90" width="500" height="240" fill="url(#wallG)" />
          <polygon points="250,90 750,90 750,330 250,330" fill="none" stroke="rgba(0,0,0,0.06)" />
          <rect x="430" y="150" width="140" height="110" rx="3" fill="#cfe0ec" stroke="#fff" strokeWidth="6" />
          <line x1="500" y1="150" x2="500" y2="260" stroke="#fff" strokeWidth="4" />
          <polygon points="330,430 560,430 600,520 290,520" fill="#9aa6b3" />
          <polygon points="330,430 560,430 560,395 330,395" fill="#aab5c1" />
          <polygon points="330,395 560,395 575,365 345,365" fill="#b4bfc9" />
          <polygon points="300,520 600,520 660,560 250,560" fill="#dcd3c4" opacity="0.85" />
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.7)", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)" }} />
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: "rgba(27,27,30,0.8)", color: "#fff", borderRadius: 12, fontSize: 13, backdropFilter: "blur(8px)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}><kbd style={kbd}>W</kbd><kbd style={kbd}>A</kbd><kbd style={kbd}>S</kbd><kbd style={kbd}>D</kbd> move</span>
          <span style={{ opacity: 0.5 }}>·</span><span>drag to look</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#9fd4ff" }}><Icon name="check" size={14} /> collision on</span>
        </div>
        <div style={{ position: "absolute", top: 16, left: 16, padding: "7px 13px", background: "rgba(255,255,255,0.85)", borderRadius: 99, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="person" size={15} /> Eye height 1.65 m
        </div>
      </div>
    );
  }
  const kbd = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 5px", background: "rgba(255,255,255,0.16)", borderRadius: 5, fontSize: 11, fontFamily: "var(--mono)", border: "1px solid rgba(255,255,255,0.2)" };

  window.RoomDesignerApp = App;
})();
