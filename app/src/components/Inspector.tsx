/* ===== Inspector — object + room/materials (ported from prototype panels.jsx) ===== */
import { Icon, TYPE_ICON } from "./Icon";
import { useStore } from "../state/store";
import { NumField, Slider, Section, Stat, Toggle, inpStyle } from "./fields";
import { area, perimeter, shapeName } from "../domain/geometry";
import type { Furniture, Material, MaterialKey } from "../domain/types";

export function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  const o = useStore((s) => s.furniture.find((f) => f.id === selectedId));
  if (o) return <ObjInspector o={o} />;
  return <RoomInspector />;
}

function ObjInspector({ o }: { o: Furniture }) {
  const s = useStore();
  const parents = s.furniture.filter((f) => f.id !== o.id && !f.parent && !f.flat);
  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--panel-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}><Icon name={TYPE_ICON[o.type] || "box"} size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={o.name} onChange={(e) => s.patch(o.id, { name: e.target.value })} style={{ width: "100%", border: "none", background: "transparent", font: "inherit", fontSize: 15, fontWeight: 650, color: "var(--text)", outline: "none", padding: 0 }} />
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{o.type}</span>
          </div>
          {o.status === "generating" && <span className="tag amber"><span className="spin-ic" style={{ display: "flex" }}><Icon name="settings" size={12} /></span> Gen</span>}
        </div>
      </div>

      <Section title="Dimensions (scales mesh to fit)">
        <div style={{ display: "flex", gap: 8 }}>
          <NumField label="W" value={o.w} unit="cm" onChange={(v) => s.patch(o.id, { w: Math.max(5, v) })} />
          <NumField label="D" value={o.d} unit="cm" onChange={(v) => s.patch(o.id, { d: Math.max(5, v) })} />
          <NumField label="H" value={o.h} unit="cm" onChange={(v) => s.patch(o.id, { h: Math.max(2, v) })} />
        </div>
      </Section>

      <Section title="Transform">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <NumField label="X" value={o.x} unit="cm" onChange={(v) => s.moveFurniture(o.id, { x: v })} />
          <NumField label="Y" value={o.y} unit="cm" onChange={(v) => s.moveFurniture(o.id, { y: v })} />
        </div>
        <Slider label="Rotation" value={Math.round(o.rot || 0)} min={0} max={345} step={15} unit="°" onChange={(v) => s.moveFurniture(o.id, { rot: v })} />
      </Section>

      <Section title="Nesting (scene graph)">
        <p style={{ margin: "0 0 9px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>Bind to a parent so its coordinates follow the parent, not the floor.</p>
        <select value={o.parent || ""} onChange={(e) => s.patch(o.id, { parent: e.target.value || null })} style={{ ...inpStyle, padding: "0 10px" }}>
          <option value="">Floor (no parent)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>On: {p.name}</option>)}
        </select>
      </Section>

      <Section title="Appearance">
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {["#8a98a6", "#b88a55", "#3b3b40", "#b08968", "#e8e4dc", "#4c7a4c", "#c9c4ba", "#a87a4a"].map((c) => (
            <button key={c} onClick={() => s.patch(o.id, { color: c })} style={{ width: 28, height: 28, borderRadius: 7, background: c, border: o.color === c ? "2px solid var(--accent)" : "1px solid var(--border-strong)", cursor: "pointer", outline: o.color === c ? "2px solid var(--accent-soft)" : "none" }} />
          ))}
        </div>
      </Section>

      <div style={{ display: "flex", gap: 8, padding: 16 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => s.duplicate(o.id)}><Icon name="copy" size={15} /> Duplicate</button>
        <button className="btn" style={{ color: "var(--danger)", flex: 1 }} onClick={() => s.remove(o.id)}><Icon name="trash" size={15} /> Delete</button>
      </div>
    </div>
  );
}

function MaterialControls({ m, onChange }: { m: Material; onChange: (p: Partial<Material>) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Slider label="Texture scale" value={m.scale} min={20} max={300} unit=" cm" onChange={(v) => onChange({ scale: v })} />
      <Slider label="Rotation" value={m.rotation} min={0} max={360} unit="°" onChange={(v) => onChange({ rotation: v })} />
      <Slider label="Roughness" value={Math.round(m.roughness * 100)} min={0} max={100} unit="%" onChange={(v) => onChange({ roughness: v / 100 })} />
    </div>
  );
}

function RoomInspector() {
  const s = useStore();
  const tab = s.materialTarget;
  const setTab = s.setMaterialTarget;
  const m = s.materials;
  const poly = s.room.polygon || [];
  const hasRoom = s.room.closed && poly.length >= 3;
  const a = (area(poly) / 10000).toFixed(1);   // m²
  const perim = (perimeter(poly) / 100).toFixed(1); // m
  const shape = shapeName(poly);

  if (!hasRoom) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, gap: 4 }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--panel-3)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", marginBottom: 10 }}><Icon name="grid" size={26} /></div>
        <div style={{ fontSize: 15, fontWeight: 650 }}>No room yet</div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: "2px 0 16px", maxWidth: 220 }}>Start with a rectangular starter room you can resize, or trace your own walls on the plan.</p>
        <button className="btn primary" style={{ width: "100%", maxWidth: 220 }} onClick={() => s.starterRoom()}><Icon name="plus" size={15} /> Create starter room</button>
        <button className="btn" style={{ width: "100%", maxWidth: 220 }} onClick={() => s.startDraw()}><Icon name="pen" size={15} /> Draw walls</button>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <input value={s.room.name || ""} onChange={(e) => s.renameRoom(e.target.value)} placeholder="Room name"
          style={{ width: "100%", border: "none", background: "transparent", font: "inherit", fontSize: 15, fontWeight: 650, color: "var(--text)", outline: "none", padding: 0 }} />
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{shape} · Berowra residence</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Stat label="Floor area" value={a + " m²"} />
          <Stat label="Perimeter" value={perim + " m"} />
          <Stat label="Wall ht" value={(s.wallHeight / 100).toFixed(2) + " m"} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => s.startDraw()}><Icon name="pen" size={14} /> Redraw walls</button>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => { if (confirm("Start a new, empty room? This clears all furniture.")) s.newRoom(); }}><Icon name="plus" size={14} /> New room</button>
        </div>
      </div>

      <Section title="Materials">
        <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "var(--panel-3)", padding: 3, borderRadius: 8 }}>
          {(["walls", "floor"] as MaterialKey[]).map((k) => (
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
        <MaterialControls m={m[tab]} onChange={(p) => s.patchMaterial(tab, p)} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => s.openModal("texture")}><Icon name="sparkle" size={14} /> Generate</button>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => s.openModal("texture")}><Icon name="upload" size={14} /> Upload maps</button>
        </div>
      </Section>

      <Section title="Verification">
        <Toggle label="Clearance zones" sub="60 cm walking border" on={s.showClearance} onClick={() => s.toggle("showClearance")} />
        <Toggle label="Human proxy" sub="60 × 40 × 180 cm dummy" on={s.showProxy} onClick={() => s.toggle("showProxy")} />
      </Section>
    </div>
  );
}
