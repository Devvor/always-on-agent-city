const STALLS = [
  { id: 'A', gx: -2.5, gy: 4.8, price: 5, title: 'SNACKS' },
  { id: 'B', gx: -1.0, gy: 5.2, price: 12, title: 'LUCK CHARM' }
];

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function easeOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - t, 3);
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function createState() {
  return {
    wanted: false,
    prevWanted: false,
    open: false,
    anim: 0,
    pressed: pressed,
    prevPressed: prevPressed,
    lastTime: null,
    lastTrade: 0,
    nearIndex: -1,
    localCoins: 20,
    spent: 0,
    charm: false,
    snackUntil: 0,
    embers: []
  };
}

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
function getState() { const w = root(); return w && w.GuildNightMarket; }
function getVisitor() {
  const w = root();
  const v = w && w.GuildVisitor;
  return (v && typeof v === 'object') ? v : null;
}
function isoReady() {
  const w = root();
  if (w && typeof w.iso === 'function') return true;
  const Vv = getV();
  return !!(Vv && Vv.grid);
}
function isNightHour() {
  let h;
  try { h = new Date().getHours(); } catch (e) { return false; }
  return h >= 19 || h <= 5;
}
function isGateWanted() {
  const Vv = getV();
  if (!Vv) return false;
  if (Vv.weather !== 'RAIN') return false;
  return isNightHour();
}

function getPurseInfo() {
  const w = root();
  const e = w && w.GuildEconomy;
  if (!e || typeof e !== 'object') return null;
  const keys = ['visitorPurse', 'visitorCoins', 'visitorCoin', 'purse', 'coins', 'gc', 'balance', 'wallet', 'money', 'funds'];
  function check(container) {
    if (!container || typeof container !== 'object') return null;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (Object.prototype.hasOwnProperty.call(container, k) && typeof container[k] === 'number' && isFinite(container[k])) {
        return { target: container, key: k };
      }
    }
    return null;
  }
  let r = check(e);
  if (r) return r;
  if (e.visitor) {
    r = check(e.visitor);
    if (r) return r;
  }
  if (e.visitorPurse && typeof e.visitorPurse === 'object') {
    r = check(e.visitorPurse);
    if (r) return r;
  }
  return null;
}

function spawnClosingEmbers(st, now) {
  for (let i = 0; i < STALLS.length; i++) {
    const s = STALLS[i];
    const p = isoFn(s.gx, s.gy);
    const count = 10;
    for (let k = 0; k < count; k++) {
      st.embers.push({
        x: p.x + (Math.random() - 0.5) * 14,
        y: p.y - 4 - Math.random() * 10,
        vx: (Math.random() - 0.5) * 20,
        vy: -24 - Math.random() * 18,
        age: 0,
        life: 3,
        size: 2,
        color: Math.random() < 0.5 ? '#ff5a1f' : '#ffc27a'
      });
    }
  }
  if (st.embers.length > 240) st.embers = st.embers.slice(-240);
}

function tileDistance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function tryTrade(st) {
  if (!st) return false;
  const Vv = getV();
  if (!Vv || (Vv.gameState != null && Vv.gameState !== 'play')) return false;
  if (!isGateWanted()) return false;
  const now = nowFn();
  if (now - st.lastTrade < 250) return false;
  const vis = getVisitor();
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;

  let near = -1;
  let best = Infinity;
  for (let i = 0; i < STALLS.length; i++) {
    const d = tileDistance(vis.gx, vis.gy, STALLS[i].gx, STALLS[i].gy);
    if (d <= 1.6 && d < best) {
      best = d;
      near = i;
    }
  }
  if (near < 0) return false;

  const price = STALLS[near].price;
  const purse = getPurseInfo();
  let current = purse ? Number(purse.target[purse.key]) : Number(st.localCoins);
  if (!isFinite(current) || current < price) return false;

  let wrote = false;
  try {
    if (purse) {
      purse.target[purse.key] = current - price;
    } else {
      st.localCoins = current - price;
    }
    wrote = true;
  } catch (e) { wrote = false; }
  if (!wrote) return false;

  st.spent += price;
  st.lastTrade = now;
  if (near === 0) {
    st.snackUntil = now + 2600;
  } else {
    st.charm = true;
  }
  return true;
}

