const BOOTH_GX = -2;
const BOOTH_GY = 2;
const NIGHT_THRESHOLD = 0.35;
const PROMPT_RANGE = 1.5;
const WISH_LINES = [
  'May the builds stay green.',
  'Wish: zero flaky tests.',
  'May the cat sit on my desk.',
  'Wish: one clean deploy.',
  'May the lanterns outlast the rain.'
];
const GOLD = '#d4af37';

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildWishBooth; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

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

function createState() {
  return {
    coins: 0,
    wishIndex: 0,
    coin: null,        // { t, dur, sx, sy, tx, ty }
    lanternRise: null,  // { t, dur }
    flare: null,       // { t, dur }
    bubble: null       // { text, t, dur }
  };
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
}

function visitorDistance(vis, Vv) {
  if (!vis || !Vv || !Vv.grid) return Infinity;
  const dx = vis.gx - BOOTH_GX;
  const dy = vis.gy - BOOTH_GY;
  return Math.hypot(dx, dy);
}

function tryTossCoin(st, vis, now) {
  const from = isoFn(vis.gx, vis.gy);
  const to = isoFn(BOOTH_GX, BOOTH_GY);
  st.coin = {
    t: 0,
    dur: 0.55,
    sx: from.x,
    sy: from.y - 10,
    tx: to.x,
    ty: to.y - 14
  };
  st.coins += 1;
  if (st.coins % 10 === 0) {
    st.flare = { t: 0, dur: 1.2 };
  }
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue('coin'); } catch (e) {}
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    prevPressed = new Set(pressed);
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');

  const vis = getVisitor();
  const near = vis && visitorDistance(vis, Vv) <= PROMPT_RANGE;
  const night = typeof Vv.daylight === 'number' && Vv.daylight < NIGHT_THRESHOLD;

  if (ePressed && !eWas && near && !st.coin) {
    tryTossCoin(st, vis, now);
  }

  if (st.coin) {
    st.coin.t += dt;
    if (st.coin.t >= st.coin.dur) {
      st.lanternRise = { t: 0, dur: 0.6 };
      st.bubble = { text: WISH_LINES[st.wishIndex % WISH_LINES.length], t: 0, dur: 3.5 };
      st.wishIndex = (st.wishIndex + 1) % WISH_LINES.length;
      st.coin = null;
    }
  }
  if (st.lanternRise) {
    st.lanternRise.t += dt;
    if (st.lanternRise.t >= st.lanternRise.dur) st.lanternRise = null;
  }
  if (st.flare) {
    st.flare.t += dt;
    if (st.flare.t >= st.flare.dur) st.flare = null;
  }
  if (st.bubble) {
    st.bubble.t += dt;
    if (st.bubble.t >= st.bubble.dur) st.bubble = null;
  }

  prevPressed = new Set(pressed);
}

