/* ===== Tool rail (ported from prototype panels.jsx) ===== */
import { Icon, type IconName } from "./Icon";
import { useStore } from "../state/store";

function Tool({ icon, tip, active, onClick }: { icon: IconName; tip: string; active: boolean; onClick: () => void }) {
  return (
    <button className={"icon-btn" + (active ? " active" : "")} title={tip} onClick={onClick}><Icon name={icon} /></button>
  );
}

export function ToolRail() {
  const s = useStore();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", background: "var(--panel)", borderRight: "1px solid var(--border)" }}>
      <Tool icon="select" tip="Select & move (V)" active={s.tool === "select"} onClick={() => s.setTool("select")} />
      <Tool icon="pen" tip="Draw room (P)" active={s.tool === "draw"} onClick={() => s.startDraw()} />
      <Tool icon="hand" tip="Pan — or hold Space / middle-drag (H)" active={s.tool === "pan"} onClick={() => s.setTool("pan")} />
      <hr className="divider" style={{ width: 22, margin: "6px 0" }} />
      <Tool icon="plus" tip="Add furniture" active={s.modal === "furniture"} onClick={() => s.openModal("furniture")} />
      <Tool icon="swatch" tip="Materials" active={s.inspectorTab === "materials"} onClick={() => {
        if (!s.activeRoomId && s.rooms[0]) s.selectRoom(s.rooms[0].id);
        s.select(null);
        s.setInspectorTab("materials");
      }} />
      <hr className="divider" style={{ width: 22, margin: "6px 0" }} />
      <Tool icon="clearance" tip="Clearance zones (60cm)" active={s.showClearance} onClick={() => s.toggle("showClearance")} />
      <Tool icon="person" tip="Human proxy" active={s.showProxy} onClick={() => s.toggle("showProxy")} />
    </div>
  );
}
