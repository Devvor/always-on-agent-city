const CART_GX = -4.8;
const CART_GY = 3.2;
const UNLOAD_TARGET_GX = -2.8;
const UNLOAD_TARGET_GY = 2.6;
let listenersBound = false;

function createState() {
  return {
    cart: null,
    exhibits: [],
    nextAt: 0,
    delivered: new Set(),
    fadingChips: [],
    hopUntil: 0,
    unloadingUntil: 0,
    unloadingChips: [],
    pressed: new Set(),
    prevE: false,
    lastTime: null
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getS() { const w = root(); return w && w.GuildCurator; }
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
function cueFn(name) {
  const w = root();
  if (!w || typeof w.cue !== 'function') return;
  try { w.cue(name); } catch (e) {}
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function ensureCart(st) {
  if (!st) return;
  if (!st.cart) st.cart = { gx: CART_GX, gy: CART_GY, hopUntil: 0 };
}

function randIntervalMs() {
  return (60 + Math.random() * 40) * 1000;
}

function visitorState() {
  const w = root();
  return w && w.GuildVisitor;
}

function tileDistToCart(visPt, Vv) {
  const cartPt = isoFn(CART_GX, CART_GY);
  return tileDistance(cartPt.x, cartPt.y, visPt.x, visPt.y, Vv.grid);
}

function onKeydown(e) {
  const st = getS();
  if (!st) return;
  const k = normKey(e);
  if (!k) return;
  st.pressed.add(k);
  const Vv = getV();
  if (Vv && Vv.gameState === 'play' && (k === 'e' || k === ' ')) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const st = getS();
  if (!st) return;
  const k = normKey(e);
  if (!k) return;
  st.pressed.delete(k);
}

function tryDelivery(st, Vv, now) {
  if (!st || !Vv || !Array.isArray(Vv.allTasks)) return;
  if (st.unloadingUntil && now < st.unloadingUntil) return;
  let chosen = null;
  for (let i = 0; i < Vv.allTasks.length; i++) {
    const task = Vv.allTasks[i];
    if (!task || task.status !== 'done') continue;
    const id = String(task.id == null ? '' : task.id);
    if (st.delivered && st.delivered.has(id)) continue;
    chosen = task;
    break;
  }
  if (!chosen) return;
  const id = String(chosen.id == null ? '' : chosen.id);
  if (!st.delivered) st.delivered = new Set();
  st.delivered.add(id);
  if (st.exhibits.length >= 3) {
    const old = st.exhibits.shift();
    if (!Array.isArray(st.fadingChips)) st.fadingChips = [];
    st.fadingChips.push({ id: old.id, start: now, duration: 350 });
  }
  st.exhibits.push({ id: id, born: now });
  ensureCart(st);
  if (st.cart) st.cart.hopUntil = now + 800;
}

function startUnload(st, Vv, now) {
  if (!st || st.exhibits.length === 0) return;
  const vis = visitorState();
  if (!vis) return;
  const cartPt = isoFn(CART_GX, CART_GY);
  const targetPt = isoFn(UNLOAD_TARGET_GX, UNLOAD_TARGET_GY);
  const chips = st.exhibits.map(function (chip, i) {
    return {
      id: chip.id,
      start: now,
      duration: 1000,
      x0: cartPt.x - 4 + i * 9,
      y0: cartPt.y - 12,
      x1: targetPt.x - 4 + i * 6,
      y1: targetPt.y - 8
    };
  });
  st.unloadingChips = chips;
  st.unloadingUntil = now + 1000;
  st.exhibits = [];
  cueFn('grow');
}

function update(now) {
  const st = getS();
  if (!st) return;
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  ensureCart(st);
  if (!Array.isArray(st.exhibits)) st.exhibits = [];
  if (!Array.isArray(st.fadingChips)) st.fadingChips = [];
  if (!Array.isArray(st.unloadingChips)) st.unloadingChips = [];
  if (!(st.delivered instanceof Set)) st.delivered = new Set(Array.isArray(st.delivered) ? st.delivered : []);
  if (st.pressed instanceof Set === false) st.pressed = new Set(Array.isArray(st.pressed) ? st.pressed : []);

  // prune finished fades
  const nextFades = [];
  for (let i = 0; i < st.fadingChips.length; i++) {
    const chip = st.fadingChips[i];
    if (chip && now - chip.start < chip.duration) nextFades.push(chip);
  }
  st.fadingChips = nextFades;

  // prune finished unload
  if (st.unloadingUntil && now >= st.unloadingUntil) {
    st.unloadingChips = [];
    st.unloadingUntil = 0;
  }

  // scheduling
  if (!isFinite(st.nextAt) || st.nextAt <= 0) {
    st.nextAt = now;
  }
  if (now >= st.nextAt) {
    st.nextAt = now + randIntervalMs();
    tryDelivery(st, Vv, now);
  }

  // input one-shot
  const ePressed = st.pressed.has('e') || st.pressed.has(' ');
  const eOneShot = ePressed && !st.prevE;
  st.prevE = ePressed;

  // proximity unload
  const vis = visitorState();
  if (vis && st.exhibits.length > 0 && !(st.unloadingUntil && now < st.unloadingUntil)) {
    const visPt = isoFn(vis.gx, vis.gy);
    const dist = tileDistToCart(visPt, Vv);
    if (dist <= 1.6 && eOneShot) startUnload(st, Vv, now);
  }
}

function draw(ctx) {
  const st = getS();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  ensureCart(st);
  if (!Array.isArray(st.exhibits)) st.exhibits = [];
  if (!Array.isArray(st.fadingChips)) st.fadingChips = [];
  if (!Array.isArray(st.unloadingChips)) st.unloadingChips = [];

  const now = nowFn();
  const cartPt = isoFn(CART_GX, CART_GY);
  const x = Math.round(cartPt.x);
  const y = Math.round(cartPt.y);

  let hopOffset = 0;
  if (st.cart && st.cart.hopUntil && now < st.cart.hopUntil) {
    const dur = 800;
    const start = st.cart.hopUntil - dur;
    const t = clamp((now - start) / dur, 0, 1);
    hopOffset = -Math.round(Math.sin(t * Math.PI) * 8);
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 12, y + 17, 30, 4);

  // wheels
  ctx.fillStyle = '#374151';
  ctx.fillRect(x - 11, y + 8, 6, 6);
  ctx.fillRect(x + 11, y + 8, 6, 6);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 9, y + 10, 2, 2);
  ctx.fillRect(x + 13, y + 10, 2, 2);

  // cart body
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 9, y - 1, 22, 9);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(x - 9, y + 7, 22, 2);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 9, y - 1, 22, 1);
  ctx.fillRect(x - 9, y + 6, 22, 1);

  // crate hops
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 7, y - 13 + hopOffset, 18, 13);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 7, y - 1 + hopOffset, 18, 2);

  // rolled parchment
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x - 5, y - 17 + hopOffset, 14, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 5, y - 15 + hopOffset, 14, 1);

  // exhibit chips on cart
  for (let i = 0; i < st.exhibits.length; i++) {
    const chip = st.exhibits[i];
    const cxp = x - 3 + i * 9;
    const cyp = y - 15 + hopOffset;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cxp, cyp, 6, 6);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cxp + 1, cyp + 1, 4, 2);
    ctx.fillStyle = '#e8e6df';
    ctx.font = '8px monospace';
    const label = fitFn(String(chip.id == null ? '' : chip.id), 48);
    ctx.fillText(label, cxp + 8, cyp + 5);
  }

  // fading displaced chips
  for (let i = 0; i < st.fadingChips.length; i++) {
    const chip = st.fadingChips[i];
    const a = clamp(1 - (now - chip.start) / chip.duration, 0, 1);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x - 3, y - 15, 6, 6);
    ctx.globalAlpha = 1;
  }

  // unloading chips glide
  for (let i = 0; i < st.unloadingChips.length; i++) {
    const chip = st.unloadingChips[i];
    const t = clamp((now - chip.start) / chip.duration, 0, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const px = Math.round(chip.x0 + (chip.x1 - chip.x0) * ease);
    const py = Math.round(chip.y0 + (chip.y1 - chip.y0) * ease);
    const alpha = 1 - t * 0.35;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(px, py, 6, 6);
    ctx.fillStyle = '#e8e6df';
    ctx.font = '8px monospace';
    ctx.fillText(fitFn(String(chip.id == null ? '' : chip.id), 48), px + 8, py + 5);
    ctx.globalAlpha = 1;
  }

  // hint
  const vis = visitorState();
  let showHint = false;
  if (vis && st.exhibits.length > 0 && !(st.unloadingUntil && now < st.unloadingUntil)) {
    const visPt = isoFn(vis.gx, vis.gy);
    const dist = tileDistToCart(visPt, Vv);
    if (dist <= 1.6) showHint = true;
  }
  if (showHint) {
    const hx = x - 4;
    const hy = y - 42;
    const text = '[E] UNLOAD';
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(hx, hy, 86, 14);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx, hy, 86, 14);
    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, hx + 6, hy + 7);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildCurator) window.GuildCurator = createState();
  else {
    if (!Array.isArray(window.GuildCurator.exhibits)) window.GuildCurator.exhibits = [];
    if (window.GuildCurator.cart == null) window.GuildCurator.cart = null;
    if (!isFinite(window.GuildCurator.nextAt)) window.GuildCurator.nextAt = 0;
  }
  window.GuildCurator.update = update;
  window.GuildCurator.draw = draw;
  window.GuildCurator.__probe = function () {
    const s = getS() || {};
    return { cart: !!(s.cart), exhibits: Array.isArray(s.exhibits) ? s.exhibits.length : 0 };
  };

  if (!listenersBound && !window.__gcListeners) {
    listenersBound = true;
    window.__gcListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
