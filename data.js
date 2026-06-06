/* ===== Room Designer — demo data ===== */
/* Coordinate system: centimetres. Plan x = right, y = depth (down on 2D plan). */

// L-shaped open-plan living / kitchen
window.ROOM_POLYGON = [
  { x: 0,   y: 0   },
  { x: 640, y: 0   },
  { x: 640, y: 480 },
  { x: 300, y: 480 },
  { x: 300, y: 300 },
  { x: 0,   y: 300 },
];

window.WALL_HEIGHT = 270; // cm

// Openings (cut into walls) — defined by wall segment index + offset + width
window.OPENINGS = [
  { id: "op-door",  type: "door",   wall: 5, offset: 60,  width: 90,  height: 210, label: "Entry" },
  { id: "op-win-1", type: "window", wall: 0, offset: 120, width: 180, height: 130, sill: 90, label: "Window" },
  { id: "op-win-2", type: "window", wall: 1, offset: 90,  width: 150, height: 130, sill: 90, label: "Window" },
];

// Materials
window.MATERIALS = {
  floor: { id: "floor", name: "European Oak", kind: "wood",  base: "#c89b6b", scale: 120, rotation: 0, roughness: 0.6, source: "ai" },
  walls: { id: "walls", name: "Warm White Paint", kind: "paint", base: "#efe9e1", scale: 100, rotation: 0, roughness: 0.9, source: "swatch" },
};

/* Furniture — pos = centre (cm); rot in degrees (cw); dims w(x) d(y) h(z) cm.
   parent: id of object this is nested under (coords then relative). */
window.FURNITURE = [
  { id: "rug",     name: "Wool Area Rug",     type: "rug",     x: 165, y: 150, rot: 0,  w: 280, d: 190, h: 2,   color: "#dcd3c4", status: "ready", flat: true },
  { id: "sofa",    name: "3-Seat Sofa",        type: "sofa",    x: 165, y: 95,  rot: 0,  w: 230, d: 95,  h: 82,  color: "#8a98a6", status: "ready" },
  { id: "coffee",  name: "Oak Coffee Table",   type: "table",   x: 165, y: 195, rot: 0,  w: 120, d: 62,  h: 40,  color: "#b88a55", status: "ready" },
  { id: "armchair",name: "Lounge Armchair",    type: "chair",   x: 420, y: 110, rot: -35,w: 88,  d: 88,  h: 80,  color: "#b08968", status: "ready" },
  { id: "tvunit",  name: "Media Console",      type: "storage", x: 165, y: 28,  rot: 0,  w: 200, d: 42,  h: 48,  color: "#3b3b40", status: "ready" },
  { id: "tv",      name: "65\" TV",            type: "tv",      x: 0,   y: 0,   rot: 0,  w: 145, d: 8,   h: 82,  color: "#1c1c20", status: "ready", parent: "tvunit", localZ: 48 },
  { id: "plant",   name: "Fiddle-Leaf Fig",    type: "plant",   x: 70,  y: 250, rot: 0,  w: 70,  d: 70,  h: 170, color: "#4c7a4c", status: "ready" },
  { id: "lamp",    name: "Arc Floor Lamp",     type: "lamp",    x: 320, y: 60,  rot: 0,  w: 40,  d: 40,  h: 200, color: "#c9c4ba", status: "ready" },
  { id: "island",  name: "Kitchen Island",     type: "storage", x: 480, y: 360, rot: 0,  w: 200, d: 95,  h: 92,  color: "#e8e4dc", status: "ready" },
  { id: "dining",  name: "Dining Table",       type: "table",   x: 455, y: 215, rot: 0,  w: 160, d: 90,  h: 75,  color: "#a87a4a", status: "ready" },
  { id: "stool-1", name: "Bar Stool",          type: "chair",   x: 430, y: 300, rot: 0,  w: 40,  d: 40,  h: 75,  color: "#2c2c30", status: "ready" },
  { id: "stool-2", name: "Bar Stool",          type: "chair",   x: 530, y: 300, rot: 0,  w: 40,  d: 40,  h: 75,  color: "#2c2c30", status: "ready" },
];

// Catalog for the "add furniture" pipeline
window.CATALOG = [
  { id: "c-sofa",   name: "Modular Sofa",      type: "sofa",    w: 240, d: 100, h: 80 },
  { id: "c-chair",  name: "Accent Chair",      type: "chair",   w: 80,  d: 82,  h: 78 },
  { id: "c-table",  name: "Side Table",        type: "table",   w: 50,  d: 50,  h: 55 },
  { id: "c-shelf",  name: "Bookshelf",         type: "storage", w: 90,  d: 35,  h: 200 },
  { id: "c-bed",    name: "Queen Bed",         type: "bed",     w: 160, d: 210, h: 110 },
  { id: "c-desk",   name: "Writing Desk",      type: "desk",    w: 140, d: 70,  h: 75 },
  { id: "c-rug",    name: "Round Rug",         type: "rug",     w: 200, d: 200, h: 2 },
  { id: "c-plant",  name: "Potted Palm",       type: "plant",   w: 60,  d: 60,  h: 150 },
];

// Sample messy product blurb for the LLM spec-parse demo
window.SAMPLE_BLURB =
  "SÖDERHAMN 3-seat sofa, Finnsta turquoise. A low, deep and comfy seat. " +
  "Width: 198 cm, Depth: 99 cm, Height: 83 cm. Seat depth 60cm. " +
  "Free-standing; can be placed anywhere in the room.";

window.CM = function (n) { return Math.round(n) + " cm"; };
window.uid = function (p) { return (p || "id") + "-" + Math.random().toString(36).slice(2, 8); };
