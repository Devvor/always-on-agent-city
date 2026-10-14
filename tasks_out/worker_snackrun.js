let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildSnackRun; }
function visitorState() { const w = root(); return w && w.GuildVisitor; }
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
function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

function tileDistance(sx, sy, vx, vy, g) {
  if (!g || !isFiniteNumber(g.tileW) || !isFiniteNumber(g.tileH) || !g.tileW || !g.tileH) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function stallPos() {
  const w = root();
  const e = w && w.GuildEconomy;
  if (e && e.stall && typeof e.stall === 'object') {
    const x = Number(e.stall.x);
    const y = Number(e.stall.y);
    if (isFinite(x) && isFinite(y)) return { x: x, y: y };
  }
  const pt = isoFn(0, -1);
  return { x: pt.x, y: pt.y };
}

function visitorPos() {
  const v = visitorState();
  if (!v || !isFiniteNumber(v.gx) || !isFiniteNumber(v.gy)) return null;
  return isoFn(v.gx, v.gy);
}

function tryBuy(now) {
  const s = getState();
  const Vv = getV();
  const vis = visitorState();
  if (!s || s.phase !== 'idle' || !vis || !Vv || Vv.gameState !== 'play') return false;
  const sp = stallPos();
  const vp = isoFn(vis.gx, vis.gy);
  if (tileDistance(vp.x, vp.y, sp.x, sp.y, Vv.grid) > 2) return false;
  s.phase = 'making';
  s.held = null;
  s._makeStart = null;
  try {
    const tips = root() && root().GuildTips;
    if (tips && typeof tips.coins === 'number' && tips.coins > 0) tips.coins -= 1;
  } catch (e) {}
  return true;
}

function tryDeliver(now) {
  const s = getState();
  const Vv = getV();
  const vis = visitorState();
  if (!s || s.phase !== 'held' || !s.held || !vis || !Vv || Vv.gameState !== 'play') return false;
  const vp = isoFn(vis.gx, vis.gy);
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w || !isFiniteNumber(w.x) || !isFiniteNumber(w.y)) continue;
    const d = tileDistance(w.x, w.y, vp.x, vp.y, Vv.grid);
    if (d <= 1.5 && d < bestDist) { bestDist = d; best = i; }
  }
  if (best < 0) return false;
  s.phase = 'idle';
  s.held = null;
  s._makeStart = null;
  const worker = ws[best];
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  const meta = metas[best] || {};
  const name = (meta.name != null) ? meta.name : (best === 0 ? 'MISSINGNO' : 'STEP5');
  const color = workerColor(best, name);
  if (!Array.isArray(s.floats)) s.floats = [];
  s.floats.push({ text: 'Yum!', color: color, x: (worker.x || 0) + 8, y: (worker.y || 0) - 12, vy: -24, t: 0, duration: 2 });
  try {
    const econ = root() && root().GuildEconomy;
    if (econ && Array.isArray(econ.purses)) {
      const idx = best;
      if (idx >= 0 && idx < econ.purses.length && typeof econ.purses[idx] === 'number') econ.purses[idx] += 1;
    }
  } catch (e) {}
  try {
    const purp = root() && root().GuildPurpose;
    if (purp && typeof purp.rep === 'number') purp.rep += 1;
  } catch (e) {}
  try {
    const cueFn = root() && root().cue;
    if (typeof cueFn === 'function') cueFn('done');
  } catch (e) {}
  return true;
}

