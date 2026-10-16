const PROP_GX = 3.6;
const PROP_GY = 6.9;
const MAX_DRIFT = 15;
const DAY_STEP = 3;
const EASE_RATE = 3.2;
const BEAM_HALF = 20;
const STRING_LEN = 11;
const CUE_PULSE = 0.6;
const GOLD = '#d4af37';
const GOLD_LIGHT = '#f3d37a';

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function getState() { const w = root(); return w && w.GuildWishDrift; }

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
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  return String(text == null ? '' : text);
}

function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}

function createState() {
  return {
    gx: PROP_GX,
    gy: PROP_GY,
    drift: 0,
    angle: 0,
    dayKey: null,
    seeded: false,
    sawWish: false,
    starWishes: 0,
    hope: 0,
    gold: 0,
    live: false,
    pulse: 0,
    sway: 0,
    lastTime: null
  };
}

function dayKeyNow() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

function wishFlavored(t) {
  return t.indexOf('wish') !== -1 || t.indexOf('lantern') !== -1 || t.indexOf('star') !== -1 ||
    t.indexOf('coin') !== -1 || t.indexOf('gold') !== -1 || t.indexOf('seed') !== -1 ||
    t.indexOf('bloom') !== -1 || t.indexOf('hope') !== -1 || t.indexOf('fortune') !== -1 ||
    t.indexOf('toss') !== -1 || t.indexOf('pond') !== -1;
}

function fallbackTally() {
  const Vv = getV();
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  let hope = 0;
  let gold = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t) continue;
    const title = String(t.title != null ? t.title : (t.name != null ? t.name : (t.id != null ? t.id : ''))).toLowerCase();
    if (!wishFlavored(title)) continue;
    if (title.indexOf('seed') !== -1 || title.indexOf('bloom') !== -1 || title.indexOf('hope') !== -1 ||
      title.indexOf('lantern') !== -1 || title.indexOf('star') !== -1 || title.indexOf('plant') !== -1 ||
      title.indexOf('pond') !== -1) hope++;
    else gold++;
  }
  return { hope: hope, gold: gold };
}

function readTallies(st) {
  const w = root();
  let hope = 0;
  let gold = 0;
  let live = false;
  const seeds = w && w.GuildWishSeeds;
  if (seeds) {
    if (typeof seeds.plantCounter === 'number' && isFinite(seeds.plantCounter) && seeds.plantCounter > 0) {
      hope += seeds.plantCounter;
      live = true;
    } else if (Array.isArray(seeds.flowers) && seeds.flowers.length > 0) {
      hope += seeds.flowers.length;
      live = true;
    }
  }
  const booth = w && w.GuildWishBooth;
  if (booth && typeof booth.coins === 'number' && isFinite(booth.coins) && booth.coins > 0) {
    gold += booth.coins;
    live = true;
  }
  const toss = w && w.GuildWishToss;
  if (toss && typeof toss.wishCount === 'number' && isFinite(toss.wishCount) && toss.wishCount > 0) {
    gold += toss.wishCount;
    live = true;
  }
  if (st.starWishes > 0) { hope += st.starWishes; live = true; }
  if (!live) {
    const f = fallbackTally();
    hope = f.hope;
    gold = f.gold;
  }
  return { hope: hope, gold: gold, live: live };
}

