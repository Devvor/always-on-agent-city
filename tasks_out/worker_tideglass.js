// GuildTideglass - 4 tide-glass float lanterns stranded on the S-rim sand; bob with the tide, glow warm gold at night.
const COUNT = 4;
const MIN_SEP = 1.6;
const MIN_AVOID = 2.0;

const ANCHORS = [
  { gx: -1.0, gy: 7.0 },
  { gx:  0.8, gy: 6.6 },
  { gx:  2.4, gy: 7.3 },
  { gx:  4.2, gy: 6.7 }
];
const PHASES = [0.0, 2.1, 4.3, 1.2];

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildTideglass; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') { try { return w.iso(gx, gy); } catch (e) { return null; } }
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

function islandBounds() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) ? Math.floor(Vv.growthStep) : 0;
  return { s: s, min: -2 - s, max: 1 + s };
}

// Named S-rim neighbours the lanterns must stand 2+ tiles from (barge, lighthouse, waterfall + live props).
function propPoints() {
  const w = root();
  const b = islandBounds();
  const list = [];
  list.push({ gx: 4.5, gy: 7.5 });
  list.push({ gx: b.max - 1.3, gy: b.max + 1.7 });
  list.push({ gx: clamp(3, b.min, b.max), gy: b.max });
  const fh = w && w.GuildFishhut;
  if (fh && fh.hut && isFinite(fh.hut.gx) && isFinite(fh.hut.gy)) list.push({ gx: fh.hut.gx, gy: fh.hut.gy });
  else list.push({ gx: 3.2, gy: 5.2 });
  list.push({ gx: 3.0, gy: 5.5 });
  const tp = w && w.GuildTidepools;
  if (tp && Array.isArray(tp.pools) && tp.pools.length) {
    for (let i = 0; i < tp.pools.length; i++) {
      const p = tp.pools[i];
      if (p && isFinite(p.gx) && isFinite(p.gy)) list.push({ gx: p.gx, gy: p.gy });
    }
  } else {
    list.push({ gx: 1, gy: 6 });
    list.push({ gx: 2, gy: 7 });
    list.push({ gx: 3, gy: 6 });
  }
  const tc = w && w.GuildTideCombs;
  if (tc && Array.isArray(tc.combs) && tc.combs.length) {
    for (let i = 0; i < tc.combs.length; i++) {
      const p = tc.combs[i];
      if (p && isFinite(p.gx) && isFinite(p.gy)) list.push({ gx: p.gx, gy: p.gy });
    }
  } else {
    list.push({ gx: 1.5, gy: 6.8 });
    list.push({ gx: 4.5, gy: 7.2 });
  }
  return list;
}

// Nearest valid S-rim spot to each anchor: clamped on the grown floor, 2+ from neighbours, 1.5+ apart.
function resolveLanterns() {
  const b = islandBounds();
  const avoid = propPoints();
  const out = [];
  for (let i = 0; i < ANCHORS.length; i++) {
    const a = ANCHORS[i];
    const startGx = clamp(a.gx, b.min, b.max);
    const startGy = clamp(a.gy, b.min + 0.5, b.max - 0.5);
    let placed = null;
    for (let ring = 0; ring <= 24 && !placed; ring++) {
      for (let ix = -ring; ix <= ring && !placed; ix++) {
        for (let iy = -ring; iy <= ring && !placed; iy++) {
          if (ring > 0 && Math.max(Math.abs(ix), Math.abs(iy)) !== ring) continue;
          const gx = clamp(startGx + ix * 0.5, b.min, b.max);
          const gy = clamp(startGy + iy * 0.5, b.min + 0.5, b.max - 0.5);
          if (tileRing(Math.floor(gx), Math.floor(gy)) > b.s) continue;
          let ok = true;
          for (let k = 0; k < avoid.length && ok; k++) {
            if (Math.hypot(avoid[k].gx - gx, avoid[k].gy - gy) < MIN_AVOID) ok = false;
          }
          for (let j = 0; j < out.length && ok; j++) {
            if (Math.hypot(out[j].gx - gx, out[j].gy - gy) < MIN_SEP) ok = false;
          }
          if (ok) placed = { gx: gx, gy: gy };
        }
      }
    }
    if (!placed) placed = { gx: startGx, gy: startGy };
    out.push(placed);
  }
  return out;
}

