const BUILDINGS_UNUSED = null;
function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isoFn(gx, gy) {
  const w = root();
  const Vv = getV();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    const r = Math.round(v);
    if (r >= -2 && r <= 1) return 0;
    if (r < -2) return -2 - r;
    return r - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function clampOnIslandFloat(gx, gy) {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Math.floor(Vv.growthStep) : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  let x = Math.max(minC, Math.min(maxC, gx));
  let y = Math.max(minC, Math.min(maxC, gy));
  let guard = 0;
  while (guard < 128 && tileRing(x, y) > s) {
    guard++;
    if (Math.abs(x) >= Math.abs(y)) {
      x += (x > 0) ? -0.5 : (x < 0 ? 0.5 : 0);
    } else {
      y += (y > 0) ? -0.5 : (y < 0 ? 0.5 : 0);
    }
    x = Math.max(minC, Math.min(maxC, x));
    y = Math.max(minC, Math.min(maxC, y));
  }
  return { gx: x, gy: y };
}
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

const COLORS = ['#d4af37', '#ffffff', '#3b82f6'];
const BASES = [
  { gx: -5.4, gy: -2.2 },
  { gx: -4.2, gy: -3.4 },
  { gx: -6.0, gy: -1.0 }
];

const state = { crystals: [], lastNightGlint: 0, lastChimeAt: -1 };

function makeCrystal(base, index) {
  return {
    baseGx: base.gx,
    baseGy: base.gy,
    gx: base.gx,
    gy: base.gy,
    color: COLORS[index % COLORS.length],
    sparkle: { active: false, start: 0, duration: 600 },
    nightGlint: { active: false, start: 0, duration: 1400 },
    note: { active: false, start: 0, x: 0, y: 0 },
    sizePulse: { active: false, start: 0, duration: 450 },
    nextNightAt: 0,
    lastTriggered: -1000000
  };
}

function ensureCrystals(now) {
  if (!Array.isArray(state.crystals) || state.crystals.length !== BASES.length) {
    state.crystals = BASES.map(makeCrystal);
    for (let i = 0; i < state.crystals.length; i++) {
      const c = state.crystals[i];
      c.nextNightAt = now + 12000 + Math.floor(seeded(9000 + i * 137) * 6001);
    }
  }
  for (let i = 0; i < state.crystals.length; i++) {
    const c = state.crystals[i];
    const cl = clampOnIslandFloat(c.baseGx, c.baseGy);
    c.gx = cl.gx;
    c.gy = cl.gy;
    if (!c.nextNightAt) c.nextNightAt = now + 12000 + Math.floor(seeded(9000 + i * 137) * 6001);
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv) return;
  ensureCrystals(now);
  const visitor = (typeof window !== 'undefined') ? window.GuildVisitor : null;
  const crystals = state.crystals;
  for (let i = 0; i < crystals.length; i++) {
    const c = crystals[i];
    const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
    if (dl < 0.3) {
      if (now >= c.nextNightAt) {
        c.nightGlint.active = true;
        c.nightGlint.start = now;
        state.lastNightGlint = now;
        c.nextNightAt = now + 12000 + Math.floor(seeded(now * 0.001 + i * 3.7) * 6001);
      }
    } else {
      if (c.nextNightAt < now) c.nextNightAt = now + 12000;
    }

    if (visitor && Vv.gameState === 'play') {
      const dist = Math.hypot(visitor.gx - c.gx, visitor.gy - c.gy);
      if (dist <= 1.5 && (now - c.lastTriggered) >= 4000) {
        c.lastTriggered = now;
        state.lastChimeAt = now;
        try {
          const w = root();
          if (w && typeof w.cue === 'function') w.cue('pop');
        } catch (e) {}
        c.sizePulse.active = true;
        c.sizePulse.start = now;
        c.sparkle.active = true;
        c.sparkle.start = now;
        const pt = isoFn(c.gx, c.gy);
        c.note.active = true;
        c.note.start = now;
        c.note.x = Math.round(pt.x);
        c.note.y = Math.round(pt.y - 10);
      }
    }
  }
}

function drawSparkle(ctx, x, y, ageMs, durationMs, arms, alphaMax) {
  const progress = ageMs / durationMs;
  if (progress < 0 || progress >= 1) return;
  const alpha = (1 - progress) * alphaMax;
  const arm = Math.max(3, Math.round(arms));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x) - Math.floor(arm * 0.5), Math.round(y), arm, 1);
  ctx.fillRect(Math.round(x), Math.round(y) - Math.floor(arm * 0.5), 1, arm);
  ctx.restore();
}

function drawCrystal(ctx, c, now) {
  const pt = isoFn(c.gx, c.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  let pulseMul = 1;
  if (c.sizePulse.active) {
    const progress = (now - c.sizePulse.start) / c.sizePulse.duration;
    if (progress >= 1) c.sizePulse.active = false;
    else pulseMul = 1 + 0.32 * (1 - progress);
  }

  const cluster = [
    { dx: -3, dy: -2, w: 2, h: 5 },
    { dx: -1, dy: -7, w: 3, h: 9 },
    { dx: 2, dy: -3, w: 2, h: 4 },
    { dx: 0, dy: 1, w: 2, h: 2 }
  ];

  ctx.save();
  for (let i = 0; i < cluster.length; i++) {
    const q = cluster[i];
    const w = Math.max(1, Math.round(q.w * pulseMul));
    const h = Math.max(1, Math.round(q.h * pulseMul));
    const dx = Math.round(q.dx * pulseMul);
    const dy = Math.round(q.dy * pulseMul);
    ctx.fillStyle = c.color;
    ctx.fillRect(x + dx, y + dy, w, h);
  }

  const twinkle = 0.16 + 0.14 * (0.5 + 0.5 * Math.sin(now * 0.0037 + (c.color.length)));
  ctx.globalAlpha = twinkle;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1, y - 6, 1, 1);
  ctx.globalAlpha = 1;
  ctx.restore();

  if (c.sparkle.active) {
    const age = now - c.sparkle.start;
    if (age >= c.sparkle.duration) c.sparkle.active = false;
    else drawSparkle(ctx, x, y - 6, age, c.sparkle.duration, 5, 0.95);
  }

  if (c.nightGlint.active) {
    const age = now - c.nightGlint.start;
    if (age >= c.nightGlint.duration) c.nightGlint.active = false;
    else drawSparkle(ctx, x, y - 5, age, c.nightGlint.duration, 3, 0.55);
  }

  if (c.note.active) {
    const ageMs = now - c.note.start;
    const duration = 900;
    if (ageMs >= duration) c.note.active = false;
    else {
      const progress = ageMs / duration;
      const alpha = Math.max(0, 1 - progress);
      const ny = c.note.y - progress * 22;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e8e6df';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u266A', c.note.x, Math.round(ny));
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }
}

function draw(ctx) {
  if (!ctx) return;
  const now = nowFn();
  const Vv = getV();
  if (!Vv || !Vv.grid) return;
  ensureCrystals(now);
  for (let i = 0; i < state.crystals.length; i++) drawCrystal(ctx, state.crystals[i], now);
}

if (typeof window !== 'undefined') {
  state.update = update;
  state.draw = draw;
  state.__probe = function () {
    const n = nowFn();
    const last = state.lastChimeAt;
    return {
      crystals: Array.isArray(state.crystals) ? state.crystals.length : 0,
      lastChime: (typeof last === 'number' && last >= 0) ? Math.max(0, Math.round(n - last)) : -1
    };
  };
  window.GuildCrystalChime = state;
}
