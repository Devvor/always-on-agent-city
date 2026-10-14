const pressed = new Set();
const prevPressed = new Set();
let lastTime = null;

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
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildTips; }
function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
}

function spawnCoinFloat(state, x, y, start, duration, vy) {
  state.floats.push({
    x: isFinite(x) ? x : 0,
    y: isFinite(y) ? y : 0,
    start: start,
    duration: duration,
    vy: isFinite(vy) ? vy : -16,
    text: '+1 GC'
  });
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const tNow = pressed.has('t');
  const tWas = prevPressed.has('t');

  if (typeof state.coins !== 'number') state.coins = 0;
  if (!Array.isArray(state.tips)) state.tips = [];
  if (typeof state.lastScore !== 'number') state.lastScore = 0;
  if (!Array.isArray(state.floats)) state.floats = [];

  const w = root();
  const mg = w && w.GuildMinigame;
  if (mg && typeof mg.score === 'number') {
    const score = mg.score;
    while (state.lastScore < score) {
      state.lastScore += 1;
      state.coins++;
      const vis = w && w.GuildVisitor;
      let fx = 0;
      let fy = 0;
      if (vis && Vv && Vv.grid) {
        const p = isoFn(vis.gx, vis.gy);
        fx = p.x;
        fy = p.y - 30;
      }
      spawnCoinFloat(state, fx, fy, now, 1.2, -20);
      try {
        const cue = w && w.cue;
        if (typeof cue === 'function') cue('grow');
      } catch (e) {}
    }
    if (state.lastScore > score) state.lastScore = score;
  }

  if (tNow && !tWas && state.coins >= 1) {
    const vis = w && w.GuildVisitor;
    if (vis && Vv && Array.isArray(Vv.workerStates) && Vv.grid) {
      const vp = isoFn(vis.gx, vis.gy);
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < Vv.workerStates.length; i++) {
        const worker = Vv.workerStates[i];
        if (!worker) continue;
        const d = tileDistance(worker.x, worker.y, vp.x, vp.y, Vv.grid);
        if (d <= 1.5 && d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (best >= 0 && state.coins >= 1) {
        state.coins--;
        state.tips.push({ workerIndex: best, t: now });
        const econ = w && w.GuildEconomy;
        let useOwn = true;
        try {
          if (econ && Array.isArray(econ.purses) && typeof econ.purses[best] === 'number' && isFinite(econ.purses[best])) {
            econ.purses[best] += 1;
            useOwn = false;
          }
        } catch (e) {
          useOwn = true;
        }
        if (useOwn) {
          if (!Array.isArray(state.purses)) state.purses = [];
          while (state.purses.length <= best) state.purses.push(0);
          state.purses[best] += 1;
        }
        const worker = Vv.workerStates[best];
        if (worker) {
          spawnCoinFloat(state, (isFinite(worker.x) ? worker.x : 0) + 8, (isFinite(worker.y) ? worker.y : 0) - 24, now, 2, -12);
        }
        try {
          const cue = w && w.cue;
          if (typeof cue === 'function') cue('done');
        } catch (e) {}
      }
    }
  }

  const nextFloats = [];
  for (let i = 0; i < state.floats.length; i++) {
    const f = state.floats[i];
    if (!f || typeof f !== 'object') continue;
    if (typeof f.duration !== 'number' || !isFinite(f.duration)) f.duration = 1.2;
    if (typeof f.vy !== 'number' || !isFinite(f.vy)) f.vy = -16;
    f.y += f.vy * dt;
    const age = (now - f.start) / 1000;
    if (!isFinite(age) || age < 0 || age < f.duration) nextFloats.push(f);
  }
  state.floats = nextFloats;

  prevPressed = new Set(pressed);
}

function drawFloats(ctx, now) {
  const state = getState();
  if (!state || !Array.isArray(state.floats)) return;
  for (let i = 0; i < state.floats.length; i++) {
    const f = state.floats[i];
    if (!f || typeof f !== 'object') continue;
    const duration = isFinite(f.duration) ? f.duration : 1.2;
    const age = (now - f.start) / 1000;
    if (!isFinite(age) || age < 0 || age >= duration) continue;
    const alpha = Math.max(0, 1 - (age / duration));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(f.text || '+1 GC', 60), f.x, f.y);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawHud(ctx, now) {
  const state = getState();
  const Vv = getV();
  if (!state || !Vv) return;
  const c = (ctx && ctx.canvas) ? ctx.canvas : Vv.canvas;
  if (!c) return;
  const coins = isFinite(state.coins) ? state.coins : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  const bottomH = 52;
  ctx.beginPath();
  ctx.rect(c.width - 118, c.height - bottomH - 34, 112, 30);
  ctx.clip();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(c.width - 104, c.height - bottomH - 18, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '10px monospace';
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('x ' + coins, 70), c.width - 98, c.height - bottomH - 18);
  ctx.restore();
  ctx.restore();
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;
  const n = (typeof nowFn === 'function') ? nowFn() : Date.now();
  try { drawFloats(ctx, n); } catch (e) {}
  try { drawHud(ctx, n); } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildTips || typeof window.GuildTips !== 'object') {
    window.GuildTips = { coins: 0, tips: [], lastScore: 0, floats: [], purses: [] };
  }
  const gt = window.GuildTips;
  if (typeof gt.coins !== 'number') gt.coins = 0;
  if (!Array.isArray(gt.tips)) gt.tips = [];
  if (typeof gt.lastScore !== 'number') gt.lastScore = 0;
  if (!Array.isArray(gt.floats)) gt.floats = [];
  if (!Array.isArray(gt.purses)) gt.purses = [];
  gt.update = update;
  gt.draw = draw;
  gt.__probe = function () { return { coins: gt.coins, tips: gt.tips.length }; };
  if (!window.__gtListeners) {
    window.__gtListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
