/* ===== Objects / layers panel — rooms list + per-room furniture (ported from prototype panels.jsx) ===== */
import type { ReactNode } from "react";
import { Icon, TYPE_ICON, type IconName } from "./Icon";
import { useStore } from "../state/store";
import { area, shapeName } from "../domain/geometry";
import type { Furniture, Room } from "../domain/types";

function GroupLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 8px 5px" }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)" }}>{children}</span>
      {right}
    </div>
  );
}

function Row({ icon, name, sub, active, onClick, right, depth, hidden, loading }: {
  icon: IconName | string; name: string; sub?: string; active: boolean; onClick: () => void;
  right?: ReactNode; depth?: number; hidden?: boolean; loading?: boolean;
}) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", paddingLeft: 8 + (depth || 0) * 18,
      borderRadius: "var(--r-sm)", cursor: "pointer", marginBottom: 1,
      background: active ? "var(--accent-soft)" : "transparent", opacity: hidden ? 0.45 : 1,
    }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--panel-3)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
      {(depth || 0) > 0 && <Icon name="link" size={13} />}
      <span style={{ color: active ? "var(--accent-600)" : "var(--text-2)", display: "flex" }}>
        {loading ? <span className="spin-ic"><Icon name="settings" size={16} /></span> : <Icon name={icon} size={16} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: active ? "var(--accent-600)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {sub && <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--text-3)" }}>{sub}</span>}
      </span>
      {right}
    </div>
  );
}

function ObjRow({ o, all, depth }: { o: Furniture; all: Furniture[]; depth: number }) {
  const s = useStore();
  const children = all.filter((f) => f.parent === o.id);
  return (
    <>
      <Row icon={TYPE_ICON[o.type] || "box"} name={o.name}
        sub={o.status === "generating" ? "Generating…" : `${Math.round(o.w)}×${Math.round(o.d)}×${Math.round(o.h)}`}
        active={s.selectedId === o.id} depth={depth} onClick={() => s.select(o.id)}
        hidden={o.hidden} loading={o.status === "generating"}
        right={
          <span style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" style={{ width: 26, height: 26 }} title={o.hidden ? "Show" : "Hide"} onClick={() => s.patch(o.id, { hidden: !o.hidden })}><Icon name={o.hidden ? "eyeOff" : "eye"} size={15} /></button>
          </span>
        } />
      {children.map((c) => <ObjRow key={c.id} o={c} all={all} depth={depth + 1} />)}
    </>
  );
}

/** A selectable room card with redraw + delete affordances. */
function RoomCard({ room, active }: { room: Room; active: boolean }) {
  const s = useStore();
  const poly = room.polygon || [];
  const shape = shapeName(poly);
  const a = (area(poly) / 10000).toFixed(1); // cm² → m²
  return (
    <div onClick={() => s.selectRoom(room.id)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: "var(--r-sm)", cursor: "pointer", marginBottom: 4,
        background: active ? "var(--accent-soft)" : "var(--panel-3)",
        border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
      }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: active ? "var(--accent)" : "var(--panel)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#fff" : "var(--text-2)", flexShrink: 0 }}>
        <Icon name="grid" size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: active ? "var(--accent-600)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.name}</span>
        <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--text-3)" }}>{shape} · {a} m²</span>
      </span>
      <span style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" style={{ width: 26, height: 26 }} title="Redraw walls" onClick={() => s.redrawRoom(room.id)}><Icon name="pen" size={14} /></button>
        <button className="icon-btn" style={{ width: 26, height: 26, color: "var(--danger)" }} title="Delete room"
          onClick={() => { if (confirm(`Delete "${room.name}" and its furniture?`)) s.removeRoom(room.id); }}><Icon name="trash" size={14} /></button>
      </span>
    </div>
  );
}

export function ObjectsPanel() {
  const s = useStore();
  const rooms = s.rooms;
  const orphans = s.furniture.filter((o) => !o.parent && !rooms.some((r) => r.id === o.roomId));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--panel)" }}>
      <div style={{ padding: "13px 16px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontWeight: 650, fontSize: 13.5 }}>Objects</span>
        <span className="tag gray">{s.furniture.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 8px 16px" }}>
        <GroupLabel right={
          rooms.length ? <button className="icon-btn" style={{ width: 24, height: 24 }} title="Add a room by size" onClick={() => s.openModal("room")}><Icon name="plus" size={14} /></button> : undefined
        }>Rooms</GroupLabel>

        {rooms.length ? (
          rooms.map((room) => <RoomCard key={room.id} room={room} active={!s.selectedId && s.activeRoomId === room.id} />)
        ) : (
          <div style={{ padding: "16px 14px", textAlign: "center", border: "1.5px dashed var(--border-strong)", borderRadius: "var(--r)", background: "var(--panel-3)" }}>
            <div style={{ color: "var(--text-3)", display: "flex", justifyContent: "center", marginBottom: 8 }}><Icon name="grid" size={22} /></div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>No rooms yet</div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.45, marginBottom: 11 }}>Add a starter room, or trace your own walls.</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn primary sm" style={{ flex: 1 }} onClick={() => s.openModal("room")}><Icon name="plus" size={14} /> Add room</button>
              <button className="btn sm" style={{ flex: 1 }} onClick={() => s.startDraw()}><Icon name="pen" size={14} /> Draw</button>
            </div>
          </div>
        )}

        <GroupLabel right={<span className="tag gray" style={{ fontSize: 10 }}>{s.furniture.filter((o) => !o.parent).length}</span>}>Furniture</GroupLabel>
        {s.furniture.length === 0 && <div style={{ padding: "10px 10px 6px", fontSize: 11.5, color: "var(--text-3)" }}>Nothing placed yet.</div>}
        {rooms.map((room) => {
          const tops = s.furniture.filter((o) => !o.parent && o.roomId === room.id);
          if (!tops.length) return null;
          return (
            <div key={room.id} style={{ marginBottom: 2 }}>
              <div style={{ padding: "6px 8px 2px", fontSize: 10.5, fontWeight: 600, color: "var(--text-3)" }}>{room.name}</div>
              {tops.map((o) => <ObjRow key={o.id} o={o} all={s.furniture} depth={0} />)}
            </div>
          );
        })}
        {orphans.length > 0 && (
          <div style={{ marginBottom: 2 }}>
            <div style={{ padding: "6px 8px 2px", fontSize: 10.5, fontWeight: 600, color: "var(--text-3)" }}>Unassigned</div>
            {orphans.map((o) => <ObjRow key={o.id} o={o} all={s.furniture} depth={0} />)}
          </div>
        )}
      </div>
      <button className="btn ghost" style={{ margin: 10, justifyContent: "flex-start" }} onClick={() => s.openModal("furniture")}>
        <Icon name="plus" size={16} /> Add furniture
      </button>
    </div>
  );
}
