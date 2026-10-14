const pressed = new Set();
let prevPressedE = false;
const ePrevKey = '__gfmEPrev';

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { return w.iso(gx, gy); } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) {
    return {
      x: g.originX + (gx - gy) * g.tileW * 0.5,
      y: g.originY + (gx + gy) * g.tileH * 0.5
    };
  }
  return { x: 0, y: 0 };
}
function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}
function getState() {
  const w = root();
  return w && w.GuildFishMarket;
}
function getVisitor() {
  const w = root();
  return w && w.GuildVisitor;
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function clampNum(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}
function isOnIslandPoint(gx, gy, growthStep) {
  const s = (typeof growthStep === 'number') ? growthStep : 0;
  const rx = Math.round(gx);
  const ry = Math.round(gy);
  const minC = -2 - s;
  const maxC = 1 + s;
  if (rx < minC || rx > maxC || ry < minC || ry > maxC) return false;
  return tileRing(rx, ry) <= s;
}
function clampOnIsland(gx, gy, growthStep) {
  const s = (typeof growthStep === 'number') ? growthStep : 0;
  if (isOnIslandPoint(gx, gy, s)) return { gx: gx, gy: gy };
  const minC = -2 - s;
  const maxC = 1 + s;
  let rx = clampNum(Math.round(gx), minC, maxC);
  let ry = clampNum(Math.round(gy), minC, maxC);
  let guard = 0;
  while (tileRing(rx, ry) > s && guard < 50) {
    if (rx > 0) rx--;
    else if (rx < 0) rx++;
    if (ry > 0) ry--;
    else if (ry < 0) ry++;
    guard++;
  }
  return { gx: rx, gy: ry };
}
function fishingProbe() {
  const w = root();
  const m = w && w.GuildFishing;
  if (!m || typeof m.__probe !== 'function') return null;
  try { return m.__probe(); } catch (e) { return null; }
}
function fishingCatches() {
  const p = fishingProbe();
  if (!p) return null;
  const n = Number(p.catches);
  return isFinite(n) ? n : null;
}
function cueDone() {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue('done'); } catch (e) {}
  }
}
function createState() {
  return {
    gx: -0.5,
    gy: 5.2,
    sold: 0,
    delivered: 0,
    lastCatches: 0,
    priceFlickerUntil: 0,
    floats: [],
    coins: []
  };
}
function ensureStateArrays(state) {
  if (!state) return;
  if (!Array.isArray(state.floats)) state.floats = [];
  if (!Array.isArray(state.coins)) state.coins = [];
  if (typeof state.sold !== 'number') state.sold = 0;
  if (typeof state.lastCatches !== 'number') state.lastCatches = 0;
  if (typeof state.priceFlickerUntil !== 'number') state.priceFlickerUntil = 0;
}
function onKeydown(e) {
  const k = (e && e.key === ' ') ? ' ' : String((e && e.key) || '').toLowerCase();
  if (!k) return;
  pressed.add(k);
}
function onKeyup(e) {
  const k = (e && e.key === ' ') ? ' ' : String((e && e.key) || '').toLowerCase();
  if (!k) return;
  pressed.delete(k);
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  if (!state) return;
  ensureStateArrays(state);
  const Vv = getV();

  state.floats = state.floats.filter(function (f) {
    return isFinite(f && f.start) && (now - f.start < ((f.duration != null) ? f.duration : 1.2));
  });
  state.coins = state.coins.filter(function (c) {
    return isFinite(c && c.start) && (now - c.start < ((c.duration != null) ? c.duration : 0.75));
  });

  const catches = fishingCatches();
  if (catches !== null) {
    if (catches > state.lastCatches) state.lastCatches = catches;
  }

  const ownE = pressed.has('e');
  let extE = false;
  const vis0 = getVisitor();
  if (vis0 && vis0.__keys && typeof vis0.__keys.has === 'function') {
    try { extE = !!vis0.__keys.has('e'); } catch (e) { extE = false; }
  }
  const ePressed = ownE || extE;
  const edge = ePressed && !prevPressedE;
  prevPressedE = ePressed;

  if (state.lastCatches < (catches == null ? state.lastCatches : catches) && catches !== null) {
    state.lastCatches = catches;
  }

  if (Vv && Vv.gameState === 'play' && state && getVisitor()) {
    const vis = getVisitor();
    const sx = Number(vis.gx);
    const sy = Number(vis.gy);
    if (isFinite(sx) && isFinite(sy) && catches !== null) {
      const eff = clampOnIsland(state.gx, state.gy, Vv.growthStep);
      const dist = Math.hypot(eff.gx - sx, eff.gy - sy);
      const unsold = catches > (state.sold || 0);
      if (unsold && dist <= 1.6 && edge) {
        state.sold = (state.sold || 0) + 1;
        if (state.sold > catches) state.sold = catches;
        state.priceFlickerUntil = now + 2000;
        state.floats.push({ start: now, duration: 1.2 });
        state.coins.push({ start: now, duration: 0.75, from: { gx: sx, gy: sy } });
        cueDone();
      }
    }
  }
}
function drawStall(ctx, state, Vv, now) {
  if (!ctx || !state) return;
  const eff = clampOnIsland(state.gx, state.gy, Vv ? Vv.growthStep : 0);
  const pt = isoFn(eff.gx, eff.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 18, y + 4, 36, 5);

  ctx.fillStyle = '#5a3a23';
  ctx.fillRect(x - 16, y - 30, 32, 24);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 16, y - 30, 7, 24);

  ctx.fillStyle = '#8b5a36';
  ctx.fillRect(x - 18, y - 6, 36, 8);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 18, y - 6, 36, 2);
  ctx.fillRect(x - 18, y + 2, 36, 2);

  const awningY = y - 46;
  ctx.fillStyle = '#8b1a22';
  ctx.fillRect(x - 20, awningY, 40, 12);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#f4e8c1' : '#8b1a22';
    ctx.fillRect(x - 20 + i * 8, awningY, 8, 12);
  }
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 20, awningY, 40, 2);
  ctx.fillRect(x - 20, awningY + 10, 40, 2);
  ctx.fillStyle = '#3b2a18';
  ctx.fillRect(x - 2, awningY + 10, 4, 24);

  ctx.fillStyle = '#4b3320';
  ctx.fillRect(x + 2, y - 44, 2, 8);
  ctx.fillStyle = '#67e8f9';
  ctx.fillRect(x - 3, y - 42, 12, 4);
  ctx.fillRect(x - 5, y - 40, 3, 4);
  ctx.fillRect(x - 8, y - 38, 4, 2);
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(x + 6, y - 41, 2, 2);

  const flicker = now < (state.priceFlickerUntil || 0);
  const signX = x - 15;
  const signY = y - 20;
  const signW = 30;
  const signH = 12;
  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(signX, signY, signW, signH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(signX, signY, signW, signH);

  if (flicker) {
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.02));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(signX + 1, signY + 1, signW - 2, signH - 2);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = flicker ? '#1f2937' : '#f4ead5';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FISH: 5 GC', x, signY + signH * 0.5 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  if (!state) return;
  ensureStateArrays(state);
  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;
  const now = nowFn();
  const vis = getVisitor();
  drawStall(ctx, state, Vv, now);

  try {
    const catches = fishingCatches();
    if (catches !== null && catches > (state.sold || 0) && vis) {
      const eff = clampOnIsland(state.gx, state.gy, Vv ? Vv.growthStep : 0);
      const dist = Math.hypot(eff.gx - Number(vis.gx), eff.gy - Number(vis.gy));
      if (dist <= 1.6) {
        const x0 = Math.round(isoFn(eff.gx, eff.gy).x);
        const y0 = Math.round(isoFn(eff.gx, eff.gy).y);
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(x0 - 40, y0 - 64, 80, 15);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 - 40, y0 - 64, 80, 15);
        ctx.fillStyle = '#f3d37a';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E: sell fish +5 GC', x0, y0 - 56);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
  } catch (e) {}

  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    const dur = (c && isFinite(c.duration)) ? c.duration : 0.75;
    const progress = (now - c.start) / dur;
    if (progress < 0 || progress >= 1) continue;
    const eff = clampOnIsland(state.gx, state.gy, Vv ? Vv.growthStep : 0);
    const from = isoFn(c.from.gx, c.from.gy);
    const to = isoFn(eff.gx, eff.gy);
    const sx = from.x + (to.x - from.x) * progress;
    const sy = from.y + (to.y - from.y) * progress - Math.sin(progress * Math.PI) * 20;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
  }

  if (vis) {
    for (let i = 0; i < state.floats.length; i++) {
      const f = state.floats[i];
      const dur = (f && isFinite(f.duration)) ? f.duration : 1.2;
      const progress = (now - f.start) / dur;
      if (progress < 0 || progress >= 1) continue;
      const ptv = isoFn(Number(vis.gx), Number(vis.gy));
      const fx = Math.round(ptv.x);
      const fy = Math.round(ptv.y) - 38 - Math.round(progress * 18);
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+5 GC', fx, fy);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}
if (typeof window !== 'undefined') {
  if (!window.GuildFishMarket) window.GuildFishMarket = createState();
  const st = window.GuildFishMarket;
  if (st && typeof st.gx !== 'number') st.gx = -0.5;
  if (st && typeof st.gy !== 'number') st.gy = 5.2;
  if (st && typeof st.sold !== 'number') st.sold = 0;
  ensureStateArrays(st);
  st.update = update;
  st.draw = draw;
  st.__probe = function () { return { sold: (getState() && typeof getState().sold === 'number') ? getState().sold : 0 }; };
  st.__keys = pressed;
  st.__rawUpdate = update;
  if (!window.__gfmListeners) {
    window.__gfmListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}
export {};