function drawBooth(ctx, st, Vv, now) {
  const pt = isoFn(BOOTH_GX, BOOTH_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const night = typeof Vv.daylight === 'number' && Vv.daylight < NIGHT_THRESHOLD;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 16, y - 2, 32, 5);

  // booth posts + counter
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 15, y - 30, 3, 30);
  ctx.fillRect(x + 12, y - 30, 3, 30);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 15, y - 8, 30, 8);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 15, y - 12, 30, 4);

  // striped awning
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#7a1620' : '#f3e6bf';
    ctx.fillRect(x - 17 + i * 6, y - 36, 6, 7);
  }
  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(x - 17, y - 30, 34, 2);

  // coin slot
  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(x - 2, y - 10, 5, 3);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 1, y - 10, 3, 1);

  // lantern hanging from awning, rises 20px on wish
  let lanternY = y - 34;
  if (st.lanternRise) {
    const p = Math.min(1, st.lanternRise.t / st.lanternRise.dur);
    const eased = 1 - Math.pow(1 - p, 3);
    lanternY = y - 34 - Math.round(eased * 20);
  }
  let flareMul = 1;
  if (st.flare) {
    const fp = st.flare.t / st.flare.dur;
    flareMul = 1 + Math.sin(Math.max(0, 1 - fp) * Math.PI) * 1.0; // up to 2x
  }
  const glow = (night ? 0.5 : 0.22) * flareMul;
  ctx.globalAlpha = Math.min(1, glow);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 8, lanternY - 8, 16, 16);
  ctx.globalAlpha = 1;
  // paper lantern body
  ctx.fillStyle = '#f4d9a6';
  ctx.fillRect(x - 4, lanternY - 5, 8, 9);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 4, lanternY - 6, 8, 2);
  ctx.fillRect(x - 4, lanternY + 3, 8, 1);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x - 2, lanternY - 3, 4, 5);

  // soft pop when the rise starts
  if (st.lanternRise && st.lanternRise.t < 0.25) {
    const pp = st.lanternRise.t / 0.25;
    ctx.globalAlpha = (1 - pp) * 0.6;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, lanternY, 6 + pp * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // night sign
  if (night) {
    const signText = 'WISHES';
    ctx.font = 'bold 8px monospace';
    const tw = ctx.measureText(signText).width;
    const sw = Math.round(tw) + 8;
    const sx = x - Math.round(sw * 0.5);
    const sy = y - 52;
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(sx, sy, sw, 12);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, sw, 12);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(signText, sx + sw * 0.5, sy + 7);
    ctx.textAlign = 'left';
  }
}

function drawCoinArc(ctx, st) {
  if (!st.coin) return;
  const c = st.coin;
  const p = Math.min(1, c.t / c.dur);
  const x = c.sx + (c.tx - c.sx) * p;
  const y = c.sy + (c.ty - c.sy) * p - Math.sin(p * Math.PI) * 34;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 3);
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(Math.round(x) - 2, Math.round(y) + 1, 5, 1);
  ctx.fillStyle = '#ffffff';
  if (Math.sin(p * Math.PI * 8) > 0) ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 1);
}

function drawPrompt(ctx, st, Vv) {
  const vis = getVisitor();
  if (!vis || visitorDistance(vis, Vv) > PROMPT_RANGE) return;
  const pt = isoFn(BOOTH_GX, BOOTH_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y) - 66;
  const text = fitFn('toss a coin [E]', 140);
  ctx.font = '10px monospace';
  const tw = ctx.measureText(text).width;
  const bw = Math.round(tw) + 12;
  const bh = 16;
  const bx = x - Math.round(bw * 0.5);
  const by = y;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 6, by + bh * 0.5 + 1);
}

function drawBubble(ctx, st) {
  if (!st.bubble) return;
  const b = st.bubble;
  const alpha = b.t <= b.dur - 1 ? 1 : Math.max(0, 1 - (b.t - (b.dur - 1)) / 1);
  if (alpha <= 0) return;
  const pt = isoFn(BOOTH_GX, BOOTH_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y) - 84;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'italic 10px monospace';
  const text = fitFn(b.text, 170);
  const tw = ctx.measureText(text).width;
  const bw = Math.max(50, Math.round(tw) + 12);
  const bh = 16;
  const bx = x - Math.round(bw * 0.5);
  const by = y;
  ctx.fillStyle = 'rgba(10,10,12,0.90)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 6, by + bh * 0.5 + 1);
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;
  const n = nowFn();
  drawBooth(ctx, st, Vv, n);
  drawCoinArc(ctx, st);
  drawPrompt(ctx, st, Vv);
  drawBubble(ctx, st);
}

if (typeof window !== 'undefined') {
  if (!window.GuildWishBooth) window.GuildWishBooth = createState();
  window.GuildWishBooth.update = update;
  window.GuildWishBooth.draw = draw;
  window.GuildWishBooth.__probe = function () {
    const st = getState();
    return { coins: st ? st.coins : 0 };
  };
  if (!window.__gwbListeners) {
    window.__gwbListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
