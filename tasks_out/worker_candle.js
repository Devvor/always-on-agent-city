const MAX_CANDLES = 3;
const LIFETIME_MS = 90000;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildCandle; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function fitFn(text, maxW, ctxOverride) {
  text = (text == null ? '' : String(text));
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  const ctx = ctxOverride || (getV() && getV().ctx);
  if (ctx && isFinite(maxW) && maxW > 0) {
    if (ctx.measureText(text).width <= maxW) return text;
    const ell = '\u2026';
    for (let i = text.length; i > 0; i--) {
      const cand = text.slice(0, i) + ell;
      if (ctx.measureText(cand).width <= maxW) return cand;
    }
    return ctx.measureText(ell).width <= maxW ? ell : '';
  }
  if (!isFinite(maxW) || maxW <= 0) return '';
  return text;
}

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function failedId(task, index) {
  if (!task || typeof task !== 'object') return 'task_' + (index == null ? 0 : index);
  if (task.id != null) return String(task.id);
  if (task.key != null) return String(task.key);
  if (task.title != null) return String(task.title);
  if (task.name != null) return String(task.name);
  return 'task_' + (index == null ? 0 : index);
}

function countFailed(Vv) {
  if (!Vv || !Array.isArray(Vv.allTasks)) return 0;
  let count = 0;
  for (let i = 0; i < Vv.allTasks.length; i++) {
    const t = Vv.allTasks[i];
    if (t && t.status === 'failed') count++;
  }
  return count;
}

function clampTileToIsland(gx, gy) {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  let x = (typeof gx === 'number' && isFinite(gx)) ? gx : 0;
  let y = (typeof gy === 'number' && isFinite(gy)) ? gy : 0;
  if (x < minC) x = minC;
  if (x > maxC) x = maxC;
  if (y < minC) y = minC;
  if (y > maxC) y = maxC;
  return { x: x, y: y };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;

  if (!Array.isArray(state.lit)) state.lit = [];
  const baseNow = now;
  state.lit = state.lit.filter(function (c) {
    return c && typeof c.start === 'number' && (baseNow - c.start) < LIFETIME_MS;
  });

  const failedTasks = Array.isArray(Vv.allTasks)
    ? Vv.allTasks.filter(function (t) { return t && t.status === 'failed'; })
    : [];
  const currentCount = failedTasks.length;

  if (!state._initialized) {
    state.lastFailed = currentCount;
    const seen = new Set();
    for (let i = 0; i < failedTasks.length; i++) seen.add(failedId(failedTasks[i], i));
    state._seenFailed = seen;
    state._initialized = true;
    state._labelAlpha = 0;
    state._lastNow = now;
    return;
  }

  const lastNow = (typeof state._lastNow === 'number') ? state._lastNow : now;
  let dt = (now - lastNow) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  state._lastNow = now;

  const seen = (state._seenFailed instanceof Set) ? state._seenFailed : new Set();
  const newIds = [];
  for (let i = 0; i < failedTasks.length; i++) {
    const id = failedId(failedTasks[i], i);
    if (!seen.has(id)) newIds.push(id);
  }

  const lastFailed = (typeof state.lastFailed === 'number') ? state.lastFailed : currentCount;
  const delta = currentCount - lastFailed;

  if (delta > 0) {
    let lightIds = [];
    if (newIds.length >= delta) {
      lightIds = newIds.slice(0, delta);
    } else if (newIds.length > 0) {
      lightIds = newIds.slice();
    } else {
      const start = Math.max(0, failedTasks.length - delta);
      lightIds = failedTasks.slice(start).map(function (t, i) { return failedId(t, i); });
    }

    const baseTile = clampTileToIsland(-2.2, 4.6);
    for (let i = 0; i < lightIds.length; i++) {
      state.lit.push({
        id: lightIds[i],
        start: now,
        gx: baseTile.x,
        gy: baseTile.y
      });
    }
    if (state.lit.length > MAX_CANDLES) {
      state.lit.splice(0, state.lit.length - MAX_CANDLES);
    }
  }

  const nextSeen = new Set();
  for (let i = 0; i < failedTasks.length; i++) nextSeen.add(failedId(failedTasks[i], i));
  state._seenFailed = nextSeen;
  state.lastFailed = currentCount;

  const targetAlpha = state.lit.length ? 0.5 : 0;
  const currentAlpha = (typeof state._labelAlpha === 'number') ? state._labelAlpha : 0;
  if (dt > 0) {
    const rate = 2.5;
    const alphaStep = 1 - Math.exp(-rate * dt);
    state._labelAlpha = currentAlpha + (targetAlpha - currentAlpha) * alphaStep;
  } else {
    state._labelAlpha = targetAlpha;
  }
  if (state.lit.length === 0) state._labelAlpha = Math.max(0, state._labelAlpha);
}

