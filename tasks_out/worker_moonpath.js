const STARGAZE = { gx: 0, gy: -8 };
const FROST_FERNS = [
  { gx: -3.0, gy: -8.0 },
  { gx: -2.5, gy: -8.0 },
  { gx: -2.0, gy: -8.0 },
  { gx:  2.0, gy: -8.0 },
  { gx:  2.5, gy: -8.0 },
  { gx:  3.0, gy: -8.0 }
];
const POOL_ANCHOR = { gx: 0, gy: -7 };
const MIN_SEP = 2.0;
const MAX_RING = 8;
const CRACK_LIFE = 4;
const CRACK_MIN_GAP = 10;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildMoonpath; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return null;
}

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function clampFloor(gx, gy, s) {
  const minC = -2 - s;
  const maxC = 1 + s;
  let x = clamp(gx, minC, maxC);
  let y = clamp(gy, minC, maxC);
  let guard = 0;
  while (tileRing(x, y) > s && guard < 200) {
    if (x > 0) x -= 0.1; else if (x < 0) x += 0.1;
    if (y > 0) y -= 0.1; else if (y < 0) y += 0.1;
    x = clamp(x, minC, maxC);
    y = clamp(y, minC, maxC);
    guard++;
  }
  return { gx: x, gy: y };
}

function resolvePool(Vv) {
  const raw = Number(Vv && Vv.growthStep);
  const s = clamp(Math.floor(isFinite(raw) ? raw : 0), 0, MAX_RING);
  let pos = clampFloor(POOL_ANCHOR.gx, POOL_ANCHOR.gy, s);
  const props = [STARGAZE].concat(FROST_FERNS);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < props.length; i++) {
      const ox = props[i].gx;
      const oy = props[i].gy;
      let dx = pos.gx - ox;
      let dy = pos.gy - oy;
      let d = Math.hypot(dx, dy);
      if (d < MIN_SEP) {
        if (d < 0.0001) { dx = 0; dy = 1; d = 1; }
        pos.gx = ox + (dx / d) * MIN_SEP;
        pos.gy = oy + (dy / d) * MIN_SEP;
      }
    }
    pos = clampFloor(pos.gx, pos.gy, s);
  }
  return pos;
}

function buildGlints(pt, Vv) {
  const canvas = Vv && Vv.canvas;
  const cw = (canvas && canvas.width) ? canvas.width : 960;
  const ch = (canvas && canvas.height) ? canvas.height : 640;
  const moonX = cw * 0.72;
  const moonY = ch * 0.15;
  let dx = moonX - pt.x;
  let dy = moonY - pt.y;
  let len = Math.hypot(dx, dy);
  if (!isFinite(len) || len < 0.001) { dx = 0.7; dy = -0.7; len = 1; }
  dx /= len;
  dy /= len;
  const px = -dy;
  const py = dx;
  const total = Math.min(96, Math.max(48, len * 0.5));
  const n = 7;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const spread = t * (8 + t * 12);
    const side = (i % 2 === 0) ? 1 : -1;
    out.push({
      dx: dx * total * t + px * spread * side,
      dy: dy * total * t + py * spread * side,
      phase: i * 1.7 + (i % 3) * 0.9,
      size: 1 + Math.round((1 - t) * 1.4),
      gold: (i % 2 === 0)
    });
  }
  return out;
}

function spawnCrack(st, now) {
  const n = 2 + Math.floor(Math.random() * 2);
  const segs = [];
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r0 = 1 + Math.random() * 2;
    const r1 = 6 + Math.random() * 10;
    segs.push({
      x1: Math.cos(ang) * r0,
      y1: Math.sin(ang) * r0 * 0.55,
      x2: Math.cos(ang) * r1,
      y2: Math.sin(ang) * r1 * 0.55
    });
  }
  st.cracks.push({ born: now, life: CRACK_LIFE, segs: segs });
  while (st.cracks.length > 8) st.cracks.shift();
}

