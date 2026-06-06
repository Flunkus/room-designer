/* ===== Furniture pipeline + texture modals (ported from prototype furniture.jsx) =====
   Phase 2 keeps the prototype's inline mock behaviour; Phase 5/6 swap in the
   real provider services (meshGen / textureGen / specParser). */
import { useState, useRef, type ReactNode } from "react";
import { Icon, TYPE_ICON } from "./Icon";
import { useStore } from "../state/store";
import { CATALOG, SAMPLE_BLURB } from "../state/demoRoom";
import { parseSpec } from "../services/specParser";
import { generateFurnitureMesh } from "../services/meshGen";
import { putMesh, cacheRemoteMesh } from "../services/meshStore";
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
  const patch = useStore((s) => s.patch);
  const [method, setMethod] = useState<"catalog" | "image" | "upload" | "describe">("catalog");
  const [sel, setSel] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 200, d: 90, h: 80 });
  const [name, setName] = useState("New Object");
  const [blurb, setBlurb] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Image → 3D: real preview (object URL) + base64 data URL sent to the provider.
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  // Upload: the chosen .glb/.gltf file.
  const [modelFile, setModelFile] = useState<File | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);

  const pick = (c: typeof CATALOG[number]) => { setSel(c.id); setName(c.name); setDims({ w: c.w, d: c.d, h: c.h }); };

  const defaultName = (fileName: string) => { if (!name || name === "New Object") setName(fileName.replace(/\.[^.]+$/, "").slice(0, 32)); };

  const onImage = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    if (!f.type.startsWith("image/")) { setError("Please choose an image file (PNG/JPG/WebP)."); return; }
    if (f.size > 10 * 1024 * 1024) { setError("Image is too large (max 10 MB)."); return; }
    if (imgPreview) URL.revokeObjectURL(imgPreview);
    setImgPreview(URL.createObjectURL(f));
    const reader = new FileReader();
    reader.onload = () => setImgDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Could not read that image.");
    reader.readAsDataURL(f);
    defaultName(f.name);
  };

  const onModel = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    if (!/\.(glb|gltf)$/i.test(f.name)) { setError("Please choose a .glb or .gltf file."); return; }
    if (f.size > 75 * 1024 * 1024) { setError("Model is too large (max 75 MB)."); return; }
    setModelFile(f);
    defaultName(f.name);
  };

  const parseBlurb = async () => {
    setParsing(true); setParsed(false);
    const res = await parseSpec(blurb || SAMPLE_BLURB);
    setDims({ w: res.w, d: res.d, h: res.h });
    if (res.name) setName(res.name);
    setParsing(false); setParsed(true);
  };

  const canAdd = method === "upload" ? !!modelFile : method === "image" ? !!imgDataUrl : true;

  const add = async () => {
    // 1) Upload a model: bytes are in hand → place immediately (status ready), persist to IDB.
    if (method === "upload") {
      if (!modelFile) return;
      try {
        const bytes = await modelFile.arrayBuffer();
        const mime = modelFile.name.toLowerCase().endsWith(".glb") ? "model/gltf-binary" : "model/gltf+json";
        const meshUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        const id = addFurniture({ name, type: "box", ...dims, meshUrl });
        await putMesh(id, bytes, mime, modelFile.name);
        patch(id, { meshStored: true });
      } catch (err) {
        console.warn("[upload] could not read model file:", err);
        setError("Could not read that model file.");
        return;
      }
      onClose();
      return;
    }

    // 2) Image → 3D: drop a placeholder box now; swap in the generated GLB when the job resolves.
    if (method === "image") {
      if (!imgDataUrl) return;
      const id = addFurniture({ name, type: "box", ...dims });
      void generateFurnitureMesh({ name, type: "box", ...dims, sourceImage: true, imageDataUrl: imgDataUrl })
        .then(async (job) => {
          setFurnitureMesh(id, job.meshUrl, "ready");
          // Cache the (expiring) remote GLB to IDB so it survives reload; degrade to https on CORS failure.
          if (job.meshUrl && (await cacheRemoteMesh(id, job.meshUrl))) patch(id, { meshStored: true });
        })
        .catch((err) => { console.warn("[meshGen] image→3D failed:", err); setFurnitureMesh(id, null, "error"); });
      onClose();
      return;
    }

    // 3) Catalog / Describe: procedural mock model (no image, no key needed).
    const type = sel ? (CATALOG.find((c) => c.id === sel)?.type || "box") : "box";
    const id = addFurniture({ name, type, ...dims });
    void generateFurnitureMesh({ name, type, ...dims })
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
          {tab("upload", "box", "Upload model")}
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
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>Upload a product photo. We send it to the 3D-generation API; you'll see a bounding-box placeholder that swaps to the mesh when ready.</p>
              <input ref={imgInput} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onImage(e.target.files)} />
              {!imgPreview ? (
                <button onClick={() => imgInput.current?.click()} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 12, background: "var(--panel-2)", padding: "30px 20px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-2)" }}>
                  <Icon name="upload" size={26} />
                  <div style={{ fontSize: 13.5, fontWeight: 560, color: "var(--text)" }}>Click to upload an image</div>
                  <div style={{ fontSize: 12 }}>PNG, JPG or WebP · max 10 MB</div>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 120, height: 120, borderRadius: 8, background: `url(${imgPreview}) center/cover`, border: "1px solid var(--border-strong)" }} />
                  <div style={{ flex: 1 }}>
                    <span className="tag green"><Icon name="check" size={12} /> Image ready</span>
                    <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "8px 0 0", lineHeight: 1.5 }}>On <strong>Add</strong>, a placeholder box appears immediately and the generated mesh streams in.</p>
                    <button className="btn sm ghost" onClick={() => imgInput.current?.click()} style={{ marginTop: 8 }}>Choose another</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {method === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>Upload your own <strong>.glb</strong> (or self-contained <strong>.gltf</strong>) model. It's placed immediately, scaled to the bounding box, and saved to this browser so it survives a reload.</p>
              <input ref={modelInput} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" style={{ display: "none" }} onChange={(e) => onModel(e.target.files)} />
              {!modelFile ? (
                <button onClick={() => modelInput.current?.click()} style={{ border: "1.5px dashed var(--border-strong)", borderRadius: 12, background: "var(--panel-2)", padding: "30px 20px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-2)" }}>
                  <Icon name="box" size={26} />
                  <div style={{ fontSize: 13.5, fontWeight: 560, color: "var(--text)" }}>Click to upload a 3D model</div>
                  <div style={{ fontSize: 12 }}>.glb or .gltf · max 75 MB</div>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: "var(--panel-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-600)" }}><Icon name="box" size={28} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="tag green"><Icon name="check" size={12} /> Model ready</span>
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--text-2)", margin: "8px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelFile.name} · {(modelFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    <button className="btn sm ghost" onClick={() => modelInput.current?.click()} style={{ marginTop: 8 }}>Choose another</button>
                  </div>
                </div>
              )}
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Tip: <strong>.gltf</strong> must embed its buffers/textures — files that reference external <span className="mono">.bin</span>/images won't resolve and will fall back to the box.</p>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 8, background: "var(--danger-soft, #fdecec)", color: "var(--danger, #b3261e)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 7 }}>
              <Icon name="lock" size={14} /> {error}
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
          <button className="btn primary" style={{ marginTop: "auto" }} onClick={add} disabled={!canAdd}><Icon name="plus" size={16} /> Add to scene</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Add a rectangular room by size ---------------- */
