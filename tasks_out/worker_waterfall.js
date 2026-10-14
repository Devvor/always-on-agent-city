function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function createState() {
  return {
    cols: [
      { width: 6, speed: 58, phase: 0.0, offset: 0 },
      { width: 9, speed: 70, phase: 1.7, offset: 0 }
    ],
    mist: [],
    splashes: [],
    mistTimer: 0.5,
    lastTime: null,
    fishSig: null
  };
}

const state = (typeof window !== 'undefined' && window.GuildWater) ? window.GuildWater : createState();

function islandBounds() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  return { min: -2 - s, max: 1 + s };
}

function rimAnchor() {
  try {
    const b = islandBounds();
    const gx = clamp(3, b.min, b.max);
    const gy = b.max;
    const pt = isoFn(gx, gy);
    if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return null;
    return { gx: gx, gy: gy, pt: pt };
  } catch (e) {
    return null;
  }
}

function catchSig(probe) {
  if (probe == null) return '';
  if (typeof probe !== 'object') {
    try { return JSON.stringify(probe); } catch (e) { return String(probe); }
  }
  const caught = (probe.caught != null) ? probe.caught : probe.lastCatch;
  if (caught == null) return '';
  try { return JSON.stringify(caught); } catch (e) { return String(caught); }
}

function isCatch(probe) {
  if (probe == null) return false;
  if (typeof probe === 'boolean') return probe;
  if (typeof probe === 'number') return probe > 0;
  if (typeof probe !== 'object') return !!probe;
  const caught = (probe.caught != null) ? probe.caught : probe.lastCatch;
  if (caught == null) return false;
  if (typeof caught === 'boolean') return caught;
  if (typeof caught === 'number') return caught > 0;
  if (typeof caught === 'string') {
    const t = caught.trim().toLowerCase();
    return t.length > 0 && t !== 'null' && t !== 'none' && t !== 'false';
  }
  return true;
}

function spawnSplash(x, y) {
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI / 2 + (i - 3.5) * 0.45;
    const mag = 45 + Math.random() * 35;
    state.splashes.push({
      x: x,
      y: y,
      vx: Math.cos(ang) * mag,
      vy: Math.sin(ang) * mag - 20,
      age: 0,
      life: 0.5
    });
  }
  if (state.splashes.length > 64) state.splashes.splice(0, state.splashes.length - 64);
}

function update(now) {
  const st = state;
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!st) return;
  if (!st.lastTime === null || !isFinite(st.lastTime)) st.lastTime = now;
  if (st.lastTime === null) st.lastTime = now;

  if (!Vv || Vv.gameState !== 'play') {
    st.lastTime = now;
    return;
  }

  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const rain = (Vv.weather === 'RAIN');

  st.mistTimer -= dt;
  if (st.mistTimer <= 0) {
    const a = rimAnchor();
    if (a) {
      st.mist.push({ x: a.pt.x, y: a.pt.y, age: 0, life: 1.6, alpha: rain ? 0.20 : 0.15 });
      if (st.mist.length > 12) st.mist.shift();
    }
    st.mistTimer = (rain ? 0.2 : 0.4) + Math.random() * (rain ? 0.25 : 0.5);
  }

  const nextMist = [];
  for (let i = 0; i < st.mist.length; i++) {
    const p = st.mist[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.y -= (rain ? 22 : 14) * dt;
    nextMist.push(p);
  }
  st.mist = nextMist;
  if (st.mist.length > 12) st.mist = st.mist.slice(st.mist.length - 12);

  const nextSplashes = [];
  for (let i = 0; i < st.splashes.length; i++) {
    const sp = st.splashes[i];
    sp.age += dt;
    if (sp.age >= sp.life) continue;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vy += 220 * dt;
    nextSplashes.push(sp);
  }
  st.splashes = nextSplashes;

  for (let i = 0; i < st.cols.length; i++) {
    const col = st.cols[i];
    if (!col) continue;
    if (typeof col.offset !== 'number') col.offset = 0;
    const base = (typeof col.speed === 'number') ? col.speed : (i === 0 ? 58 : 70);
    col.offset += base * (rain ? 1.2 : 1) * dt;
  }

  try {
    const w = root();
    const fish = w && w.GuildFishing;
    let probe = null;
    if (fish) {
      if (typeof fish.__probe === 'function') {
        try { probe = fish.__probe(); } catch (e) { probe = fish; }
      } else {
        probe = fish;
      }
    }
    const sig = catchSig(probe);
    if (isCatch(probe) && sig !== st.fishSig) {
      const a = rimAnchor();
      if (a && a.pt) spawnSplash(a.pt.x, a.pt.y);
    }
    st.fishSig = sig;
  } catch (e) {}
}

