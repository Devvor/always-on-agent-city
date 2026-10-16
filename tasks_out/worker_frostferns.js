const N_EDGE_ROCKS = [
  { gx: -3.0, gy: -8.0 },
  { gx:  3.0, gy: -8.0 },
  { gx: -2.0, gy: -8.0 },
  { gx:  2.0, gy: -8.0 },
  { gx: -2.5, gy: -8.0 },
  { gx:  2.5, gy: -8.0 }
];
const MAX_STAGE = 18;
const GROW_RATE = 1;
const MELT_RATE = 1.6;
const FROND_DUR = 8;

let lastTime = null;

function createState() {
  return {
    stage: 0,
    melted: true,
    bloomCued: false,
    rockCount: 4,
    rocks: null,
    lastWeather: null
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildFrostFerns; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

function doneCount() {
  const w = root();
  const list = Array.isArray(w && w.allTasks)
    ? w.allTasks
    : (w && w.V && Array.isArray(w.V.allTasks) ? w.V.allTasks : []);
  let n = 0;
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].status === 'done') n++;
  return n;
}

function buildRocks(count) {
  const rocks = [];
  const n = clamp(count == null ? 4 : count, 4, N_EDGE_ROCKS.length);
  for (let i = 0; i < n; i++) {
    const pos = N_EDGE_ROCKS[i];
    const seed = 400 + i * 13.7;
    const delay = seeded(seed + 1.1) * 9;
    const dur = FROND_DUR * (0.75 + seeded(seed + 2.3) * 0.5);
    const nF = 5 + Math.floor(seeded(seed + 3.7) * 4);
    const fronds = [];
    for (let f = 0; f < nF; f++) {
      const fs = seed + f * 7.3;
      const base = -2.7 + ((f + 0.5) / nF) * 2.25;
      fronds.push({
        ang: base + (seeded(fs + 1.7) - 0.5) * 0.34,
        len: 6 + seeded(fs + 2.9) * 6,
        curve: 3 + seeded(fs + 4.1) * 4,
        phase: seeded(fs + 5.3) * Math.PI * 2,
        shade: seeded(fs + 6.7) < 0.5,
        ox: (seeded(fs + 7.9) - 0.5) * 5
      });
    }
    rocks.push({
      gx: pos.gx,
      gy: pos.gy,
      seed: seed,
      delay: delay,
      dur: dur,
      h: 4 + Math.round(seeded(seed + 8.9) * 3),
      fronds: fronds,
      bloom: 0
    });
  }
  return rocks;
}

function rockBloom(stage, r) {
  return clamp((stage - r.delay) / r.dur, 0, 1);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const weather = (Vv.weather == null) ? 'CLEAR' : String(Vv.weather).toUpperCase();
  const night = (typeof Vv.nightFactor === 'number') ? Vv.nightFactor : 1;
  const growing = (weather === 'SNOW') && night > 0.25;
  const w = root();

  if (growing) {
    st.stage = Math.min(MAX_STAGE, st.stage + dt * GROW_RATE);
    if (!st.bloomCued && st.stage > 0.2) {
      st.bloomCued = true;
      st.melted = false;
      if (w && typeof w.cue === 'function') { try { w.cue('frost'); } catch (e) {} }
    }
  } else if (st.stage > 0) {
    st.stage = Math.max(0, st.stage - dt * MELT_RATE);
    if (st.stage === 0 && !st.melted) {
      st.melted = true;
      st.bloomCued = false;
      if (w && typeof w.cue === 'function') { try { w.cue('melt'); } catch (e) {} }
    }
  }

  const count = clamp(4 + Math.floor(doneCount() / 10), 4, 6);
  if (count !== st.rockCount) st.rockCount = count;
  if (!st.rocks || st.rocks.length !== st.rockCount) st.rocks = buildRocks(st.rockCount);
  for (let i = 0; i < st.rocks.length; i++) st.rocks[i].bloom = rockBloom(st.stage, st.rocks[i]);
  st.lastWeather = weather;
}

