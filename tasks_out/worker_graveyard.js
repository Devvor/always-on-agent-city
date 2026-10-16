// =====================================================================
// GRAVEYARD :: window.GuildGraveyard
// ---------------------------------------------------------------------
// A small memorial plot of leaning stones, one per FAILED quest id on
// the board, planted in the north-edge GRAVEYARD zone near grid (-5,-5)
// (LAYOUT.md). Stones are capped at 8, newest last, and carry the task
// title as an epitaph (fitted through window.fitText). Drifting ghost
// wisps (soft white alpha) only appear after dark (V.daylight < 0.3).
// Pure FX / prop layer: no collision, never writes to V or worker state.
// Conventions copied from tasks_out/worker_visitor.js: self-installing ES
// module, no imports, no top-level DOM access, state on a window global
// exposing update(now) / draw(ctx) hooks plus __probe(). Bails silently
// if V or iso are missing. Palette: stone greys + gold (#d4af37) + soft
// white wisps only.
// =====================================================================

// Named zone anchor. Reads the registry if a GRAVEYARD district is ever
// published there, otherwise claims the N-edge plot ourselves.
const GRAVEYARD_ZONE = (typeof window !== 'undefined' && window.GuildZones && window.GuildZones.GRAVEYARD) || { gx: -5, gy: -5 };

const STONE_CAP = 8;             // one leaning stone per failed id, capped
const MIN_PROP_TILES = 2;       // ZONE RULE: 2+ tiles from every existing prop
const WISP_COUNT = 5;           // drifting ghost wisps over the plot
const WISP_DAYLIGHT_MAX = 0.3;  // wisps only when V.daylight < 0.3
const SEARCH_RX = 4;            // cluster search half-width (gx) around anchor
const SEARCH_RY = 5;            // cluster search depth (gy, north side)

// stone greys / soft white / gold only - no new accent colours
const STONE_TONES = ['#9ca3af', '#78716c', '#6b7280', '#57534e'];
const STONE_LIGHT = '#d1d5db';
const STONE_DARK = '#4b5563';
const GOLD = '#d4af37';
const GOLD_SOFT = '#f3d37a';

// ---- environment helpers (typeof-guarded, read only) -----------------
function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildGraveyard; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try {
      const p = w.iso(gx, gy);
      if (p && isFinite(p.x) && isFinite(p.y)) return p;
    } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g && isFinite(g.originX) && isFinite(g.originY) && isFinite(g.tileW) && isFinite(g.tileH)) {
    return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  }
  return null;
}

function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  return String(text == null ? '' : text);
}

