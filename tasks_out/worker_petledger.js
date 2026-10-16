// GUILD PETTING-ZOO LEDGER (worker_pettingzoo.js) — a wooden ledger plaque on a post in
// the E garden (gx 9, gy 2: 2+ tiles clear of the butterfly meadow at 4..6/0..3 and the
// wish-seed plot at 5,1.5). It lists every pettable creature it can find — the cat and
// fox modules are probed from window.Guild* defensively (try/catch) — with a live pet
// count beside each name. Counts are read straight from the creature globals (cat.petCount,
// fox state -> 'follow') so the ledger ticks up the instant the visitor pets. Per canon
// §9b the board shows at most 3 standing lines (title + first two creatures) and expands
// to the full list + totals when the visitor is near. Text is fit with window.fitText and
// the whole board is clamped inside the island bounds, per the sign-clip findings. The
// night glow uses the existing gold accent only. Self-contained ES module; the client's
// window.Guild* loop wires update(now)/draw(ctx).

const PLAQUE_GX = 9;
const PLAQUE_GY = 2;
const NEAR_TILES = 2.4;
const POST_H = 22;
const BOARD_W = 94;
const ROW_H = 11;
const HEADER_H = 15;
const FOOTER_H = 13;
const COUNT_KEYS = ['petCount', 'pets', 'pet_count', 'petcount', 'pats', 'boops'];
const KNOWN = [
  { key: 'GuildCat', name: 'CAT', watchField: null, watchValue: null },
  { key: 'GuildPetFox', name: 'FOX', watchField: 'state', watchValue: 'follow' }
];

function createState() {
  return {
    gx: PLAQUE_GX,
    gy: PLAQUE_GY,
    entries: [],
    built: false,
    lastTime: null,
    near: false,
    glow: 0,
    sway: 0,
    flash: 0,
    total: 0
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildPettingZoo; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

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
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  return String(text == null ? '' : text);
}

function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function tileDistance(sx, sy, vx, vy, g) {
  if (!g || !isFinite(sx) || !isFinite(sy) || !isFinite(vx) || !isFinite(vy)) return Infinity;
  const tileW = isFinite(g.tileW) && g.tileW ? g.tileW : 1;
  const tileH = isFinite(g.tileH) && g.tileH ? g.tileH : 1;
  const dx = sx - vx;
  const dy = sy - vy;
  return Math.hypot(dx / tileW + dy / tileH, dy / tileH - dx / tileW);
}

function pickNum(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (let i = 0; i < keys.length; i++) {
    const v = obj[keys[i]];
    if (typeof v === 'number' && isFinite(v)) return v;
  }
  return null;
}

function probeCount(obj, keys) {
  if (!obj || typeof obj.__probe !== 'function') return null;
  try {
    const p = obj.__probe();
    if (p && typeof p === 'object') return pickNum(p, keys);
  } catch (e) {}
  return null;
}

function nameFromKey(key) {
  let s = String(key || '').replace(/^Guild/, '');
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toUpperCase();
  return s || 'CREATURE';
}

function makeEntry(key, name, src, useProbe, watchField, watchValue) {
  return {
    key: key,
    name: name,
    src: src,
    countKeys: COUNT_KEYS.slice(),
    useProbe: !!useProbe,
    watchField: watchField || null,
    watchValue: watchValue || null,
    count: 0,
    prevCount: null,
    prevState: null,
    mirrored: 0,
    flash: 0
  };
}

function buildEntries() {
  const st = getState();
  const w = root();
  if (!st || !w) return;
  const entries = [];
  const seen = {};
  for (let i = 0; i < KNOWN.length; i++) {
    const def = KNOWN[i];
    let src = null;
    try { src = w[def.key]; } catch (e) { src = null; }
    if (!src || typeof src !== 'object') continue;
    seen[def.key] = true;
    entries.push(makeEntry(def.key, def.name, src, true, def.watchField, def.watchValue));
  }
  for (const k in w) {
    if (!/^Guild/.test(k)) continue;
    if (k === 'GuildPettingZoo' || k === 'GuildVisitor' || seen[k]) continue;
    let src = null;
    try { src = w[k]; } catch (e) { continue; }
    if (!src || typeof src !== 'object') continue;
    if (pickNum(src, COUNT_KEYS) == null) continue;
    seen[k] = true;
    entries.push(makeEntry(k, nameFromKey(k), src, false, null, null));
  }
  st.entries = entries;
  st.built = true;
}

function pollSources(st) {
  const entries = Array.isArray(st.entries) ? st.entries : [];
  let booms = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const src = e.src;
    if (!src) continue;
    let live = pickNum(src, e.countKeys);
    if (live == null && e.useProbe) live = probeCount(src, e.countKeys);
    if (e.watchField) {
      let sv = '';
      try { sv = String(src[e.watchField] == null ? '' : src[e.watchField]); } catch (err) { sv = ''; }
      if (e.watchValue && sv === e.watchValue && e.prevState !== e.watchValue) {
        e.mirrored = (e.mirrored || 0) + 1;
        e.flash = 1;
        booms++;
      }
      e.prevState = sv;
    }
    if (live != null) {
      live = Math.floor(live);
      if (e.prevCount != null && live > e.prevCount) { e.flash = 1; booms++; }
      e.prevCount = live;
      e.count = live;
    } else {
      e.count = e.mirrored || 0;
    }
  }
  return booms;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') { st.lastTime = now; return; }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  if (!st.built) buildEntries();
  st.glow += dt;
  st.sway += dt;

  const vis = getVisitor();
  let near = false;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy) && Vv.grid) {
    near = tileDistance(vis.gx, vis.gy, st.gx, st.gy, Vv.grid) <= NEAR_TILES;
  }
  st.near = near;

  const booms = pollSources(st);
  if (booms > 0) {
    st.flash = 1;
    try { if (typeof root().cue === 'function') root().cue('pet'); } catch (e) {}
  }

  st.flash = Math.max(0, st.flash - dt * 1.6);
  const entries = Array.isArray(st.entries) ? st.entries : [];
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].flash > 0) entries[i].flash = Math.max(0, entries[i].flash - dt * 1.4);
    total += Math.floor(entries[i].count) || 0;
  }
  st.total = total;
}

