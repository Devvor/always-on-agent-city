// =====================================================================
// WIND CHIME GROVE :: window.GuildWindChimes
// ---------------------------------------------------------------------
// Five small bamboo wind chimes hanging from the NW tree line of the
// island. Chime tile coordinates (gx, gy), spread along gx 3..8 and
// gy 3..6 so the grove fills the NW corner, away from the central
// buildings:
//   1. { gx: 3.0, gy: 3.0 }
//   2. { gx: 4.3, gy: 3.7 }
//   3. { gx: 5.6, gy: 4.2 }
//   4. { gx: 6.9, gy: 5.1 }
//   5. { gx: 8.0, gy: 5.9 }
// Conventions copied from tasks_out/worker_visitor.js: self-installing
// ES module, no imports, no top-level DOM access, state object on a
// window global exposing update(now) / draw(ctx) hooks plus __probe().
// State shape: window.GuildWindChimes = { chimes: [], rings: 0, breeze: 0 }.
// Palette discipline: gold / parchment / night-blue tones only.
// =====================================================================

// ---- tunables -------------------------------------------------------
const MAX_SWING_DEG = 8;            // peak swing angle in degrees
const RING_COOLDOWN_MS = 6000;      // at most one ring per chime / 6s
const RIPPLE_LIFE_MS = 700;         // expanding pale ripple after a ring
const NOTE_LIFE_MS = 1500;          // visitor musical note lifetime
const NIGHT_DAYLIGHT = 0.35;        // fireflies below this daylight
const FIREFLY_COUNT = 6;

// gold / parchment bamboo tints (no new accent colors)
const BAR_TONES = ['#dccfa2', '#cbb98a', '#bda173', '#e0d3ae', '#b09a6a'];

// Per-chime seeds: tile coords, swing phase + period, normalized ring
// threshold (0..1) and dangling bar lengths in pixels (3-5 bars each).
const CHIME_SEEDS = [
  { gx: 3.0, gy: 3.0, phase: 0.0, period: 2100, threshold: 0.46, bars: [14, 9, 17, 11] },
  { gx: 4.3, gy: 3.7, phase: 1.35, period: 2450, threshold: 0.54, bars: [10, 16, 8, 19, 12] },
  { gx: 5.6, gy: 4.2, phase: 2.6, period: 1850, threshold: 0.62, bars: [15, 10, 13] },
  { gx: 6.9, gy: 5.1, phase: 3.8, period: 2650, threshold: 0.50, bars: [9, 18, 12, 21] },
  { gx: 8.0, gy: 5.9, phase: 5.1, period: 2250, threshold: 0.58, bars: [13, 8, 16, 10, 19] }
];

// Night firefly home points dotted between the chimes (tile coords);
// each drifts on a small sinusoid loop around its home point.
const FIREFLY_SEEDS = [
  { hx: 3.6, hy: 3.3, rx: 0.32, ry: 0.22, p1: 1500, p2: 1900, phase: 0.4 },
  { hx: 4.9, hy: 3.9, rx: 0.26, ry: 0.30, p1: 1700, p2: 1400, phase: 1.9 },
  { hx: 5.9, hy: 4.4, rx: 0.30, ry: 0.26, p1: 1300, p2: 2100, phase: 3.1 },
  { hx: 6.8, hy: 5.0, rx: 0.24, ry: 0.28, p1: 1600, p2: 1250, phase: 4.4 },
  { hx: 7.6, hy: 5.5, rx: 0.34, ry: 0.24, p1: 1450, p2: 1750, phase: 5.6 },
  { hx: 4.3, hy: 4.9, rx: 0.28, ry: 0.20, p1: 1850, p2: 1350, phase: 2.6 }
];

// ---- environment helpers (typeof-guarded, read only) -----------------
function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildWindChimes; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoPt(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try {
      const p = w.iso(gx, gy);
      if (p && isFinite(p.x) && isFinite(p.y)) return { x: p.x, y: p.y };
    } catch (e) {
      return null;
    }
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g && isFinite(g.originX) && isFinite(g.originY) && isFinite(g.tileW) && isFinite(g.tileH)) {
    return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  }
  return null;
}

function cue(name) {
  const w = root();
  const fn = w && w.cue;
  if (typeof fn !== 'function') return;
  try { fn(name); } catch (e) {}
}

function breezeAt(now) { return 0.5 + 0.5 * Math.sin(now / 3500); }
function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

