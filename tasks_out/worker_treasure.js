let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

const root = () => (typeof window !== 'undefined' ? window : null);
const getV = () => {
  const w = root();
  return w && w.V;
};
const nowFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const isoFn = (gx, gy) => {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
};
const fitFn = (text, maxW) => {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
};
const normKey = (e) => {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
};
const isFiniteN = (v) => typeof v === 'number' && isFinite(v);

const spots = [
  { gx: -1, gy: -2, dug: false },
  { gx: 2, gy: -1, dug: false },
  { gx: 1, gy: 3, dug: false },
  { gx: -3, gy: 1, dug: false },
  { gx: 3, gy: 2, dug: false }
];

const state = {
  found: 0,
  dirt: [],
  sparkle: [],
  coins: [],
  fireworks: [],
  allFoundFired: false,
  allFoundStart: 0
};

function syncGlobal() {
  const w = root();
  if (!w || !w.GuildTreasure) return;
  w.GuildTreasure.spots = spots;
  w.GuildTreasure.found = state.found;
}

function seed(v) {
  return Math.abs(Math.sin(v * 999.99 + 17.25));
}

function visitorWorldPosition(Vv) {
  const w = root();
  if (w && w.GuildVisitor) {
    const v = w.GuildVisitor;
    if (isFiniteN(v.gx) && isFiniteN(v.gy)) return isoFn(v.gx, v.gy);
    if (isFiniteN(v.x) && isFiniteN(v.y)) return { x: Number(v.x), y: Number(v.y) };
  }
  if (Vv && Vv.visitor) {
    const v = Vv.visitor;
    if (isFiniteN(v.gx) && isFiniteN(v.gy)) return isoFn(v.gx, v.gy);
    if (isFiniteN(v.x) && isFiniteN(v.y)) return { x: Number(v.x), y: Number(v.y) };
  }
  if (Vv && Vv.gameState === 'play') {
    const c = Vv.canvas;
    if (c) return { x: c.width * 0.5, y: c.height * 0.5 };
  }
  return null;
}

function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function createDigEffects(spot, now) {
  const Vv = getV();
  const pt = isoFn(spot.gx, spot.gy);
  const x = pt.x;
  const y = pt.y - 3;
  for (let i = 0; i < 9; i++) {
    const a = seed(now + i * 13.7);
    state.dirt.push({
      x: x + (seed(now + i * 2.3) - 0.5) * 4,
      y: y,
      vx: (seed(now + i * 5.1) - 0.5) * 72,
      vy: -26 - seed(now + i * 7.9) * 34,
      life: 0.55 + seed(now + i * 11.3) * 0.3,
      age: 0,
      size: seed(now + i * 19.1) < 0.45 ? 2 : 3,
      color: seed(now + i * 23.7) < 0.5 ? '#78350f' : '#5b2a0c'
    });
  }
  for (let i = 0; i < 7; i++) {
    state.sparkle.push({
      x: x + (seed(now + i * 31.7) - 0.5) * 6,
      y: y - 2,
      vx: (seed(now + i * 37.1) - 0.5) * 58,
      vy: -38 - seed(now + i * 41.3) * 26,
      life: 0.35 + seed(now + i * 43.9) * 0.25,
      age: 0,
      size: 2,
      color: seed(now + i * 47.3) < 0.55 ? '#facc15' : '#ffe066'
    });
  }
  const c = Vv && Vv.canvas ? Vv.canvas : (root() && root().V && root().V.canvas);
  const targetX = c ? c.width - 96 : x + 90;
  const targetY = c ? c.height - 78 : y + 70;
  state.coins.push({
    x: x,
    y: y - 7,
    sx: x,
    sy: y - 7,
    ex: targetX,
    ey: targetY,
    t: 0,
    duration: 0.78,
    spin: seed(now) * Math.PI * 2
  });
}

function attemptDig(now) {
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const pos = visitorWorldPosition(Vv);
  if (!pos) return;

  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    if (spot.dug) continue;
    const sp = isoFn(spot.gx, spot.gy);
    const d = tileDistance(sp.x, sp.y, pos.x, pos.y, Vv.grid);
    if (d <= 1.25 && d < bestDist) {
      bestDist = d;
      best = spot;
    }
  }
  if (!best) return;

  best.dug = true;
  state.found = spots.reduce((sum, s) => sum + (s.dug ? 1 : 0), 0);
  createDigEffects(best, now);
  syncGlobal();

  const w = root();
  try {
    if (w && typeof w.cue === 'function') w.cue('coin');
  } catch (e) {}

  if (state.found === 5 && !state.allFoundFired) {
    state.allFoundFired = true;
    state.allFoundStart = now;
    const pt = isoFn(best.gx, best.gy);
    for (let i = 0; i < 34; i++) {
      const ang = (i / 34) * Math.PI * 2 + seed(now + i) * 0.35;
      const speed = 24 + seed(now + i * 3) * 62;
      state.fireworks.push({
        x: pt.x + (seed(now + i * 7) - 0.5) * 6,
        y: pt.y - 5,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 12,
        life: 1.2 + seed(now + i * 11) * 0.9,
        age: 0,
        size: 2,
        color: seed(now + i * 13) < 0.65 ? '#facc15' : '#ffe066'
      });
    }
    try {
      if (w && typeof w.cue === 'function') w.cue('coin');
    } catch (e) {}
  }
}

