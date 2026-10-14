const ROOST_DEFS = [
  { gx: -2.6, gy: -4.4 },
  { gx: -1.2, gy: -5.0 }
];

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

function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function ensureState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildRoost || typeof w.GuildRoost !== 'object') w.GuildRoost = { poles: [], feathers: [] };
  const R = w.GuildRoost;
  if (!Array.isArray(R.poles)) R.poles = [];
  if (!Array.isArray(R.feathers)) R.feathers = [];
  if (!Array.isArray(R._perchers)) R._perchers = [];
  if (!R._meta || typeof R._meta !== 'object') R._meta = { nextBird: null, featherWaveDone: false, lastNow: null };
  return R;
}

function clampPole(gx, gy, s) {
  const minC = -2 - (s || 0);
  const maxC = 1 + (s || 0);
  return {
    gx: Math.max(minC, Math.min(maxC, gx)),
    gy: Math.max(minC, Math.min(maxC, gy))
  };
}

function aviaryBirdCount() {
  const w = root();
  const a = w && w.GuildAviary;
  if (!a) return 0;
  try {
    if (typeof a.__probe === 'function') {
      const p = a.__probe();
      if (p && typeof p === 'object') {
        const keys = ['birds', 'birdCount', 'count', 'total', 'amount'];
        for (let i = 0; i < keys.length; i++) {
          const v = p[keys[i]];
          if (typeof v === 'number' && isFinite(v)) return v;
          if (Array.isArray(v)) return v.length;
        }
      } else if (typeof p === 'number' && isFinite(p)) {
        return p;
      }
    }
  } catch (e) {}
  if (typeof a.birds === 'number' && isFinite(a.birds)) return a.birds;
  if (Array.isArray(a.birds)) return a.birds.length;
  if (typeof a.count === 'number' && isFinite(a.count)) return a.count;
  return 0;
}

function update(now) {
  try {
    if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
    const R = ensureState();
    if (!R) return;
    const Vv = getV();
    if (!Vv || Vv.gameState !== 'play') return;

    const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
    const poles = [];
    for (let i = 0; i < ROOST_DEFS.length; i++) {
      const pos = clampPole(ROOST_DEFS[i].gx, ROOST_DEFS[i].gy, s);
      poles.push({ gx: pos.gx, gy: pos.gy });
    }
    R.poles = poles;

    const perchers = R._perchers;
    const alive = [];
    for (let i = 0; i < perchers.length; i++) {
      const b = perchers[i];
      if (b && typeof b.start === 'number' && now - b.start < b.duration) alive.push(b);
    }
    R._perchers = alive;

    const meta = R._meta;
    if (meta.lastNow == null) meta.lastNow = now;
    let dt = (now - meta.lastNow) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    meta.lastNow = now;

    const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 0;
    if (dl >= 0.2 && dl <= 0.5) {
      if (!meta.featherWaveDone) {
        const featherCount = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < featherCount; i++) {
          const pole = R.poles[Math.floor(Math.random() * R.poles.length)] || ROOST_DEFS[0];
          const base = isoFn(pole.gx, pole.gy);
          R.feathers.push({
            x: base.x + (Math.random() - 0.5) * 8,
            y: base.y - 34 - Math.random() * 4,
            vx: (Math.random() - 0.5) * 6,
            vy: 18 + Math.random() * 14,
            age: 0,
            life: 3
          });
        }
        meta.featherWaveDone = true;
      }

      const wind = (typeof Vv.wind === 'number') ? Vv.wind : 0;
      const nextFeathers = [];
      for (let i = 0; i < R.feathers.length; i++) {
        const f = R.feathers[i];
        if (!f) continue;
        f.age += dt;
        if (f.age >= 3) continue;
        f.x += (f.vx + wind * 2) * dt;
        f.y += f.vy * dt;
        f.vy += 2 * dt;
        nextFeathers.push(f);
      }
      R.feathers = nextFeathers;
    } else {
      meta.featherWaveDone = false;
      R.feathers = [];
    }

    if (meta.nextBird == null) meta.nextBird = now + 25000 + Math.random() * 25000;
    if (now >= meta.nextBird) {
      const free = [];
      for (let i = 0; i < R.poles.length; i++) {
        if (!alive.some(function (b) { return b.pole === i; })) free.push(i);
      }
      if (free.length > 0) {
        const poleIndex = free[Math.floor(Math.random() * free.length)];
        const ghost = aviaryBirdCount() > 0;
        const duration = 4000 + Math.random() * 4000;
        const start = now;
        const peckTimes = [start + duration * 0.22, start + duration * 0.58];
        R._perchers.push({ pole: poleIndex, start: start, duration: duration, ghost: ghost, pecks: peckTimes });
      }
      meta.nextBird = now + 25000 + Math.random() * 25000;
    }
  } catch (e) {}
}