// ---- state -----------------------------------------------------------
function createState() {
  const chimes = [];
  for (let i = 0; i < CHIME_SEEDS.length; i++) {
    const s = CHIME_SEEDS[i];
    chimes.push({
      gx: s.gx,
      gy: s.gy,
      phase: s.phase,
      period: s.period,
      threshold: s.threshold,
      bars: s.bars.slice(),
      lastRing: -1e9,
      prevAmp: 0
    });
  }
  return {
    chimes: chimes,
    rings: 0,
    breeze: 0,
    _ripples: [],
    _notes: [],
    _fireflies: null
  };
}

function ensureFireflies(state) {
  if (Array.isArray(state._fireflies)) return state._fireflies;
  const flies = [];
  for (let i = 0; i < FIREFLY_COUNT && i < FIREFLY_SEEDS.length; i++) {
    const s = FIREFLY_SEEDS[i];
    flies.push({ hx: s.hx, hy: s.hy, rx: s.rx, ry: s.ry, p1: s.p1, p2: s.p2, phase: s.phase });
  }
  state._fireflies = flies;
  return flies;
}

function prune(list, now) {
  if (!Array.isArray(list)) return;
  let k = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (now - e.start < e.dur) list[k++] = e;
  }
  list.length = k;
}

function visitorNear(ch) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis) return false;
  if (typeof vis.gx !== 'number' || typeof vis.gy !== 'number') return false;
  if (!isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return Math.hypot(vis.gx - ch.gx, vis.gy - ch.gy) <= 1.5;
}

function ringChime(state, ch, now) {
  state.rings += 1;
  if (!Array.isArray(state._ripples)) state._ripples = [];
  state._ripples.push({ gx: ch.gx, gy: ch.gy, start: now, dur: RIPPLE_LIFE_MS });
  cue('coin');
  if (visitorNear(ch)) {
    if (!Array.isArray(state._notes)) state._notes = [];
    state._notes.push({ gx: ch.gx, gy: ch.gy, start: now, dur: NOTE_LIFE_MS });
  }
}

// ---- update ----------------------------------------------------------
function update(now) {
  const state = getState();
  if (!state || !Array.isArray(state.chimes)) return;
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;

  // Breeze oscillates slowly; every chime shares it but swings at its
  // own phase + period, so the grove never moves in lockstep.
  state.breeze = breezeAt(now);
  prune(state._ripples, now);
  prune(state._notes, now);
  const night = (typeof Vv.daylight === 'number') ? Vv.daylight < NIGHT_DAYLIGHT : false;
  if (night) ensureFireflies(state);

  for (let i = 0; i < state.chimes.length; i++) {
    const ch = state.chimes[i];
    // Normalized swing amplitude (0..1): breeze multiplied by the swing
    // sine, so a gust (high breeze) reaches deeper into the threshold.
    const osc = Math.sin(now / ch.period + ch.phase);
    const amp = Math.abs(osc * state.breeze);
    const rising = ch.prevAmp < ch.threshold && amp >= ch.threshold;
    ch.prevAmp = amp;
    if (!rising) continue;
    if (now - ch.lastRing < RING_COOLDOWN_MS) continue;
    ch.lastRing = now;
    ringChime(state, ch, now);
  }
}

// ---- drawing ----------------------------------------------------------
function drawChime(ctx, ch, breeze, now) {
  const pt = isoPt(ch.gx, ch.gy);
  if (!pt) return;
  const ax = Math.round(pt.x);
  const ay = Math.round(pt.y);
  const angle = MAX_SWING_DEG * (Math.PI / 180) * breeze * Math.sin(now / ch.period + ch.phase);

  // Tree branch stub + hang line the chime dangles from (parchment tones).
  ctx.fillStyle = '#6b5a38';
  ctx.fillRect(ax - 6, ay - 37, 12, 2);
  ctx.fillStyle = '#8a7a56';
  ctx.fillRect(ax, ay - 36, 1, 11);

  // Small bamboo crossbar with a lit top edge.
  ctx.fillStyle = '#c9b682';
  ctx.fillRect(ax - 10, ay - 26, 20, 3);
  ctx.fillStyle = '#e6d9b0';
  ctx.fillRect(ax - 10, ay - 26, 20, 1);

  // The whole dangling assembly swings via canvas rotation around the
  // crossbar point; per-chime phase keeps the five out of lockstep.
  ctx.save();
  ctx.translate(ax, ay - 23);
  ctx.rotate(angle);

  for (let b = 0; b < ch.bars.length; b++) {
    const count = ch.bars.length;
    const off = Math.round(((b + 1) / (count + 1)) * 18) - 9;
    const len = ch.bars[b];
    ctx.save();
    ctx.translate(off, 0);
    ctx.rotate(angle * 0.12 * ((b % 3) - 1)); // tiny per-bar lag
    ctx.fillStyle = BAR_TONES[b % BAR_TONES.length];
    ctx.fillRect(-1, 0, 2, len);
    ctx.fillStyle = 'rgba(122,106,72,0.75)';
    ctx.fillRect(-1, len - 1, 2, 1);
    ctx.restore();
  }

  // Tiny clapper dot, swaying slightly against the crossbar.
  ctx.save();
  ctx.rotate(-angle * 0.5);
  ctx.fillStyle = '#8a7a56';
  ctx.fillRect(0, 0, 1, 4);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-1, 4, 3, 3);
  ctx.restore();

  ctx.restore();
}

