const root = function () { return (typeof window !== 'undefined') ? window : null; };
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
function getState() { const w = root(); return w && w.GuildDividends; }

let coins = [];
let floats = [];
let hasPaid = false;

function dateStr() {
  const d = new Date();
  return d.toDateString();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!st.paidToday || typeof st.paidToday !== 'number') st.paidToday = 0;
  if (st.lastDay === undefined) st.lastDay = null;
  if (hasPaid || st.paidToday > 0) hasPaid = true;

  try {
    if (!Vv) return;
    if (st.lastDay === null) {
      st.lastDay = dateStr();
      return;
    }
    const today = dateStr();
    if (st.lastDay !== today) {
      const econ = root().GuildEconomy;
      if (econ && Number(econ.minted) > 0) {
        st.lastDay = today;
        const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
        const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
        const n = Math.max(ws.length, metas.length);
        const vault = isoFn(2.5, 0.5);
        const startNow = now;
        for (let i = 0; i < n; i++) {
          const worker = ws[i];
          if (!worker || !isFinite(worker.x) || !isFinite(worker.y)) continue;
          coins.push({
            index: i,
            fromX: vault.x,
            fromY: vault.y,
            toX: worker.x,
            toY: worker.y,
            start: startNow + i * 250,
            end: startNow + i * 250 + 1200,
            done: false
          });
        }
        try { const w = root(); if (w && typeof w.cue === 'function') w.cue('coin'); } catch (e) {}
        try { const w = root(); if (w && typeof w.cue === 'function') w.cue('done'); } catch (e) {}
        st.paidToday += 2 * n;
        hasPaid = true;
      }
    }

    const nextCoins = [];
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (c.done) continue;
      if (now >= c.end) {
        c.done = true;
        floats.push({
          x: c.toX,
          y: c.toY - 12,
          start: now,
          dur: 1200
        });
        try {
          const econ = root().GuildEconomy;
          if (econ && Array.isArray(econ.purses)) {
            const cur = typeof econ.purses[c.index] === 'number' ? econ.purses[c.index] : 0;
            econ.purses[c.index] = cur + 2;
          }
        } catch (e) {}
      } else {
        nextCoins.push(c);
      }
    }
    coins = nextCoins;

    const nextFloats = [];
    for (let i = 0; i < floats.length; i++) {
      const f = floats[i];
      if (now - f.start < f.dur) nextFloats.push(f);
    }
    floats = nextFloats;
  } catch (e) {}
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  if (!st) return;
  const now = nowFn();
  try {
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (now < c.start || now >= c.end || c.done) continue;
      const t = (now - c.start) / (c.end - c.start);
      const u = Math.max(0, Math.min(1, t));
      const x = c.fromX + (c.toX - c.fromX) * u;
      const y = c.fromY + (c.toY - c.fromY) * u - Math.sin(Math.PI * u) * 34;
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    }
    for (let i = 0; i < floats.length; i++) {
      const f = floats[i];
      const age = now - f.start;
      if (age < 0 || age >= f.dur) continue;
      const a = Math.max(0, 1 - age / f.dur);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('+2 GC', Math.round(f.x), Math.round(f.y - age * 0.022));
      ctx.restore();
    }
  } catch (e) {}

  if (!hasPaid && !(st.paidToday > 0)) return;
  hasPaid = true;
  try {
    const canvas = (ctx && ctx.canvas) ? ctx.canvas : (getV() && getV().canvas);
    if (!canvas) return;
    ctx.save();
    const text = 'Dividends today: ' + (st.paidToday || 0) + ' GC';
    ctx.font = '10px monospace';
    const maxW = Math.max(20, canvas.width - 16);
    const shown = fitFn(text, maxW);
    const w = Math.max(44, Math.round(ctx.measureText(shown).width) + 12);
    const h = 16;
    const x = canvas.width - w - 8;
    const y = canvas.height - h - 8;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#0d1324';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(shown, x + 6, y + h * 0.5);
    ctx.restore();
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildDividends) window.GuildDividends = { lastDay: null, paidToday: 0 };
  const g = window.GuildDividends;
  if (g.lastDay === undefined) g.lastDay = null;
  if (typeof g.paidToday !== 'number') g.paidToday = 0;
  g.update = update;
  g.draw = draw;
  g.__probe = function () { return { paidToday: g.paidToday, lastDay: g.lastDay }; };
}

export {};
