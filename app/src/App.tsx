/* ===== Roomscale — app shell, A/B layout directions (ported from prototype app.jsx) ===== */
import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Icon, type IconName } from "./components/Icon";
import { useStore } from "./state/store";
import { shade } from "./domain/geometry";
import { useTweaks, TweaksPanel, type Tweaks } from "./components/Tweaks";
import { ToolRail } from "./components/ToolRail";
import { ObjectsPanel } from "./components/ObjectsPanel";
import { Inspector } from "./components/Inspector";
import { Canvas2D } from "./canvas2d/Canvas2D";
import { FurnitureModal, TextureModal, RoomModal } from "./components/Modals";
import type { ViewMode } from "./domain/types";

// Code-split the 3D engine (three/drei/rapier) so the 2D editor loads fast and
// the heavy 3D bundle is fetched only when 3D / Walk is first opened.
const SceneRoot = lazy(() => import("./three/SceneRoot").then((m) => ({ default: m.SceneRoot })));
const Walkthrough = lazy(() => import("./three/Walkthrough").then((m) => ({ default: m.Walkthrough })));

function StageLoading({ label }: { label: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-3)", background: "linear-gradient(180deg,#eef0f2,#e4e6e9)" }}>
      <span className="spin-ic" style={{ display: "flex" }}><Icon name="settings" size={26} /></span>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export function App() {
  const [t, setTweak] = useTweaks();

  // Rebuild blob URLs for uploaded / cached models whose bytes live in IndexedDB (once on load).
  useEffect(() => { useStore.getState().rehydrateMeshes(); }, []);

  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", t.accent);
    r.setProperty("--accent-600", shade(t.accent, 0.85));
    r.setProperty("--accent-soft", t.accent + "20");
    r.setProperty("--space", t.density === "compact" ? "0.8" : "1");
  }, [t]);

  const modal = useStore((s) => s.modal);
  const closeModal = useStore((s) => s.closeModal);

  return (
    <div className="app" style={{ gridTemplateRows: "auto 1fr" }}>
      <TopBar dir={t.direction} />
      {t.direction === "A" ? <LayoutA tweaks={t} /> : <LayoutB tweaks={t} />}
      {modal === "furniture" && <FurnitureModal onClose={closeModal} />}
      {modal === "texture" && <TextureModal onClose={closeModal} />}
      {modal === "room" && <RoomModal onClose={closeModal} />}
      <TweaksPanel t={t} setTweak={setTweak} />
    </div>
  );
}

function ModeButton({ id, icon, label, mode, setMode }: { id: ViewMode; icon: IconName; label: string; mode: ViewMode; setMode: (m: ViewMode) => void }) {
  return (
    <button className={"pill" + (mode === id ? " active" : "")} onClick={() => setMode(id)} style={{ height: 32 }}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );
}

function HouseMenu() {
  const rooms = useStore((s) => s.rooms);
  const activeRoomId = useStore((s) => s.activeRoomId);
  const selectRoom = useStore((s) => s.selectRoom);
  const startDraw = useStore((s) => s.startDraw);
  const newHouse = useStore((s) => s.newHouse);
  const openModal = useStore((s) => s.openModal);
  const [open, setOpen] = useState(false);
  const active = rooms.find((r) => r.id === activeRoomId);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const item: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", border: "none", background: "transparent", borderRadius: "var(--r-sm)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--text)", textAlign: "left" };

  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button className="btn ghost sm" onClick={() => setOpen((o) => !o)} style={{ gap: 7 }} title="House & rooms">
        <Icon name="layers" size={15} />
        <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rooms.length ? (active?.name ?? "House") : "New house"}</span>
        <span className="tag gray">{rooms.length}</span>
        <Icon name="chevron" size={13} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 248, background: "var(--panel)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-3)", border: "1px solid var(--border)", zIndex: 40, padding: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)", padding: "6px 10px 4px" }}>Rooms</div>
          {rooms.length ? rooms.map((r) => {
            const on = r.id === activeRoomId;
            return (
              <button key={r.id} onClick={() => { selectRoom(r.id); setOpen(false); }}
                style={{ ...item, background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent-600)" : "var(--text)" }}>
                <Icon name="grid" size={15} /><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                {on && <Icon name="check" size={15} />}
              </button>
            );
          }) : <div style={{ padding: "4px 10px 8px", fontSize: 12, color: "var(--text-3)" }}>No rooms yet.</div>}
          <hr className="divider" style={{ margin: "6px 4px" }} />
          <button onClick={() => { startDraw(); setOpen(false); }} style={item}><Icon name="pen" size={15} /> Draw a room</button>
          <button onClick={() => { openModal("room"); setOpen(false); }} style={item}><Icon name="plus" size={15} /> Rectangular room…</button>
          <button onClick={() => { if (confirm("Start a new, empty house? This clears all rooms and furniture.")) { newHouse(); setOpen(false); } }} style={{ ...item, color: "var(--danger)" }}><Icon name="trash" size={15} /> New house</button>
        </div>
      )}
    </div>
  );
}

