/* ===== Panels — tool rail, objects list, inspector ===== */
(function () {
  const { useState } = React;
  const G = window.GEO;

  /* ---------- small field controls ---------- */
  function NumField({ label, value, unit, onChange, step, w }) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: w || 1 }}>
        <span className="label-xs">{label}</span>
        <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input className="mono" type="number" value={Math.round(value)} step={step || 1}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            style={inpStyle} />
          {unit && <span className="mono" style={{ position: "absolute", right: 9, fontSize: 11, color: "var(--text-3)", pointerEvents: "none" }}>{unit}</span>}
        </span>
      </label>
    );
  }
  const inpStyle = { width: "100%", height: 34, padding: "0 26px 0 10px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--panel)", color: "var(--text)", fontSize: 13, outline: "none" };

  function Slider({ label, value, min, max, step, unit, onChange }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="label-xs">{label}</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{value}{unit}</span>
        </div>
        <input type="range" min={min} max={max} step={step || 1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
      </div>
    );
  }

  function Section({ title, children, right }) {
    return (
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="label-xs">{title}</span>{right}
        </div>
        {children}
      </div>
    );
  }

  /* ---------- Tool rail ---------- */
  function ToolRail({ S, A, mode }) {
    const Tool = ({ name, icon, tip, active, onClick }) => (
      <button className={"icon-btn" + (active ? " active" : "")} title={tip} onClick={onClick}><Icon name={icon} /></button>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", background: "var(--panel)", borderRight: "1px solid var(--border)" }}>
        <Tool name="select" icon="select" tip="Select & move (V)" active={S.tool === "select"} onClick={() => A.setTool("select")} />
        <Tool name="draw" icon="pen" tip="Draw room (P)" active={S.tool === "draw"} onClick={() => A.startDraw()} />
        <Tool name="pan" icon="hand" tip="Pan — or hold Space / middle-drag (H)" active={S.tool === "pan"} onClick={() => A.setTool("pan")} />
        <hr className="divider" style={{ width: 22, margin: "6px 0" }} />
        <Tool name="add" icon="plus" tip="Add furniture" active={S.modal === "furniture"} onClick={() => A.openModal("furniture")} />
        <Tool name="mat" icon="swatch" tip="Materials" active={S.inspectorTab === "materials"} onClick={() => { A.select(null); A.setInspectorTab("materials"); }} />
        <Tool name="measure" icon="ruler" tip="Measure" active={S.tool === "measure"} onClick={() => A.setTool("measure")} />
        <hr className="divider" style={{ width: 22, margin: "6px 0" }} />
        <Tool name="clear" icon="clearance" tip="Clearance zones (60cm)" active={S.showClearance} onClick={() => A.toggle("showClearance")} />
        <Tool name="proxy" icon="person" tip="Human proxy" active={S.showProxy} onClick={() => A.toggle("showProxy")} />
      </div>
    );
  }

  /* ---------- Objects / layers ---------- */
  function roomStats(S) {
    const poly = S.room.polygon || [];
    const closed = S.room.closed && poly.length >= 3;
    return {
      closed,
      name: S.room.name || "Room",
      shape: G.shapeName(poly),
      area: (G.area(poly) / 10000).toFixed(1), // cm² → m²
    };
  }

  function GroupLabel({ children, right }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 8px 5px" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)" }}>{children}</span>
        {right}
      </div>
    );
  }

  function ObjectsPanel({ S, A }) {
    const r = roomStats(S);
    const roomActive = !S.selectedId && (S.inspectorTab === "room" || S.inspectorTab === "materials");
    const tops = S.furniture.filter((o) => !o.parent);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--panel)" }}>
        <div style={{ padding: "13px 16px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 650, fontSize: 13.5 }}>Objects</span>
          <span className="tag gray">{S.furniture.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px 16px" }}>
          <GroupLabel>Room</GroupLabel>
          {r.closed ? (
            <div onClick={() => { A.select(null); A.setInspectorTab("room"); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: "var(--r-sm)", cursor: "pointer",
                background: roomActive ? "var(--accent-soft)" : "var(--panel-3)",
                border: "1px solid " + (roomActive ? "var(--accent)" : "var(--border)"),
              }}
              onMouseEnter={(e) => { if (!roomActive) e.currentTarget.style.borderColor = "var(--border-strong)"; }}
              onMouseLeave={(e) => { if (!roomActive) e.currentTarget.style.borderColor = "var(--border)"; }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: roomActive ? "var(--accent)" : "var(--panel)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: roomActive ? "#fff" : "var(--text-2)", flexShrink: 0 }}>
                <Icon name="grid" size={17} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: roomActive ? "var(--accent-600)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--text-3)" }}>{r.shape} · {r.area} m²</span>
              </span>
              <button className="icon-btn" style={{ width: 26, height: 26 }} title="Redraw walls" onClick={(e) => { e.stopPropagation(); A.startDraw(); }}><Icon name="pen" size={14} /></button>
            </div>
          ) : (
            <div style={{ padding: "16px 14px", textAlign: "center", border: "1.5px dashed var(--border-strong)", borderRadius: "var(--r)", background: "var(--panel-3)" }}>
              <div style={{ color: "var(--text-3)", display: "flex", justifyContent: "center", marginBottom: 8 }}><Icon name="grid" size={22} /></div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>No room yet</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.45, marginBottom: 11 }}>Add a starter room, or trace your own walls.</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn primary sm" style={{ flex: 1 }} onClick={() => A.starterRoom()}><Icon name="plus" size={14} /> Starter room</button>
                <button className="btn sm" style={{ flex: 1 }} onClick={() => A.startDraw()}><Icon name="pen" size={14} /> Draw</button>
              </div>
            </div>
          )}

          <GroupLabel right={<span className="tag gray" style={{ fontSize: 10 }}>{tops.length}</span>}>Furniture</GroupLabel>
          {tops.length ? tops.map((o) => (
            <ObjRow key={o.id} o={o} S={S} A={A} all={S.furniture} depth={0} />
          )) : (
            <div style={{ padding: "10px 10px 6px", fontSize: 11.5, color: "var(--text-3)" }}>Nothing placed yet.</div>
          )}
        </div>
        <button className="btn ghost" style={{ margin: 10, justifyContent: "flex-start" }} onClick={() => A.openModal("furniture")}>
          <Icon name="plus" size={16} /> Add furniture
        </button>
      </div>
    );
  }
  function ObjRow({ o, S, A, all, depth }) {
    const children = all.filter((f) => f.parent === o.id);
    return (
      <>
        <Row icon={TYPE_ICON[o.type] || "box"} name={o.name} sub={o.status === "generating" ? "Generating…" : `${Math.round(o.w)}×${Math.round(o.d)}×${Math.round(o.h)}`}
          active={S.selectedId === o.id} depth={depth} onClick={() => A.select(o.id)}
          hidden={o.hidden} loading={o.status === "generating"}
          right={
            <span style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" style={{ width: 26, height: 26 }} title={o.hidden ? "Show" : "Hide"} onClick={() => A.patch(o.id, { hidden: !o.hidden })}><Icon name={o.hidden ? "eyeOff" : "eye"} size={15} /></button>
            </span>
          } />
        {children.map((c) => <ObjRow key={c.id} o={c} S={S} A={A} all={all} depth={depth + 1} />)}
      </>
    );
  }
  function Row({ icon, name, sub, active, onClick, right, depth, faded, hidden, loading }) {
    return (
      <div onClick={onClick} style={{
        display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", paddingLeft: 8 + (depth || 0) * 18,
        borderRadius: "var(--r-sm)", cursor: "pointer", marginBottom: 1,
        background: active ? "var(--accent-soft)" : "transparent", opacity: hidden ? 0.45 : 1,
      }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--panel-3)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
        {depth > 0 && <Icon name="link" size={13} />}
        <span style={{ color: active ? "var(--accent-600)" : "var(--text-2)", display: "flex" }}>
          {loading ? <span className="spin-ic"><Icon name="settings" size={16} /></span> : <Icon name={icon} size={16} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: faded ? 600 : 500, color: active ? "var(--accent-600)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          {sub && <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--text-3)" }}>{sub}</span>}
        </span>
        {right}
      </div>
    );
  }

  /* ---------- Inspector ---------- */
  function Inspector({ S, A }) {
    const o = S.furniture.find((f) => f.id === S.selectedId);
    if (o) return <ObjInspector o={o} S={S} A={A} />;
    return <RoomInspector S={S} A={A} />;
  }

  function ObjInspector({ o, S, A }) {
    const parents = S.furniture.filter((f) => f.id !== o.id && !f.parent && !f.flat);
    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--panel-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}><Icon name={TYPE_ICON[o.type] || "box"} size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input value={o.name} onChange={(e) => A.patch(o.id, { name: e.target.value })} style={{ width: "100%", border: "none", background: "transparent", font: "inherit", fontSize: 15, fontWeight: 650, color: "var(--text)", outline: "none", padding: 0 }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{o.type}</span>
            </div>
            {o.status === "generating" && <span className="tag amber"><span className="spin-ic" style={{ display: "flex" }}><Icon name="settings" size={12} /></span> Gen</span>}
          </div>
        </div>

        <Section title="Dimensions (scales mesh to fit)">
          <div style={{ display: "flex", gap: 8 }}>
            <NumField label="W" value={o.w} unit="cm" onChange={(v) => A.patch(o.id, { w: Math.max(5, v) })} />
            <NumField label="D" value={o.d} unit="cm" onChange={(v) => A.patch(o.id, { d: Math.max(5, v) })} />
            <NumField label="H" value={o.h} unit="cm" onChange={(v) => A.patch(o.id, { h: Math.max(2, v) })} />
          </div>
        </Section>

        <Section title="Transform">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <NumField label="X" value={o.x} unit="cm" onChange={(v) => A.moveFurniture(o.id, { x: v })} />
            <NumField label="Y" value={o.y} unit="cm" onChange={(v) => A.moveFurniture(o.id, { y: v })} />
          </div>
          <Slider label="Rotation" value={Math.round(o.rot || 0)} min={0} max={345} step={15} unit="°" onChange={(v) => A.moveFurniture(o.id, { rot: v })} />
        </Section>

        <Section title="Nesting (scene graph)">
          <p style={{ margin: "0 0 9px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>Bind to a parent so its coordinates follow the parent, not the floor.</p>
          <select value={o.parent || ""} onChange={(e) => A.patch(o.id, { parent: e.target.value || null })} style={{ ...inpStyle, padding: "0 10px", paddingRight: 10 }}>
            <option value="">Floor (no parent)</option>
            {parents.map((p) => <option key={p.id} value={p.id}>On: {p.name}</option>)}
          </select>
        </Section>

        <Section title="Appearance">
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {["#8a98a6", "#b88a55", "#3b3b40", "#b08968", "#e8e4dc", "#4c7a4c", "#c9c4ba", "#a87a4a"].map((c) => (
              <button key={c} onClick={() => A.patch(o.id, { color: c })} style={{ width: 28, height: 28, borderRadius: 7, background: c, border: o.color === c ? "2px solid var(--accent)" : "1px solid var(--border-strong)", cursor: "pointer", outline: o.color === c ? "2px solid var(--accent-soft)" : "none" }} />
            ))}
          </div>
        </Section>

        <div style={{ display: "flex", gap: 8, padding: 16 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => A.duplicate(o.id)}><Icon name="copy" size={15} /> Duplicate</button>
          <button className="btn" style={{ color: "var(--danger)", flex: 1 }} onClick={() => A.remove(o.id)}><Icon name="trash" size={15} /> Delete</button>
        </div>
      </div>
    );
  }

  function MaterialControls({ m, onChange }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <Slider label="Texture scale" value={m.scale} min={20} max={300} unit=" cm" onChange={(v) => onChange({ scale: v })} />
        <Slider label="Rotation" value={m.rotation} min={0} max={360} unit="°" onChange={(v) => onChange({ rotation: v })} />
        <Slider label="Roughness" value={Math.round(m.roughness * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ roughness: v / 100 })} />
      </div>
    );
  }

  function RoomInspector({ S, A }) {
    const [tab, setTab] = useState("walls");
    const m = window.MATERIALS;
    const poly = S.room.polygon || [];
    const hasRoom = S.room.closed && poly.length >= 3;
    const area = (G.area(poly) / 10000).toFixed(1);   // m²
    const perim = (G.perimeter(poly) / 100).toFixed(1); // m
    const shape = G.shapeName(poly);

    if (!hasRoom) {
      return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, gap: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--panel-3)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", marginBottom: 10 }}><Icon name="grid" size={26} /></div>
          <div style={{ fontSize: 15, fontWeight: 650 }}>No room yet</div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: "2px 0 16px", maxWidth: 220 }}>Start with a rectangular starter room you can resize, or trace your own walls on the plan.</p>
          <button className="btn primary" style={{ width: "100%", maxWidth: 220 }} onClick={() => A.starterRoom()}><Icon name="plus" size={15} /> Create starter room</button>
          <button className="btn" style={{ width: "100%", maxWidth: 220 }} onClick={() => A.startDraw()}><Icon name="pen" size={15} /> Draw walls</button>
        </div>
      );
    }

    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
          <input value={S.room.name || ""} onChange={(e) => A.renameRoom(e.target.value)} placeholder="Room name"
            style={{ width: "100%", border: "none", background: "transparent", font: "inherit", fontSize: 15, fontWeight: 650, color: "var(--text)", outline: "none", padding: 0 }} />
          <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{shape} · Berowra residence</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Stat label="Floor area" value={area + " m²"} />
            <Stat label="Perimeter" value={perim + " m"} />
            <Stat label="Wall ht" value="2.70 m" />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => A.startDraw()}><Icon name="pen" size={14} /> Redraw walls</button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => { if (confirm("Start a new, empty room? This clears all furniture.")) A.newRoom(); }}><Icon name="plus" size={14} /> New room</button>
          </div>
        </div>

        <Section title="Materials">
          <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "var(--panel-3)", padding: 3, borderRadius: 8 }}>
            {["walls", "floor"].map((k) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, height: 30, border: "none", borderRadius: 6, background: tab === k ? "var(--panel)" : "transparent", boxShadow: tab === k ? "var(--sh-1)" : "none", fontSize: 12.5, fontWeight: 600, color: tab === k ? "var(--text)" : "var(--text-2)", cursor: "pointer", textTransform: "capitalize" }}>{k}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 9, background: m[tab].base, border: "1px solid var(--border-strong)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m[tab].name}</div>
              <span className={"tag " + (m[tab].source === "ai" ? "blue" : "gray")} style={{ marginTop: 4 }}>
                {m[tab].source === "ai" ? <><Icon name="sparkle" size={11} /> AI texture</> : "PBR set"}
              </span>
            </div>
          </div>
          <MaterialControls m={m[tab]} onChange={(p) => A.patchMaterial(tab, p)} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => A.openModal("texture")}><Icon name="sparkle" size={14} /> Generate</button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => A.openModal("texture")}><Icon name="upload" size={14} /> Upload maps</button>
          </div>
        </Section>

        <Section title="Verification">
          <Toggle label="Clearance zones" sub="60 cm walking border" on={S.showClearance} onClick={() => A.toggle("showClearance")} />
          <Toggle label="Human proxy" sub="60 × 40 × 180 cm dummy" on={S.showProxy} onClick={() => A.toggle("showProxy")} />
        </Section>
      </div>
    );
  }

  function Stat({ label, value }) {
    return (
      <div style={{ flex: 1, background: "var(--panel-3)", borderRadius: 8, padding: "9px 10px" }}>
        <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>{label}</div>
      </div>
    );
  }
  function Toggle({ label, sub, on, onClick }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 540 }}>{label}</div>
          {sub && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{sub}</div>}
        </div>
        <button onClick={onClick} style={{ width: 40, height: 23, borderRadius: 99, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--border-strong)", position: "relative", transition: "background .15s" }}>
          <span style={{ position: "absolute", top: 2, left: on ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "var(--sh-1)", transition: "left .15s" }} />
        </button>
      </div>
    );
  }

  Object.assign(window, { ToolRail, ObjectsPanel, Inspector, Section, Slider, NumField, Toggle });
})();