function drawPole(ctx, pole, now) {
  const base = isoFn(pole.gx, pole.gy);
  const x = Math.round(base.x);
  const y = Math.round(base.y);

  ctx.fillStyle = '#c9b086';
  ctx.fillRect(x - 9, y - 2, 4, 2);
  ctx.fillRect(x + 5, y - 3, 4, 2);
  ctx.fillRect(x - 3, y - 4, 3, 2);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 2, y - 46, 4, 48);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 3, y - 30, 6, 3);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 14, y - 41, 28, 3);

  ctx.fillStyle = '#e8d5a3';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y - 37, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 10, y - 39, 20, 6);
  }

  ctx.strokeStyle = '#8a6f3f';
  ctx.lineWidth = 1;
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y - 37, 10, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(x - 10, y - 39, 20, 6);
  }
}

function drawBird(ctx, pole, bird, now) {
  const base = isoFn(pole.gx, pole.gy);
  const x = Math.round(base.x);
  const y = Math.round(base.y) - 37;
  const pecking = Array.isArray(bird.pecks) && bird.pecks.some(function (t) { return now >= t && now < t + 250; });
  const headY = pecking ? y - 8 + 2 : y - 8;
  const frame = Math.floor(now / 130) % 2;

  ctx.save();
  ctx.globalAlpha = bird.ghost ? 0.55 : 1;
  ctx.fillStyle = bird.ghost ? '#1f2530' : '#3b2b1f';
  ctx.fillRect(x - 3, y - 6, 7, 5);
  ctx.fillRect(x + 2, headY, 3, 3);
  ctx.fillRect(x - 5, y - 5, 2, 2);
  if (frame) ctx.fillRect(x - 2, y - 9, 4, 2);
  else ctx.fillRect(x - 1, y - 8, 3, 2);
  ctx.restore();
}

function draw(ctx) {
  try {
    const R = ensureState();
    const Vv = getV();
    if (!ctx || !R || !Vv || Vv.gameState !== 'play') return;
    const now = nowFn();

    for (let i = 0; i < R.poles.length; i++) {
      drawPole(ctx, R.poles[i] || ROOST_DEFS[i] || ROOST_DEFS[0], now);
    }

    for (let i = 0; i < R._perchers.length; i++) {
      const b = R._perchers[i];
      const pole = R.poles[b.pole] || R.poles[0];
      if (pole) drawBird(ctx, pole, b, now);
    }

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < R.feathers.length; i++) {
      const f = R.feathers[i];
      if (!f) continue;
      ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  const R = ensureState();
  if (R) {
    R.update = update;
    R.draw = draw;
    R.__probe = function () {
      try {
        const r = ensureState();
        return {
          poles: Array.isArray(r.poles) ? r.poles.length : 0,
          perchers: Array.isArray(r._perchers) ? r._perchers.length : 0
        };
      } catch (e) {
        return { poles: 2, perchers: 0 };
      }
    };
  }
}

export {};