function nudge(st) {
  const diff = (st.hope || 0) - (st.gold || 0);
  let dir = 0;
  if (diff > 0) dir = 1;
  else if (diff < 0) dir = -1;
  if (dir === 0) return;
  const before = st.drift;
  st.drift = clamp(st.drift + dir * DAY_STEP, -MAX_DRIFT, MAX_DRIFT);
  if (st.drift !== before) {
    st.pulse = CUE_PULSE;
    cueFn('creak');
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const w = root();
  const wishes = w && w.GuildWishes;
  const activeWish = !!(wishes && wishes.wish);
  if (activeWish && !st.sawWish) st.starWishes = (st.starWishes || 0) + 1;
  st.sawWish = activeWish;

  const t = readTallies(st);
  st.hope = t.hope;
  st.gold = t.gold;
  st.live = t.live;

  if (!st.seeded && t.live) {
    st.seeded = true;
    nudge(st);
  }

  const key = dayKeyNow();
  if (st.dayKey === null) st.dayKey = key;
  else if (key !== st.dayKey) { st.dayKey = key; nudge(st); }

  const k = Math.min(1, dt * EASE_RATE);
  st.angle += (st.drift - st.angle) * k;
  st.sway += dt;
  if (st.pulse > 0) st.pulse = Math.max(0, st.pulse - dt);
}

function drawPan(ctx, cx, cy) {
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 3);
  ctx.lineTo(cx + 9, cy - 3);
  ctx.lineTo(cx + 6, cy + 2);
  ctx.lineTo(cx - 6, cy + 2);
  ctx.closePath();
  ctx.fillStyle = '#8b643f';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWeights(ctx, cx, cy, val) {
  const n = clamp(Math.round(val || 0), 0, 6);
  for (let i = 0; i < n; i++) {
    const wx = Math.round(cx - 5 + (i % 3) * 4);
    const wy = Math.round(cy - 2 - Math.floor(i / 3) * 3);
    ctx.fillStyle = GOLD;
    ctx.fillRect(wx, wy, 3, 3);
    ctx.fillStyle = GOLD_LIGHT;
    ctx.fillRect(wx, wy, 1, 1);
  }
}

function drawReadout(ctx, st, x, y) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
  const vp = isoFn(vis.gx, vis.gy);
  if (Math.hypot(vp.x - x, vp.y - y) > 80) return;
  const label = 'PLANTED ' + Math.round(st.hope || 0) + '  |  COINS ' + Math.round(st.gold || 0);
  ctx.font = '9px monospace';
  const text = fitFn(label, 160);
  const tw = ctx.measureText(text).width;
  const bw = Math.round(tw) + 12;
  const bh = 14;
  const bx = Math.round(x - bw * 0.5);
  const by = Math.round(y - 60);
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw * 0.5, by + bh * 0.5 + 1);
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;

  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 16, y - 3, 32, 5);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 12, y - 8, 24, 8);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 12, y - 8, 24, 3);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 12, y - 8, 24, 8);

  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 2, y - 34, 4, 26);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 2, y - 34, 2, 26);

  const pivotY = y - 34;
  const swayDeg = Math.sin(st.sway * 0.9) * 0.6;
  const rad = (-(st.angle + swayDeg)) * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const L = BEAM_HALF;
  const leftX = x - L * cos;
  const leftY = pivotY - L * sin;
  const rightX = x + L * cos;
  const rightY = pivotY + L * sin;
  const lpx = leftX;
  const lpy = leftY + STRING_LEN;
  const rpx = rightX;
  const rpy = rightY + STRING_LEN;

  ctx.strokeStyle = '#3a2a15';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(lpx, lpy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightX, rightY);
  ctx.lineTo(rpx, rpy);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, pivotY);
  ctx.rotate(rad);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(-L - 1, -2, 2 * L + 2, 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-L - 1, -2, 2 * L + 2, 1);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -14);
  ctx.stroke();
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillRect(-1, -16, 3, 3);
  ctx.restore();

  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillRect(x - 2, pivotY - 2, 4, 4);

  drawPan(ctx, lpx, lpy);
  drawPan(ctx, rpx, rpy);
  drawWeights(ctx, lpx, lpy - 3, st.hope);
  drawWeights(ctx, rpx, rpy - 3, st.gold);

  if (st.pulse > 0) {
    const pp = 1 - st.pulse / CUE_PULSE;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - pp) * 0.5;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, pivotY, 10 + pp * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawReadout(ctx, st, x, y);
}

if (typeof window !== 'undefined') {
  if (!window.GuildWishDrift) window.GuildWishDrift = createState();
  const st = window.GuildWishDrift;
  if (typeof st.gx !== 'number') st.gx = PROP_GX;
  if (typeof st.gy !== 'number') st.gy = PROP_GY;
  if (typeof st.drift !== 'number') st.drift = 0;
  if (typeof st.angle !== 'number') st.angle = 0;
  if (typeof st.dayKey === 'undefined') st.dayKey = null;
  if (typeof st.seeded !== 'boolean') st.seeded = false;
  if (typeof st.sawWish !== 'boolean') st.sawWish = false;
  if (typeof st.starWishes !== 'number') st.starWishes = 0;
  if (typeof st.hope !== 'number') st.hope = 0;
  if (typeof st.gold !== 'number') st.gold = 0;
  if (typeof st.live !== 'boolean') st.live = false;
  if (typeof st.pulse !== 'number') st.pulse = 0;
  if (typeof st.sway !== 'number') st.sway = 0;

  window.GuildWishDrift.update = update;
  window.GuildWishDrift.draw = draw;
  window.GuildWishDrift.__probe = function () {
    const s = getState();
    return s ? { hope: s.hope, gold: s.gold, drift: s.drift, angle: s.angle, starWishes: s.starWishes } : null;
  };
}

export {};
