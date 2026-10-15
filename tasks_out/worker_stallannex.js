// tasks_out/worker_stallannex.js
const STALL_GX = 0.5;
const STALL_GY = 5.3;

let nextSpawnAt = null;
let lastNow = null;
let customerSeq = 0;
let floatSeq = 0;
const FLOATS = [];

const PURSE_WORD = /purse|wallet|gold|coin|cash|money|fund|balance|credit|token/i;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildStallAnnex; }
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

function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function idleWorkerIndices(Vv) {
  const out = [];
  if (!Vv) return out;
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  const n = Math.max(states.length, metas.length);
  for (let i = 0; i < n; i++) {
    const st = states[i] || {};
    const meta = metas[i] || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(st.tasks) ? st.tasks : []);
    let idle = false;
    if (typeof st.workerState === 'string' && String(st.workerState).toUpperCase() === 'IDLE') idle = true;
    else if (tasks.length === 0 || tasks.every(function (t) { return t && (t.status === 'done' || t.status == null); })) idle = true;
    if (tasks.some(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); })) idle = false;
    if (idle) out.push(i);
  }
  return out;
}

function collectPurseValues(econ) {
  if (!econ || typeof econ !== 'object') return null;
  const out = [];
  const seen = new Set();
  function rec(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 4) return;
    if (seen.has(obj)) return;
    seen.add(obj);
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = obj[key];
      if (PURSE_WORD.test(String(key))) {
        if (typeof value === 'number' && isFinite(value)) out.push(Number(value));
        else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === 'number' && isFinite(value[i])) out.push(Number(value[i]));
          }
        } else if (value && typeof value === 'object') {
          rec(value, depth + 1);
        }
      } else if (value && typeof value === 'object') {
        rec(value, depth + 1);
      }
    }
  }
  rec(econ, 0);
  if (out.length > 0) return out;

  const fallback = [];
  for (const key in econ) {
    if (!Object.prototype.hasOwnProperty.call(econ, key)) continue;
    const lk = String(key).toLowerCase();
    if (lk === 'gx' || lk === 'gy' || lk === 'x' || lk === 'y') continue;
    const value = econ[key];
    if (typeof value === 'number' && isFinite(value)) fallback.push(Number(value));
    else if (Array.isArray(value) && value.length > 0 && value.every(function (v) { return typeof v === 'number' && isFinite(v); })) {
      for (let i = 0; i < value.length; i++) fallback.push(Number(value[i]));
    }
  }
  return fallback.length > 0 ? fallback : null;
}

function drawStall(ctx, Vv, state, now) {
  const p = isoFn(state.gx, state.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 15, y + 9, 34, 5);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 13, y - 20, 3, 18);
  ctx.fillRect(x + 10, y - 20, 3, 18);

  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 16, y - 2, 32, 9);
  ctx.fillStyle = '#4a2f16';
  ctx.fillRect(x - 16, y + 6, 32, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x - 12, y, 24, 1);

  const awX = x - 18;
  const awY = y - 27;
  const awW = 36;
  const awH = 12;
  for (let i = 0; i < awW / 4; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#d9c8a3' : '#4a2f16';
    ctx.fillRect(awX + i * 4, awY, 4, awH);
  }
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(awX, awY, awW, 2);
  ctx.fillRect(awX, awY + awH - 2, awW, 2);
  ctx.fillRect(awX, awY, 2, awH);
  ctx.fillRect(awX + awW - 2, awY, 2, awH);

  ctx.fillStyle = '#1a1a1d';
  ctx.fillRect(x - 12, y - 15, 24, 9);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 12, y - 15, 24, 9);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('SNACKS 2 GC', 20), x, y - 10.5);
  ctx.textAlign = 'left';
}