function updateFloats(dt) {
  const s = getState();
  if (!s || !Array.isArray(s.floats)) return;
  const next = [];
  for (let i = 0; i < s.floats.length; i++) {
    const f = s.floats[i];
    if (!f || typeof f !== 'object') continue;
    f.t = (typeof f.t === 'number' ? f.t : 0) + dt;
    if (typeof f.y === 'number') f.y += (typeof f.vy === 'number' ? f.vy : -24) * dt;
    const dur = (typeof f.duration === 'number' && f.duration > 0) ? f.duration : 2;
    if (f.t < dur) next.push(f);
  }
  s.floats = next;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const s = getState();
  const Vv = getV();
  if (!s) { lastTime = now; return; }
  if (!Array.isArray(s.floats)) s.floats = [];
  if (!Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const bEdge = pressed.has('b') && !prevPressed.has('b');

  if (s.phase === 'idle') {
    if (bEdge) tryBuy(now);
  } else if (s.phase === 'making') {
    if (!isFiniteNumber(s._makeStart)) s._makeStart = now;
    if (now - s._makeStart >= 1500) {
      s.phase = 'held';
      s.held = true;
      s._makeStart = null;
      try {
        const cueFn = root() && root().cue;
        if (typeof cueFn === 'function') cueFn('grow');
      } catch (e) {}
    }
  } else if (s.phase === 'held') {
    if (bEdge) tryDeliver(now);
  }

  updateFloats(dt);
  prevPressed = new Set(pressed);
}

function draw(ctx) {
  const s = getState();
  const Vv = getV();
  if (!s || !ctx || !Vv || Vv.gameState !== 'play') return;
  const vis = visitorState();

  if (s.phase === 'held' && s.held && vis && isFiniteNumber(vis.gx) && isFiniteNumber(vis.gy)) {
    const pt = isoFn(vis.gx, vis.gy);
    const x = Math.round(pt.x + 5);
    const y = Math.round(pt.y - 15 + Math.sin(nowFn() * 0.005) * 1);
    ctx.fillStyle = '#e8d5a3';
    ctx.fillRect(x, y, 4, 3);
    ctx.fillStyle = '#8b6f47';
    ctx.fillRect(x, y + 3, 4, 1);
  }

  if (Array.isArray(s.floats)) {
    ctx.font = '10px monospace';
    for (let i = 0; i < s.floats.length; i++) {
      const f = s.floats[i];
      if (!f || typeof f !== 'object') continue;
      const dur = (typeof f.duration === 'number' && f.duration > 0) ? f.duration : 2;
      const t = (typeof f.t === 'number') ? f.t : 0;
      let alpha = 1;
      if (t > dur - 0.5) alpha = Math.max(0, (dur - t) / 0.5);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = (typeof f.color === 'string') ? f.color : '#ffffff';
      ctx.fillText(String(f.text == null ? '' : f.text), Math.round(f.x || 0), Math.round(f.y || 0));
      ctx.globalAlpha = 1;
    }
  }

  if (s.phase === 'idle' && vis && isFiniteNumber(vis.gx) && isFiniteNumber(vis.gy)) {
    const sp = stallPos();
    const vp = isoFn(vis.gx, vis.gy);
    if (tileDistance(vp.x, vp.y, sp.x, sp.y, Vv.grid) <= 2) {
      ctx.font = '10px monospace';
      const hint = fitFn('B: buy snack 1gc', 180);
      ctx.fillStyle = '#f3d37a';
      ctx.fillText(hint, Math.round(sp.x), Math.round(sp.y - 14));
    }
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const Vv = getV();
  const s = getState();
  if (s && Vv && Vv.gameState === 'play' && k === 'b') {
    if (s.phase === 'idle') tryBuy(nowFn());
    else if (s.phase === 'held') tryDeliver(nowFn());
  }
  if (k === 'b') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

if (typeof window !== 'undefined') {
  if (!window.GuildSnackRun) window.GuildSnackRun = { phase: 'idle', held: null, floats: [] };
  window.GuildSnackRun.update = update;
  window.GuildSnackRun.draw = draw;
  window.GuildSnackRun.__probe = function () {
    const st = getState();
    return { phase: st ? st.phase : 'idle', held: !!(st && st.held) };
  };
  window.GuildSnackRun.__rawUpdate = update;
  window.GuildSnackRun.__keys = pressed;
  if (!window.__gsrListeners) {
    window.__gsrListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
