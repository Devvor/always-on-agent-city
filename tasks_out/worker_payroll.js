const QUIRKS = [
  'skimming my cut... joking',
  'the pile grows',
  'counting stacks',
  'overtime in gold',
  'vault tax? never',
  'mints never sleep'
];

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
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}
function coordLayer(v) {
  if (v >= -2 && v <= 1) return 0;
  if (v < -2) return -2 - v;
  return v - 1;
}
function tileRing(gx, gy) { return Math.max(coordLayer(gx), coordLayer(gy)); }

function ensureState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildPayroll || typeof w.GuildPayroll !== 'object') {
    w.GuildPayroll = { lastMinted: -1, ceremony: null, nextAt: 0 };
  }
  const s = w.GuildPayroll;
  if (typeof s.lastMinted !== 'number') s.lastMinted = -1;
  if (s.ceremony !== null && (typeof s.ceremony !== 'object' || !s.ceremony)) s.ceremony = null;
  if (typeof s.nextAt !== 'number') s.nextAt = 0;
  return s;
}
function getState() { const w = root(); return w ? w.GuildPayroll : null; }

function readMinted() {
  const w = root();
  const e = w && w.GuildEconomy;
  let raw = 0;
  if (e && Object.prototype.hasOwnProperty.call(e, 'minted')) raw = e.minted;
  else if (e && e.minted != null) raw = e.minted;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function vaultTile(Vv) {
  const s = Number.isFinite(Vv && Vv.growthStep) ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  return { gx: clamp(2.5, minC, maxC), gy: clamp(0.5, minC, maxC) };
}
function vaultPoint(Vv) {
  if (!Vv || !Vv.grid) return { x: 0, y: 0 };
  const t = vaultTile(Vv);
  return isoFn(t.gx, t.gy);
}

function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const state = ensureState();
  if (!state) return;
  state._now = now;

  const current = readMinted();
  const prev = state.lastMinted;

  if (prev === -1) {
    state.lastMinted = current;
    if (!state.nextAt) state.nextAt = now + 45000;
  } else if (current > prev) {
    const prevBucket = Math.floor(prev / 50);
    const currBucket = Math.floor(current / 50);
    if (currBucket > prevBucket) {
      state.ceremony = { t0: now, dur: 8000, amount: current };
      state.idleBubble = null;
      const w = root();
      if (w && typeof w.cue === 'function') {
        try { w.cue('levelup'); } catch (e) {}
      }
    }
    state.lastMinted = current;
  }

  const Vv = getV();
  if (state.ceremony && now - state.ceremony.t0 >= state.ceremony.dur) state.ceremony = null;
  if (state.idleBubble && now - state.idleBubble.t0 >= state.idleBubble.dur) state.idleBubble = null;

  if (state.ceremony) return;
  if (!Vv || Vv.gameState !== 'play') return;

  if (!state.idleBubble && now >= (state.nextAt || 0)) {
    let best = -1;
    let bestDist = Infinity;
    const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
    const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
    const vp = vaultPoint(Vv);
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (!w) continue;
      const meta = metas[i] || {};
      const idle = (meta.workerState === 'IDLE') || (w.mode === 'idle');
      if (!idle) continue;
      const d = tileDistance(w.x, w.y, vp.x, vp.y, Vv.grid);
      if (d <= 2 && d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0) {
      const idx = Math.floor(Math.random() * QUIRKS.length);
      state.idleBubble = { workerIndex: best, text: QUIRKS[idx], t0: now, dur: 3000 };
      state.nextAt = now + 45000;
    }
  }
}

function drawCeremony(ctx, state, Vv, now) {
  const cer = state.ceremony;
  if (!cer) return;
  const age = now - cer.t0;
  if (age < 0 || age >= cer.dur) { state.ceremony = null; return; }

  const vp = vaultPoint(Vv);

  const glowT = Math.max(0, 1 - age / 2500);
  if (glowT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.30 * glowT * (0.5 + 0.5 * Math.sin(age * 0.01));
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(Math.round(vp.x - 28), Math.round(vp.y - 28), 56, 56);
    ctx.globalAlpha = 0.18 * glowT;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(vp.x - 16), Math.round(vp.y - 16), 32, 32);
    ctx.restore();
  }

  const numCoins = 16;
  ctx.save();
  for (let i = 0; i < numCoins; i++) {
    const cycle = 2200;
    const delay = i * 95;
    const local = (age + delay) % cycle;
    const progress = local / cycle;
    const topY = vp.y - 100;
    const botY = vp.y + 10;
    const y = topY + (botY - topY) * progress;
    const sway = Math.sin(age * 0.0025 + i * 1.35) * 7;
    const x = vp.x - 62 + (i / Math.max(1, numCoins - 1)) * 124 + sway;
    const fade = progress < 0.08 ? progress / 0.08 : (progress > 0.88 ? (1 - progress) / 0.12 : 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade)) * 0.92;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (age < 2000) {
    ctx.save();
    const text = 'PAYROLL!';
    ctx.font = 'bold 10px monospace';
    const tw = ctx.measureText(text).width;
    const bw = Math.ceil(tw + 10);
    const bh = 14;
    const bx = Math.round(vp.x - bw * 0.5);
    const by = Math.round(vp.y - 86);
    ctx.beginPath();
    ctx.rect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(212,175,55,0.92)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#1b1205';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(text, bw - 4), Math.round(vp.x), by + bh * 0.5);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

function drawIdleBubble(ctx, state, Vv, now) {
  const b = state.idleBubble;
  if (!b) return;
  const age = now - b.t0;
  if (age < 0 || age >= b.dur) { state.idleBubble = null; return; }

  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const w = ws[b.workerIndex];
  if (!w) { state.idleBubble = null; return; }

  const alpha = age <= 2500 ? 1 : Math.max(0, 1 - (age - 2500) / 500);
  ctx.save();
  ctx.globalAlpha = alpha;
  const x = Math.round(w.x) + 8;
  const byTop = Math.round(w.y) - 30;
  ctx.font = '9px monospace';
  const text = fitFn(b.text, 110);
  const tw = ctx.measureText(text).width;
  const bw = Math.max(38, Math.round(tw + 8));
  const bh = 12;
  const bx = Math.round(x - bw * 0.5);
  const by = byTop - bh;
  ctx.fillStyle = 'rgba(10,10,12,0.90)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#e8e6df';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw * 0.5, by + bh * 0.5);
  ctx.restore();
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const state = ensureState();
  const Vv = getV();
  if (!ctx || !state || !Vv || Vv.gameState !== 'play') return;
  const now = (typeof state._now === 'number') ? state._now : nowFn();

  if (state.ceremony && now - state.ceremony.t0 >= state.ceremony.dur) state.ceremony = null;
  if (state.idleBubble && now - state.idleBubble.t0 >= state.idleBubble.dur) state.idleBubble = null;

  if (state.ceremony) drawCeremony(ctx, state, Vv, now);
  else if (state.idleBubble) drawIdleBubble(ctx, state, Vv, now);
}

if (typeof window !== 'undefined') {
  ensureState();
  const gp = window.GuildPayroll;
  gp.update = update;
  gp.draw = draw;
  gp.__probe = function () {
    const s = ensureState();
    return { ceremony: !!(s && s.ceremony), lastMinted: s ? s.lastMinted : -1 };
  };
}

export {};