/** Editable name of the whole house/project — click to rename; persists with the scene. */
function HouseNameField() {
  const houseName = useStore((s) => s.houseName);
  const setHouseName = useStore((s) => s.setHouseName);
  return (
    <input
      value={houseName}
      onChange={(e) => setHouseName(e.target.value)}
      placeholder="Untitled house"
      title="Name of this house — click to rename"
      style={{ marginLeft: 2, maxWidth: 200, border: "1px solid transparent", borderRadius: 7, background: "var(--panel-3)", font: "inherit", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", padding: "3px 9px", outline: "none", transition: "background .12s, border-color .12s" }}
      onFocus={(e) => { e.currentTarget.style.background = "var(--panel)"; e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text)"; e.currentTarget.select(); }}
      onBlur={(e) => { e.currentTarget.style.background = "var(--panel-3)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-2)"; if (!e.currentTarget.value.trim()) setHouseName("Untitled house"); }}
    />
  );
}

function TopBar({ dir }: { dir: "A" | "B" }) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const fit = useStore((s) => s.fit);
  const rooms = useStore((s) => s.rooms);
  const activeRoomId = useStore((s) => s.activeRoomId);
  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  // The scene auto-saves to this browser on every change (Zustand persist); Save just confirms it.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSave = () => {
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1800);
  };
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 14, height: 56, padding: "0 14px", background: "var(--panel)", borderBottom: "1px solid var(--border)", zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="cube3d" size={17} /></div>
        <div style={{ fontWeight: 720, fontSize: 15, letterSpacing: "-0.01em" }}>Roomscale</div>
        <HouseNameField />
      </div>
      <div style={{ width: 1, height: 24, background: "var(--border)" }} />
      <HouseMenu />
      <div style={{ display: "flex", gap: 4 }}>
        <button className="icon-btn" title="Undo"><Icon name="undo" size={17} /></button>
        <button className="icon-btn" title="Redo"><Icon name="redo" size={17} /></button>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {dir === "A" ? (
          <div style={{ display: "flex", gap: 6, background: "var(--panel-3)", padding: 4, borderRadius: 99 }}>
            <ModeButton id="2d" icon="plan2d" label="Plan" mode={mode} setMode={setMode} />
            <ModeButton id="3d" icon="cube3d" label="3D" mode={mode} setMode={setMode} />
            <ModeButton id="walk" icon="walk" label="Walk" mode={mode} setMode={setMode} />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 12 }}>{rooms.length ? `${rooms.length} room${rooms.length > 1 ? "s" : ""}${activeRoom ? ` · ${activeRoom.name}` : ""}` : "No rooms"}</span>
            <span style={{ color: "var(--text-3)" }}>·</span>
            <span>autosaved</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn ghost sm" onClick={fit} title="Fit view"><Icon name="fit" size={16} /></button>
        <button className="btn sm" onClick={onSave} title="Your design auto-saves to this browser"
          style={saved ? { color: "var(--good, #15803d)", borderColor: "var(--good, #15803d)" } : undefined}>
          <Icon name={saved ? "check" : "save"} size={15} /> {saved ? "Saved" : "Save"}
        </button>
      </div>
    </header>
  );
}

function LayoutA({ tweaks }: { tweaks: Tweaks }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "52px 232px 1fr 304px", minHeight: 0 }}>
      <ToolRail />
      <div style={{ borderRight: "1px solid var(--border)", minHeight: 0 }}>
        <ObjectsPanel />
      </div>
      <Stage tweaks={tweaks} />
      <aside style={{ borderLeft: "1px solid var(--border)", background: "var(--panel)", minHeight: 0 }}>
        <Inspector />
      </aside>
    </div>
  );
}

