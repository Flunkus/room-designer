/* ===== Furniture pipeline + texture modals (ported from prototype furniture.jsx) =====
   Phase 2 keeps the prototype's inline mock behaviour; Phase 5/6 swap in the
   real provider services (meshGen / textureGen / specParser). */
import { useState, useRef, type ReactNode } from "react";
import { Icon, TYPE_ICON } from "./Icon";
import { useStore } from "../state/store";
import { CATALOG, SAMPLE_BLURB } from "../state/demoRoom";
import { parseSpec } from "../services/specParser";
import { generateFurnitureMesh } from "../services/meshGen";
import { generateTexture, type PBRMaps } from "../services/textureGen";

function Modal({ title, sub, onClose, children, wide }: {
  title: string; sub?: string; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(24,24,28,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: wide ? 760 : 600, maxWidth: "94vw", maxHeight: "88vh", background: "var(--panel)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-3)", overflow: "hidden", display: "flex", flexDirection: "column", animation: "popIn .2s ease" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 680 }}>{title}</div>
            {sub && <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const ImgPlaceholder = ({ label, h }: { label: string; h?: number }) => (
  <div style={{ height: h || 120, borderRadius: 8, background: "repeating-linear-gradient(45deg,#f0f0ed,#f0f0ed 8px,#e9e9e5 8px,#e9e9e5 16px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
    <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</span>
  </div>
);

/* ---------------- Furniture pipeline ---------------- */
export function FurnitureModal({ onClose }: { onClose: () => void }) {
  const addFurniture = useStore((s) => s.addFurniture);
  const setFurnitureMesh = useStore((s) => s.setFurnitureMesh);
  const [method, setMethod] = useState<"catalog" | "image" | "describe">("catalog");
  const [sel, setSel] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 200, d: 90, h: 80 });
  const [name, setName] = useState("New Object");
  const [hasImg, setHasImg] = useState(false);
  const [blurb, setBlurb] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);

  const pick = (c: typeof CATALOG[number]) => { setSel(c.id); setName(c.name); setDims({ w: c.w, d: c.d, h: c.h }); };

  const parseBlurb = async () => {
    setParsing(true); setParsed(false);
    const res = await parseSpec(blurb || SAMPLE_BLURB);
    setDims({ w: res.w, d: res.d, h: res.h });
    if (res.name) setName(res.name);
    setParsing(false); setParsed(true);
  };

  const add = () => {
    const type = sel ? (CATALOG.find((c) => c.id === sel)?.type || "box") : "box";
    const id = addFurniture({ name, type, ...dims });
    // Kick off async mesh generation: a placeholder box is already on the scene;
    // when the job resolves we swap in the generated GLB (preserving transform).
    void generateFurnitureMesh({ name, type, ...dims, sourceImage: hasImg })
      .then((job) => setFurnitureMesh(id, job.meshUrl, "ready"))
      .catch(() => setFurnitureMesh(id, null, "error"));
    onClose();
  };

  const tab = (id: typeof method, icon: string, label: string) => (
    <button key={id} onClick={() => setMethod(id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", border: "none", borderRadius: 8, background: method === id ? "var(--accent-soft)" : "transparent", color: method === id ? "var(--accent-600)" : "var(--text-2)", fontSize: 13, fontWeight: 560, cursor: "pointer", textAlign: "left" }}>
      <Icon name={icon} size={17} /> {label}
    </button>
  );

  return (
    <Modal wide title="Add furniture" sub="Browse the catalog, generate 3D from an image, or describe it." onClose={onClose}>
      <div style={{ display: "flex", minHeight: 380 }}>
        <div style={{ width: 190, padding: 12, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 3 }}>
          {tab("catalog", "folder", "Catalog")}
          {tab("image", "image", "Image → 3D")}
          {tab("describe", "sparkle", "Describe (AI)")}
          <div style={{ marginTop: "auto", padding: 10, background: "var(--panel-3)", borderRadius: 8, fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text)" }}>Modular tip:</strong> build an L-sofa by snapping separate scaled pieces, not stretching one mesh.
          </div>
        </div>

        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {method === "catalog" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {CATALOG.map((c) => (
                <button key={c.id} onClick={() => pick(c)} style={{ border: sel === c.id ? "2px solid var(--accent)" : "1px solid var(--border)", borderRadius: 10, background: sel === c.id ? "var(--accent-soft)" : "var(--panel)", padding: 12, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ height: 56, borderRadius: 6, background: "var(--panel-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)" }}><Icon name={TYPE_ICON[c.type] || "box"} size={26} /></div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>{c.w}×{c.d}×{c.h}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {method === "image" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>Drop a product photo. We send it to the 3D-generation API; you'll see a bounding-box placeholder that swaps to the mesh when ready.</p>
              {!hasImg ? (
                <button onClick={() => setHasImg(true)} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 12, background: "var(--panel-2)", padding: "30px 20px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-2)" }}>
                  <Icon name="upload" size={26} />
                  <div style={{ fontSize: 13.5, fontWeight: 560, color: "var(--text)" }}>Drop image or click to upload</div>
                  <div style={{ fontSize: 12 }}>or use a sample photo</div>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 120 }}><ImgPlaceholder label="product.jpg" h={120} /></div>
                  <div style={{ flex: 1 }}>
                    <span className="tag green"><Icon name="check" size={12} /> Image ready</span>
                    <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "8px 0 0", lineHeight: 1.5 }}>On <strong>Add</strong>, a placeholder box appears immediately and the generated mesh streams in.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {method === "describe" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>Paste a messy product description — the model extracts dimensions into the boxes below.</p>
              <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder={SAMPLE_BLURB}
                style={{ width: "100%", height: 110, padding: 12, border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, fontFamily: "var(--ui)", resize: "vertical", outline: "none", lineHeight: 1.5 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn sm ghost" onClick={() => setBlurb(SAMPLE_BLURB)}>Paste sample</button>
                <button className="btn primary sm" onClick={parseBlurb} disabled={parsing} style={{ marginLeft: "auto" }}>
                  {parsing ? <><span className="spin-ic" style={{ display: "flex" }}><Icon name="settings" size={14} /></span> Parsing…</> : <><Icon name="sparkle" size={14} /> Extract dimensions</>}
                </button>
              </div>
              {parsed && <div className="tag green" style={{ alignSelf: "flex-start" }}><Icon name="check" size={12} /> Dimensions populated below</div>}
            </div>
          )}
        </div>

        <div style={{ width: 210, padding: 16, borderLeft: "1px solid var(--border)", background: "var(--panel-2)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span className="label-xs">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", height: 32, marginTop: 5, padding: "0 9px", border: "1px solid var(--border-strong)", borderRadius: 6, fontSize: 13, outline: "none" }} />
          </div>
          <div>
            <span className="label-xs">Bounding box</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {([["w", "Width"], ["d", "Depth"], ["h", "Height"]] as const).map(([k, lbl]) => (
                <span key={k} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: 9, fontSize: 11, color: "var(--text-3)", width: 38 }}>{lbl}</span>
                  <input className="mono" type="number" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: parseFloat(e.target.value) || 0 })}
                    style={{ width: "100%", height: 32, padding: "0 26px 0 52px", border: "1px solid var(--border-strong)", borderRadius: 6, fontSize: 13, outline: "none", textAlign: "right" }} />
                  <span className="mono" style={{ position: "absolute", right: 9, fontSize: 11, color: "var(--text-3)" }}>cm</span>
                </span>
              ))}
            </div>
          </div>
          <button className="btn primary" style={{ marginTop: "auto" }} onClick={add}><Icon name="plus" size={16} /> Add to scene</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Texture / material ---------------- */
type MapKey = "base" | "normal" | "rough";

export function TextureModal({ onClose }: { onClose: () => void }) {
  const patchMaterial = useStore((s) => s.patchMaterial);
  const target = useStore((s) => s.materialTarget);
  const targetName = useStore((s) => s.materials[target].name);
  const [track, setTrack] = useState<"ai" | "upload">("ai");
  const [gen, setGen] = useState<PBRMaps | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  // manual track: real uploaded object-URLs + file names
  const [maps, setMaps] = useState<Record<MapKey, { url: string; name: string } | null>>({ base: null, normal: null, rough: null });
  const fileRefs = { base: useRef<HTMLInputElement>(null), normal: useRef<HTMLInputElement>(null), rough: useRef<HTMLInputElement>(null) };

  const generate = async () => {
    setBusy(true);
    const res = await generateTexture(prompt || "warm european oak, matte");
    setBusy(false); setGen(res);
  };

  const onFile = (k: MapKey, files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setMaps((prev) => ({ ...prev, [k]: { url: URL.createObjectURL(f), name: f.name } }));
  };

  return (
    <Modal title={`Material — ${targetName} (${target})`} sub="Two ingestion tracks: AI-generated tileable texture, or manual PBR maps." onClose={onClose}>
      <div style={{ display: "flex", gap: 6, padding: "14px 18px 0" }}>
        {([["ai", "AI texture", "sparkle"], ["upload", "Upload PBR maps", "upload"]] as const).map(([id, label, ic]) => (
          <button key={id} onClick={() => setTrack(id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", border: "none", borderBottom: track === id ? "2px solid var(--accent)" : "2px solid transparent", background: "transparent", color: track === id ? "var(--text)" : "var(--text-2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            <Icon name={ic} size={16} /> {label}
          </button>
        ))}
      </div>
      <hr className="divider" />
      <div style={{ padding: 18, minHeight: 240 }}>
        {track === "ai" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ImgPlaceholder label="drop a surface photo → seamless tile" h={110} />
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="or describe it: 'warm european oak, matte'" style={{ width: "100%", height: 38, padding: "0 12px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, outline: "none" }} />
            <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={generate} disabled={busy}>
              {busy ? <><span className="spin-ic" style={{ display: "flex" }}><Icon name="settings" size={15} /></span> Generating tile…</> : <><Icon name="sparkle" size={15} /> Generate seamless texture</>}
            </button>
            {gen && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", animation: "popIn .2s" }}>
                <div style={{ width: 70, height: 70, borderRadius: 8, background: gen.base ? `url(${gen.base})` : gen.preview, backgroundSize: "cover", border: "1px solid var(--border-strong)" }} />
                <div style={{ flex: 1 }}><span className="tag green"><Icon name="check" size={12} /> Tileable · 2K</span></div>
                <button className="btn primary sm" onClick={() => { patchMaterial(target, { source: "ai", base: gen.baseColor, kind: "wood", maps: { base: gen.base, normal: gen.normal, roughness: gen.roughness } }); onClose(); }}>Apply</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {([["base", "Base Color"], ["normal", "Normal Map"], ["rough", "Roughness Map"]] as [MapKey, string][]).map(([k, lbl]) => (
              <div key={k}>
                <input ref={fileRefs[k]} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onFile(k, e.target.files)} />
                <button onClick={() => fileRefs[k].current?.click()} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel)", cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 7, background: maps[k] ? `url(${maps[k]!.url}) center/cover` : "var(--panel-3)", display: "flex", alignItems: "center", justifyContent: "center", color: maps[k] ? "var(--accent-600)" : "var(--text-3)" }}>{!maps[k] && <Icon name="image" size={20} />}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{lbl}</div>
                    <div className="mono" style={{ fontSize: 11, color: maps[k] ? "var(--good)" : "var(--text-3)" }}>{maps[k] ? maps[k]!.name : "no file — click to upload"}</div>
                  </div>
                  {maps[k] && <Icon name="check" size={16} />}
                </button>
              </div>
            ))}
            <button className="btn primary" style={{ alignSelf: "flex-start", marginTop: 4 }} disabled={!maps.base} onClick={() => { patchMaterial(target, { source: "pbr", maps: { base: maps.base?.url ?? null, normal: maps.normal?.url ?? null, roughness: maps.rough?.url ?? null } }); onClose(); }}>Apply PBR set</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
