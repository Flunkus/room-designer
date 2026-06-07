/* ===== Inspector — object + room/materials (ported from prototype panels.jsx) ===== */
import { useRef, useEffect, useState } from "react";
import { Icon, TYPE_ICON } from "./Icon";
import { useStore } from "../state/store";
import { NumField, Slider, Section, Stat, Toggle, inpStyle } from "./fields";
import { saveFurnitureToLibrary } from "../services/library";
import { putMesh } from "../services/meshStore";
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
  // "Save to My models": stash this object's model at its current size for reuse.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const onSaveToLibrary = async () => {
    setSaveState("saving");
    const ok = await saveFurnitureToLibrary(o).catch(() => false);
    setSaveState(ok ? "saved" : "error");
    setTimeout(() => setSaveState("idle"), 2200);
  };

  // Replace this object's box/model with an uploaded GLB (scaled to its current W×D×H).
  const modelInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [modelErr, setModelErr] = useState<string | null>(null);
  const onModelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setModelErr(null);
    if (!/\.(glb|gltf)$/i.test(f.name)) { setModelErr("Please choose a .glb or .gltf file."); return; }
    if (f.size > 75 * 1024 * 1024) { setModelErr("Model is too large (max 75 MB)."); return; }
    setUploading(true);
    try {
      const bytes = await f.arrayBuffer();
      const mime = f.name.toLowerCase().endsWith(".glb") ? "model/gltf-binary" : "model/gltf+json";
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      await putMesh(o.id, bytes, mime, f.name); // durable bytes keyed by this object's id
      s.setFurnitureMesh(o.id, url, "ready");
      s.patch(o.id, { meshStored: true, imageUrl: null, imageStored: false });
    } catch (err) {
      console.warn("[replace model] could not read file:", err);
      setModelErr("Could not read that model file.");
    } finally {
      setUploading(false);
    }
  };
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
          <NumField label="Z" value={o.localZ ?? 0} unit="cm" onChange={(v) => s.patch(o.id, { localZ: v })} />
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

      {!o.flat && !o.imageUrl && (
        <Section title="3D model">
          <p style={{ margin: "0 0 9px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
            {o.meshUrl ? "Replace this object's 3D model, or save it to reuse." : "Replace this box with a 3D model (.glb/.gltf) — it's scaled to fit the current W×D×H."}
          </p>
          <input ref={modelInput} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" style={{ display: "none" }} onChange={onModelFile} />
          <button className="btn" style={{ width: "100%" }} disabled={uploading} onClick={() => modelInput.current?.click()}>
            <Icon name="upload" size={15} /> {uploading ? "Loading model…" : o.meshUrl ? "Replace 3D model" : "Upload 3D model"}
          </button>
          {modelErr && <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>{modelErr}</div>}
          {o.meshUrl && (
            <button className="btn" style={{ width: "100%", marginTop: 8 }} disabled={saveState === "saving"} onClick={onSaveToLibrary}>
              <Icon name={saveState === "saved" ? "check" : "save"} size={15} />{" "}
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to My models" : saveState === "error" ? "Couldn't save — try again" : "Save to My models"}
            </button>
          )}
        </Section>
      )}

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
  const activeRoom = s.rooms.find((r) => r.id === s.activeRoomId) ?? null;
  const nameRef = useRef<HTMLInputElement>(null);

  // When a room is freshly created (drawn or added by size), focus its name for instant renaming.
  useEffect(() => {
    if (!s.focusRoomName) return;
    nameRef.current?.focus();
    nameRef.current?.select();
    useStore.getState().setFocusRoomName(false);
  }, [s.focusRoomName]);
  const poly = activeRoom?.polygon || [];
  const hasRoom = !!activeRoom && activeRoom.closed && poly.length >= 3;
  const a = (area(poly) / 10000).toFixed(1);   // m²
  const perim = (perimeter(poly) / 100).toFixed(1); // m
  const shape = shapeName(poly);

  if (!hasRoom) {
    const noRooms = s.rooms.length === 0;
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, gap: 4 }}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--panel-3)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", marginBottom: 10 }}><Icon name="grid" size={26} /></div>
        <div style={{ fontSize: 15, fontWeight: 650 }}>{noRooms ? "No rooms yet" : "Select a room"}</div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, margin: "2px 0 16px", maxWidth: 220 }}>{noRooms ? "Start with a rectangular starter room you can resize, or trace your own walls on the plan." : "Pick a room from the Objects panel, or add another."}</p>
        <button className="btn primary" style={{ width: "100%", maxWidth: 220 }} onClick={() => s.openModal("room")}><Icon name="plus" size={15} /> Add room by size</button>
        <button className="btn" style={{ width: "100%", maxWidth: 220 }} onClick={() => s.startDraw()}><Icon name="pen" size={15} /> {noRooms ? "Draw walls" : "Draw a room"}</button>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: -7 }}>
          <input ref={nameRef} value={activeRoom.name || ""} onChange={(e) => s.renameRoom(activeRoom.id, e.target.value)} placeholder="Room name" title="Click to rename this room"
            style={{ flex: 1, minWidth: 0, border: "1px solid transparent", borderRadius: 6, background: "transparent", font: "inherit", fontSize: 15, fontWeight: 650, color: "var(--text)", outline: "none", padding: "2px 7px", transition: "background .12s, border-color .12s" }}
            onFocus={(e) => { e.currentTarget.style.background = "var(--panel-3)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onBlur={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
            onMouseEnter={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = "var(--panel-3)"; }}
            onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.background = "transparent"; }} />
          <button className="icon-btn" style={{ width: 26, height: 26, flexShrink: 0 }} title="Rename room" onClick={() => { nameRef.current?.focus(); nameRef.current?.select(); }}><Icon name="pen" size={13} /></button>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, marginLeft: -1 }}>{shape} · {s.houseName}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Stat label="Floor area" value={a + " m²"} />
          <Stat label="Perimeter" value={perim + " m"} />
          <Stat label="Wall ht" value={(s.wallHeight / 100).toFixed(2) + " m"} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => s.redrawRoom(activeRoom.id)}><Icon name="pen" size={14} /> Redraw walls</button>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => s.openModal("room")}><Icon name="plus" size={14} /> Add room</button>
        </div>
        <button className="btn sm" style={{ width: "100%", marginTop: 8, color: "var(--danger)" }}
          onClick={() => { if (confirm(`Delete "${activeRoom.name}" and its furniture?`)) s.removeRoom(activeRoom.id); }}><Icon name="trash" size={14} /> Delete room</button>
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

      <Section title="Wall images">
        <p style={{ margin: "0 0 9px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>Apply a photo to a wall — a window view, mural or artwork. Click below, then click the wall on the plan.</p>
        <button className="btn sm" style={{ width: "100%" }} onClick={() => { s.setPendingWallImage(true); s.setMode("2d"); }}>
          <Icon name="image" size={14} /> Add image to a wall
        </button>
        {s.pendingWallImage && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--accent-600)" }}>Now click a wall on the plan…</div>}
        {s.wallImages.filter((w) => w.roomId === activeRoom.id).map((wi) => (
          <div key={wi.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {wi.url && <div style={{ width: 36, height: 27, borderRadius: 4, background: `var(--panel-3) url(${wi.url}) center/cover`, border: "1px solid var(--border-strong)", flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wi.name || "Image"}</div>
              <button className="icon-btn" style={{ width: 24, height: 24, color: "var(--danger)", flexShrink: 0 }} title="Remove image" onClick={() => s.removeWallImage(wi.id)}><Icon name="trash" size={13} /></button>
            </div>
            <select value={wi.wall} onChange={(e) => s.patchWallImage(wi.id, { wall: Number(e.target.value) })} style={{ ...inpStyle, padding: "0 8px", marginBottom: 8 }}>
              {poly.map((_, i) => <option key={i} value={i}>Wall {i + 1}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <NumField label="W" value={wi.width} unit="cm" onChange={(v) => s.patchWallImage(wi.id, { width: Math.max(10, v) })} />
              <NumField label="H" value={wi.height} unit="cm" onChange={(v) => s.patchWallImage(wi.id, { height: Math.max(10, v) })} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <NumField label="Along" value={wi.offset} unit="cm" onChange={(v) => s.patchWallImage(wi.id, { offset: Math.max(0, v) })} />
              <NumField label="Sill" value={wi.sill} unit="cm" onChange={(v) => s.patchWallImage(wi.id, { sill: Math.max(0, v) })} />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Verification">
        <Toggle label="Clearance zones" sub="60 cm walking border" on={s.showClearance} onClick={() => s.toggle("showClearance")} />
        <Toggle label="Human proxy" sub={`${s.proxy.w ?? 60} × ${s.proxy.d ?? 40} × ${s.proxy.h ?? 180} cm dummy`} on={s.showProxy} onClick={() => s.toggle("showProxy")} />
        {s.showProxy && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <NumField label="W" value={s.proxy.w ?? 60} unit="cm" onChange={(v) => s.setProxy({ w: Math.max(10, v) })} />
            <NumField label="D" value={s.proxy.d ?? 40} unit="cm" onChange={(v) => s.setProxy({ d: Math.max(10, v) })} />
            <NumField label="H" value={s.proxy.h ?? 180} unit="cm" onChange={(v) => s.setProxy({ h: Math.max(10, v) })} />
          </div>
        )}
      </Section>
    </div>
  );
}
