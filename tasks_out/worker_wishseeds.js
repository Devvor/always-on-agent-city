const PALETTE_TINTS = ['#d4af37', '#3b82f6', '#ef4444', '#22c55e', '#ffffff'];
let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try {
      const p = w.iso(gx, gy);
      if (p && isFinite(p.x) && isFinite(p.y)) return p;
    } catch (e) {}
  }
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
function getState() { const w = root(); return w && w.GuildWishSeeds; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
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
  prevPressed.delete(k);
}

function createState() {
  return {
    gx: 5.0,
    gy: 1.5,
    flowers: [],
    sparkles: [],
    hops: [],
    fading: [],
    plantCounter: 0,
    plantCooldown: 0
  };
}

function firstCallable(obj, names) {
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (obj && typeof obj[n] === 'function') return obj[n].bind(obj);
  }
  return null;
}

function firstBalanceKey(obj, keys) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (obj && typeof obj[k] === 'number' && isFinite(obj[k])) return k;
  }
  return null;
}

function spendTwo() {
  const w = root();
  const Vv = getV();
  if (!w) return 'free';

  const objNames = ['GuildEconomy', 'GuildCoins', 'GuildGold', 'GuildPurse', 'GuildWallet', 'economy', 'purse', 'wallet'];
  let econ = null;
  for (let i = 0; i < objNames.length; i++) {
    const o = w[objNames[i]];
    if (o && typeof o === 'object') { econ = o; break; }
  }
  if (!econ && Vv && Vv.economy && typeof Vv.economy === 'object') econ = Vv.economy;
  if (!econ && Vv && Vv.purse && typeof Vv.purse === 'object') econ = Vv.purse;

  const scalarNames = ['coins', 'gc', 'gold', 'money', 'funds', 'cash'];
  let scalarKey = null;
  for (let i = 0; i < scalarNames.length; i++) {
    if (typeof w[scalarNames[i]] === 'number' && isFinite(w[scalarNames[i]])) { scalarKey = scalarNames[i]; break; }
  }

  const spendNames = ['trySpend', 'spend', 'charge', 'pay', 'deduct', 'buy', 'purchase', 'withdraw'];
  const affordNames = ['canAfford', 'hasEnough', 'hasCoins', 'hasFunds', 'hasMoney', 'afford', 'canPay', 'has', 'check', 'canBuy'];
  const balanceKeys = ['coins', 'gc', 'gold', 'balance', 'money', 'funds', 'amount', 'value', 'cash', 'currency'];

  if (econ) {
    const spendMethod = firstCallable(econ, spendNames);
    const affordMethod = firstCallable(econ, affordNames);
    const balanceKey = firstBalanceKey(econ, balanceKeys);
    if (!spendMethod && !affordMethod && !balanceKey) return 'free';

    try {
      if (affordMethod) {
        const r = affordMethod(2);
        if (r === false) return false;
        if (typeof r === 'number' && r < 2) return false;
        if (r && typeof r === 'object' && (r.ok === false || r.success === false || r.allowed === false)) return false;
      } else if (balanceKey) {
        if (econ[balanceKey] < 2) return false;
      }

      if (spendMethod) {
        const r = spendMethod(2);
        if (r === false) return false;
        if (r && typeof r === 'object' && (r.ok === false || r.success === false || r.allowed === false)) return false;
      } else if (balanceKey) {
        econ[balanceKey] = econ[balanceKey] - 2;
      }
      return true;
    } catch (e) {
      return 'free';
    }
  }

  if (scalarKey) {
    if (w[scalarKey] < 2) return false;
    w[scalarKey] = w[scalarKey] - 2;
    return true;
  }

  return 'free';
}

