const state = {
  gx: -3,
  gy: 3,
  bobPhase: 0,
  tipCount: 0,
  coins: [],
  bow: { active: false, start: 0, duration: 700 },
  ePrev: false,
  lastTime: null
};
let pressed = new Set();
let prevPressed = new Set();

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
function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}
function isNight(Vv) {
  const dl = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  return dl < 0.12;
}

function spawnCoins(now, vis) {
  const Vv = getV();
  const bp = isoFn(state.gx, state.gy);
  const vp = vis ? isoFn(vis.gx, vis.gy) : bp;
  const count = 4;
  for (let i = 0; i < count; i++) {
    state.coins.push({
      start: now + i * 45,
      duration: 520,
      sx: vp.x + (Math.random() - 0.5) * 6,
      sy: vp.y - 8,
      ex: bp.x + (Math.random() - 0.5) * 8,
      ey: bp.y - 10,
      arc: -28 - Math.random() * 12
    });
  }
}

function tip(now) {
  const vis = getVisitor();
  state.tipCount += 1;
  state.bow.active = true;
  state.bow.start = now;
  spawnCoins(now, vis);
  try {
    const w = root();
    if (w && typeof w.cue === 'function') w.cue('tip');
  } catch (e) {}
  try {
    const w = root();
    if (w && typeof w.cue === 'function') w.cue('coin');
  } catch (e) {}
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

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const vis = getVisitor();
  if (!state.lastTime) state.lastTime = now;
  let dt = (now - state.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  state.lastTime = now;

  try {
    if (Array.isArray(root().allTasks)) {
      state.lastTaskCount = root().allTasks.length;
    }
  } catch (e) {}

  const night = isNight(Vv);
  if (!night) state.bobPhase += dt * 3.4;
  if (state.bow.active && now - state.bow.start >= state.bow.duration) state.bow.active = false;

  const ownE = pressed.has('e') || pressed.has(' ');
  const visKeys = vis && vis.__keys instanceof Set ? vis.__keys : null;
  const visitorE = visKeys ? (visKeys.has('e') || visKeys.has(' ')) : false;
  const eNow = ownE || visitorE;
  const eEdge = eNow && !state.ePrev;
  state.ePrev = eNow;

  const grid = Vv && Vv.grid;
  if (Vv && vis && Vv.gameState === 'play' && eEdge && grid) {
    const bp = isoFn(state.gx, state.gy);
    const vp = isoFn(vis.gx, vis.gy);
    const d = tileDistance(bp.x, bp.y, vp.x, vp.y, grid);
    if (d <= 2.0) tip(now);
  }

  const next = [];
  for (let i = 0; i < state.coins.length; i++) {
    if (now < state.coins[i].start + state.coins[i].duration) next.push(state.coins[i]);
  }
  state.coins = next;
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  const vis = getVisitor();
  if (!Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const night = isNight(Vv);
  const pt = isoFn(state.gx, state.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  let bodyY = y;
  if (!night) bodyY += Math.round(Math.sin(state.bobPhase) * 1.6);
  const bowProgress = state.bow.active ? Math.min(1, (now - state.bow.start) / state.bow.duration) : 0;
  const bowDown = state.bow.active ? Math.round(Math.sin(bowProgress * Math.PI) * 5) : 0;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 5, y + (night ? 20 : 17), 22, 4);

  const legColor = night ? '#3f3f46' : '#334155';
  const robeColor = night ? '#475569' : '#92400e';
  const faceColor = night ? '#cbd5e1' : '#f1c9a5';

  if (night) {
    ctx.fillStyle = legColor;
    ctx.fillRect(x + 2, y + 14, 4, 3);
    ctx.fillRect(x + 10, y + 14, 4, 3);
    ctx.fillStyle = robeColor;
    ctx.fillRect(x + 1, bodyY - 2 + bowDown, 14, 10);
    ctx.fillStyle = faceColor;
    ctx.fillRect(x + 3, bodyY - 10 + bowDown, 10, 8);
  } else {
    ctx.fillStyle = legColor;
    ctx.fillRect(x + 2, bodyY + 10, 4, 8);
    ctx.fillRect(x + 10, bodyY + 10, 4, 8);
    ctx.fillStyle = robeColor;
    ctx.fillRect(x + 1, bodyY - 2 + bowDown, 14, 12);
    ctx.fillStyle = faceColor;
    ctx.fillRect(x + 3, bodyY - 10 + bowDown, 10, 9);
  }
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, bodyY - 8 + bowDown, 2, 2);
  ctx.fillRect(x + 9, bodyY - 8 + bowDown, 2, 2);

  ctx.fillStyle = night ? '#94a3b8' : '#d4a373';
  ctx.fillRect(x - 3, bodyY + 4 + bowDown, 3, 2);
  ctx.fillStyle = night ? '#64748b' : '#7c3a10';
  ctx.fillRect(x + 14, bodyY + 3 + bowDown, 8, 3);
  ctx.fillStyle = night ? '#475569' : '#5a1118';
  ctx.fillRect(x + 15, bodyY + 1 + bowDown, 6, 2);

  const signText = fitFn('TIPS ' + state.tipCount, 70);
  ctx.font = 'bold 10px monospace';
  const tw = ctx.measureText(signText).width;
  const sw = Math.max(34, Math.round(tw + 10));
  const sh = 14;
  const sx = x + 8 - Math.round(sw * 0.5);
  const sy = bodyY - 34 + bowDown;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(signText, sx + sw * 0.5, sy + sh * 0.5 + 1);
  ctx.textAlign = 'left';

  for (let i = 0; i < state.coins.length; i++) {
    const coin = state.coins[i];
    if (now < coin.start) continue;
    const p = Math.min(1, (now - coin.start) / coin.duration);
    const ix = coin.sx + (coin.ex - coin.sx) * p;
    const iy = coin.sy + (coin.ey - coin.sy) * p + coin.arc * Math.sin(p * Math.PI);
    if (p >= 0.98) {
      ctx.globalAlpha = 1 - (p - 0.98) * 50;
    }
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(Math.round(ix), Math.round(iy), 4, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(ix) + 1, Math.round(iy), 1, 1);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.__gBuskerKeys) {
    window.__gBuskerKeys = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
  const api = {
    update: update,
    draw: draw,
    state: state,
    pressed: pressed,
    tip: tip,
    gx: state.gx,
    gy: state.gy
  };
  window.GuildBusker = api;
}

export {};
