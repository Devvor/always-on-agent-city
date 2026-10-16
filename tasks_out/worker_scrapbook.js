const POI_DEFS = [
  { id: 'board', hint: 'quest board', fx: 0, fy: 0 },
  { id: 'museum', hint: 'museum', fx: -6, fy: 3 },
  { id: 'stall', hint: 'snack stall', fx: 2.5, fy: -2.5 },
  { id: 'cat', hint: 'the cat', fx: 1, fy: 1 },
  { id: 'combs', hint: 'tide combs', fx: 2, fy: 7 },
  { id: 'bench', hint: 'bench', fx: 4.5, fy: -2.5 }
];

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildScrapbook; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') { try { return w.iso(gx, gy); } catch (e) {} }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') { try { return w.fitText(text, maxW); } catch (e) {} }
  return String(text == null ? '' : text);
}

function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

function tileDist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function islandBounds() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Math.floor(Vv.growthStep) : 0;
  return { min: -2 - s, max: 1 + s };
}

function createState() {
  return {
    stamps: {},
    dwellId: null,
    dwellT: 0,
    celebrated: false,
    fanfareFired: false,
    ceremony: null,
    lastCue: 0
  };
}

function resolvePois() {
  const w = root();
  const b = islandBounds();
  const out = [];
  for (let i = 0; i < POI_DEFS.length; i++) {
    out.push({ id: POI_DEFS[i].id, hint: POI_DEFS[i].hint, gx: POI_DEFS[i].fx, gy: POI_DEFS[i].fy });
  }
  const qb = w && w.GuildQuestBoard;
  if (qb && isFinite(qb.gx) && isFinite(qb.gy)) { out[0].gx = qb.gx; out[0].gy = qb.gy; }
  const mu = w && w.GuildMuseum;
  if (mu && Array.isArray(mu.pedestals) && mu.pedestals.length) {
    const p = mu.pedestals[0];
    if (p && isFinite(p.gx) && isFinite(p.gy)) { out[1].gx = p.gx; out[1].gy = p.gy; }
  }
  const ss = w && w.GuildSnackStall;
  if (ss && isFinite(ss.gx) && isFinite(ss.gy)) { out[2].gx = ss.gx; out[2].gy = ss.gy; }
  const cat = w && w.GuildCat;
  if (cat && isFinite(cat.gx) && isFinite(cat.gy)) { out[3].gx = cat.gx; out[3].gy = cat.gy; }
  const tc = w && w.GuildTideCombs;
  if (tc && Array.isArray(tc.combs) && tc.combs.length) {
    const c0 = tc.combs[0];
    if (c0 && isFinite(c0.gx) && isFinite(c0.gy)) { out[4].gx = c0.gx; out[4].gy = c0.gy; }
  }
  const fb = w && w.GuildFoundersbench;
  if (fb && isFinite(fb.x) && isFinite(fb.y)) { out[5].gx = fb.x; out[5].gy = fb.y; }
  for (let i = 0; i < out.length; i++) {
    out[i].gx = clamp(out[i].gx, b.min, b.max);
    out[i].gy = clamp(out[i].gy, b.min, b.max);
  }
  return out;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (state.ceremony) {
    state.ceremony.t += dt;
    if (state.ceremony.t >= state.ceremony.dur) state.ceremony = null;
  }

  const vis = getVisitor();
  const hasVis = !!(vis && isFinite(vis.gx) && isFinite(vis.gy));
  if (hasVis) {
    const pois = resolvePois();
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < pois.length; i++) {
      if (state.stamps[pois[i].id] != null) continue;
      const d = tileDist(vis.gx, vis.gy, pois[i].gx, pois[i].gy);
      if (d <= 1.5 && d < bestD) { bestD = d; best = pois[i]; }
    }
    if (best) {
      if (state.dwellId === best.id) state.dwellT += dt;
      else { state.dwellId = best.id; state.dwellT = dt; }
      if (state.dwellT >= 2) {
        state.stamps[best.id] = now;
        state.dwellId = null;
        state.dwellT = 0;
      }
    } else {
      state.dwellId = null;
      state.dwellT = 0;
    }
  } else {
    state.dwellId = null;
    state.dwellT = 0;
  }

  if (!state.celebrated && Object.keys(state.stamps).length >= POI_DEFS.length) {
    state.celebrated = true;
    state.ceremony = { t: 0, dur: 5 };
    if (!state.fanfareFired && now - state.lastCue >= 300) {
      state.fanfareFired = true;
      state.lastCue = now;
      cueFn('fanfare');
    }
  }
}

