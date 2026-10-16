const GOODS = [
  { key: 'snack',   name: 'SNACK',         price: 2 },
  { key: 'seed',    name: 'SEED POUCH',    price: 3 },
  { key: 'lantern', name: 'PAPER LANTERN', price: 4 }
];
const FERRY_A = { gx: 1.8, gy: 9.0 };
const FERRY_B = { gx: 7.8, gy: 9.0 };
const ARRIVE_DUR = 3.4;
const MOOR_DUR = 60;
const DEPART_DUR = 3.4;
const FIRST_DELAY = 6000;
const GAP_MIN = 55000;
const GAP_MAX = 100000;
const INTERACT_R = 3.0;
const HAND_MS = 1700;
const FAR = 17;
const SHEET_W = 116;
const SHEET_H = 58;

let pressed = new Set();
let localPurse = 20;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildDriftBarge; }
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
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function randGap() { return GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN); }

function visitorPos() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number' && isFinite(vis.gx) && isFinite(vis.gy)) {
    return { gx: vis.gx, gy: vis.gy };
  }
  return null;
}
function economy() { const w = root(); return w && w.GuildEconomy; }
function visitorPurse() {
  const ge = economy();
  if (ge && typeof ge.visitorPurse === 'number' && isFinite(ge.visitorPurse)) return ge.visitorPurse;
  return localPurse;
}
function spendCoin(amount) {
  const amt = Number(amount);
  if (!isFinite(amt) || amt < 0) return false;
  const ge = economy();
  if (ge && typeof ge.spend === 'function') {
    try { return !!ge.spend(-1, amt); } catch (e) { return false; }
  }
  if (localPurse >= amt) { localPurse -= amt; return true; }
  return false;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function ferryDist(gx, gy) {
  const seg = distSeg(gx, gy, FERRY_A.gx, FERRY_A.gy, FERRY_B.gx, FERRY_B.gy);
  const da = Math.hypot(gx - FERRY_A.gx, gy - FERRY_A.gy);
  const db = Math.hypot(gx - FERRY_B.gx, gy - FERRY_B.gy);
  return Math.min(seg, da, db);
}
function moorPoint() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
  const maxC = 1 + s;
  const minC = -2 - s;
  let gx = maxC - 1.3;
  const gy = maxC + 1.7;
  let guard = 0;
  while (ferryDist(gx, gy) < 2.3 && gx > minC && guard < 60) { gx -= 0.4; guard++; }
  return { gx: gx, gy: gy };
}
function createState() {
  return {
    phase: 'idle',
    s: 0,
    visits: 0,
    goods: [],
    nextAt: null,
    mooredUntil: 0,
    sheetOpen: false,
    hand: null,
    seed: Math.random() * Math.PI * 2,
    lastTime: null
  };
}
function pickGoods(st) {
  const Vv = getV();
  const w = root();
  let tasks = [];
  if (Vv && Array.isArray(Vv.allTasks)) tasks = Vv.allTasks;
  else if (w && Array.isArray(w.allTasks)) tasks = w.allTasks;
  const rot = (st.visits + tasks.length) % GOODS.length;
  const a = GOODS[rot];
  const b = GOODS[(rot + 1) % GOODS.length];
  st.goods = [
    { key: a.key, name: a.name, price: a.price },
    { key: b.key, name: b.name, price: b.price }
  ];
}
function canOpen(st) {
  if (!st || st.phase !== 'moored') return false;
  const vp = visitorPos();
  if (!vp) return false;
  const m = moorPoint();
  return Math.hypot(vp.gx - m.gx, vp.gy - m.gy) <= INTERACT_R;
}
function buy(st, idx) {
  if (!st || !st.sheetOpen) return;
  const g = st.goods[idx];
  if (!g) return;
  if (!spendCoin(g.price)) { cueFn('failed'); return; }
  const ge = economy();
  if (ge && typeof ge.treasury === 'number' && isFinite(ge.treasury)) ge.treasury += g.price;
  cueFn('done');
  st.hand = { key: g.key, start: nowFn() };
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function onKeyDown(e) {
  const k = normKey(e);
  if (!k) return;
  if (pressed.has(k)) return;
  pressed.add(k);
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (st.sheetOpen) {
    if (k === '1') { buy(st, 0); if (e && e.preventDefault) e.preventDefault(); }
    else if (k === '2') { buy(st, 1); if (e && e.preventDefault) e.preventDefault(); }
    else if (k === 'e' || k === 'escape' || k === ' ') { st.sheetOpen = false; if (e && e.preventDefault) e.preventDefault(); }
    return;
  }
  if (k === 'e' && canOpen(st)) {
    st.sheetOpen = true;
    if (e && e.preventDefault) e.preventDefault();
  }
}
function onKeyUp(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') { st.lastTime = now; st.sheetOpen = false; return; }
  if (st.lastTime == null || !isFinite(st.lastTime)) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  if (st.nextAt == null) st.nextAt = now + FIRST_DELAY;

  if (st.phase === 'idle') {
    if (now >= st.nextAt) {
      st.phase = 'arriving';
      st.s = 0;
      st.visits += 1;
      pickGoods(st);
      st.sheetOpen = false;
    }
  } else if (st.phase === 'arriving') {
    st.s += dt / ARRIVE_DUR;
    if (st.s >= 1) { st.s = 1; st.phase = 'moored'; st.mooredUntil = now + MOOR_DUR * 1000; }
  } else if (st.phase === 'moored') {
    if (now >= st.mooredUntil) { st.phase = 'departing'; st.sheetOpen = false; }
  } else if (st.phase === 'departing') {
    st.s -= dt / DEPART_DUR;
    if (st.s <= 0) { st.s = 0; st.phase = 'idle'; st.nextAt = now + randGap(); }
  }

  if (st.sheetOpen && !canOpen(st)) st.sheetOpen = false;
  if (st.hand && now - st.hand.start >= HAND_MS) st.hand = null;
}

function drawGood(ctx, key, x, y) {
  if (key === 'seed') {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - 3, y - 4, 7, 2);
    ctx.fillStyle = '#8b6b3f';
    ctx.fillRect(x - 3, y - 2, 7, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x - 2, y - 1, 2, 2);
    ctx.fillRect(x + 1, y, 2, 2);
  } else if (key === 'lantern') {
    ctx.fillStyle = '#6b4a2d';
    ctx.fillRect(x - 1, y - 6, 3, 1);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 3, y - 5, 7, 8);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x - 2, y - 4, 5, 6);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(x - 1, y - 3, 2, 3);
  } else {
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - 3, y + 2, 7, 1);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x - 3, y - 2, 7, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - 2, y - 3, 5, 2);
  }
}