function islandBounds(Vv, fallbackX) {
  const g = (Vv && Vv.grid) ? Vv.grid : null;
  if (!g) return { left: fallbackX - 200, right: fallbackX + 200 };
  const s = (typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
  const half = (3 + 2 * s) * (isFinite(g.tileW) && g.tileW ? g.tileW : 1) * 0.5;
  return { left: g.originX - half, right: g.originX + half };
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  if (!st.built) buildEntries();
  pollSources(st);

  const now = nowFn();
  const anchor = isoFn(st.gx, st.gy);
  const ax = Math.round(anchor.x);
  const ay = Math.round(anchor.y);
  const near = st.near;
  const entries = Array.isArray(st.entries) ? st.entries : [];
  const shown = near ? entries : entries.slice(0, 2);
  const rows = Math.max(1, shown.length);
  const boardH = near
    ? HEADER_H + rows * ROW_H + FOOTER_H + 6
    : HEADER_H + rows * ROW_H + 6;

  const bounds = islandBounds(Vv, ax);
  let bx = ax - Math.round(BOARD_W * 0.5);
  const lo = Math.round(bounds.left) + 4;
  const hi = Math.round(bounds.right) - BOARD_W - 4;
  if (hi >= lo) bx = clamp(bx, lo, hi);
  else bx = Math.round((bounds.left + bounds.right) * 0.5 - BOARD_W * 0.5);
  bx += Math.round(Math.sin(now * 0.0016 + st.sway) * 1);
  bx = Math.round(bx);

  const boardBottom = ay - POST_H;
  const by = Math.max(6, Math.round(boardBottom - boardH));
  const postX = Math.round(bx + BOARD_W * 0.5);
  const night = (typeof Vv.nightFactor === 'number' && isFinite(Vv.nightFactor)) ? Vv.nightFactor : 0;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(postX - 14, ay + 1, 28, 5);

  if (night > 0.12) {
    const gcx = bx + BOARD_W * 0.5;
    const gcy = by + boardH * 0.5;
    const glow = 0.30 * night * (0.85 + 0.15 * Math.sin(now * 0.002 + st.glow));
    const grad = ctx.createRadialGradient(gcx, gcy, 2, gcx, gcy, BOARD_W * 0.9);
    grad.addColorStop(0, 'rgba(212,175,55,' + glow.toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx - BOARD_W, by - BOARD_W * 0.6, BOARD_W * 3, boardH + BOARD_W * 1.2);
  }

  ctx.fillStyle = '#3f2a16';
  ctx.fillRect(postX - 3, boardBottom, 6, POST_H + 4);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(postX - 3, boardBottom, 4, POST_H + 4);
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(postX - 2, boardBottom + 2, 1, POST_H);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(bx - 2, by - 2, BOARD_W + 4, boardH + 4);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx - 2, by - 2, BOARD_W + 4, boardH + 4);
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(bx + 2, by + 2, BOARD_W - 4, boardH - 4);

  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3f2a16';
  ctx.fillText(fitFn('PET LEDGER', BOARD_W - 14), bx + BOARD_W * 0.5, by + 9);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(bx + 8, by + HEADER_H - 1, BOARD_W - 16, 1);

  if (!shown.length) {
    ctx.font = '9px monospace';
    ctx.fillStyle = '#2b1d0e';
    ctx.fillText(fitFn('NO PETS YET', BOARD_W - 14), bx + BOARD_W * 0.5, by + HEADER_H + ROW_H);
  }

  let ry = by + HEADER_H + 2;
  for (let i = 0; i < shown.length; i++) {
    const e = shown[i];
    const cy = ry + ROW_H * 0.5;
    if (e.flash > 0) {
      ctx.fillStyle = 'rgba(212,175,55,' + (0.40 * e.flash).toFixed(3) + ')';
      ctx.fillRect(bx + 4, ry - 1, BOARD_W - 8, ROW_H);
    }
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const countStr = String(Math.floor(e.count) || 0);
    const cw = ctx.measureText(countStr).width;
    const name = fitFn(e.name, BOARD_W - 14 - cw - 10);
    ctx.fillStyle = '#2b1d0e';
    ctx.fillText(name, bx + 6, cy);
    const nw = ctx.measureText(name).width;
    const dotStart = bx + 6 + nw + 3;
    const dotEnd = bx + BOARD_W - 8 - cw;
    ctx.fillStyle = 'rgba(43,29,14,0.32)';
    for (let dx = dotStart; dx < dotEnd; dx += 3) ctx.fillRect(Math.round(dx), cy, 1, 1);
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.fillText(countStr, bx + BOARD_W - 6, cy);
    ry += ROW_H;
  }

  if (near) {
    const fy = by + boardH - FOOTER_H * 0.5 - 1;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(bx + 8, by + boardH - FOOTER_H - 1, BOARD_W - 16, 1);
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2b1d0e';
    ctx.fillText(fitFn('TOTAL', 40), bx + 6, fy);
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(st.total) || 0), bx + BOARD_W - 6, fy);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildPettingZoo) window.GuildPettingZoo = createState();
  const st = window.GuildPettingZoo;
  if (!Array.isArray(st.entries)) st.entries = [];
  st.update = update;
  st.draw = draw;
  st.__probe = function () {
    return {
      gx: st.gx,
      gy: st.gy,
      near: st.near,
      total: st.total,
      built: st.built,
      entries: (Array.isArray(st.entries) ? st.entries : []).map(function (e) {
        return { key: e.key, name: e.name, count: Math.floor(e.count) || 0, flash: e.flash };
      })
    };
  };
}

export {};