function LayoutB({ tweaks }: { tweaks: Tweaks }) {
  const [objOpen, setObjOpen] = useState(true);
  const s = useStore();
  return (
    <div style={{ position: "relative", height: "100%", minHeight: 0 }}>
      <Stage tweaks={tweaks} bare />
      <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, padding: 6, background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-2)", zIndex: 12 }}>
        {([["2d", "plan2d", "Plan"], ["3d", "orbit", "Orbit"], ["walk", "walk", "Walk"]] as [ViewMode, IconName, string][]).map(([id, ic, label]) => (
          <button key={id} className={"icon-btn" + (s.mode === id ? " active" : "")} title={label} onClick={() => s.setMode(id)} style={{ width: 42, height: 42, borderRadius: 99 }}><Icon name={ic} size={19} /></button>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 3, padding: 5, background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-2)", zIndex: 12 }}>
        {([["select", "select", "Select"], ["draw", "pen", "Draw"], ["pan", "hand", "Pan — or hold Space"]] as ["select" | "draw" | "pan", IconName, string][]).map(([tool, ic, label]) => (
          <button key={tool} className={"icon-btn" + (s.tool === tool ? " active" : "")} title={label} onClick={() => tool === "draw" ? s.startDraw() : s.setTool(tool)}><Icon name={ic} /></button>
        ))}
        <hr style={{ width: 1, height: 22, background: "var(--border)", border: 0, margin: "0 3px", alignSelf: "center" }} />
        <button className="icon-btn" title="Add furniture" onClick={() => s.openModal("furniture")}><Icon name="plus" /></button>
        <button className={"icon-btn" + (s.showClearance ? " active" : "")} title="Clearance" onClick={() => s.toggle("showClearance")}><Icon name="clearance" /></button>
        <button className={"icon-btn" + (s.showProxy ? " active" : "")} title="Human proxy" onClick={() => s.toggle("showProxy")}><Icon name="person" /></button>
      </div>
      <div style={{ position: "absolute", left: 74, top: 16, width: 224, maxHeight: "calc(100% - 32px)", background: "var(--panel)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-2)", overflow: "hidden", display: "flex", flexDirection: "column", zIndex: 11 }}>
        <button onClick={() => setObjOpen(!objOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", width: "100%" }}>
          <Icon name="layers" size={16} /><span style={{ fontWeight: 650, fontSize: 13.5, flex: 1, textAlign: "left" }}>Objects</span>
          <span style={{ transform: objOpen ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--text-3)" }}><Icon name="chevron" size={15} /></span>
        </button>
        {objOpen && <div style={{ borderTop: "1px solid var(--border)", overflow: "hidden", flex: 1, minHeight: 0, display: "flex" }}><ObjectsPanel /></div>}
      </div>
      <div style={{ position: "absolute", right: 16, top: 16, width: 300, maxHeight: "calc(100% - 32px)", background: "var(--panel)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-2)", overflow: "hidden", zIndex: 11, display: "flex", flexDirection: "column" }}>
        <Inspector />
      </div>
    </div>
  );
}

function Stage({ tweaks, bare }: { tweaks: Tweaks; bare?: boolean }) {
  const s = useStore();
  return (
    <div style={{ position: bare ? "absolute" : "relative", inset: bare ? 0 : undefined, minHeight: 0, overflow: "hidden", background: "var(--canvas)" }}>
      {s.mode === "2d" && <Canvas2D accent={tweaks.accent} gridStyle={tweaks.grid} />}
      {s.mode === "3d" && <Suspense fallback={<StageLoading label="Loading 3D engine…" />}><SceneRoot bare={bare} /></Suspense>}
      {s.mode === "walk" && <Suspense fallback={<StageLoading label="Loading walkthrough…" />}><Walkthrough /></Suspense>}
      {s.mode === "2d" && (
        <div style={{ position: "absolute", right: bare ? 330 : 14, bottom: 16, display: "flex", flexDirection: "column", gap: 4, background: "var(--panel)", borderRadius: 10, boxShadow: "var(--sh-2)", padding: 4, zIndex: 8 }}>
          <button className="icon-btn" title="Zoom in" onClick={() => s.setView2d({ ...s.view2d, zoom: Math.min(3.5, s.view2d.zoom * 1.2) })}><Icon name="zoomIn" /></button>
          <button className="icon-btn" title="Zoom out" onClick={() => s.setView2d({ ...s.view2d, zoom: Math.max(0.12, s.view2d.zoom / 1.2) })}><Icon name="zoomOut" /></button>
          <button className="icon-btn" title="Fit" onClick={s.fit}><Icon name="fit" /></button>
        </div>
      )}
      {!bare && (
        <div style={{ position: "absolute", left: 14, top: 14, display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", background: "var(--panel)", borderRadius: 99, boxShadow: "var(--sh-1)", fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", zIndex: 8 }}>
          <Icon name={s.mode === "2d" ? "plan2d" : s.mode === "3d" ? "orbit" : "walk"} size={15} />
          {s.mode === "2d" ? "2D Plan" : s.mode === "3d" ? "3D Dollhouse" : "Walkthrough"}
        </div>
      )}
    </div>
  );
}