function nearestIdleWorker(flower, now) {
  const Vv = getV();
  if (!Vv) return -1;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const pos = isoFn(flower.gx, flower.gy);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w) continue;
    const meta = (Array.isArray(Vv.workers) ? Vv.workers[i] : null) || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(w.tasks) ? w.tasks : []);
    const idle = meta.workerState === 'IDLE' || w.mode === 'idle' || tasks.length === 0 || tasks.every(function (t) { return t && t.status === 'done'; });
    if (!idle) continue;
    const d = Math.hypot((w.x || 0) - pos.x, (w.y || 0) - pos.y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function attemptPlant(now) {
  const st = getState();
  const Vv = getV();
  const vis = getVisitor();
  if (!st || !Vv || Vv.gameState !== 'play' || !vis) return;
  if (!isFinite(vis.gx) || !isFinite(vis.gy) || !isFinite(st.gx) || !isFinite(st.gy)) return;
  if (Math.hypot(vis.gx - st.gx, vis.gy - st.gy) > 1.5) return;
  if (st.plantCooldown > 0) return;

  const pay = spendTwo();
  if (pay === false) return;

  st.plantCooldown = 0.25;
  st.plantCounter = (st.plantCounter || 0) + 1;
  const pc = st.plantCounter;

  const rx = seeded(pc * 1.13 + 0.4);
  const ry = seeded(pc * 2.07 + 0.9);
  let fx = st.gx + (rx - 0.5) * 1.6;
  let fy = st.gy + (ry - 0.5) * 1.6;
  fx = Math.min(6, Math.max(4, fx));
  fy = Math.min(3, Math.max(0, fy));

  const free = (pay === 'free');
  const tintIndex = Math.floor(seeded(pc * 3.71 + 0.2) * PALETTE_TINTS.length);
  const flower = {
    gx: fx,
    gy: fy,
    planted: (typeof now === 'number' ? now : nowFn()),
    seed: pc,
    tint: PALETTE_TINTS[tintIndex],
    free: free,
    freeWish: free
  };

  if (!Array.isArray(st.flowers)) st.flowers = [];
  if (st.flowers.length >= 12) {
    const old = st.flowers.shift();
    if (old) {
      if (!Array.isArray(st.fading)) st.fading = [];
      st.fading.push(Object.assign({}, old, { fadeStart: (typeof now === 'number' ? now : nowFn()) }));
    }
  }
  st.flowers.push(flower);
}

function drawFlower(ctx, f, now, alpha) {
  const p = isoFn(f.gx, f.gy);
  const age = now - (typeof f.planted === 'number' ? f.planted : now);
  let stage = 'sprout';
  if (age >= 60000) stage = 'bloom';
  else if (age >= 30000) stage = 'bud';

  const stemH = stage === 'sprout' ? 8 : (stage === 'bud' ? 12 : 16);

  ctx.save();
  if (alpha != null && isFinite(alpha)) ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y) + 1, 6, 2);

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(Math.round(p.x), Math.round(p.y) - stemH, 2, stemH);

  if (stage === 'sprout') {
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) - 6, 3, 2);
  } else if (stage === 'bud') {
    ctx.fillStyle = f.tint || '#d4af37';
    ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - stemH - 3, 5, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(Math.round(p.x), Math.round(p.y) - stemH - 2, 1, 1);
  } else {
    const petal = f.tint || '#d4af37';
    const cx = Math.round(p.x) + 1;
    const cy = Math.round(p.y) - stemH - 2;
    ctx.fillStyle = petal;
    ctx.fillRect(cx - 3, cy - 3, 2, 2);
    ctx.fillRect(cx + 2, cy - 3, 2, 2);
    ctx.fillRect(cx - 3, cy, 2, 2);
    ctx.fillRect(cx + 2, cy, 2, 2);
    ctx.fillRect(cx, cy - 5, 2, 2);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx, cy - 2, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, cy - 2, 1, 1);
  }
  ctx.restore();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const w = root();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (!Array.isArray(st.flowers)) st.flowers = [];
  if (!Array.isArray(st.sparkles)) st.sparkles = [];
  if (!Array.isArray(st.hops)) st.hops = [];
  if (!Array.isArray(st.fading)) st.fading = [];

  if (st.plantCooldown > 0) st.plantCooldown = Math.max(0, st.plantCooldown - dt);

  const ePressed = pressed.has('e') || pressed.has(' ');
  const eWas = prevPressed.has('e') || prevPressed.has(' ');
  if (!eWas && ePressed) attemptPlant(now);
  prevPressed = new Set(pressed);

  const bloomTime = 60000;
  for (let i = st.flowers.length - 1; i >= 0; i--) {
    const f = st.flowers[i];
    if (!f || f.bloomed || typeof f.planted !== 'number') continue;
    if (now - f.planted < bloomTime) continue;
    f.bloomed = true;
    f.bloomAt = now;
    st.sparkles.push({ gx: f.gx, gy: f.gy, start: now, duration: 1400 });
    try { if (w && typeof w.cue === 'function') w.cue('done'); } catch (e) {}
    const wi = nearestIdleWorker(f, now);
    if (wi >= 0) st.hops.push({ workerIndex: wi, start: now, duration: 1400 });
  }

  st.sparkles = st.sparkles.filter(function (s) { return (now - s.start) < s.duration; });
  st.hops = st.hops.filter(function (h) { return (now - h.start) < h.duration; });
  st.fading = st.fading.filter(function (f) { return (now - f.fadeStart) < 1500; });
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();

  if (!Array.isArray(st.flowers)) st.flowers = [];
  if (!Array.isArray(st.sparkles)) st.sparkles = [];
  if (!Array.isArray(st.hops)) st.hops = [];
  if (!Array.isArray(st.fading)) st.fading = [];

  const base = isoFn(st.gx, st.gy);

  ctx.save();

  ctx.fillStyle = 'rgba(62,40,18,0.95)';
  ctx.fillRect(Math.round(base.x) - 16, Math.round(base.y) - 8, 32, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i += 3) {
    ctx.beginPath();
    ctx.moveTo(Math.round(base.x) - 16, Math.round(base.y) + i);
    ctx.lineTo(Math.round(base.x) + 16, Math.round(base.y) + i);
    ctx.stroke();
  }
  for (let i = -14; i <= 14; i += 4) {
    ctx.beginPath();
    ctx.moveTo(Math.round(base.x) + i, Math.round(base.y) - 8);
    ctx.lineTo(Math.round(base.x) + i, Math.round(base.y) + 8);
    ctx.stroke();
  }

  const sx = Math.round(base.x) + 20;
  const sy = Math.round(base.y) - 14;
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(sx - 2, sy, 4, 24);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(sx - 26, sy - 16, 52, 16);
  ctx.strokeStyle = '#4b321f';
  ctx.strokeRect(sx - 26, sy - 16, 52, 16);
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('PLANT A WISH - 2 GC', 46), sx, sy - 8);

  for (let i = 0; i < st.fading.length; i++) {
    const f = st.fading[i];
    const a = Math.max(0, 1 - ((now - f.fadeStart) / 1500));
    drawFlower(ctx, f, now, a);
  }
  for (let i = 0; i < st.flowers.length; i++) {
    drawFlower(ctx, st.flowers[i], now, 1);
  }

  for (let i = 0; i < st.sparkles.length; i++) {
    const s = st.sparkles[i];
    if ((now - s.start) >= s.duration) continue;
    const age = (now - s.start) / 1000;
    const dur = s.duration / 1000;
    const prog = Math.min(1, age / dur);
    const alpha = Math.max(0, 1 - prog) * 0.8;
    const p = isoFn(s.gx, s.gy);
    const radius = 6 + prog * 24;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(Math.round(p.x) + 1, Math.round(p.y) - 8, radius, 0, Math.PI * 2);
    ctx.stroke();

    for (let k = 0; k < 8; k++) {
      const ang = k * Math.PI * 0.25 + prog * 1.2;
      const dx = Math.cos(ang) * radius;
      const dy = Math.sin(ang) * radius;
      ctx.fillStyle = (k % 2 === 0) ? '#ffffff' : '#facc15';
      ctx.fillRect(Math.round(p.x + 1 + dx), Math.round(p.y - 8 + dy), 2, 2);
    }
    ctx.restore();
  }

  for (let i = 0; i < st.hops.length; i++) {
    const h = st.hops[i];
    if ((now - h.start) >= h.duration) continue;
    const age = (now - h.start) / 1000;
    const dur = h.duration / 1000;
    const prog = Math.min(1, age / dur);
    const alpha = Math.max(0, 1 - prog);
    const worker = Vv.workerStates && Vv.workerStates[h.workerIndex];
    if (!worker) continue;

    const bob = -Math.sin(prog * Math.PI) * 14;
    const x = Math.round((worker.x || 0) + 8);
    const y = Math.round((worker.y || 0) - 28 + bob);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - 4, y, 3, 3);
    ctx.fillRect(x + 1, y, 3, 3);
    ctx.fillRect(x - 5, y + 3, 10, 3);
    ctx.fillRect(x - 4, y + 6, 8, 2);
    ctx.fillRect(x - 2, y + 8, 4, 2);
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(x - 3, y + 1, 1, 1);
    ctx.fillRect(x + 2, y + 1, 1, 1);
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildWishSeeds) window.GuildWishSeeds = createState();
  const st = window.GuildWishSeeds;
  if (!Array.isArray(st.flowers)) st.flowers = [];
  if (!Array.isArray(st.sparkles)) st.sparkles = [];
  if (!Array.isArray(st.hops)) st.hops = [];
  if (!Array.isArray(st.fading)) st.fading = [];
  st.update = update;
  st.draw = draw;
  st.__probe = function () { return { flowers: Array.isArray(st.flowers) ? st.flowers.length : 0 }; };

  if (!window.__gwsListeners) {
    window.__gwsListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