function drawVotive(ctx, x, y, candle, now) {
  x = Math.round(x);
  y = Math.round(y);
  const frame = (Math.floor((now - candle.start) / 150) % 2);

  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(x - 4, y + 5, 8, 2);

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x - 2, y - 4, 4, 5);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x - 2, y - 4, 4, 1);

  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x, y - 6, 1, 2);

  ctx.fillStyle = '#fbbf24';
  if (frame === 0) {
    ctx.fillRect(x - 1, y - 9, 3, 4);
    ctx.fillRect(x, y - 10, 1, 1);
  } else {
    ctx.fillRect(x - 1, y - 8, 2, 3);
  }

  const px = x - 18;
  const py = y + 7;
  ctx.fillStyle = 'rgba(60,62,66,0.78)';
  ctx.fillRect(px, py, 36, 12);
  ctx.strokeStyle = 'rgba(120,122,126,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, 36, 12);

  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const plaqueText = 'for ' + candle.id;
  const shownPlaque = fitFn(plaqueText, 32, ctx);
  ctx.fillStyle = '#a3a3a3';
  ctx.fillText(shownPlaque, px + 18, py + 6);
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  if (!ctx || !state || !Vv || Vv.gameState !== 'play') return;
  if (!Array.isArray(state.lit)) state.lit = [];
  if (state.lit.length === 0) return;

  const now = nowFn();
  const n = state.lit.length;
  const points = [];
  for (let i = 0; i < n; i++) {
    const c = state.lit[i];
    const pt = isoFn(c.gx, c.gy);
    const x = pt.x + (i - (n - 1) / 2) * 10;
    const y = pt.y;
    points.push({ candle: c, x: x, y: y });
    drawVotive(ctx, x, y, c, now);
  }

  const centerX = points.reduce(function (sum, p) { return sum + p.x; }, 0) / points.length;
  const baseY = points[0].y;
  const alpha = (typeof state._labelAlpha === 'number') ? state._labelAlpha : 0;
  if (alpha > 0.001) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = 'the guild remembers its flops';
    const shown = fitFn(label, 200, ctx);
    ctx.fillStyle = 'rgba(160,162,168,1)';
    ctx.fillText(shown, centerX, baseY + 24);
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

if (typeof window !== 'undefined') {
  if (!window.GuildCandle) window.GuildCandle = { lit: [], lastFailed: 0 };
  const G = window.GuildCandle;
  if (!Array.isArray(G.lit)) G.lit = [];
  if (typeof G.lastFailed !== 'number') G.lastFailed = 0;
  if (typeof G._initialized !== 'boolean') G._initialized = false;
  if (!(G._seenFailed instanceof Set)) G._seenFailed = new Set();
  if (typeof G._labelAlpha !== 'number') G._labelAlpha = 0;
  if (typeof G._lastNow !== 'number') G._lastNow = null;

  G.update = update;
  G.draw = draw;
  G.__probe = function () { return { lit: Array.isArray(G.lit) ? G.lit.length : 0 }; };
  G.__rawUpdate = update;
}

export {};
