const WISH_LINES = [
  'may the queue run dry',
  'gold for every merge',
  'may tests pass on first try',
  'a clean build before lunch',
  'may the server stay awake',
  'one more green tick',
  'may deploys be boring',
  'coins for the guild'
];

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;
let wishCount = 0;

function createState() {
  return { gx: -0.4, gy: 4.9, wishes: [], lastToss: 0, wishCount: 0 };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
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
function getState() {
  const w = root();
  return w && w.GuildWishToss;
}
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function inRange() {
  const st = getState();
  const vis = getVisitor();
  if (!st || !vis) return false;
  if (!isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return Math.hypot(vis.gx - st.gx, vis.gy - st.gy) <= 1.5;
}

function tryToss(now) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return false;
  const vis = getVisitor();
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  if (Math.hypot(vis.gx - st.gx, vis.gy - st.gy) > 1.5) return false;
  if (now - (st.lastToss || 0) < 1000) return false;

  st.lastToss = now;
  st.wishCount = (st.wishCount || 0) + 1;
  wishCount = st.wishCount;

  const kept = [];
  for (let i = 0; i < st.wishes.length; i++) {
    if (now - st.wishes[i].start < 2500) kept.push(st.wishes[i]);
  }
  st.wishes = kept;
  if (st.wishes.length >= 4) st.wishes.shift();

  const line = WISH_LINES[(st.wishCount - 1) % WISH_LINES.length];
  const fromPt = isoFn(vis.gx, vis.gy);
  const toPt = isoFn(st.gx, st.gy);
  st.wishes.push({
    text: line,
    start: now,
    fromX: fromPt.x,
    fromY: fromPt.y - 8,
    toX: toPt.x,
    toY: toPt.y - 4,
    arcDuration: 500
  });
  if (st.wishes.length > 4) st.wishes = st.wishes.slice(-4);

  cueFn('done');
  return true;
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);

  const Vv = getV();
  const st = getState();
  if (st && Vv && Vv.gameState === 'play' && k === 'e' && !prevPressed.has(k)) {
    if (inRange()) {
      tryToss(nowFn());
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  if (k === 'e' || k === ' ' || k === 'escape') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
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

  const kept = [];
  for (let i = 0; i < st.wishes.length; i++) {
    if (now - st.wishes[i].start < 2500) kept.push(st.wishes[i]);
  }
  st.wishes = kept;

  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');
  if (!eWas && ePressed) tryToss(now);

  prevPressed = new Set(pressed);
}

function drawFountain(ctx, st, now) {
  if (!ctx || !st) return;
  const pt = isoFn(st.gx, st.gy);
  if (!pt) return;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const frame = Math.floor(now / 360) % 2;

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(x - 7, y + 5, 14, 3);

  ctx.fillStyle = '#55524e';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = frame === 0 ? '#4f7f99' : '#6fa5be';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();

  const glintPhase = Math.floor(now / 750) % 4;
  for (let i = 0; i < 3; i++) {
    if ((i + glintPhase) % 4 === 0) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - 3 + i * 3, y - 2, 2, 1);
    }
  }
  if (frame === 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.fillRect(x - 2, y - 3, 3, 1);
  }
}

function drawWishes(ctx, st, now) {
  if (!ctx || !st) return;
  for (let i = 0; i < st.wishes.length; i++) {
    const w = st.wishes[i];
    const age = now - w.start;
    const ageSec = age / 1000;

    if (age < w.arcDuration) {
      const t = age / w.arcDuration;
      const u = 1 - t;
      const cx = (w.fromX + w.toX) * 0.5;
      const cy = Math.min(w.fromY, w.toY) - 48;
      const x = u * u * w.fromX + 2 * u * t * cx + t * t * w.toX;
      const y = u * u * w.fromY + 2 * u * t * cy + t * t * w.toY;
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    } else if (ageSec >= 0.5 && ageSec < 0.9) {
      const ringAge = ageSec - 0.5;
      const r = 4 + ringAge * 24;
      ctx.globalAlpha = Math.max(0, 1 - ringAge / 0.4);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w.toX, w.toY, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (ageSec < 2.5) {
      const alpha = Math.max(0, 1 - ageSec / 2.5);
      const ly = w.toY - 12 - ageSec * 16;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#f3d37a';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn(w.text, 100), Math.round(w.toX), Math.round(ly));
      ctx.restore();
    }
  }
}

function drawHint(ctx, st, now) {
  if (!ctx || !st) return;
  const vis = getVisitor();
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
  if (Math.hypot(vis.gx - st.gx, vis.gy - st.gy) > 1.5) return;
  const vp = isoFn(vis.gx, vis.gy);
  ctx.fillStyle = '#d4af37';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('[E] toss a wish', 110), Math.round(vp.x), Math.round(vp.y) - 24);
  ctx.textAlign = 'left';
}

function draw(ctx, nowArg) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;
  const now = (typeof nowArg === 'number') ? nowArg : nowFn();

  drawFountain(ctx, st, now);
  drawWishes(ctx, st, now);
  drawHint(ctx, st, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildWishToss) window.GuildWishToss = createState();
  const st = window.GuildWishToss;
  if (!Array.isArray(st.wishes)) st.wishes = [];
  if (typeof st.gx !== 'number') st.gx = -0.4;
  if (typeof st.gy !== 'number') st.gy = 4.9;
  if (typeof st.lastToss !== 'number') st.lastToss = 0;
  if (typeof st.wishCount !== 'number') st.wishCount = 0;
  wishCount = st.wishCount;

  window.GuildWishToss.update = update;
  window.GuildWishToss.draw = draw;
  window.GuildWishToss.__probe = function () {
    return {
      pressed: Array.from(pressed),
      prev: Array.from(prevPressed),
      wishes: (getState() && Array.isArray(getState().wishes)) ? getState().wishes.length : 0,
      wishCount: (getState() && typeof getState().wishCount === 'number') ? getState().wishCount : 0,
      lastToss: (getState() && typeof getState().lastToss === 'number') ? getState().lastToss : 0
    };
  };

  if (!window.__gwtListeners) {
    window.__gwtListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