function onKeydown(e) {
  const k = (e && e.key === ' ') ? ' ' : (e && e.key ? String(e.key).toLowerCase() : '');
  if (!k) return;
  const st = getState();
  if (!st) return;
  st.pressed.add(k);
  if (k === 'e' || k === ' ') tryTrade(st);
}
function onKeyup(e) {
  const k = (e && e.key === ' ') ? ' ' : (e && e.key ? String(e.key).toLowerCase() : '');
  if (!k) return;
  const st = getState();
  if (!st) return;
  st.pressed.delete(k);
  st.prevPressed.delete(k);
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function updateEmbers(st, dt) {
  const next = [];
  for (let i = 0; i < st.embers.length; i++) {
    const p = st.embers[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 16 * dt;
    p.vx *= 0.98;
    next.push(p);
  }
  st.embers = next;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;
  const Vv = getV();
  if (!Vv) { lastTime = now; return; }
  if (Vv.gameState != null && Vv.gameState !== 'play') { lastTime = now; return; }
  if (!isoReady()) { lastTime = now; return; }

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const wanted = isGateWanted();
  if (wanted !== st.prevWanted) {
    if (!wanted && st.prevWanted && st.anim > 0.001) {
      try {
        const w = root();
        if (w && typeof w.cue === 'function') w.cue('alert');
      } catch (e) {}
      spawnClosingEmbers(st, now);
    }
    st.prevWanted = wanted;
  }
  st.wanted = wanted;
  st.open = wanted;

  if (wanted) st.anim = clamp(st.anim + dt, 0, 1);
  else st.anim = clamp(st.anim - dt, 0, 1);

  const vis = getVisitor();
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    let near = -1;
    let best = Infinity;
    for (let i = 0; i < STALLS.length; i++) {
      const d = tileDistance(vis.gx, vis.gy, STALLS[i].gx, STALLS[i].gy);
      if (d <= 1.6 && d < best) { best = d; near = i; }
    }
    st.nearIndex = near;
  } else {
    st.nearIndex = -1;
  }

  if (wanted) tryTrade(st);

  const ep = st.pressed.has('e') || st.pressed.has(' ');
  const epWas = st.prevPressed.has('e') || st.prevPressed.has(' ');
  if (wanted && !epWas && ep) tryTrade(st);

  updateEmbers(st, dt);
  st.prevPressed = new Set(st.pressed);
}

function drawStallGlow(ctx, x, y, eased) {
  if (eased <= 0.001) return;
  const radius = 24 + eased * 12;
  const cx = x;
  const cy = y - 10;
  let g;
  try { g = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius); } catch (e) { return; }
  g.addColorStop(0, 'rgba(251,191,36,' + (0.55 * eased) + ')');
  g.addColorStop(0.35, 'rgba(251,191,36,' + (0.20 * eased) + ')');
  g.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawStallSprite(ctx, stall, p, eased) {
  if (eased <= 0.001) return;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const floorY = y + 9;
  const scale = 0.5 + 0.5 * eased;
  ctx.save();
  ctx.globalAlpha = eased;
  ctx.translate(x, floorY);
  ctx.scale(1, scale);
  ctx.translate(-x, -floorY);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 3, y - 24, 6, 26);
  ctx.fillRect(x - 15, y - 9, 30, 9);
  ctx.fillStyle = '#5a3d25';
  ctx.fillRect(x - 15, y - 9, 30, 2);

  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#fff7ed';
    ctx.fillRect(x - 16 + i * 4, y - 31, 4, 11);
  }
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 18, y - 33, 36, 3);
  ctx.fillRect(x - 18, y - 20, 36, 2);

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(x - 2, y - 38, 4, 5);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x - 1, y - 37, 2, 3);

  ctx.restore();
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  if (!st) return;
  const Vv = getV();
  if (!Vv || (Vv.gameState != null && Vv.gameState !== 'play')) return;
  if (!isoReady()) return;
  if (st.anim <= 0.001) {
    // still draw closing embers even after stalls gone
  } else {
    // draw stalls
  }

  const eased = clamp(st.anim, 0, 1);
  if (eased > 0.001) {
    for (let i = 0; i < STALLS.length; i++) {
      const s = STALLS[i];
      const p = isoFn(s.gx, s.gy);
      drawStallGlow(ctx, Math.round(p.x), Math.round(p.y), eased);
      drawStallSprite(ctx, s, p, eased);

      ctx.save();
      ctx.globalAlpha = eased;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn(s.title, 70), Math.round(p.x), Math.round(p.y) - 42);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(fitFn(s.price + ' GC', 50), Math.round(p.x), Math.round(p.y) - 31);
      ctx.restore();
    }
  }

  // clipped trade hint
  if (st.nearIndex >= 0 && eased > 0.05 && st.wanted) {
    const s = STALLS[st.nearIndex];
    const p = isoFn(s.gx, s.gy);
    const x = Math.round(p.x);
    const y = Math.round(p.y) - 56;
    const text = fitFn('[E] TRADE', 120);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 42, y - 10, 84, 22);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,10,12,0.86)';
    ctx.fillRect(x - 42, y - 10, 84, 22);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 42, y - 10, 84, 22);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // floating snack label and steaming bun
  const now = nowFn();
  if (st.snackUntil > now) {
    const vis = getVisitor();
    if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
      const p = isoFn(vis.gx, vis.gy);
      const started = st.snackUntil - 2600;
      const progress = clamp((now - started) / 2600, 0, 1);
      const alpha = 1 - progress;
      const lx = Math.round(p.x);
      const ly = Math.round(p.y) - 34 - Math.round(progress * 16);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+snack', lx, ly);
      ctx.fillStyle = '#f5d0a9';
      ctx.fillRect(lx - 3, ly - 15, 6, 4);
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(lx - 2, ly - 17, 4, 2);
      for (let i = 0; i < 3; i++) {
        const sx = lx - 2 + i * 2;
        const sy = ly - 19 - Math.round((progress * 7 + i) % 4);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * alpha) + ')';
        ctx.fillRect(sx, sy, 1, 2);
      }
      ctx.restore();
      ctx.textAlign = 'left';
    }
  }

  // persistent charm mark on visitor
  if (st.charm) {
    const vis = getVisitor();
    if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
      const p = isoFn(vis.gx, vis.gy);
      const x = Math.round(p.x + 11);
      const y = Math.round(p.y + 8);
      const glow = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.006));
      ctx.save();
      ctx.globalAlpha = glow;
      let g;
      try { g = ctx.createRadialGradient(x, y, 1, x, y, 7); } catch (e) { g = null; }
      if (g) {
        g.addColorStop(0, 'rgba(252,211,77,0.75)');
        g.addColorStop(1, 'rgba(252,211,77,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 7, y - 7, 14, 14);
      }
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(x, y, 2, 2);
      ctx.fillRect(x - 1, y - 1, 4, 4);
      ctx.restore();
    }
  }

  // closing embers
  for (let i = 0; i < st.embers.length; i++) {
    const e = st.embers[i];
    const a = clamp(1 - e.age / e.life, 0, 1);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = e.color;
    ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

if (typeof window !== 'undefined') {
  if (!window.GuildNightMarket) window.GuildNightMarket = createState();
  window.GuildNightMarket.update = update;
  window.GuildNightMarket.draw = draw;
  window.GuildNightMarket.__probe = function () {
    const s = getState();
    if (!s) return { open: false, charm: false, spent: 0 };
    return { open: !!s.open, charm: !!s.charm, spent: s.spent || 0 };
  };
  window.GuildNightMarket.__rawUpdate = update;
  window.GuildNightMarket.__keys = pressed;
  if (!window.__gnmListeners) {
    window.__gnmListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
