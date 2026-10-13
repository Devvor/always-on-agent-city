function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return (w && w.V) ? w.V : null; }
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
function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}
function getState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildSnackStall) w.GuildSnackStall = { sessionSnacks: 0, lastBuy: [], active: null };
  return w.GuildSnackStall;
}

let lastTime = null;
let nextBuyAt = null;
let ownPurses = [];
const snackUntil = Object.create(null);

function randomInterval() {
  return 25000 + Math.random() * 20000;
}
function ensureOwnPurses(n) {
  if (!isFinite(n) || n <= ownPurses.length) return;
  for (let i = ownPurses.length; i < n; i++) ownPurses.push(3);
}
function isIdleWorker(ws) {
  if (!ws || typeof ws !== 'object') return false;
  for (const key in ws) {
    if (Object.prototype.hasOwnProperty.call(ws, key)) {
      const value = ws[key];
      if (typeof value === 'string' && /IDLE/i.test(value)) return true;
    }
  }
  return false;
}
function getPurse(index, w) {
  const ge = w && w.GuildEconomy;
  if (ge && Array.isArray(ge.purses) && index >= 0 && index < ge.purses.length) {
    const value = ge.purses[index];
    return (typeof value === 'number') ? value : (value == null ? 0 : (Number(value) || 0));
  }
  if (index >= 0 && index < ownPurses.length) {
    const value = ownPurses[index];
    return (typeof value === 'number') ? value : (value == null ? 0 : (Number(value) || 0));
  }
  return 0;
}
function decrementPurse(index) {
  const w = root();
  const ge = w && w.GuildEconomy;
  if (ge && Array.isArray(ge.purses) && index >= 0 && index < ge.purses.length) {
    const value = ge.purses[index];
    ge.purses[index] = (typeof value === 'number' ? value : 0) - 2;
  } else if (index >= 0 && index < ownPurses.length) {
    ownPurses[index] = (typeof ownPurses[index] === 'number' ? ownPurses[index] : 0) - 2;
  }
}
function collectIdleIndices(Vv) {
  const out = [];
  if (!Vv || !Array.isArray(Vv.workerStates)) return out;
  for (let i = 0; i < Vv.workerStates.length; i++) {
    if (isIdleWorker(Vv.workerStates[i])) out.push(i);
  }
  return out;
}
function drawBun(ctx, x, y) {
  if (!ctx) return;
  ctx.fillStyle = '#d97706';
  ctx.fillRect(x, y, 4, 3);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x + 1, y, 2, 1);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const g = getState();
  if (!g) { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (g.active && typeof g.active.start === 'number') {
    const duration = (typeof g.active.duration === 'number') ? g.active.duration : (g.active.type === 'wistful' ? 3000 : 2500);
    if (now - g.active.start >= duration) g.active = null;
  }

  const Vv = getV();
  const count = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates.length : 0;
  ensureOwnPurses(count);

  if (!w || !Vv || Vv.gameState !== 'play') return;
  if (nextBuyAt === null) nextBuyAt = now + randomInterval();
  if (g.active) return;
  if (now < nextBuyAt) return;

  nextBuyAt = now + randomInterval();
  const idle = collectIdleIndices(Vv);
  if (!idle.length) return;

  const index = idle[0];
  const purse = getPurse(index, w);
  if (purse > 0) {
    g.sessionSnacks = (typeof g.sessionSnacks === 'number' ? g.sessionSnacks : 0) + 1;
    decrementPurse(index);
    try {
      if (typeof w.cue === 'function') w.cue('done');
    } catch (e) {}
    snackUntil[String(index)] = now + 60000;
    g.active = { type: 'buy', index: index, start: now, duration: 2500 };
    if (!Array.isArray(g.lastBuy)) g.lastBuy = [];
    g.lastBuy.push({ index: index, at: now });
  } else {
    g.active = { type: 'wistful', index: index, start: now, duration: 3000 };
  }
}