function draw(ctx) {
  const st = state;
  if (!ctx || !st) return;
  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;

  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  const bottomY = canvas ? canvas.height : 600;
  const now = nowFn();
  const rain = (Vv && Vv.weather === 'RAIN');
  const anchor = rimAnchor();
  if (!anchor || !anchor.pt) return;
  const p = anchor.pt;

  const sx = p.x;
  const sy = p.y;

  const rockOffsets = [[-13, -3], [13, -3], [-2, -12], [2, 7]];
  for (let i = 0; i < rockOffsets.length; i++) {
    const r = rockOffsets[i];
    ctx.fillStyle = '#334155';
    ctx.fillRect(Math.round(sx + r[0]), Math.round(sy + r[1]), 6, 5);
  }
  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(Math.round(sx) - 10, Math.round(sy) - 5, 20, 10);
  const shimmerY = Math.round(sy - 3 + Math.sin(now * 0.005) * 3);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(Math.round(sx) - 9, shimmerY, 18, 1);

  for (let ci = 0; ci < st.cols.length; ci++) {
    const col = st.cols[ci] || {};
    const cw = (typeof col.width === 'number') ? col.width : (ci === 0 ? 6 : 9);
    const cx = Math.round(sx + (ci === 0 ? -9 : 3));
    const topY = Math.round(sy + 2);
    const height = bottomY - topY;
    if (height <= 0) continue;

    const mainGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
    mainGrad.addColorStop(0, 'rgba(147,197,253,1.00)');
    mainGrad.addColorStop(1, 'rgba(147,197,253,0.35)');
    ctx.fillStyle = mainGrad;
    ctx.fillRect(cx, topY, cw, height);

    const off = (typeof col.offset === 'number') ? col.offset : 0;
    const period = 11;
    for (let y = topY - (Math.floor(off) % period); y < bottomY; y += period) {
      const t = Math.min(1, Math.max(0, (y - topY) / Math.max(1, height)));
      const alpha = (1 - (1 - 0.35) * t) * 0.9;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(cx + 1, Math.round(y), Math.max(1, cw - 2), 3);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(cx - 2, topY - 3, cw + 4, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(cx - 3, topY - 1, 2, 2);
    ctx.fillRect(cx + cw + 1, topY - 2, 2, 2);
  }

  for (let i = 0; i < st.mist.length; i++) {
    const m = st.mist[i];
    const t = Math.min(1, Math.max(0, m.age / m.life));
    const r = 8 + 12 * t;
    const a = (typeof m.alpha === 'number') ? m.alpha : 0.15;
    const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    grad.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < st.splashes.length; i++) {
    const sp = st.splashes[i];
    const lifeRatio = Math.max(0, 1 - (sp.age / sp.life));
    ctx.globalAlpha = lifeRatio;
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 2, 2);
  }
  ctx.globalAlpha = 1;

  void rain;
}

if (typeof window !== 'undefined') {
  if (!window.GuildWater) window.GuildWater = state;
  const gw = window.GuildWater;
  if (!Array.isArray(gw.cols)) gw.cols = state.cols;
  if (!Array.isArray(gw.mist)) gw.mist = state.mist;
  if (!Array.isArray(gw.splashes)) gw.splashes = state.splashes;
  gw.update = update;
  gw.draw = draw;
  gw.__probe = function () { return { cols: state.cols.length, mist: state.mist.length }; };
}

export {};