function drawGhostCustomer(ctx, customer, baseX, baseY) {
  const x = baseX + 2;
  const y = baseY + 2;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 6, y + 15, 16, 4);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x + 1, y + 10, 3, 8);
  ctx.fillRect(x + 7, y + 10, 3, 8);

  ctx.globalAlpha = 0.45;
  ctx.fillStyle = customer.color || '#94a3b8';
  ctx.fillRect(x - 1, y - 2, 14, 12);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x + 1, y - 11, 10, 9);
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 3, y - 8, 2, 2);
  ctx.fillRect(x + 7, y - 8, 2, 2);

  ctx.globalAlpha = 0.15;
  ctx.fillStyle = customer.color || '#d4af37';
  ctx.fillRect(x - 4, y - 14, 20, 30);
  ctx.globalAlpha = 1;

  const text = fitFn('buys a snack', 120);
  ctx.font = '10px monospace';
  const tw = ctx.measureText(text).width;
  const bw = Math.max(60, Math.round(tw + 12));
  const bh = 16;
  const bx = Math.round(x + 7 - bw / 2);
  const by = y - 46;

  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 6, by + bh * 0.5);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') {
    lastNow = now;
    return;
  }
  if (lastNow === null || !isFinite(lastNow) || now < lastNow) lastNow = now;
  const dt = Math.max(0, Math.min(0.12, (now - lastNow) / 1000));
  lastNow = now;

  state.customers = (Array.isArray(state.customers) ? state.customers : []).filter(function (c) {
    return c && (now - (typeof c.start === 'number' ? c.start : 0)) < (typeof c.duration === 'number' ? c.duration : 4000);
  });

  if (nextSpawnAt === null) nextSpawnAt = now + 20000 + Math.random() * 20000;
  if (now >= nextSpawnAt) {
    nextSpawnAt = now + 20000 + Math.random() * 20000;
    const idle = idleWorkerIndices(Vv);
    if (idle.length > 0) {
      const wi = idle[Math.floor(Math.random() * idle.length)];
      const meta = Array.isArray(Vv.workers) ? Vv.workers[wi] : null;
      const st = Array.isArray(Vv.workerStates) ? Vv.workerStates[wi] : null;
      customerSeq += 1;
      state.customers.push({
        id: customerSeq,
        workerIndex: wi,
        workerName: (meta && meta.name != null) ? meta.name : ((st && st.name != null) ? st.name : ('WORKER ' + (wi + 1))),
        color: workerColor(wi, (meta && meta.name != null) ? meta.name : ((st && st.name != null) ? st.name : '')),
        start: now,
        duration: 4000
      });
    }
  }

  const hasActiveCustomer = Array.isArray(state.customers) && state.customers.some(function (c) {
    return (now - c.start) >= 0 && (now - c.start) < c.duration;
  });

  const econ = root() && root().GuildEconomy;
  const vals = collectPurseValues(econ);
  let decreased = false;
  if (hasActiveCustomer && Array.isArray(vals) && vals.length > 0 && Array.isArray(lastPurseSnapshot) && lastPurseSnapshot.length > 0) {
    const n = Math.min(vals.length, lastPurseSnapshot.length);
    for (let i = 0; i < n; i++) {
      if (isFinite(vals[i]) && isFinite(lastPurseSnapshot[i]) && vals[i] < lastPurseSnapshot[i]) {
        decreased = true;
        break;
      }
    }
  }
  if (Array.isArray(vals) && vals.length > 0) lastPurseSnapshot = vals.slice();
  else lastPurseSnapshot = null;

  if (decreased && hasActiveCustomer) {
    floatSeq += 1;
    FLOATS.push({ id: floatSeq, start: now, duration: 1200, gx: state.gx, gy: state.gy });
  }

  const nextFloats = [];
  for (let i = 0; i < FLOATS.length; i++) {
    const f = FLOATS[i];
    if (now - f.start < f.duration) nextFloats.push(f);
  }
  FLOATS.length = 0;
  for (let i = 0; i < nextFloats.length; i++) FLOATS.push(nextFloats[i]);

  if (dt < 0 || dt > 0.12) dt = 0;
  state._lastDt = dt;
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  if (!ctx || !state || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();

  drawStall(ctx, Vv, state, now);

  const customers = Array.isArray(state.customers) ? state.customers : [];
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const age = now - (typeof c.start === 'number' ? c.start : 0);
    if (age < 0 || age >= (typeof c.duration === 'number' ? c.duration : 4000)) continue;
    const p = isoFn(state.gx, state.gy);
    const baseX = Math.round(p.x);
    const baseY = Math.round(p.y);
    ctx.save();
    const fade = (age > 3500) ? Math.max(0, 1 - (age - 3500) / 500) : 1;
    ctx.globalAlpha = fade;
    drawGhostCustomer(ctx, c, baseX, baseY);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  for (let i = 0; i < FLOATS.length; i++) {
    const f = FLOATS[i];
    const age = now - f.start;
    if (age < 0 || age >= f.duration) continue;
    const alpha = Math.max(0, 1 - (age / f.duration));
    const fp = isoFn(f.gx, f.gy);
    const x = Math.round(fp.x + 4);
    const y = Math.round(fp.y - 26 - (age / 1000) * 18);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn('+2 GC', 60), x, y);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
}

if (typeof window !== 'undefined') {
  if (!window.GuildStallAnnex) {
    window.GuildStallAnnex = { gx: STALL_GX, gy: STALL_GY, customers: [] };
  }
  const annex = window.GuildStallAnnex;
  annex.gx = STALL_GX;
  annex.gy = STALL_GY;
  if (!Array.isArray(annex.customers)) annex.customers = [];
  annex.update = update;
  annex.draw = draw;
  annex.__probe = function () {
    return { customers: Array.isArray(annex.customers) ? annex.customers.length : 0 };
  };
}

export {};
