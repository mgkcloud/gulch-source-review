/* Regenerates gulch-seed/seed.json with guaranteed-rectangular ASCII maps.
   Hand-typed ragged rows broke buildOverworld() (m.ascii[y] undefined -> throw),
   which silently killed boot() and left the canvas blank. Never hand-type maps again. */
const fs = require("fs");
const OUT = "/home/mgk/clawd/workspace/gulch-seed/seed.json";
const W = 60, H = 40;

function withBorder(w, h, fill) {
  const g = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      row += edge ? "#" : (fill === "." ? "." : fill);
    }
    g.push(row);
  }
  return g;
}
function put(g, x, y, ch) { if (g[y] && x >= 0 && x < g[y].length) g[y] = g[y].slice(0, x) + ch + g[y].slice(x + 1); }
function rect(g, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch);
}
function tree(g, x, y, ch) { put(g, x, y, ch); }
function verify(rows, w, h, label) {
  if (rows.length !== h) throw new Error(label + ": row count " + rows.length + " != " + h);
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(label + ": row " + i + " len " + r.length + " != " + w); });
}

/* ---------------- OVERWORLD: surface camp, lake, forest, a stair down ---------------- */
const ow = withBorder(W, H, ".");
// lake
rect(ow, 22, 3, 26, 7, "~");
// forest
for (const [x, y] of [[4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [5, 1], [5, 5], [55, 1], [55, 2], [55, 3], [55, 4], [55, 5], [54, 1], [54, 5],
  [4, 22], [4, 23], [5, 22], [5, 23], [55, 22], [55, 23], [54, 22], [54, 23], [6, 33], [6, 34], [53, 33], [53, 34]]) tree(ow, x, y, "T");
// fungus patches (soil)
rect(ow, 10, 18, 13, 21, ",");
rect(ow, 44, 10, 46, 13, ",");
// camp: plank floor with a plank hut
rect(ow, 29, 10, 33, 13, "_");
rect(ow, 30, 10, 32, 10, "#");
put(ow, 31, 12, "+");
// stair down at the hut door
put(ow, 31, 11, ">");
// glowcaps
for (const [x, y] of [[29, 12], [12, 19], [45, 11]]) put(ow, x, y, '"');
verify(ow, W, H, "overworld");

/* ---------------- CAVES: 48x30, glowcap-lit, no border violation ---------------- */
const CW = 48, CH = 30;
const cv = withBorder(CW, CH, ".");
// internal walls forming chambers
rect(cv, 8, 4, 8, 12, "#");
rect(cv, 12, 4, 12, 12, "#");
rect(cv, 8, 14, 8, 24, "#");
rect(cv, 12, 14, 12, 24, "#");
rect(cv, 20, 6, 20, 20, "#");
rect(cv, 24, 6, 24, 20, "#");
rect(cv, 30, 4, 30, 12, "#");
rect(cv, 34, 4, 34, 12, "#");
rect(cv, 30, 16, 30, 24, "#");
rect(cv, 34, 16, 34, 24, "#");
// shallow water pool
rect(cv, 16, 22, 19, 26, "~");
// fungus floors
rect(cv, 5, 8, 7, 9, '"');
rect(cv, 5, 18, 7, 19, '"');
rect(cv, 40, 8, 43, 9, '"');
rect(cv, 40, 18, 43, 19, '"');
// soil strips
rect(cv, 26, 10, 28, 14, ",");
rect(cv, 36, 6, 39, 10, ",");
verify(cv, CW, CH, "caves");

const spawn = { x: 30, y: 20 };
const stair = { x: 31, y: 11 };
if (ow[stair.y][stair.x] !== ">") throw new Error("stair not placed");
if (ow[spawn.y][spawn.x] === "#") throw new Error("spawn is a wall");

const seed = {
  meta: {
    name: "Gulch: Seed Project",
    desc: "Top-down grid roguelike. Dwarf Fortress / Caves of Qud / Brogue / Kelly Glitch lineage. This file is the source of truth: the chat overlay patches THIS, and the renderer reads THIS. No hard-coded level.",
    version: 2,
    tileSize: 32,
    fov: { radius: 9, lightFalloff: "linear", rememberExplored: true }
  },
  legend: {
    ".": ["floor", "stone"], "#": ["wall", "stone"], ",": ["floor", "soil"],
    '"': ["floor", "fungus"], "~": ["water", "shallow"], "+": ["door", "wood"],
    ">": ["stairs_down", "stone"], "T": ["floor", "tree"], "_": ["floor", "plank"]
  },
  maps: [
    {
      id: "overworld", name: "The Surface", w: W, h: H, ascii: ow,
      spawn,
      exits: [{ x: stair.x, y: stair.y, to: "caves", at: { x: 4, y: 4 } }]
    },
    { id: "caves", name: "The Gulch Caves", w: CW, h: CH, ascii: cv, spawn: { x: 4, y: 4 }, exits: [] }
  ],
  entities: [
    { id: "player", name: "Wanderer", glyph: "@", color: "#ffd479", hp: 24, maxHp: 24, x: spawn.x, y: spawn.y, map: "overworld", ai: "player", faction: "player" },
    { id: "trader", name: "Old Quill", glyph: "Q", color: "#7fd4ff", hp: 20, maxHp: 20, x: 31, y: 12, map: "overworld", ai: "wander", faction: "neutral", dialogue: "You look half-starved. Bring me stone and wood." },
    { id: "rat1", name: "gulch rat", glyph: "r", color: "#b08968", hp: 4, maxHp: 4, x: 38, y: 24, map: "overworld", ai: "chase", faction: "hostile" },
    { id: "rat2", name: "gulch rat", glyph: "r", color: "#b08968", hp: 4, maxHp: 4, x: 18, y: 8, map: "overworld", ai: "chase", faction: "hostile" },
    { id: "rat3", name: "gulch rat", glyph: "r", color: "#b08968", hp: 4, maxHp: 4, x: 44, y: 33, map: "overworld", ai: "chase", faction: "hostile" },
    { id: "shroom1", name: "glowcap", glyph: "*", color: "#9dff9d", hp: 1, maxHp: 1, x: 29, y: 12, map: "overworld", ai: "static", faction: "neutral", emitsLight: 3 },
    { id: "shroom2", name: "glowcap", glyph: "*", color: "#9dff9d", hp: 1, maxHp: 1, x: 6, y: 8, map: "caves", ai: "static", faction: "neutral", emitsLight: 3 },
    { id: "shroom3", name: "glowcap", glyph: "*", color: "#9dff9d", hp: 1, maxHp: 1, x: 6, y: 6, map: "caves", ai: "static", faction: "neutral", emitsLight: 3 },
    { id: "shroom4", name: "glowcap", glyph: "*", color: "#9dff9d", hp: 1, maxHp: 1, x: 41, y: 8, map: "caves", ai: "static", faction: "neutral", emitsLight: 3 },
    { id: "shroom5", name: "glowcap", glyph: "*", color: "#9dff9d", hp: 1, maxHp: 1, x: 41, y: 19, map: "caves", ai: "static", faction: "neutral", emitsLight: 3 }
  ],
  items: [
    { id: "stone", name: "chunk of tufa", glyph: "o", color: "#9aa0a6", stack: 20, weight: 2 },
    { id: "wood", name: "dry limb", glyph: "/", color: "#8d6e4a", stack: 20, weight: 1 },
    { id: "mineral", name: "barbedite shard", glyph: "^", color: "#c58aff", stack: 10, weight: 1 },
    { id: "glowcap", name: "glowcap", glyph: "*", color: "#9dff9d", stack: 10, weight: 0 }
  ],
  recipes: [
    { id: "torch", name: "torch", out: "wood:1", needs: { wood: 1, mineral: 1 }, emitsLight: 4, note: "First real light source. Worth making before the caves." },
    { id: "plank", name: "plank", out: "wood:1", needs: { wood: 2 }, note: "Placeable flooring." },
    { id: "meal", name: "glowcap meal", out: "glowcap:1", needs: { glowcap: 2 }, heals: 3, note: "Edible. Tastes like static." }
  ],
  inventory: { player: { wood: 3, stone: 2 } },
  progression: {
    milestones: [
      { id: "m1", done: false, text: "Talk to Old Quill at the surface camp." },
      { id: "m2", done: false, text: "Craft a torch (1 wood + 1 barbedite)." },
      { id: "m3", done: false, text: "Descend into the caves." },
      { id: "m4", done: false, text: "Survive the caves for 3 turns without fleeing." }
    ]
  },
  changelog: ["v1: first seed (ragged ASCII, rejected by the renderer).",
    "v2: maps generated rectangularly and verified; stair at the hut door; 10 entities; 4 recipes; 4 milestones."]
};

// final self-check before writing
for (const m of seed.maps) {
  if (m.ascii.length !== m.h) throw new Error(m.id + " rows " + m.ascii.length);
  m.ascii.forEach((r, i) => { if (r.length !== m.w) throw new Error(m.id + " row " + i + " len " + r.length); });
}
fs.writeFileSync(OUT, JSON.stringify(seed, null, 2) + "\n");
console.log("seed.json v2 written — both maps verified rectangular");
console.log("overworld", W + "x" + H, "| caves", CW + "x" + CH, "| stair at", stair.x + "," + stair.y, "| spawn", spawn.x + "," + spawn.y);