function birdOverhead(w) {
  const aviary = w && w.GuildAviary;
  if (!aviary) return null;
  try {
    const pg = aviary.pigeon;
    if (pg && (pg.state === 'arriving' || pg.state === 'leaving' || pg.state === 'pecking')) return true;
    const ns = aviary.nests;
    if (Array.isArray(ns)) {
      for (let i = 0; i < ns.length; i++) {
        const b = ns[i] && ns[i].bird;
        if (b && b.state === 'stirred') return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const Vv = getV();
  const st = getState();
  if (!w || !st || !Vv || Vv.gameState !== 'play') return;

  const hasIso = (typeof w.iso === 'function') || (Vv && Vv.grid);
  if (!hasIso) return;

  if (st._lastTime == null) st._lastTime = now;
  let dt = (now - st._lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st._lastTime = now;
  st._now = now;

  const pos = resolvePool(Vv);
  const oldPool = st.path && st.path.pool;
  if (!st.path || !oldPool || oldPool.gx !== pos.gx || oldPool.gy !== pos.gy) {
    const iso = isoFn(pos.gx, pos.gy);
    if (!iso) return;
    st.path = {
      pool: { gx: pos.gx, gy: pos.gy },
      glints: buildGlints(iso, Vv),
      alpha: (st.path && typeof st.path.alpha === 'number') ? st.path.alpha : 0
    };
  }

  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const target = (dl < 0.3) ? 1 : 0;
  const step = dt / 2;
  if (st.path.alpha < target) st.path.alpha = Math.min(target, st.path.alpha + step);
  else st.path.alpha = Math.max(target, st.path.alpha - step);

  if (!Array.isArray(st.cracks)) st.cracks = [];
  const kept = [];
  for (let i = 0; i < st.cracks.length; i++) {
    const c = st.cracks[i];
    if (c && (now - c.born) / 1000 < c.life) kept.push(c);
  }
  st.cracks = kept;

  if (st._lastCrack == null) st._lastCrack = 0;
  const overhead = birdOverhead(w);
  if (overhead === null) {
    if (!st._nextCrackAt) st._nextCrackAt = now + 45000 + Math.random() * 25000;
    if (now - st._lastCrack >= CRACK_MIN_GAP * 1000 && now >= st._nextCrackAt) {
      spawnCrack(st, now);
      st._lastCrack = now;
      st._nextCrackAt = now + 45000 + Math.random() * 25000;
    }
  } else if (overhead) {
    if (now - st._lastCrack >= CRACK_MIN_GAP * 1000) {
      if (!st._birdCrackAt) st._birdCrackAt = now + 1000 + Math.random() * 5000;
      if (now >= st._birdCrackAt) {
        spawnCrack(st, now);
        st._lastCrack = now;
        st._birdCrackAt = 0;
      }
    }
  } else {
    st._birdCrackAt = 0;
  }
}

function drawPool(ctx, pt, now) {
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = '#9ca3af';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
  ctx.fillStyle = '#bfdbfe';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 4.0, 0, Math.PI * 2);
  ctx.fillStyle = '#dbeafe';
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(x - 4, y - 2, 3, 1);
  ctx.globalAlpha = 1;
}

function draw(ctx) {
  if (!ctx) return;
  const w = root();
  const Vv = getV();
  const st = getState();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const hasIso = (w && typeof w.iso === 'function') || (Vv && Vv.grid);
  if (!hasIso) return;
  if (!st.path || !st.path.pool) return;

  const now = (typeof st._now === 'number') ? st._now : nowFn();
  const pt = isoFn(st.path.pool.gx, st.path.pool.gy);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;

  drawPool(ctx, pt, now);

  if (st.path.alpha > 0.01 && Array.isArray(st.path.glints)) {
    const rain = String(Vv.weather || '').toUpperCase() === 'RAIN';
    const freq = 0.0035 * (rain ? 2.2 : 1);
    for (let i = 0; i < st.path.glints.length; i++) {
      const g = st.path.glints[i];
      const pulse = 0.5 + 0.5 * Math.sin(now * freq + g.phase);
      const a = st.path.alpha * (0.20 + 0.60 * pulse);
      if (a <= 0.02) continue;
      const x = pt.x + g.dx;
      const y = pt.y + g.dy;
      const sz = g.size;
      ctx.globalAlpha = a;
      ctx.fillStyle = g.gold ? '#d4af37' : '#bfdbfe';
      ctx.fillRect(Math.round(x - sz), Math.round(y - sz * 0.5), sz * 2, Math.max(1, sz));
      if (pulse > 0.72) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(x), Math.round(y - 1), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (Array.isArray(st.cracks) && st.cracks.length) {
    let drew = false;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < st.cracks.length; i++) {
      const c = st.cracks[i];
      const age = (now - c.born) / 1000;
      if (age < 0 || age >= c.life) continue;
      const a = (1 - age / c.life) * 0.55;
      if (a <= 0.02) continue;
      drew = true;
      ctx.globalAlpha = Math.max(ctx.globalAlpha === 1 ? a : ctx.globalAlpha, a);
      for (let s = 0; s < c.segs.length; s++) {
        const sg = c.segs[s];
        ctx.moveTo(Math.round(pt.x + sg.x1), Math.round(pt.y + sg.y1));
        ctx.lineTo(Math.round(pt.x + sg.x2), Math.round(pt.y + sg.y2));
      }
    }
    if (drew) {
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildMoonpath) window.GuildMoonpath = { path: null, cracks: [] };
  window.GuildMoonpath.update = update;
  window.GuildMoonpath.draw = draw;
  window.GuildMoonpath.__probe = function () {
    const st = getState();
    return {
      path: !!(st && st.path),
      cracks: (st && Array.isArray(st.cracks)) ? st.cracks.length : 0
    };
  };
  window.GuildMoonpath.__rawUpdate = update;
}

export {};