function drawVendor(ctx, px, py, now) {
  const bob = Math.sin(now * 0.004) * 0.8;
  const Y = py + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px - 4, Y + 6, 9, 2);
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(px - 2, Y + 3, 2, 4);
  ctx.fillRect(px + 1, Y + 3, 2, 4);
  ctx.fillStyle = '#52525b';
  ctx.fillRect(px - 3, Y - 4, 7, 7);
  ctx.fillStyle = '#8b6b3f';
  ctx.fillRect(px - 2, Y - 1, 5, 4);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(px - 2, Y - 9, 5, 5);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(px - 1, Y - 7, 1, 1);
  ctx.fillRect(px + 1, Y - 7, 1, 1);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(px - 3, Y - 11, 7, 3);
  ctx.fillRect(px - 2, Y - 13, 5, 2);
}

function drawNameplate(ctx, cx, cy, name) {
  ctx.font = 'bold 9px monospace';
  const label = fitFn(name, 84);
  const tw = ctx.measureText(label).width;
  const pw = Math.round(tw) + 8;
  const ph = 12;
  const px = Math.round(cx - pw * 0.5);
  const py = Math.round(cy - ph);
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.beginPath();
  ctx.moveTo(cx - 4, py + ph);
  ctx.lineTo(cx + 4, py + ph);
  ctx.lineTo(cx, py + ph + 5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fill();
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawBarge(ctx, x, y, st, now) {
  const bob = Math.sin(now * 0.0016 + st.seed) * 1.4;
  const Y = y + bob;
  const working = (st.phase === 'arriving' || st.phase === 'departing');

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 23, Y + 6, 46, 4);
  if (working) {
    ctx.strokeStyle = 'rgba(232,230,223,0.35)';
    ctx.lineWidth = 1;
    const r = 14 + Math.abs(Math.sin(now * 0.004)) * 6;
    ctx.beginPath();
    ctx.moveTo(x - r, Y + 7);
    ctx.lineTo(x + r, Y + 7);
    ctx.stroke();
  }

  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 21, Y - 2, 42, 8);
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x - 20, Y - 5, 40, 6);
  ctx.fillStyle = '#6b4a2d';
  for (let i = -16; i < 20; i += 8) ctx.fillRect(x + i, Y - 5, 1, 6);
  ctx.fillStyle = '#9a7a5e';
  ctx.fillRect(x - 20, Y - 6, 40, 1);
  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(x - 21, Y + 5, 42, 1);

  const dip = working ? Math.sin(now * 0.012) * 4 : Math.sin(now * 0.003) * 0.6;
  ctx.strokeStyle = '#4a3423';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 13, Y - 3);
  ctx.lineTo(x - 18 + dip, Y + 9);
  ctx.stroke();
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 15, Y - 4, 5, 2);

  const goods = st.goods || [];
  if (goods[0]) drawGood(ctx, goods[0].key, x - 8, Y - 8);
  if (goods[1]) drawGood(ctx, goods[1].key, x - 1, Y - 8);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 12, Y - 10, 14, 1);

  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(x + 2, Y - 13, 1, 8);
  ctx.fillStyle = 'rgba(20,16,10,0.85)';
  ctx.fillRect(x + 3, Y - 13, 9, 6);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, Y - 13, 9, 6);

  drawVendor(ctx, x + 9, Y - 6, now);
  drawNameplate(ctx, x + 9, Y - 28, 'DRIFT PEDDLER');
}

