function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildEconomy; }
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
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function ensureStateArrays(st, size) {
  if (!st) return;
  if (!Array.isArray(st.purses)) st.purses = [];
  if (!Array.isArray(st.lastCounts)) st.lastCounts = [];
  if (!Array.isArray(st.failedCounts)) st.failedCounts = [];
  if (!Array.isArray(st.floats)) st.floats = [];
  if (typeof st.visitorPurse !== 'number') st.visitorPurse = 20;
  if (typeof st.treasury !== 'number') st.treasury = 0;
  if (typeof st.minted !== 'number') st.minted = 0;
  while (st.purses.length < size) st.purses.push(0);
  while (st.lastCounts.length < size) st.lastCounts.push(0);
  while (st.failedCounts.length < size) st.failedCounts.push(0);
  if (st.purses.length > size) st.purses = st.purses.slice(0, size);
  if (st.lastCounts.length > size) st.lastCounts = st.lastCounts.slice(0, size);
  if (st.failedCounts.length > size) st.failedCounts = st.failedCounts.slice(0, size);
}

function getPurse(i) {
  const st = getState();
  if (!st) return 0;
  ensureStateArrays(st, Array.isArray(getV() && getV().workers) ? getV().workers.length : st.purses.length);
  if (i === -1) return st.visitorPurse || 0;
  const idx = Number(i);
  if (!isFinite(idx) || idx < 0 || idx >= st.purses.length) return 0;
  return st.purses[idx] || 0;
}

function spend(i, amount) {
  const st = getState();
  if (!st) return false;
  const amt = Number(amount);
  if (!isFinite(amt) || amt < 0) return false;
  if (i === -1) {
    const cur = st.visitorPurse || 0;
    if (cur < amt) return false;
    st.visitorPurse = cur - amt;
    return true;
  }
  const idx = Number(i);
  if (!isFinite(idx) || idx < 0) return false;
  ensureStateArrays(st, Math.max(st.purses.length, idx + 1));
  const cur = st.purses[idx] || 0;
  if (cur < amt) return false;
  st.purses[idx] = cur - amt;
  return true;
}

function credit(i, amount) {
  const st = getState();
  if (!st) return;
  const amt = Number(amount);
  if (!isFinite(amt)) return;
  if (i === -1) {
    if (typeof st.visitorPurse !== 'number') st.visitorPurse = 20;
    st.visitorPurse += amt;
    return;
  }
  const idx = Number(i);
  if (!isFinite(idx) || idx < 0) return;
  ensureStateArrays(st, Math.max(st.purses.length, idx + 1));
  st.purses[idx] = (st.purses[idx] || 0) + amt;
}

function spawnFloat(st, x, y, text, color, duration, rise) {
  if (!st) return;
  const fx = (typeof x === 'number' && isFinite(x)) ? x : null;
  const fy = (typeof y === 'number' && isFinite(y)) ? y : null;
  st.floats.push({
    x: fx,
    y: fy,
    text: String(text),
    color: color,
    start: (typeof performance !== 'undefined') ? performance.now() : Date.now(),
    duration: duration,
    rise: rise
  });
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  const workerStates = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  ensureStateArrays(st, workers.length);

  for (let i = 0; i < workers.length; i++) {
    const worker = (workers[i] && typeof workers[i] === 'object') ? workers[i] : {};
    const tasks = Array.isArray(worker.tasks) ? worker.tasks : [];
    let doneCount = 0;
    let failedCount = 0;
    for (let t = 0; t < tasks.length; t++) {
      const task = tasks[t];
      if (task && task.status === 'done') doneCount++;
      else if (task && task.status === 'failed') failedCount++;
    }

    const prevDone = (typeof st.lastCounts[i] === 'number') ? st.lastCounts[i] : 0;
    if (doneCount > prevDone) {
      const delta = doneCount - prevDone;
      st.purses[i] = (st.purses[i] || 0) + delta * 10;
      st.minted = (st.minted || 0) + delta * 10;
      const ws = workerStates[i];
      const baseX = (ws && typeof ws.x === 'number') ? ws.x + 8 : null;
      const baseY = (ws && typeof ws.y === 'number') ? ws.y - 18 : null;
      for (let k = 0; k < delta; k++) {
        spawnFloat(st, baseX != null ? baseX + k * 4 : null, baseY != null ? baseY - k * 6 : null, '+10 GC', '#facc15', 2000, 32 + k * 4);
      }
    }

    const prevFailed = (typeof st.failedCounts[i] === 'number') ? st.failedCounts[i] : 0;
    if (failedCount > prevFailed) {
      const delta = failedCount - prevFailed;
      const ws = workerStates[i];
      const baseX = (ws && typeof ws.x === 'number') ? ws.x + 8 : null;
      const baseY = (ws && typeof ws.y === 'number') ? ws.y - 20 : null;
      for (let k = 0; k < delta; k++) {
        spawnFloat(st, baseX != null ? baseX + k * 4 : null, baseY != null ? baseY - k * 5 : null, 'unpaid', '#9ca3af', 1200, 14);
      }
    }

    st.lastCounts[i] = doneCount;
    st.failedCounts[i] = failedCount;
  }

  const kept = [];
  for (let i = 0; i < st.floats.length; i++) {
    const f = st.floats[i];
    if (!f || typeof f.start !== 'number') continue;
    if (now - f.start < f.duration) kept.push(f);
  }
  st.floats = kept;
}

function drawCoin(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#a16207';
  ctx.stroke();
}

