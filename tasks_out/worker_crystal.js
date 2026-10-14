const root = () => (typeof window !== 'undefined' ? window : null);
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowMs() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

let lastTime = null;
const droplets = [];

const BASE_CENTERS = [
  [-5.8, -4.0],
  [-4.7, -3.7],
  [-4.0, -2.9],
  [-5.2, -2.1],
  [-4.3, -1.4]
];

function buildClusters() {
  const out = [];
  for (let i = 0; i < BASE_CENTERS.length; i++) {
    const base = BASE_CENTERS[i];
    const shardCount = 3 + Math.floor(seeded(300 + i * 13.7) * 2.999999);
    const shards = [];
    let accentPlaced = false;
    for (let j = 0; j < shardCount; j++) {
      const accent = (!accentPlaced && j === shardCount - 1);
      if (accent) accentPlaced = true;
      shards.push({
        ox: (seeded(400 + i * 19 + j * 3.1) - 0.5) * 0.65,
        oy: (seeded(500 + i * 17 + j * 2.7) - 0.5) * 0.65,
        height: 14 + seeded(600 + i * 23 + j * 4.3) * 12,
        width: 4 + Math.floor(seeded(700 + i * 29 + j * 5.9) * 3),
        accent: accent
      });
    }
    out.push({
      gx: base[0] + (seeded(800 + i * 31) - 0.5) * 0.7,
      gy: base[1] + (seeded(900 + i * 37) - 0.5) * 0.7,
      baseGx: base[0] + (seeded(800 + i * 31) - 0.5) * 0.7,
      baseGy: base[1] + (seeded(900 + i * 37) - 0.5) * 0.7,
      phase: seeded(1000 + i * 41) * Math.PI * 2,
      period: 2 + seeded(1100 + i * 43) * 2,
      shards: shards
    });
  }
  return out;
}

function makeSparkle(i, clusters) {
  const c = clusters[i % clusters.length];
  return {
    baseGx: c.baseGx + (seeded(1200 + i * 53) - 0.5) * 1.5,
    baseGy: c.baseGy + (seeded(1300 + i * 59) - 0.5) * 1.5,
    gx: c.baseGx,
    gy: c.baseGy,
    phase: seeded(1400 + i * 61) * Math.PI * 2,
    twinkleSpeed: 0.9 + seeded(1500 + i * 67) * 1.6,
    gold: seeded(1600 + i * 71) < 0.4
  };
}

const state = (typeof window !== 'undefined' && window.GuildCrystal && typeof window.GuildCrystal === 'object')
  ? window.GuildCrystal
  : { crystals: [], sparkles: [] };
state.crystals = buildClusters();
state.sparkles = [];
for (let i = 0; i < 7; i++) state.sparkles.push(makeSparkle(i, state.crystals));

