const RING_SPOTS = [
  { gx: 3, gy: 4 },
  { gx: -6, gy: 3 },
  { gx: -5, gy: 4 }
];
const RING_DURATION = 90000;
const FADE_DURATION = 5000;
const SPROUT_DURATION = 2000;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildMushrooms; }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return null;
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function createState() {
  return {
    previousWeather: null,
    active: false,
    startedAt: null,
    fadeStartedAt: null,
    lastNow: null,
    rings: []
  };
}

function createRings(now) {
  const rings = [];
  for (let i = 0; i < RING_SPOTS.length; i++) {
    const spot = RING_SPOTS[i];
    const count = 5 + (i % 3);
    const mushrooms = [];
    for (let m = 0; m < count; m++) {
      mushrooms.push({ angle: (m / count) * Math.PI * 2 });
    }
    rings.push({
      id: i,
      gx: spot.gx,
      gy: spot.gy,
      count: count,
      mushrooms: mushrooms,
      spawnedAt: now
    });
  }
  return rings;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();

  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const w = root();
  if (!w || typeof w.iso !== 'function' && !(Vv && Vv.grid)) return;

  st.lastNow = now;

  const weather = Vv.weather;
  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 0;
  const wasPrevious = st.previousWeather;
  st.previousWeather = (weather == null) ? null : weather;

  if (st.active) {
    if (daylight > 0.8) {
      st.active = false;
      st.rings = [];
      st.startedAt = null;
      st.fadeStartedAt = null;
    } else if (st.startedAt != null && now - st.startedAt >= RING_DURATION) {
      if (st.fadeStartedAt == null) st.fadeStartedAt = now;
      if (now - st.fadeStartedAt >= FADE_DURATION) {
        st.active = false;
        st.rings = [];
        st.startedAt = null;
        st.fadeStartedAt = null;
      }
    }
  }

  if (!st.active && wasPrevious === 'RAIN' && weather !== 'RAIN') {
    st.startedAt = now;
    st.fadeStartedAt = null;
    st.rings = createRings(now);
    if (daylight > 0.8) {
      st.active = false;
      st.rings = [];
      st.startedAt = null;
      st.fadeStartedAt = null;
    } else {
      st.active = true;
    }
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv) return;
  if (!st.active || !Array.isArray(st.rings) || !st.rings.length) return;

  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 0;
  if (daylight > 0.8) {
    st.active = false;
    st.rings = [];
    st.startedAt = null;
    st.fadeStartedAt = null;
    return;
  }

  const now = (typeof st.lastNow === 'number') ? st.lastNow : nowFn();

  for (let i = 0; i < st.rings.length; i++) {
    const ring = st.rings[i];
    const age = now - ring.spawnedAt;
    const scale = clamp(age / SPROUT_DURATION, 0, 1);

    let fade = 1;
    if (st.fadeStartedAt != null) {
      fade = clamp(1 - (now - st.fadeStartedAt) / FADE_DURATION, 0, 1);
    }

    const pulse = 0.7 + 0.3 * Math.sin(now * 0.003 + ring.id * 1.7);
    const alpha = scale * fade * pulse;
    if (alpha <= 0.001) continue;

    const pt = isoFn(ring.gx, ring.gy);
    if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) continue;

    const cx = Math.round(pt.x);
    const cy = Math.round(pt.y);

    ctx.save();
    const haloRadius = 8 + 6 * scale;
    ctx.globalAlpha = alpha * 0.28;
    const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, haloRadius);
    grd.addColorStop(0, 'rgba(212, 175, 55, ' + (0.45 * alpha) + ')');
    grd.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    const mushRadius = 9 * scale;
    const size = Math.max(1, Math.round(2 * scale));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d4af37';
    for (let m = 0; m < ring.mushrooms.length; m++) {
      const mush = ring.mushrooms[m];
      const mx = cx + Math.cos(mush.angle) * mushRadius;
      const my = cy + Math.sin(mush.angle) * mushRadius;
      ctx.fillRect(Math.round(mx - size * 0.5), Math.round(my - size * 0.5), size, size);
    }

    ctx.fillStyle = '#f3d37a';
    ctx.globalAlpha = alpha * 0.7;
    for (let m = 0; m < ring.mushrooms.length; m++) {
      const mush = ring.mushrooms[m];
      const mx = cx + Math.cos(mush.angle) * mushRadius;
      const my = cy + Math.sin(mush.angle) * mushRadius;
      if (size > 1) ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
    }

    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function probe() {
  const st = getState();
  if (!st) return { active: false, rings: [] };
  return { active: !!st.active, rings: Array.isArray(st.rings) ? st.rings.slice() : [] };
}

if (typeof window !== 'undefined') {
  if (!window.GuildMushrooms) window.GuildMushrooms = createState();
  const gm = window.GuildMushrooms;
  gm.update = update;
  gm.draw = draw;
  gm.__probe = probe;
}

export {};