function SizeField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <span style={{ position: "relative", display: "flex", alignItems: "center", flex: 1 }}>
      <span style={{ position: "absolute", left: 10, fontSize: 11, color: "var(--text-3)" }}>{label}</span>
      <input type="number" className="mono" value={value} disabled={disabled}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        style={{ width: "100%", height: 38, padding: "0 30px 0 60px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 14, textAlign: "right", outline: "none", opacity: disabled ? 0.55 : 1, background: disabled ? "var(--panel-3)" : "var(--panel)" }} />
      <span style={{ position: "absolute", right: 10, fontSize: 11, color: "var(--text-3)" }}>cm</span>
    </span>
  );
}

export function RoomModal({ onClose }: { onClose: () => void }) {
  const starterRoom = useStore((s) => s.starterRoom);
  const [w, setW] = useState(400);
  const [d, setD] = useState(300);
  const [square, setSquare] = useState(false);
  const [name, setName] = useState("");
  const depth = square ? w : d;
  const areaM2 = ((Math.max(50, w) * Math.max(50, depth)) / 10000).toFixed(1);

  const create = () => { starterRoom(w, depth, name); onClose(); };

  return (
    <Modal title="Add a room" sub="Create a rectangular room by size — it drops onto the plan beside your other rooms; move or reshape it after." onClose={onClose}>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <span className="label-xs">Name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bedroom"
            style={{ width: "100%", height: 38, marginTop: 6, padding: "0 11px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 14, outline: "none" }} />
        </div>
        <div>
          <span className="label-xs">Size</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <SizeField label="Width" value={w} onChange={setW} />
            <span style={{ color: "var(--text-3)", fontWeight: 600 }}>×</span>
            <SizeField label="Depth" value={depth} onChange={setD} disabled={square} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--text-2)", cursor: "pointer" }}>
          <input type="checkbox" checked={square} onChange={(e) => setSquare(e.target.checked)} />
          Square room (lock depth to width)
        </label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--panel-3)", borderRadius: 8, fontSize: 12.5, color: "var(--text-2)" }}>
          <span>Floor area</span>
          <span className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{areaM2} m²</span>
        </div>
        <button className="btn primary" onClick={create} style={{ alignSelf: "flex-end" }}><Icon name="plus" size={16} /> Create room</button>
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