function updateEffects(dt, Vv, now) {
  const c = Vv && Vv.canvas;
  const nextDirt = [];
  for (let i = 0; i < state.dirt.length; i++) {
    const p = state.dirt[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 68 * dt;
    nextDirt.push(p);
  }
  state.dirt = nextDirt;

  const nextSpark = [];
  for (let i = 0; i < state.sparkle.length; i++) {
    const p = state.sparkle[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 24 * dt;
    nextSpark.push(p);
  }
  state.sparkle = nextSpark;

  const nextCoin = [];
  for (let i = 0; i < state.coins.length; i++) {
    const co = state.coins[i];
    co.t += dt;
    const p = Math.max(0, Math.min(1, co.t / co.duration));
    co.x = co.sx + (co.ex - co.sx) * p;
    co.y = co.sy + (co.ey - co.sy) * p - Math.sin(p * Math.PI) * 92;
    if (p < 1) nextCoin.push(co);
  }
  state.coins = nextCoin;

  const nextFire = [];
  for (let i = 0; i < state.fireworks.length; i++) {
    const p = state.fireworks[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy += 28 * dt;
    nextFire.push(p);
  }
  state.fireworks = nextFire;
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const Vv = getV();
  if (Vv && Vv.gameState === 'play' && k === 'e') {
    attemptDig(nowFn());
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
  if (k === 'escape') prevPressed.add(k);
  if (k === 'e') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv || !Vv.grid) {
    lastTime = now;
    return;
  }
  if (Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  updateEffects(dt, Vv, now);

  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');
  if (!eWas && ePressed) attemptDig(now);

  prevPressed = new Set(pressed);
  syncGlobal();
}

function drawSpot(ctx, spot, n) {
  const pt = isoFn(spot.gx, spot.gy);
  const mx = Math.round(pt.x);
  const my = Math.round(pt.y);
  const ox = mx - 5;
  const oy = my - 7;

  if (!spot.dug) {
    for (let yy = 0; yy < 6; yy++) {
      for (let xx = 0; xx < 10; xx++) {
        const shade = (xx + yy) % 2 === 0 ? '#78350f' : '#5a2a0c';
        ctx.fillStyle = shade;
        ctx.fillRect(ox + xx, oy + yy, 1, 1);
      }
    }
    ctx.fillStyle = '#3f1e0a';
    ctx.fillRect(ox - 1, oy - 1, 12, 8);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox, oy, 10, 6);

    const phase = (n || nowFn()) % 2000;
    if (phase < 230) {
      const a = Math.max(0, 1 - phase / 230);
      ctx.globalAlpha = 0.85 * a;
      ctx.fillStyle = '#fff7df';
      ctx.fillRect(mx - 1, oy + 2, 2, 1);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = '#140f0a';
    ctx.fillRect(ox, my - 2, 10, 5);
    ctx.fillStyle = '#2a1f15';
    ctx.fillRect(ox, my - 4, 10, 2);
    ctx.save();
    ctx.translate(mx, my - 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-4, -1, 8, 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillRect(-4, -1, 8, 2);
    ctx.restore();
  }
}

function drawChip(ctx, canvas, foundCount, now) {
  if (foundCount <= 0) return;
  const chipW = 150;
  const chipH = 30;
  const cx = canvas.width - chipW - 16;
  const cy = canvas.height - chipH - 16;
  ctx.fillStyle = '#d9c8a3';
  ctx.fillRect(cx, cy, chipW, chipH);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 1, cy + 1, chipW - 2, chipH - 2);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx, cy, chipW, chipH);
  ctx.fillStyle = '#2a1a08';
  ctx.font = 'bold 12px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  let text = 'Treasure ' + foundCount + '/5';
  if (foundCount >= 5) text = 'Treasure 5/5 - rich!';
  ctx.fillText(fitFn(text, chipW - 14), cx + chipW * 0.5, cy + chipH * 0.5 + 1);
  ctx.textAlign = 'left';
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const c = Vv.canvas || ctx.canvas;
  const n = nowFn();

  for (let i = 0; i < spots.length; i++) drawSpot(ctx, spots[i], n);

  for (let i = 0; i < state.dirt.length; i++) {
    const p = state.dirt[i];
    const a = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  for (let i = 0; i < state.sparkle.length; i++) {
    const p = state.sparkle[i];
    const a = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  for (let i = 0; i < state.coins.length; i++) {
    const co = state.coins[i];
    const a = 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(Math.round(co.x) - 2, Math.round(co.y) - 2, 4, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(co.x) - 1, Math.round(co.y) - 1, 2, 2);
  }
  for (let i = 0; i < state.fireworks.length; i++) {
    const p = state.fireworks[i];
    const a = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  drawChip(ctx, c, state.found, n);
  syncGlobal();
}

if (typeof window !== 'undefined') {
  if (!window.GuildTreasure) window.GuildTreasure = { spots: spots, found: state.found };
  const g = window.GuildTreasure;
  g.spots = spots;
  g.found = state.found;
  g.update = update;
  g.draw = draw;
  g.__probe = function () {
    syncGlobal();
    return { spots: spots, found: state.found };
  };
  if (!window.__gtListeners) {
    window.__gtListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
