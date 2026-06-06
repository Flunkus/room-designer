/* ===== Geometry — polygon math + isometric projection ===== */
(function () {
  const cos = Math.cos, sin = Math.sin, PI = Math.PI;
  const rad = (d) => (d * PI) / 180;

  function bounds(pts) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  function centroid(pts) {
    let x = 0, y = 0;
    pts.forEach((p) => { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // signed-area (shoelace) → absolute area in same units² ; perimeter sums edges
  function area(pts) {
    if (!pts || pts.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }
  function perimeter(pts) {
    if (!pts || pts.length < 2) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
    return s;
  }
  // rough human-readable shape name from vertex count
  function shapeName(pts) {
    const n = (pts || []).length;
    if (n === 4) return "Rectangle";
    if (n === 6) return "L-shape";
    if (n < 3) return "Open";
    return n + "-sided";
  }

  // edges of a closed polygon, with length + outward normal (points away from centroid)
  function edges(pts) {
    const c = centroid(pts);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let nx = -(b.y - a.y), ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      // flip to point away from centroid
      if ((mid.x - c.x) * nx + (mid.y - c.y) * ny < 0) { nx = -nx; ny = -ny; }
      out.push({ a, b, mid, nx, ny, len: dist(a, b), i });
    }
    return out;
  }

  function pointInPoly(p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // 8 corners (world cm) of an object's box: centre (x,y), base at z0, dims, rot deg
  function boxCorners(o, z0) {
    const hw = o.w / 2, hd = o.d / 2;
    const r = rad(o.rot || 0), ca = cos(r), sa = sin(r);
    const base = z0 || 0, top = base + o.h;
    const local = [
      [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
    ];
    const c = [];
    for (const z of [base, top]) {
      for (const [lx, ly] of local) {
        c.push({ x: o.x + lx * ca - ly * sa, y: o.y + lx * sa + ly * ca, z });
      }
    }
    return c; // [b0..b3, t0..t3]
  }

  // Isometric projector. opts: {az (deg), scale, ox, oy, cx, cy} cx/cy = world centre to orbit about
  function makeProjector(opts) {
    const az = rad(opts.az || 0), ca = cos(az), sa = sin(az);
    const s = opts.scale, ox = opts.ox, oy = opts.oy, cx = opts.cx || 0, cy = opts.cy || 0;
    const COS30 = 0.866, SIN30 = 0.5;
    function p(pt) {
      const x = pt.x - cx, y = pt.y - cy, z = pt.z || 0;
      const rx = x * ca - y * sa;
      const ry = x * sa + y * ca;
      return {
        sx: ox + (rx - ry) * COS30 * s,
        sy: oy + (rx + ry) * SIN30 * s - z * s,
      };
    }
    // depth key: larger = nearer camera (drawn later)
    function depth(pt) {
      const x = pt.x - cx, y = pt.y - cy;
      const rx = x * ca - y * sa, ry = x * sa + y * ca;
      return rx + ry;
    }
    // is an outward normal (nx,ny) facing away from camera? → back/far wall, keep in cutaway
    function isFar(nx, ny) {
      const rnx = nx * ca - ny * sa, rny = nx * sa + ny * ca;
      return (rnx + rny) > 0.15;
    }
    return { p, depth, isFar, az: opts.az || 0, scale: s };
  }

  function polyPath(pts, proj) {
    return pts.map((p, i) => (i ? "L" : "M") + p.sx.toFixed(1) + " " + p.sy.toFixed(1)).join(" ") + " Z";
  }

  // shade a hex color by factor (1=same, <1 darker, >1 lighter)
  function shade(hex, f) {
    const m = hex.replace("#", "");
    const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f <= 1) { r *= f; g *= f; b *= f; }
    else { const t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
    const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return "#" + h(r) + h(g) + h(b);
  }

  Object.assign(window, {
    GEO: { bounds, centroid, dist, area, perimeter, shapeName, edges, pointInPoly, boxCorners, makeProjector, polyPath, shade, rad },
  });
})();