function hasIso(Vv) {
  const w = root();
  if (w && typeof w.iso === 'function') return true;
  return !!(Vv && Vv.grid && isFinite(Vv.grid.originX) && isFinite(Vv.grid.tileW));
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

// ---- prop awareness --------------------------------------------------
// Existing props the graveyard must stand clear of (core client props,
// the hearth cluster, and the N-edge neighbours already sharing this zone).
function existingProps() {
  return [
    // hearth + core client props
    { gx: -8, gy: 2.5 }, { gx: -7.5, gy: -5 }, { gx: 7.5, gy: 0.5 }, { gx: -4.5, gy: 6 },
    { gx: 0, gy: -1 }, { gx: 2.5, gy: -2.5 }, { gx: -2, gy: 2 },
    { gx: 1, gy: 0 }, { gx: 1, gy: 1 },
    { gx: -1, gy: -1 }, { gx: 1, gy: -1 }, { gx: -1, gy: 1 }, { gx: 1, gy: 1 },
    // N-edge neighbours inside / beside this zone
    { gx: -4, gy: -6 }, { gx: -2, gy: -6 }, { gx: 0, gy: -6 }, { gx: 2, gy: -6 }, { gx: 4, gy: -6 },
    { gx: -5, gy: -4 }, { gx: -4, gy: -4 }, { gx: -6, gy: -3 }, { gx: -5, gy: -3 }, { gx: -4, gy: -3 },
    { gx: -3, gy: -5.2 }, { gx: -2.6, gy: -4.4 }, { gx: -1.2, gy: -5 }, { gx: -2.5, gy: -5 },
    { gx: -1, gy: -6 }, { gx: -2.5, gy: -6 }, { gx: -0.5, gy: -5 },
    { gx: 2.5, gy: -6.5 },
    { gx: -7, gy: -4.5 }, { gx: -8.5, gy: -6 }
  ];
}

function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

function clears(gx, gy, props) {
  for (let i = 0; i < props.length; i++) {
    if (cheb(gx, gy, props[i].gx, props[i].gy) < MIN_PROP_TILES) return false;
  }
  return true;
}

// Nearest-first cluster of standable tiles around the claimed anchor,
// each 2+ tiles from every existing prop (ZONE RULE).
function buildSpots() {
  const a = GRAVEYARD_ZONE;
  const props = existingProps();
  const spots = [];
  for (let dy = -SEARCH_RY; dy <= 1; dy++) {
    for (let dx = -SEARCH_RX; dx <= SEARCH_RX; dx++) {
      const gx = a.gx + dx;
      const gy = a.gy + dy;
      if (!clears(gx, gy, props)) continue;
      spots.push({ gx: gx, gy: gy, d: Math.hypot(dx, dy) });
    }
  }
  spots.sort(function (p, q) {
    if (p.d !== q.d) return p.d - q.d;
    if (p.gx !== q.gx) return p.gx - q.gx;
    return p.gy - q.gy;
  });
  return spots;
}

// ---- state -----------------------------------------------------------
function createState() {
  return {
    stones: [],
    key: '',
    spots: null,
    wisps: null,
    lastNow: null
  };
}

function ensureWisps(state) {
  if (Array.isArray(state.wisps) && state.wisps.length) return state.wisps;
  const a = GRAVEYARD_ZONE;
  const wisps = [];
  for (let i = 0; i < WISP_COUNT; i++) {
    wisps.push({
      hx: a.gx + (seeded(300 + i * 7.3) - 0.5) * 3.6,
      hy: a.gy - 2.6 + (seeded(301 + i * 5.1) - 0.5) * 3.0,
      rx: 0.5 + seeded(302 + i * 3.7) * 0.9,
      ry: 0.3 + seeded(303 + i * 4.3) * 0.5,
      p1: 2200 + seeded(304 + i * 2.9) * 2400,
      p2: 2600 + seeded(305 + i * 6.1) * 2600,
      p3: 1400 + seeded(306 + i * 3.3) * 1200,
      phase: seeded(307 + i * 8.7) * Math.PI * 2
    });
  }
  state.wisps = wisps;
  return wisps;
}

// One stone per failed task id, cap 8, newest last; positions come from
// the clearance-checked spot list so the plot never overlaps a prop.
function buildStones(Vv, state) {
  const tasks = Array.isArray(Vv && Vv.allTasks) ? Vv.allTasks : [];
  const failed = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t && t.status === 'failed') failed.push(t);
  }
  const kept = failed.slice(-STONE_CAP); // cap 8, newest last
  if (!state.spots) state.spots = buildSpots();
  const spots = state.spots;
  const stones = [];
  for (let i = 0; i < kept.length; i++) {
    const t = kept[i] || {};
    const id = (t.id != null) ? String(t.id) : (t.title != null ? String(t.title) : ('failed#' + i));
    const title = (t.title != null) ? String(t.title) : id;
    const last = spots.length ? spots[spots.length - 1] : null;
    const spot = spots[i] || last || { gx: GRAVEYARD_ZONE.gx, gy: GRAVEYARD_ZONE.gy };
    const h = hashString(id);
    stones.push({
      id: id,
      title: title,
      gx: spot.gx,
      gy: spot.gy,
      tone: STONE_TONES[h % STONE_TONES.length],
      lean: (((h >>> 8) % 100) / 100 - 0.5) * 0.5,
      seed: (h % 997)
    });
  }
  return stones;
}

function stonesKey(stones) {
  let key = String(stones.length);
  for (let i = 0; i < stones.length; i++) key += '|' + stones[i].id + '\u0001' + stones[i].title;
  return key;
}

// ---- update ----------------------------------------------------------
function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv) return;       // bail silently
  if (!hasIso(Vv)) return;         // bail silently
  state.lastNow = now;
  if (Vv.gameState !== 'play') return;

  const stones = buildStones(Vv, state);
  const key = stonesKey(stones);
  if (key !== state.key) {
    state.key = key;
    state.stones = stones;
  }
  ensureWisps(state);
}