function drawFireflies(ctx, state, Vv, now) {
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  if (dl >= NIGHT_DAYLIGHT) return; // no fireflies during day
  const flies = ensureFireflies(state);
  if (!Array.isArray(flies)) return;
  for (let i = 0; i < flies.length; i++) {
    const f = flies[i];
    const gx = f.hx + f.rx * Math.sin(now / f.p1 + f.phase);
    const gy = f.hy + f.ry * Math.cos(now / f.p2 + f.phase * 1.7);
    const pt = isoPt(gx, gy);
    if (!pt) continue;
    const pulse = 0.5 + 0.5 * Math.sin(now / 900 + f.phase);
    const alpha = 0.22 + 0.6 * pulse;
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = '#93a7d4';
    ctx.fillRect(x - 1, y - 1, 4, 4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f3d37a';
    ctx.fillRect(x, y, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function drawRipples(ctx, state, now) {
  if (!Array.isArray(state._ripples)) return;
  for (let i = 0; i < state._ripples.length; i++) {
    const r = state._ripples[i];
    const t = (now - r.start) / r.dur;
    if (t < 0 || t > 1) continue;
    const pt = isoPt(r.gx, r.gy);
    if (!pt) continue;
    const rad = 3 + t * 22;
    const alpha = 0.55 * (1 - t);
    ctx.strokeStyle = 'rgba(240,234,214,' + alpha.toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y - 16, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawNotes(ctx, state, now) {
  if (!Array.isArray(state._notes)) return;
  for (let i = 0; i < state._notes.length; i++) {
    const n = state._notes[i];
    const t = (now - n.start) / n.dur;
    if (t < 0 || t > 1) continue;
    const pt = isoPt(n.gx, n.gy);
    if (!pt) continue;
    const fadeIn = t < 0.15 ? t / 0.15 : 1;
    const fadeOut = 1 - clamp01((t - 0.55) / 0.45);
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f3d37a';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u266A', pt.x + Math.sin(t * 3.2) * 2, pt.y - 40 - t * 12);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  state.breeze = breezeAt(now);
  drawFireflies(ctx, state, Vv, now);
  for (let i = 0; i < state.chimes.length; i++) {
    drawChime(ctx, state.chimes[i], state.breeze, now);
  }
  drawRipples(ctx, state, now);
  drawNotes(ctx, state, now);
}

// ---- test hook --------------------------------------------------------
function __probe() {
  const state = getState() || {};
  return {
    chimes: Array.isArray(state.chimes) ? state.chimes.length : 0,
    rings: typeof state.rings === 'number' ? state.rings : 0
  };
}

// ---- self-install -----------------------------------------------------
if (typeof window !== 'undefined') {
  if (!window.GuildWindChimes || typeof window.GuildWindChimes !== 'object') {
    window.GuildWindChimes = createState();
  }
  const state = window.GuildWindChimes;
  if (!Array.isArray(state.chimes) || state.chimes.length !== CHIME_SEEDS.length) {
    state.chimes = createState().chimes;
  }
  if (typeof state.rings !== 'number') state.rings = 0;
  if (typeof state.breeze !== 'number') state.breeze = 0;
  if (!Array.isArray(state._ripples)) state._ripples = [];
  if (!Array.isArray(state._notes)) state._notes = [];
  state.update = update;
  state.draw = draw;
  state.__probe = __probe;
}

export {};
