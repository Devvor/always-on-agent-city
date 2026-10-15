const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') { try { return w.iso(gx, gy); } catch (e) {} }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function distToVisitor(gx, gy) {
  const v = getVisitor();
  if (!v || !isFinite(v.gx) || !isFinite(v.gy)) return Infinity;
  return Math.hypot(v.gx - gx, v.gy - gy);
}
function visitorPoint() {
  const v = getVisitor();
  if (v && isFinite(v.gx) && isFinite(v.gy)) return isoFn(v.gx, v.gy);
  return isoFn(P.gx, P.gy);
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

const P = {
  gx: 3.6, gy: 4.8, food: 0, fed: 0, scales: [],
  effects: [], wishScales: [], floats: [],
  listeners: false, buyQueued: false
};

function isCoinKey(k) {
  const s = String(k || '').toLowerCase();
  return s === 'coins' || s === 'coin' || s === 'wallet' || s === 'money' ||
    s === 'gc' || s === 'credits' || s.indexOf('coin') !== -1 || s.indexOf('wallet') !== -1;
}

function collectCoins(obj, depth, parentKey, out) {
  if (!obj || typeof obj !== 'object' || depth > 3 || Array.isArray(obj)) return;
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const val = obj[key];
    const lk = String(key).toLowerCase();
    if (isCoinKey(lk) && typeof val === 'number' && isFinite(val)) {
      let pr = 1;
      if (lk.indexOf('visitor') !== -1) pr += 4;
      if (String(parentKey || '').toLowerCase() === 'visitor') pr += 5;
      if (lk.indexOf('wallet') !== -1) pr += 2;
      if (lk.indexOf('coin') !== -1) pr += 1;
      out.push({ obj: obj, key: key, pr: pr });
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) collectCoins(val, depth + 1, key, out);
  }
}

function findVisitorCoinField(econ) {
  if (!econ || typeof econ !== 'object') return null;
  const out = [];
  collectCoins(econ, 0, '', out);
  if (!out.length) return null;
  let best = out[0];
  for (let i = 1; i < out.length; i++) if (out[i].pr > best.pr) best = out[i];
  return best;
}

function spendVisitorCoin() {
  const w = root();
  const econ = w && w.GuildEconomy;
  if (!econ || typeof econ !== 'object') return { ok: false };
  const found = findVisitorCoinField(econ);
  if (!found) return { ok: false };
  const val = Number(found.obj[found.key]);
  if (!isFinite(val) || val < 1) return { ok: false };
  try { found.obj[found.key] = val - 1; } catch (e) { return { ok: false }; }
  return { ok: true };
}

function pushFloat(text, color) {
  P.floats.push({ text: text, color: color || '#f3f4f6', gx: P.gx, gy: P.gy, start: nowFn(), duration: 1300, drift: 1.35 });
}

function attemptBuy(now) {
  if (typeof now !== 'number') now = nowFn();
  if (P.food !== 0) return false;
  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return false;
  if (distToVisitor(P.gx, P.gy) > 1.6) return false;
  if (!spendVisitorCoin().ok) {
    pushFloat('need coins', '#ff8a80');
    return false;
  }
  P.food = 1;
  pushFloat('-1 GC', '#facc15');
  try {
    const w = root();
    if (w && typeof w.cue === 'function') w.cue('grow');
  } catch (e) {}
  return true;
}

function scatter(now) {
  if (typeof now !== 'number') now = nowFn();
  P.food = 0;
  P.fed += 1;
  const count = 5 + Math.floor(Math.random() * 3);
  const sc = { start: now, duration: 2000, x: P.gx, y: P.gy, fish: [], ripples: [] };
  for (let i = 0; i < count; i++) {
    sc.fish.push({
      delay: Math.random() * 360,
      ox: (Math.random() - 0.5) * 1.7,
      phase: Math.random() * Math.PI * 2,
      rise: 9 + Math.random() * 6
    });
  }
  sc.ripples.push({ start: now, delay: 0, max: 15 });
  sc.ripples.push({ start: now + 260, delay: 260, max: 19 });
  sc.ripples.push({ start: now + 620, delay: 620, max: 24 });
  P.effects.push(sc);

  if (Math.random() < 0.3 && (P.scales.length + P.wishScales.length < 9)) {
    P.wishScales.push({ start: now + 220, duration: 1500, done: false });
  }
}

