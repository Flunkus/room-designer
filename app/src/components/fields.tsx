/* ===== Shared field controls (ported from prototype panels.jsx) ===== */
import type { CSSProperties, ReactNode } from "react";

export const inpStyle: CSSProperties = {
  width: "100%", height: 34, padding: "0 26px 0 10px",
  border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)",
  background: "var(--panel)", color: "var(--text)", fontSize: 13, outline: "none",
};

export function NumField({ label, value, unit, onChange, step, w }: {
  label: string; value: number; unit?: string; onChange: (v: number) => void; step?: number; w?: number;
}) {
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

export function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="label-xs">{label}</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step || 1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span className="label-xs">{title}</span>{right}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: "var(--panel-3)", borderRadius: 8, padding: "9px 10px" }}>
      <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>{label}</div>
    </div>
  );
}

export function Toggle({ label, sub, on, onClick }: { label: string; sub?: string; on: boolean; onClick: () => void }) {
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