function drawBook(ctx, pt, poi, now) {
  const bx = Math.round(pt.x) + 14;
  const by = Math.round(pt.y) + 7 + Math.sin(now * 0.003) * 1;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx - 7, by + 7, 16, 3);
  ctx.fillStyle = '#e8d8b0';
  ctx.beginPath();
  ctx.moveTo(bx - 7, by + 6);
  ctx.lineTo(bx - 7, by);
  ctx.lineTo(bx, by + 2);
  ctx.lineTo(bx, by + 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx + 7, by + 6);
  ctx.lineTo(bx + 7, by);
  ctx.lineTo(bx, by + 2);
  ctx.lineTo(bx, by + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(bx - 1, by + 2, 2, 6);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx - 7, by + 6);
  ctx.lineTo(bx - 7, by);
  ctx.lineTo(bx, by + 2);
  ctx.lineTo(bx + 7, by);
  ctx.lineTo(bx + 7, by + 6);
  ctx.stroke();
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(fitFn(poi.hint, 64), bx, by - 6);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawScroll(ctx, state, pt, Vv) {
  const c = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  const scrollW = c ? Math.max(120, Math.min(c.width - 40, 340)) : 340;
  const full = 'SCRAPBOOK COMPLETE - the guild salutes a thorough wanderer';
  const open = clamp(state.ceremony.t / 0.8, 0, 1);
  const h = Math.round(30 * open);
  const cx = Math.round(pt.x);
  const cy = Math.round(pt.y) - 52 - Math.round((1 - open) * 6);
  const x = cx - Math.round(scrollW / 2);
  const y = cy - Math.round(h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 2, y + 3, scrollW, h);
  ctx.fillStyle = '#e8d8b0';
  ctx.fillRect(x, y, scrollW, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, scrollW - 1, h - 1);
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x - 3, y - 3, 4, h + 6);
  ctx.fillRect(x + scrollW - 1, y - 3, 4, h + 6);
  if (h > 14) {
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4a3a20';
    ctx.fillText(fitFn(full, scrollW - 16), cx, cy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  if (!ctx || !state || !Vv || Vv.gameState !== 'play') return;
  const vis = getVisitor();
  const hasVis = !!(vis && isFinite(vis.gx) && isFinite(vis.gy));
  if (!hasVis) return;
  const now = nowFn();
  const pt = isoFn(vis.gx, vis.gy);

  const pois = resolvePois();
  let near = null;
  let nearD = Infinity;
  for (let i = 0; i < pois.length; i++) {
    if (state.stamps[pois[i].id] != null) continue;
    const d = tileDist(vis.gx, vis.gy, pois[i].gx, pois[i].gy);
    if (d <= 3 && d < nearD) { nearD = d; near = pois[i]; }
  }
  if (near) drawBook(ctx, pt, near, now);
  if (state.ceremony) drawScroll(ctx, state, pt, Vv);
}

if (typeof window !== 'undefined') {
  if (!window.GuildScrapbook || typeof window.GuildScrapbook !== 'object') window.GuildScrapbook = createState();
  const st = window.GuildScrapbook;
  if (!st.stamps || typeof st.stamps !== 'object') st.stamps = {};
  if (st.dwellId === undefined) st.dwellId = null;
  if (typeof st.dwellT !== 'number') st.dwellT = 0;
  if (typeof st.celebrated !== 'boolean') st.celebrated = false;
  if (typeof st.fanfareFired !== 'boolean') st.fanfareFired = false;
  if (st.ceremony === undefined) st.ceremony = null;
  if (typeof st.lastCue !== 'number') st.lastCue = 0;
  st.update = update;
  st.draw = draw;
  st.__probe = function () { return { collected: Object.keys(st.stamps).length }; };
}

export {};