function clampOnIsland(gx, gy, Vv) {
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  let x = clamp(Math.round(gx), minC, maxC);
  let y = clamp(Math.round(gy), minC, maxC);
  let guard = 0;
  while (tileRing(x, y) > s && guard < 20) {
    if (x > 0) x--;
    else if (x < 0) x++;
    else if (y > 0) y--;
    else if (y < 0) y++;
    else break;
    guard++;
  }
  return { gx: x, gy: y };
}

function drawVault(ctx, Vv, st) {
  if (!ctx) return;
  const pos = clampOnIsland(2.5, 0.5, Vv || {});
  const p = isoFn(pos.gx, pos.gy);
  const vx = Math.round(p.x);
  const vy = Math.round(p.y);

  const treasury = (st && typeof st.treasury === 'number') ? st.treasury : 0;
  const n = Math.min(8, Math.floor(treasury / 30));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2;
    const cx = vx - 9 + side * 4;
    const cy = vy - 3 - row * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
  }

  ctx.fillStyle = '#3a342f';
  ctx.fillRect(vx - 8, vy - 12, 16, 12);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(vx - 8, vy - 7, 16, 3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#1a1714';
  ctx.strokeRect(vx - 8, vy - 12, 16, 12);

  const label = 'GUILD TREASURY: ' + treasury + ' GC';
  const plateW = 128;
  const plateH = 15;
  const px = Math.round(vx - plateW * 0.5);
  const py = Math.round(vy + 4);
  ctx.fillStyle = 'rgba(10, 10, 12, 0.88)';
  ctx.fillRect(px, py, plateW, plateH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, plateW, plateH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(px + 2, py + 1, plateW - 4, plateH - 2);
  ctx.clip();
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(label, plateW - 6), px + 3, py + plateH * 0.5 + 1);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawVisitorPurse(ctx, st, Vv) {
  if (!ctx || !st || !Vv || !Vv.canvas) return;
  const c = Vv.canvas;
  const chatH = 106;
  const bottomH = 52;
  const chatY = c.height - bottomH - chatH - 8;
  const text = 'VISITOR PURSE: ' + (st.visitorPurse || 0) + ' GC';
  const plateW = 190;
  const plateH = 16;
  const px = 12;
  const py = chatY - 20;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(px, py, plateW, plateH);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, plateW, plateH);
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(text, plateW - 10), px + 6, py + plateH * 0.5);
  ctx.restore();
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  ensureStateArrays(st, Array.isArray(Vv.workers) ? Vv.workers.length : 0);

  if (Array.isArray(Vv.workerStates)) {
    for (let i = 0; i < Vv.workerStates.length; i++) {
      const ws = Vv.workerStates[i];
      if (!ws || typeof ws.x !== 'number' || typeof ws.y !== 'number') continue;
      const x = Math.round(ws.x) + 46;
      const y = Math.round(ws.y) - 34;
      drawCoin(ctx, x, y);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(st.purses[i] != null ? st.purses[i] : 0), x + 5, y);
    }
  }

  drawVault(ctx, Vv, st);

  if (Array.isArray(st.floats)) {
    for (let i = 0; i < st.floats.length; i++) {
      const f = st.floats[i];
      if (!f || typeof f.start !== 'number') continue;
      const age = (nowFn() - 0) >= 0 ? 0 : 0;
      void age;
    }
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    for (let i = 0; i < st.floats.length; i++) {
      const f = st.floats[i];
      if (!f || typeof f.start !== 'number') continue;
      const elapsed = now - f.start;
      if (elapsed < 0 || elapsed >= f.duration) continue;
      const progress = elapsed / f.duration;
      let alpha = 1 - progress;
      if (f.text === 'unpaid') alpha = (1 - progress) * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 0.02)));
      const x = (typeof f.x === 'number') ? f.x : 0;
      const y = (typeof f.y === 'number') ? f.y - (f.rise || 0) * progress : 0;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = f.color || '#facc15';
      ctx.font = (f.text === 'unpaid') ? 'bold 9px monospace' : 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, Math.round(x), Math.round(y));
    }
    ctx.globalAlpha = 1;
  }

  drawVisitorPurse(ctx, st, Vv);
}

if (typeof window !== 'undefined') {
  if (!window.GuildEconomy) {
    window.GuildEconomy = {
      purses: [],
      treasury: 0,
      minted: 0,
      lastCounts: [],
      visitorPurse: 20,
      failedCounts: [],
      floats: []
    };
  } else {
    if (!Array.isArray(window.GuildEconomy.purses)) window.GuildEconomy.purses = [];
    if (!Array.isArray(window.GuildEconomy.lastCounts)) window.GuildEconomy.lastCounts = [];
    if (!Array.isArray(window.GuildEconomy.failedCounts)) window.GuildEconomy.failedCounts = [];
    if (!Array.isArray(window.GuildEconomy.floats)) window.GuildEconomy.floats = [];
    if (typeof window.GuildEconomy.treasury !== 'number') window.GuildEconomy.treasury = 0;
    if (typeof window.GuildEconomy.minted !== 'number') window.GuildEconomy.minted = 0;
    if (typeof window.GuildEconomy.visitorPurse !== 'number') window.GuildEconomy.visitorPurse = 20;
  }
  const g = window.GuildEconomy;
  g.update = update;
  g.draw = draw;
  g.__probe = function () {
    return { purses: g.purses, treasury: g.treasury, minted: g.minted };
  };
  g.getPurse = getPurse;
  g.spend = spend;
  g.credit = credit;
}

export {};