function syncLanterns(st) {
  const pos = resolveLanterns();
  if (!Array.isArray(st.lanterns)) st.lanterns = [];
  while (st.lanterns.length < pos.length) {
    const i = st.lanterns.length;
    st.lanterns.push({ gx: pos[i].gx, gy: pos[i].gy, phase: PHASES[i % PHASES.length], glint: (i * 1.7) % (Math.PI * 2) });
  }
  if (st.lanterns.length > pos.length) st.lanterns.length = pos.length;
  for (let i = 0; i < st.lanterns.length; i++) {
    st.lanterns[i].gx = pos[i].gx;
    st.lanterns[i].gy = pos[i].gy;
    if (!isFinite(st.lanterns[i].phase)) st.lanterns[i].phase = PHASES[i % PHASES.length];
  }
}

function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const st = getState();
  const Vv = getV();
  const w = root();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  const hasIso = (w && typeof w.iso === 'function') || (Vv && Vv.grid);
  if (!hasIso) { lastTime = now; return; }
  lastTime = now;
  syncLanterns(st);
}

function drawLantern(ctx, l, now, Vv) {
  const pt = isoFn(l.gx, l.gy);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;

  const weather = String((Vv && Vv.weather) || '').toUpperCase();
  const rain = weather === 'RAIN';
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const night = dl < 0.3;

  const speed = rain ? 2.6 : 1.5;
  const amp = rain ? 3.4 : 3.0;
  const t = now * 0.001 * speed + l.phase;
  const bob = Math.sin(t) * amp;
  const swayX = Math.sin(t + 1.1) * 1.0;
  const tilt = Math.sin(t + 0.7) * 0.06;

  const x = Math.round(pt.x);
  const baseY = Math.round(pt.y);
  const cx = x + swayX;
  const cy = baseY - 6 - bob;

  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(x, baseY + 4, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9c8a3';
  ctx.beginPath();
  ctx.ellipse(x, baseY + 2, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8d847c';
  ctx.beginPath();
  ctx.ellipse(x, baseY + 4, 9, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9c8a3';
  ctx.beginPath();
  ctx.ellipse(x, baseY + 0.5, 6.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (night) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0016 + l.phase);
    const flick = 0.86 + 0.10 * Math.sin(now * 0.017 + l.phase * 7.0) + (Math.random() - 0.5) * 0.08;
    const dim = rain ? 0.55 : 1;
    const a = clamp((0.26 + 0.20 * pulse) * flick * dim, 0, 0.7);
    const rr = (rain ? 15 : 19) + 2 * pulse;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    grd.addColorStop(0, 'rgba(212,175,55,' + a + ')');
    grd.addColorStop(0.55, 'rgba(212,175,55,' + (a * 0.4) + ')');
    grd.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(cx), Math.round(cy + 4));
  ctx.lineTo(x + 1, baseY + 1);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  const R = 5.5;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = night ? '#7fe3c3' : '#6ee7b7';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 1.6, R - 1.1, 0, Math.PI);
  ctx.fillStyle = '#34d399';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-1.4, -1.4, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#d1fae5';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R - 0.3, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-R, -R);
  ctx.lineTo(R, R);
  ctx.moveTo(R, -R);
  ctx.lineTo(-R, R);
  ctx.moveTo(0, -R);
  ctx.lineTo(0, R);
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(-2, -R - 3, 4, 3);
  ctx.strokeStyle = '#6b4a2f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -R - 4, 2.2, 0, Math.PI * 2);
  ctx.stroke();

  if (night) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  if (!night) {
    const glint = 0.55 + 0.45 * Math.sin(now * 0.0018 + l.glint);
    if (glint > 0.6) {
      ctx.globalAlpha = 0.5 + 0.5 * glint;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx - 2), Math.round(cy - 3), 1, 1);
      ctx.fillRect(Math.round(cx - 3), Math.round(cy - 2), 1, 1);
      ctx.globalAlpha = 1;
    }
  }
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  const w = root();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const hasIso = (w && typeof w.iso === 'function') || (Vv && Vv.grid);
  if (!hasIso) return;
  syncLanterns(st);
  const now = (typeof lastTime === 'number' && isFinite(lastTime)) ? lastTime : nowFn();
  if (!Array.isArray(st.lanterns)) st.lanterns = [];
  for (let i = 0; i < st.lanterns.length; i++) drawLantern(ctx, st.lanterns[i], now, Vv);
}

if (typeof window !== 'undefined') {
  if (!window.GuildTideglass || typeof window.GuildTideglass !== 'object') window.GuildTideglass = { lanterns: [] };
  const st = window.GuildTideglass;
  if (!Array.isArray(st.lanterns)) st.lanterns = [];
  window.GuildTideglass.update = update;
  window.GuildTideglass.draw = draw;
  window.GuildTideglass.__probe = function () {
    const s = getState();
    return { lanterns: (s && Array.isArray(s.lanterns)) ? s.lanterns.length : 0 };
  };
}

export {};