function syncPositions(Vv) {
  if (!Vv || !Vv.grid) return;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  for (let i = 0; i < state.crystals.length; i++) {
    const c = state.crystals[i];
    c.gx = clamp(c.baseGx, minC, maxC);
    c.gy = clamp(c.baseGy, minC, maxC);
  }
  for (let i = 0; i < state.sparkles.length; i++) {
    const sp = state.sparkles[i];
    sp.gx = clamp(sp.baseGx, minC, maxC);
    sp.gy = clamp(sp.baseGy, minC, maxC);
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowMs();
  const Vv = getV();
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  syncPositions(Vv);

  const daylight = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 0.5;
  const night = daylight < 0.35;
  const deepNight = daylight < 0.15;

  let targetSparkles = night ? 10 : 7;
  while (state.sparkles.length < targetSparkles) {
    state.sparkles.push(makeSparkle(state.sparkles.length, state.crystals));
  }
  while (state.sparkles.length > targetSparkles) state.sparkles.pop();

  for (let i = 0; i < state.sparkles.length; i++) {
    const sp = state.sparkles[i];
    sp.phase += dt * sp.twinkleSpeed;
  }

  if (Vv && Vv.weather === 'RAIN') {
    for (let i = 0; i < state.crystals.length; i++) {
      if (Math.random() < 0.35 * dt) {
        const c = state.crystals[i];
        droplets.push({
          gx: c.gx + (Math.random() - 0.5) * 0.25,
          gy: c.gy + (Math.random() - 0.5) * 0.25,
          y: -10 - Math.random() * 6,
          vy: 20 + Math.random() * 20,
          life: 0,
          maxLife: 0.7 + Math.random() * 0.4
        });
      }
    }
  }

  const nextDroplets = [];
  for (let i = 0; i < droplets.length; i++) {
    const d = droplets[i];
    d.life += dt;
    if (d.life >= d.maxLife) continue;
    d.vy += 45 * dt;
    d.y += d.vy * dt;
    nextDroplets.push(d);
  }
  droplets.length = 0;
  for (let i = 0; i < nextDroplets.length; i++) droplets.push(nextDroplets[i]);
}

function draw(ctx) {
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  if (!Vv.grid) return;
  const w = root();
  if (!w || (typeof w.iso !== 'function' && !(Vv && Vv.grid))) return;

  syncPositions(Vv);
  const now = nowMs();
  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 0.5;
  const night = daylight < 0.35;
  const deepNight = daylight < 0.15;

  for (let i = 0; i < state.crystals.length; i++) {
    const crystal = state.crystals[i];
    const center = isoFn(crystal.gx, crystal.gy);
    const wave = 0.5 + 0.5 * Math.sin((now / 1000) / crystal.period * Math.PI * 2 + crystal.phase);

    let glowAlpha;
    if (deepNight) glowAlpha = 0.18 + 0.12 * wave;
    else if (night) glowAlpha = 0.13 + 0.09 * wave;
    else glowAlpha = 0.10 + 0.12 * wave;
    glowAlpha = clamp(glowAlpha, 0.08, 0.30);

    const radius = 20 + wave * 8;
    if (ctx.createRadialGradient) {
      const grad = ctx.createRadialGradient(center.x, center.y - 8, 2, center.x, center.y - 8, radius);
      grad.addColorStop(0, 'rgba(103,232,249,' + glowAlpha + ')');
      grad.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(center.x, center.y - 8, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(Math.round(center.x - radius * 0.5), Math.round(center.y - 8 - radius * 0.5), Math.round(radius), Math.round(radius));
      ctx.globalAlpha = 1;
    }

    if (night) {
      const haloAlpha = deepNight ? 0.20 : 0.11;
      ctx.globalAlpha = haloAlpha;
      ctx.fillStyle = '#67e8f9';
      const haloW = deepNight ? 24 : 16;
      ctx.fillRect(Math.round(center.x - haloW * 0.5), Math.round(center.y + 2), haloW, 1);
      if (deepNight) {
        ctx.fillRect(Math.round(center.x - (haloW + 4) * 0.5), Math.round(center.y + 4), haloW + 4, 1);
      }
      ctx.globalAlpha = 1;
    }

    for (let j = 0; j < crystal.shards.length; j++) {
      const shard = crystal.shards[j];
      const sp = isoFn(crystal.gx + shard.ox, crystal.gy + shard.oy);
      const tipX = Math.round(sp.x);
      const tipY = Math.round(sp.y - shard.height);
      const footX = Math.round(sp.x);
      const footY = Math.round(sp.y);
      const hw = Math.max(1, Math.round(shard.width * 0.5));
      const pts = [
        { x: tipX, y: tipY },
        { x: footX - hw, y: footY },
        { x: footX - Math.max(1, hw - 1), y: footY + 2 },
        { x: footX + Math.max(1, hw - 1), y: footY + 2 },
        { x: footX + hw, y: footY }
      ];
      ctx.beginPath();
      for (let p = 0; p < pts.length; p++) {
        if (p === 0) ctx.moveTo(pts[p].x, pts[p].y);
        else ctx.lineTo(pts[p].x, pts[p].y);
      }
      ctx.closePath();
      ctx.fillStyle = shard.accent ? '#a78bfa' : '#67e8f9';
      ctx.fill();
      ctx.strokeStyle = '#0891b2';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tipX - 1, tipY, 2, 1);
      ctx.fillRect(tipX, tipY + 1, 1, 1);
    }
  }

  for (let i = 0; i < state.sparkles.length; i++) {
    const sparkle = state.sparkles[i];
    const sp = isoFn(sparkle.gx, sparkle.gy);
    const tw = 0.5 + 0.5 * Math.sin((now / 1000) * sparkle.twinkleSpeed + sparkle.phase);
    const nightBoost = night ? 1.25 : 0.85;
    const alpha = clamp(tw * nightBoost, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = sparkle.gold ? '#facc15' : '#ffffff';
    const x = Math.round(sp.x);
    const y = Math.round(sp.y);
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillRect(x, y - 1, 1, 3);
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < droplets.length; i++) {
    const d = droplets[i];
    const p = isoFn(d.gx, d.gy);
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(Math.round(p.x), Math.round(p.y + d.y), 1, 1);
  }
}

if (typeof window !== 'undefined') {
  window.GuildCrystal = state;
  state.update = update;
  state.draw = draw;
  state.__probe = function () { return { crystals: state.crystals.length, sparkles: state.sparkles.length }; };
}

export {};