function drawPrompt(ctx, x, y) {
  const label = fitFn('[E] TRADE', 90);
  ctx.font = 'bold 9px monospace';
  const tw = ctx.measureText(label).width;
  const pw = Math.round(tw) + 10;
  const ph = 13;
  const px = Math.round(x - pw * 0.5);
  const py = Math.round(y - ph);
  ctx.fillStyle = 'rgba(10,10,12,0.86)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawSheet(ctx, st, cx, bottomY) {
  const x0 = Math.round(cx - SHEET_W * 0.5);
  const y0 = Math.round(bottomY - SHEET_H);
  ctx.fillStyle = 'rgba(20,16,10,0.93)';
  ctx.fillRect(x0, y0, SHEET_W, SHEET_H);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, SHEET_W, SHEET_H);

  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('DRIFT WARES', SHEET_W - 10), x0 + 5, y0 + 9);

  const purse = visitorPurse();
  for (let i = 0; i < 2; i++) {
    const g = st.goods[i];
    const ry = y0 + 24 + i * 14;
    if (!g) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '9px monospace';
      ctx.fillText('[' + (i + 1) + '] - sold out -', x0 + 6, ry);
      continue;
    }
    const afford = purse >= g.price;
    drawGood(ctx, g.key, x0 + 9, ry + 2);
    ctx.fillStyle = afford ? '#e8e6df' : '#6b7280';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(fitFn('[' + (i + 1) + '] ' + g.name, 58), x0 + 18, ry);
    ctx.fillStyle = afford ? '#facc15' : '#6b7280';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(g.price + ' GC', x0 + SHEET_W - 5, ry);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#c8b89a';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[1/2] buy   [E] close', x0 + SHEET_W * 0.5, y0 + SHEET_H - 7);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();

  const m = moorPoint();
  const far = { gx: m.gx + FAR, gy: m.gy + FAR };
  const gx = far.gx + (m.gx - far.gx) * st.s;
  const gy = far.gy + (m.gy - far.gy) * st.s;
  const p = isoFn(gx, gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  drawBarge(ctx, x, y, st, now);

  if (st.phase === 'moored' && !st.sheetOpen && canOpen(st)) drawPrompt(ctx, x, y - 40);
  if (st.sheetOpen) drawSheet(ctx, st, x, y - 44);

  if (st.hand) {
    const age = now - st.hand.start;
    if (age >= 0 && age < HAND_MS) {
      const vp = visitorPos();
      if (vp) {
        const v = isoFn(vp.gx, vp.gy);
        const t = age / HAND_MS;
        const bob = Math.sin(age * 0.014) * 2.5;
        const alpha = t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
        ctx.globalAlpha = alpha;
        drawGood(ctx, st.hand.key, Math.round(v.x) + 2, Math.round(v.y) - 24 + bob);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(Math.round(v.x) + 7, Math.round(v.y) - 30 + Math.sin(age * 0.02) * 2, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildDriftBarge) window.GuildDriftBarge = createState();
  window.GuildDriftBarge.update = update;
  window.GuildDriftBarge.draw = draw;
  window.GuildDriftBarge.__probe = function () {
    const st = getState();
    if (!st) return { phase: 'idle', s: 0, goods: 0, sheet: false };
    return { phase: st.phase, s: st.s, goods: st.goods.length, sheet: st.sheetOpen, visits: st.visits };
  };
  window.GuildDriftBarge.__rawUpdate = update;
  window.GuildDriftBarge.__keys = pressed;
  if (!window.__gdbListeners) {
    window.__gdbListeners = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }
}

export {};