function drawFrond(ctx, ox, oy, fr, prog, bloom, now) {
  const L = fr.len * prog;
  if (L < 1) return;
  const shimmer = 0.7 + 0.3 * Math.sin(now * 0.004 + fr.phase);
  const alpha = clamp(bloom, 0, 1) * shimmer;
  if (alpha <= 0.02) return;
  const segs = 5;
  const pts = [];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const px = ox + Math.cos(fr.ang) * L * t;
    const py = oy + Math.sin(fr.ang) * L * t - fr.curve * t * t;
    pts.push({ x: px, y: py, t: t });
    ctx.lineTo(px, py);
  }
  ctx.strokeStyle = fr.shade ? '#bfdbfe' : '#e8e6df';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[i - 1];
    let tx = p.x - q.x;
    let ty = p.y - q.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = -ty;
    const ny = tx;
    const pl = 3.4 * (1 - p.t * 0.55);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + nx * pl, p.y + ny * pl);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - nx * pl, p.y - ny * pl);
    ctx.strokeStyle = fr.shade ? '#eef2f7' : '#ffffff';
    ctx.stroke();
  }
  const tip = pts[pts.length - 1];
  const gt = Math.sin(now * 0.003 + fr.phase * 1.7) * 0.5 + 0.5;
  if (gt > 0.72) {
    ctx.globalAlpha = alpha * ((gt - 0.72) / 0.28);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(tip.x) - 1, Math.round(tip.y) - 1, 2, 2);
  }
  ctx.restore();
}

function drawRock(ctx, r, now) {
  const pt = isoFn(r.gx, r.gy);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const h = r.h;
  const bloom = r.bloom || 0;

  ctx.globalAlpha = 0.26;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 7, y + 2, 14, 3);
  ctx.globalAlpha = 1;

  const s = seeded(r.seed + 11.3);
  ctx.fillStyle = s < 0.5 ? '#6b7280' : '#4b443d';
  ctx.fillRect(x - 6, y - h + 2, 12, h + 2);
  ctx.fillRect(x - 4, y - h - 1, 8, 4);
  ctx.fillStyle = s < 0.5 ? '#9ca3af' : '#6a6157';
  ctx.fillRect(x - 6, y - h + 2, 12, 2);

  if (bloom <= 0.02) return;

  ctx.globalAlpha = 0.5 * bloom;
  ctx.fillStyle = '#eef2f7';
  ctx.fillRect(x - 4, y - h, 2, 1);
  ctx.fillRect(x + 1, y - h - 1, 2, 1);
  ctx.fillRect(x + 4, y - h + 1, 1, 1);
  ctx.fillRect(x - 2, y - h + 2, 2, 1);
  ctx.globalAlpha = 1;

  const originY = y - h - 1;
  for (let f = 0; f < r.fronds.length; f++) {
    const fr = r.fronds[f];
    const fp = clamp((bloom - f * 0.06) / (1 - f * 0.06), 0, 1);
    if (fp <= 0.02) continue;
    drawFrond(ctx, x + fr.ox, originY, fr, fp, bloom, now);
  }
}

function visitorNearRocks(st) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!st || !st.rocks || !vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return null;
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < st.rocks.length; i++) {
    const r = st.rocks[i];
    const d = Math.hypot(vis.gx - r.gx, vis.gy - r.gy);
    if (d < bd) { bd = d; best = r; }
  }
  return (best && bd <= 2.2) ? best : null;
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!st.rocks) st.rocks = buildRocks(st.rockCount || 4);
  const now = nowFn();

  let maxBloom = 0;
  let sumX = 0;
  let minY = Infinity;
  for (let i = 0; i < st.rocks.length; i++) {
    const r = st.rocks[i];
    if (r.bloom > maxBloom) maxBloom = r.bloom;
    const pt = isoFn(r.gx, r.gy);
    sumX += pt.x;
    if (pt.y < minY) minY = pt.y;
    drawRock(ctx, r, now);
  }

  const near = (maxBloom > 0.3) ? visitorNearRocks(st) : null;
  if (near) {
    const cx = Math.round(sumX / st.rocks.length);
    const by = Math.round(minY) - 26;
    const text = fitFn('frost ferns', 92);
    const bw = 96;
    const bh = 16;
    const bx = cx - Math.round(bw * 0.5);
    ctx.fillStyle = 'rgba(10,10,12,0.86)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#e8e6df';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#e8e6df';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, by + bh * 0.5 + 1);
    ctx.textAlign = 'left';
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildFrostFerns) window.GuildFrostFerns = createState();
  window.GuildFrostFerns.update = update;
  window.GuildFrostFerns.draw = draw;
  window.GuildFrostFerns.__rawUpdate = update;
  window.GuildFrostFerns.__probe = function () {
    const st = getState();
    return {
      stage: st ? st.stage : 0,
      rocks: st && st.rocks ? st.rocks.length : 0,
      bloom: st && st.rocks ? st.rocks.map(function (r) { return Math.round(r.bloom * 100) / 100; }) : [],
      weather: st ? st.lastWeather : null
    };
  };
}

export {};