// ---- drawing ---------------------------------------------------------
function drawStone(ctx, stone, now, labels) {
  const pt = isoFn(stone.gx, stone.gy);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  // ground shadow stays flat while the slab leans
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 7, y + 1, 14, 4);

  const sway = Math.sin(now / 2600 + stone.seed) * 0.02;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(stone.lean + sway);
  ctx.fillStyle = stone.tone;
  ctx.fillRect(-4, -12, 9, 13);
  ctx.fillStyle = STONE_LIGHT;
  ctx.fillRect(-4, -12, 9, 2);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(-4, 0, 9, 2);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-1, -9, 2, 2);
  ctx.restore();

  // epitaph plaque (one label per stone, colliding labels suppressed)
  const text = fitFn(stone.title, 56);
  if (!text) return;
  ctx.font = '8px monospace';
  const tw = ctx.measureText(text).width;
  const pw = Math.round(tw) + 8;
  const ph = 11;
  const px = x - Math.round(pw * 0.5);
  const py = y - 26;
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (px < l.x + l.w && px + pw > l.x && py < l.y + l.h && py + ph > l.y) return;
  }
  labels.push({ x: px, y: py, w: pw, h: ph });
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = GOLD_SOFT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';
}

function drawWisps(ctx, state, now) {
  const wisps = ensureWisps(state);
  if (!Array.isArray(wisps)) return;
  for (let i = 0; i < wisps.length; i++) {
    const w = wisps[i];
    const gx = w.hx + Math.sin(now / w.p1 + w.phase) * w.rx;
    const gy = w.hy + Math.cos(now / w.p2 + w.phase * 1.3) * w.ry;
    const pt = isoFn(gx, gy);
    if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) continue;
    const float = 16 + Math.sin(now / w.p3 + w.phase) * 5;
    const x = pt.x;
    const y = pt.y - float;
    const pulse = 0.5 + 0.5 * Math.sin(now / 900 + w.phase);
    const alpha = 0.10 + 0.22 * pulse;
    const r = 5 + 2 * pulse;
    const g = ctx.createRadialGradient(x, y, 0.5, x, y, r + 3);
    g.addColorStop(0, 'rgba(248,250,252,' + alpha.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(248,250,252,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  const Vv = getV();
  if (!state || !Vv) return;      // bail silently
  if (!hasIso(Vv)) return;        // bail silently
  if (Vv.gameState !== 'play') return;
  const now = (typeof state.lastNow === 'number') ? state.lastNow : nowFn();

  const stones = Array.isArray(state.stones) ? state.stones : [];
  const labels = [];
  for (let i = 0; i < stones.length; i++) drawStone(ctx, stones[i], now, labels);

  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  if (dl < WISP_DAYLIGHT_MAX) drawWisps(ctx, state, now);

  ctx.globalAlpha = 1;
}

// ---- test hook -------------------------------------------------------
function __probe() {
  const state = getState();
  const Vv = getV();
  const dl = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  if (!state) return { stones: 0, ids: [], positions: [], wisps: 0, wispsVisible: dl < WISP_DAYLIGHT_MAX, zone: { gx: GRAVEYARD_ZONE.gx, gy: GRAVEYARD_ZONE.gy } };
  return {
    stones: Array.isArray(state.stones) ? state.stones.length : 0,
    ids: Array.isArray(state.stones) ? state.stones.map(function (s) { return s.id; }) : [],
    positions: Array.isArray(state.stones) ? state.stones.map(function (s) { return { gx: s.gx, gy: s.gy }; }) : [],
    wisps: Array.isArray(state.wisps) ? state.wisps.length : 0,
    wispsVisible: dl < WISP_DAYLIGHT_MAX,
    zone: { gx: GRAVEYARD_ZONE.gx, gy: GRAVEYARD_ZONE.gy }
  };
}

// ---- self-install ----------------------------------------------------
if (typeof window !== 'undefined') {
  if (!window.GuildGraveyard || typeof window.GuildGraveyard !== 'object') {
    window.GuildGraveyard = createState();
  }
  const state = window.GuildGraveyard;
  if (!Array.isArray(state.stones)) state.stones = [];
  if (typeof state.key !== 'string') state.key = '';
  if (!state.spots) state.spots = null;
  if (!Array.isArray(state.wisps)) state.wisps = null;
  if (typeof state.lastNow !== 'number') state.lastNow = null;
  state.update = update;
  state.draw = draw;
  state.__probe = __probe;
  state.__rawUpdate = update;
}

export {};