function draw(ctx) {
  if (!ctx) return;
  const g = getState();
  if (!g) return;
  const now = nowFn();
  const w = root();
  const Vv = getV();

  if (g.active && typeof g.active.start === 'number') {
    const duration = (typeof g.active.duration === 'number') ? g.active.duration : (g.active.type === 'wistful' ? 3000 : 2500);
    if (now - g.active.start >= duration) g.active = null;
  }

  const stall = isoFn(-0.6, 4.4);
  const stallXRaw = (stall && isFinite(stall.x)) ? stall.x : 0;
  const stallYRaw = (stall && isFinite(stall.y)) ? stall.y : 0;
  const X = Math.round(stallXRaw);
  const Y = Math.round(stallYRaw);

  ctx.fillStyle = '#7a5230';
  ctx.fillRect(X - 22, Y - 10, 44, 14);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(X - 22, Y - 10, 44, 3);

  const awningX = X - 26;
  const awningY = Y - 26;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#e8e6df' : '#4a3423';
    ctx.fillRect(awningX + i * 4, awningY, 4, 12);
  }
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(X - 24, Y - 14, 3, 4);
  ctx.fillRect(X + 21, Y - 14, 3, 4);

  ctx.fillStyle = 'rgba(230, 220, 190, 0.9)';
  ctx.fillRect(X - 7, Y - 20, 14, 8);
  ctx.fillStyle = '#8b6b3f';
  ctx.fillRect(X - 5, Y - 19, 10, 6);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(X - 3, Y - 17, 2, 2);
  ctx.fillRect(X + 1, Y - 16, 2, 2);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(X - 23, Y - 11, 46, 15);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(X - 2, Y - 26, 4, 4);

  const priceText = ((typeof g.sessionSnacks === 'number' ? g.sessionSnacks : 0) >= 5) ? 'snack: 3 GC' : 'snack: 2 GC';
  const pw = 72;
  const ph = 14;
  const px = X - Math.round(pw * 0.5);
  const py = Y + 8;
  ctx.fillStyle = '#0d1324';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(priceText, pw - 6), px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';

  const workerOf = function (index) {
    if (!Vv || !Array.isArray(Vv.workerStates)) return null;
    const worker = Vv.workerStates[index];
    if (!worker || !isFinite(Number(worker.x)) || !isFinite(Number(worker.y))) return null;
    return worker;
  };

  if (g.active && g.active.type === 'buy' && typeof g.active.start === 'number') {
    const index = g.active.index;
    const age = now - g.active.start;
    const duration = (typeof g.active.duration === 'number') ? g.active.duration : 2500;
    if (age >= 0 && age < duration) {
      const t = age / duration;
      const worker = workerOf(index);
      if (worker) {
        const wx = Number(worker.x);
        const wy = Number(worker.y);
        ctx.globalAlpha = Math.max(0, 1 - t);
        for (let k = 0; k < 3; k++) {
          const offset = (k - 1) * 8;
          const dotX = wx + offset + (stallXRaw - wx) * t;
          const dotY = wy - 4 + (stallYRaw - wy) * t - Math.sin(t * Math.PI) * (6 + k * 2);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(Math.round(dotX), Math.round(dotY), 2, 2);
        }
        ctx.globalAlpha = 1;
        drawBun(ctx, Math.round(wx + 12), Math.round(wy) - 2);
      }
    }
  }

  for (const key in snackUntil) {
    if (!Object.prototype.hasOwnProperty.call(snackUntil, key)) continue;
    const until = snackUntil[key];
    if (typeof until !== 'number' || now > until) continue;
    const index = parseInt(key, 10);
    if (!isFinite(index)) continue;
    const worker = workerOf(index);
    if (!worker) continue;
    const hop = (g.active && g.active.type === 'buy' && g.active.index === index) ? -2 : 0;
    drawBun(ctx, Math.round(Number(worker.x) + 12), Math.round(Number(worker.y)) + hop);
  }

  if (g.active && g.active.type === 'wistful' && typeof g.active.start === 'number') {
    const index = g.active.index;
    const age = now - g.active.start;
    const duration = (typeof g.active.duration === 'number') ? g.active.duration : 3000;
    if (age >= 0 && age < duration) {
      const worker = workerOf(index);
      if (worker) {
        const wx = Number(worker.x);
        const wy = Number(worker.y);
        const alpha = Math.max(0.45, 1 - (age / duration));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(120, 120, 120, 0.85)';
        ctx.fillRect(Math.round(wx + 8 - 12), Math.round(wy - 24), 24, 14);
        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('...', Math.round(wx + 8), Math.round(wy - 17));
        ctx.restore();
        ctx.textAlign = 'left';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildSnackStall) {
    window.GuildSnackStall = { sessionSnacks: 0, lastBuy: [], active: null };
  } else {
    if (typeof window.GuildSnackStall.sessionSnacks !== 'number') window.GuildSnackStall.sessionSnacks = 0;
    if (!Array.isArray(window.GuildSnackStall.lastBuy)) window.GuildSnackStall.lastBuy = [];
  }
  const g = window.GuildSnackStall;
  g.update = update;
  g.draw = draw;
  g.__probe = function () {
    const state = getState();
    return { sessionSnacks: state ? state.sessionSnacks : 0, active: !!(state && state.active) };
  };
}

export {};
