/* ===== Tweaks — compact, self-contained design-knob panel =====
   Ported from the prototype's tweaks-panel.jsx scaffold, stripped of the host
   postMessage protocol. Keeps the four runtime knobs (direction / accent /
   density / grid), persisted to localStorage, toggled by a floating gear. */
import { useCallback, useEffect, useState } from "react";

export type Direction = "A" | "B";
export type Density = "compact" | "comfortable";
export type GridStyle = "lines" | "dots" | "blueprint";

export interface Tweaks {
  direction: Direction;
  accent: string;
  density: Density;
  grid: GridStyle;
}

const DEFAULTS: Tweaks = {
  direction: "A",
  accent: "#3b82f6",
  density: "comfortable",
  grid: "lines",
};

const KEY = "roomscale.tweaks.v1";

export function useTweaks(): [Tweaks, <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => void] {
  const [values, setValues] = useState<Tweaks>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULTS;
  });
  const setTweak = useCallback(<K extends keyof Tweaks>(k: K, v: Tweaks[K]) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [values, setTweak];
}

const STYLE = `
.twk-fab{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:38px;height:38px;
  border-radius:11px;border:.5px solid rgba(255,255,255,.6);cursor:pointer;
  background:rgba(250,249,247,.82);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);
  box-shadow:0 6px 20px rgba(0,0,0,.16);display:flex;align-items:center;justify-content:center;color:#29261b}
.twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
  max-height:calc(100vh - 32px);display:flex;flex-direction:column;
  background:rgba(250,249,247,.82);color:#29261b;
  -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
  border:.5px solid rgba(255,255,255,.6);border-radius:14px;
  box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
  font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
.twk-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 8px 10px 14px}
.twk-hd b{font-size:12px;font-weight:600}
.twk-x{border:0;background:transparent;color:rgba(41,38,27,.55);width:22px;height:22px;
  border-radius:6px;cursor:pointer;font-size:13px}
.twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
.twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
.twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:rgba(41,38,27,.45);padding:10px 0 0}
.twk-row{display:flex;flex-direction:column;gap:5px}
.twk-lbl{color:rgba(41,38,27,.72);font-weight:500}
.twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;background:rgba(0,0,0,.06)}
.twk-seg button{position:relative;z-index:1;flex:1;border:0;background:transparent;color:inherit;
  font:inherit;font-weight:500;min-height:22px;border-radius:6px;cursor:pointer;padding:4px 6px;text-transform:capitalize}
.twk-seg button[data-on="1"]{background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.twk-chips{display:flex;gap:6px}
.twk-chip{flex:1;height:30px;border:0;border-radius:7px;cursor:pointer;
  box-shadow:0 0 0 .5px rgba(0,0,0,.12)}
.twk-chip[data-on="1"]{box-shadow:0 0 0 2px rgba(0,0,0,.85)}
.twk-note{font-size:11px;color:rgba(41,38,27,.55);line-height:1.45}
`;

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="twk-seg">
      {options.map((o) => (
        <button key={o} type="button" data-on={o === value ? "1" : "0"} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export function TweaksPanel({ t, setTweak }: { t: Tweaks; setTweak: <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => void }) {
  const [open, setOpen] = useState(false);
  // Alt+T toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.altKey && (e.key === "t" || e.key === "T")) setOpen((o) => !o); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return (
      <>
        <style>{STYLE}</style>
        <button className="twk-fab" title="Tweaks (Alt+T)" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.9 7.9 0 000-3l1.6-1.2-1.5-2.6-1.9.7a7.6 7.6 0 00-2.6-1.5L14.2 4h-3l-.3 1.9a7.6 7.6 0 00-2.6 1.5l-1.9-.7L4.9 9.3 6.5 10.5a7.9 7.9 0 000 3L4.9 14.7l1.5 2.6 1.9-.7a7.6 7.6 0 002.6 1.5l.3 1.9h3l.3-1.9a7.6 7.6 0 002.6-1.5l1.9.7 1.5-2.6-1.6-1.2z" />
          </svg>
        </button>
      </>
    );
  }

  return (
    <>
      <style>{STYLE}</style>
      <div className="twk-panel">
        <div className="twk-hd">
          <b>Tweaks</b>
          <button className="twk-x" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="twk-body">
          <div className="twk-sect">Layout direction</div>
          <div className="twk-row">
            <span className="twk-lbl">Direction</span>
            <Seg value={t.direction} options={["A", "B"]} onChange={(v) => setTweak("direction", v)} />
          </div>
          <div className="twk-note">
            {t.direction === "A"
              ? "A — Classic editor: fixed tool rail, objects panel, right inspector. Top segmented mode switch (Plan / 3D / Walk)."
              : "B — Immersive: full-bleed canvas, floating panels, vertical mode ladder (Plan → Orbit → Walk) on the left."}
          </div>
          <div className="twk-sect">Appearance</div>
          <div className="twk-row">
            <span className="twk-lbl">Accent</span>
            <div className="twk-chips">
              {["#3b82f6", "#10b981", "#f97316", "#a78bfa", "#1b1b1e"].map((c) => (
                <button key={c} className="twk-chip" data-on={t.accent === c ? "1" : "0"} style={{ background: c }} onClick={() => setTweak("accent", c)} />
              ))}
            </div>
          </div>
          <div className="twk-row">
            <span className="twk-lbl">Panel density</span>
            <Seg value={t.density} options={["compact", "comfortable"]} onChange={(v) => setTweak("density", v)} />
          </div>
          <div className="twk-sect">Plan canvas</div>
          <div className="twk-row">
            <span className="twk-lbl">Grid style</span>
            <Seg value={t.grid} options={["lines", "dots", "blueprint"]} onChange={(v) => setTweak("grid", v)} />
          </div>
        </div>
      </div>
    </>
  );
}