function updateEffects(now) {
  const out = [];
  for (let i = 0; i < P.effects.length; i++) {
    const sc = P.effects[i];
    if (now - sc.start < sc.duration + 520) out.push(sc);
  }
  P.effects = out;

  const nw = [];
  for (let i = 0; i < P.wishScales.length; i++) {
    const ws = P.wishScales[i];
    if (ws.done) continue;
    const p = (now - ws.start) / ws.duration;
    if (p >= 1) {
      if (!ws.done && P.scales.length < 9) P.scales.push({ type: 'wish scale' });
      ws.done = true;
    } else {
      nw.push(ws);
    }
  }
  P.wishScales = nw;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  updateEffects(now);

  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;

  if (P.food === 1) {
    const d = distToVisitor(P.gx, P.gy);
    if (d <= 1.2) scatter(now);
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (k === 'e' || k === ' ') attemptBuy(nowFn());
}

if (typeof window !== 'undefined' && !P.listeners) {
  P.listeners = true;
  window.addEventListener('keydown', onKeydown);
}

function drawBarrel(ctx, pt, now) {
  ctx.fillStyle = '#5a3a23';
  ctx.fillRect(Math.round(pt.x - 6), Math.round(pt.y - 8), 12, 13);
  ctx.fillStyle = '#7a4f2d';
  ctx.fillRect(Math.round(pt.x - 6), Math.round(pt.y - 8), 12, 3);
  ctx.fillStyle = '#3a2516';
  ctx.fillRect(Math.round(pt.x - 6), Math.round(pt.y - 3), 12, 2);
  ctx.fillRect(Math.round(pt.x - 6), Math.round(pt.y + 2), 12, 2);
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(Math.round(pt.x + 5), Math.round(pt.y - 10), 9, 3);
  ctx.fillStyle = '#5a3a23';
  ctx.fillRect(Math.round(pt.x + 13), Math.round(pt.y - 10), 2, 7);
}

function drawEffects(ctx, now) {
  const pt = isoFn(P.gx, P.gy);
  for (let i = 0; i < P.effects.length; i++) {
    const sc = P.effects[i];
    const elapsed = now - sc.start;
    if (elapsed < 0) continue;

    for (let r = 0; r < sc.ripples.length; r++) {
      const rip = sc.ripples[r];
      const rp = clamp((elapsed - rip.delay) / 520, 0, 1);
      if (rp <= 0 || rp >= 1) continue;
      const radius = 3 + rp * (rip.max - 3);
      const alpha = (1 - rp) * 0.42;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#dff6ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(pt.x), Math.round(pt.y - 2), radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.arc(Math.round(pt.x), Math.round(pt.y - 2), radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (let f = 0; f < sc.fish.length; f++) {
      const fish = sc.fish[f];
      const fp = clamp((elapsed - fish.delay) / 1500, 0, 1);
      if (fp <= 0 || fp >= 1) continue;
      const alpha = fp < 0.12 ? (fp / 0.12) : (fp > 0.78 ? Math.max(0, (1 - fp) / 0.22) : 1);
      if (alpha <= 0) continue;
      const curX = pt.x + fish.ox * 10 + Math.sin(fp * Math.PI * 2 + fish.phase) * 3;
      const curY = pt.y + 9 - fp * fish.rise;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(Math.round(curX), Math.round(curY), 3, 3);
      ctx.fillStyle = '#fdba74';
      ctx.fillRect(Math.round(curX) + 1, Math.round(curY), 1, 1);
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(Math.round(curX) + 2, Math.round(curY) + 1, 1, 1);
      ctx.restore();
    }
  }
}

function drawWishScales(ctx, now) {
  const fromPt = isoFn(P.gx, P.gy);
  const toPt = visitorPoint();
  for (let i = 0; i < P.wishScales.length; i++) {
    const ws = P.wishScales[i];
    if (ws.done) continue;
    const p = clamp((now - ws.start) / ws.duration, 0, 1);
    if (p < 0) continue;
    const ease = 1 - Math.pow(1 - p, 3);
    const x = fromPt.x + (toPt.x - fromPt.x) * ease;
    const y = fromPt.y + (toPt.y - fromPt.y) * ease - Math.sin(Math.PI * p) * 16;
    const shimmer = 0.6 + 0.4 * Math.sin(now * 0.011 + i * 1.7);
    ctx.save();
    ctx.globalAlpha = (1 - p * 0.2) * shimmer;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x), Math.round(y - 3), 1, 1);
    ctx.fillRect(Math.round(x - 3), Math.round(y), 1, 1);
    ctx.restore();
  }
}

function drawFloats(ctx, now) {
  for (let i = 0; i < P.floats.length; i++) {
    const f = P.floats[i];
    const age = now - f.start;
    if (age < 0 || age >= f.duration) continue;
    const p = age / f.duration;
    const gpt = isoFn(f.gx, f.gy - p * f.drift);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, Math.round(gpt.x), Math.round(gpt.y));
    ctx.textAlign = 'left';
    ctx.restore();
  }
  const out = [];
  for (let i = 0; i < P.floats.length; i++) {
    if (now - P.floats[i].start < P.floats[i].duration) out.push(P.floats[i]);
  }
  P.floats = out;
}

function drawCounter(ctx) {
  if (!P.scales.length && P.wishScales.length === 0) return;
  const pt = isoFn(P.gx + 0.42, P.gy - 0.28);
  const x = Math.round(pt.x - 18);
  const y = Math.round(pt.y - 8);
  ctx.fillStyle = 'rgba(30,32,36,0.82)';
  ctx.fillRect(x, y, 50, 13);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 50, 13);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('scales: ' + P.scales.length, x + 4, y + 6.5);
  if (P.scales.length > 0) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 39, y + 4, 3, 3);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x + 43, y + 5, 2, 2);
  }
}

function draw(ctx, nowArg) {
  if (!ctx) return;
  const now = (typeof nowArg === 'number') ? nowArg : nowFn();
  const pt = isoFn(P.gx, P.gy);

  drawBarrel(ctx, pt, now);

  const visDist = distToVisitor(P.gx, P.gy);
  if (visDist <= 1.6) {
    const hint = '[E] BUY FOOD (1 GC)';
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText(hint).width;
    const bw = Math.round(tw + 10);
    const bh = 14;
    const hx = Math.round(pt.x - bw * 0.5);
    const hy = Math.round(pt.y - 27);
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(hx, hy, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx, hy, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint, hx + bw * 0.5, hy + bh * 0.5 + 1);
    ctx.textAlign = 'left';
  }

  drawEffects(ctx, now);
  drawWishScales(ctx, now);
  drawFloats(ctx, now);
  drawCounter(ctx);

  if (visDist <= 1.6 && P.food === 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ready', Math.round(pt.x), Math.round(pt.y - 38));
    ctx.textAlign = 'left';
  }
}

P.update = update;
P.draw = draw;
P.__probe = function () { return { fed: P.fed, scales: P.scales.length }; };
P.attemptBuy = attemptBuy;

if (typeof window !== 'undefined') {
  window.GuildPondFeed = P;
}

export {};
