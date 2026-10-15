function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildSkyIsles; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

const LAYERS = [
  { rank: 0, w: 6, alpha: 0.42, baseSpeed: 7, bobAmp: 1.4, bobSpeed: 0.62, capH: 2, keelH: 3 },
  { rank: 1, w: 10, alpha: 0.70, baseSpeed: 13, bobAmp: 2.0, bobSpeed: 0.83, capH: 2, keelH: 4 },
  { rank: 2, w: 14, alpha: 0.92, baseSpeed: 22, bobAmp: 2.8, bobSpeed: 1.07, capH: 3, keelH: 4 }
];

let lastTime = null;
let lastDrawNow = null;

function makeIsles(W, H, now) {
  const st = getState();
  if (!st) return;
  const arr = [];
  for (let li = 0; li < LAYERS.length; li++) {
    const L = LAYERS[li];
    const s1 = seeded(9100 + li * 79);
    const s2 = seeded(9200 + li * 83);
    const s3 = seeded(9300 + li * 89);
    const s4 = seeded(9400 + li * 97);
    arr.push({
      rank: L.rank,
      index: li,
      w: L.w,
      alpha: L.alpha,
      baseSpeed: L.baseSpeed,
      bobAmp: L.bobAmp,
      bobSpeed: L.bobSpeed,
      capH: L.capH,
      keelH: L.keelH,
      x: (s1 * (W + 60)) - 30,
      y: H * (0.13 + li * 0.045 + s2 * 0.05),
      phase: s3 * Math.PI * 2,
      nextGlint: 40 + s4 * 12,
      glint: 0,
      variant: seeded(9500 + li * 13) < 0.5 ? 'pine' : 'crystal',
      seed: 9100 + li * 79
    });
  }
  st.isles = arr;
  if (!st.t0) st.t0 = now;
  st._w = W;
  st._h = H;
}

function ensureIsles(st, Vv, now) {
  const W = Vv.canvas.width;
  const H = Vv.canvas.height;
  if (!Array.isArray(st.isles) || st.isles.length !== LAYERS.length || st._w !== W || st._h !== H) {
    makeIsles(W, H, now);
  }
  if (!st.t0) st.t0 = now;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || !Vv.canvas || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  ensureIsles(st, Vv, now);
  const W = Vv.canvas.width;
  const rain = Vv.weather === 'RAIN';
  const speedMul = rain ? 1.75 : 1;
  const wind = (typeof Vv.wind === 'number') ? Vv.wind : 0;
  const isles = st.isles;

  for (let i = 0; i < isles.length; i++) {
    const isle = isles[i];
    isle.nextGlint -= dt;
    if (isle.nextGlint <= 0) {
      isle.glint = 0.5;
      const r = seeded(isle.seed + now * 0.000001);
      isle.nextGlint = 40 + r * 12;
    }
    if (isle.glint > 0) isle.glint = Math.max(0, isle.glint - dt);

    const layerWind = wind * (0.4 + isle.rank * 0.3);
    const speed = (isle.baseSpeed + layerWind) * speedMul;
    isle.x += speed * dt;
    isle.phase += isle.bobSpeed * dt;

    const margin = isle.w + 24;
    if (isle.x > W + margin) {
      isle.x = -margin + (seeded(isle.seed + now * 0.000003) * 6);
    }
  }
}

function draw(ctx, nowArg) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || !Vv.canvas || Vv.gameState !== 'play' || !ctx) return;

  const now = (typeof nowArg === 'number') ? nowArg : nowFn();
  if (lastDrawNow === now) return;
  lastDrawNow = now;

  ensureIsles(st, Vv, now);
  const canvas = Vv.canvas;
  const W = canvas.width;
  const H = canvas.height;
  const rain = Vv.weather === 'RAIN';
  const dim = rain ? 0.82 : 1;

  let saved = false;
  try { ctx.save(); saved = true; } catch (e) { saved = false; }
  try {
    if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
    else if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
  } catch (e) {}

  const isles = (Array.isArray(st.isles) ? st.isles.slice() : []).sort(function (a, b) {
    return (a.rank || 0) - (b.rank || 0);
  });

  for (let i = 0; i < isles.length; i++) {
    const isle = isles[i];
    const bob = Math.sin(isle.phase) * isle.bobAmp;
    const X = Math.round(isle.x);
    const Y = Math.round(isle.y + bob);
    const w = isle.w;

    ctx.globalAlpha = isle.alpha * dim;

    ctx.fillStyle = (isle.rank === 2) ? '#92da7e' : ((isle.rank === 1) ? '#7bc96f' : '#68b55a');
    ctx.fillRect(X - Math.round(w / 2), Y, w, isle.capH);

    ctx.fillStyle = (isle.rank === 0) ? '#5a5048' : ((isle.rank === 1) ? '#4f463f' : '#453d37');
    const keelW = Math.max(2, w - 1);
    ctx.fillRect(X - Math.round(keelW / 2), Y + isle.capH, keelW, isle.keelH);

    if (isle.variant === 'crystal') {
      ctx.fillStyle = (isle.rank === 2) ? '#93c5fd' : '#7dd3fc';
      const crystalH = (isle.rank === 2) ? 3 : 2;
      ctx.fillRect(X - 1, Y - crystalH, 2, crystalH);
      if (isle.rank === 2) ctx.fillRect(X, Y - 4, 1, 1);
    } else {
      ctx.fillStyle = (isle.rank === 2) ? '#2f7d4f' : '#256440';
      const pineH = (isle.rank === 2) ? 4 : 3;
      ctx.fillRect(X, Y - pineH, 1, pineH);
      if (isle.rank === 2) ctx.fillRect(X - 1, Y - 2, 1, 1);
    }

    if (isle.glint > 0) {
      const t = isle.glint / 0.5;
      ctx.globalAlpha = (isle.alpha * dim) * Math.max(0, Math.min(1, t));
      ctx.fillStyle = '#ffffff';
      const glintW = (isle.rank === 0) ? 1 : 2;
      const glintX = X + Math.round(w / 2) - ((isle.rank === 0) ? 2 : ((isle.rank === 1) ? 3 : 4));
      ctx.fillRect(glintX, Y - 1, glintW, 1);
    }

    ctx.globalAlpha = 1;
  }

  if (saved) {
    try { ctx.restore(); } catch (e) {}
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildSkyIsles) window.GuildSkyIsles = { isles: [], t0: 0 };
  const st = window.GuildSkyIsles;
  if (!Array.isArray(st.isles)) st.isles = [];
  if (typeof st.t0 !== 'number') st.t0 = 0;

  st.update = update;
  st.draw = draw;
  st.drawBackdrop = draw;
  st.__probe = function () {
    const s = getState() || st;
    return {
      isles: Array.isArray(s.isles) ? s.isles.map(function (i) {
        return { rank: i.rank, x: i.x, y: i.y, glint: i.glint, nextGlint: i.nextGlint };
      }) : [],
      t0: s.t0,
      lastDrawNow: lastDrawNow,
      lastUpdate: lastTime
    };
  };
}

export {};
