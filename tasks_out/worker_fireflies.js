let lastTime = null;
let fadeLevel = 1;
let visitorLastMove = null;
let swarmMode = false;
let returning = false;
let returnStart = 0;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { const r = w.iso(gx, gy); if (r) return r; } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

function ensureState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildFireflies || typeof w.GuildFireflies !== 'object') w.GuildFireflies = { flies: [], grove: null };
  const st = w.GuildFireflies;
  if (!Array.isArray(st.flies)) st.flies = [];
  if (st.flies.length !== 14) {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      const seed = 9000 + i * 37;
      arr.push({
        seed: seed,
        phase: seeded(seed * 1.3) * Math.PI * 2,
        orbitR: 8 + seeded(seed * 2.1) * 12,
        swarmR: 14 + seeded(seed * 3.7) * 8,
        speed: 0.45 + seeded(seed * 4.9) * 0.45,
        x: NaN,
        y: NaN
      });
    }
    st.flies = arr;
  }
  return st;
}

function syncGrove(Vv, st) {
  if (!Vv || !st) return st ? st.grove : null;
  const raw = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const s = clamp(raw, 0, 8);
  const minC = -2 - s;
  const maxC = 1 + s;
  if (!st.grove || typeof st.grove !== 'object') st.grove = { gx: maxC - 1, gy: minC + 1 };
  else { st.grove.gx = maxC - 1; st.grove.gy = minC + 1; }
  return st.grove;
}

function drawGrove(ctx, st, now) {
  if (!ctx || !st || !st.grove) return;
  const pt = isoFn(st.grove.gx, st.grove.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  // Three small pixel pines with stacked dark-green foliage and brown trunks.
  const pines = [ { ox: -16, oy: -4 }, { ox: 0, oy: -10 }, { ox: 16, oy: -2 } ];
  for (let i = 0; i < pines.length; i++) {
    const px = x + pines[i].ox;
    const py = y + pines[i].oy;
    ctx.fillStyle = '#5b3a1d';
    ctx.fillRect(px - 1, py - 4, 2, 5);
    ctx.fillStyle = '#1f4d2b';
    ctx.fillRect(px - 5, py - 7, 11, 3);
    ctx.fillStyle = '#25562f';
    ctx.fillRect(px - 4, py - 10, 9, 3);
    ctx.fillStyle = '#2d6235';
    ctx.fillRect(px - 3, py - 13, 7, 3);
    ctx.fillStyle = '#35703c';
    ctx.fillRect(px - 2, py - 16, 5, 3);
  }

  // Two red-cap mushrooms.
  const mushrooms = [ { ox: -9, oy: 6 }, { ox: 9, oy: 8 } ];
  for (let i = 0; i < mushrooms.length; i++) {
    const mx = x + mushrooms[i].ox;
    const my = y + mushrooms[i].oy;
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(mx - 1, my - 3, 2, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(mx - 3, my - 6, 7, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 1, my - 5, 1, 1);
  }

  // A 3px pond dot.
  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(x - 1, y + 11, 3, 3);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = ensureState();
  if (!st) return;
  const Vv = getV();
  syncGrove(Vv, st);

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const dl = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const night = dl < 0.35;
  if (night) fadeLevel = 1;
  else fadeLevel = Math.max(0, fadeLevel - dt);
  st.fadeLevel = fadeLevel;

  const vis = getVisitor();
  if (vis) {
    if (vis.moving) visitorLastMove = now;
    else if (visitorLastMove === null) visitorLastMove = now;
  }

  const grove = st.grove;
  let shouldSwarm = false;
  if (night && grove && vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    const dist = Math.hypot(vis.gx - grove.gx, vis.gy - grove.gy);
    const idleMs = (visitorLastMove === null) ? 0 : (now - visitorLastMove);
    shouldSwarm = dist <= 2.5 && !vis.moving && idleMs >= 1500;
  }

  if (shouldSwarm) {
    swarmMode = true;
    returning = false;
    returnStart = 0;
  } else if (swarmMode) {
    swarmMode = false;
    returning = true;
    returnStart = now;
  } else if (returning && (now - returnStart >= 2000)) {
    returning = false;
  }

  const groveC = grove ? isoFn(grove.gx, grove.gy) : { x: 0, y: 0 };
  const visC = vis && isFinite(vis.gx) && isFinite(vis.gy) ? isoFn(vis.gx, vis.gy) : null;

  const swarmSpeed = 3.2;
  const returnSpeed = 0.95;
  const groveSpeed = 1.5;
  let rate = groveSpeed;
  if (swarmMode) rate = swarmSpeed;
  else if (returning) rate = returnSpeed;
  const k = 1 - Math.exp(-rate * dt);

  for (let i = 0; i < st.flies.length; i++) {
    const f = st.flies[i];
    if (!isFinite(f.x) || !isFinite(f.y)) {
      f.x = groveC.x;
      f.y = groveC.y;
    }

    let targetX;
    let targetY;
    if (swarmMode && visC) {
      const t = now * 0.0018 * (0.7 + f.speed * 0.6) + f.phase;
      targetX = visC.x + Math.cos(t) * f.swarmR;
      targetY = visC.y + Math.sin(t) * f.swarmR;
    } else {
      const t = now * 0.00085 * (0.7 + f.speed * 0.5) + f.phase;
      targetX = groveC.x + Math.cos(t) * f.orbitR;
      targetY = groveC.y + Math.sin(t) * f.orbitR;
    }

    f.x += (targetX - f.x) * k;
    f.y += (targetY - f.y) * k;
  }
}

function draw(ctx) {
  if (!ctx) return;
  const st = ensureState();
  if (!st) return;
  const Vv = getV();
  syncGrove(Vv, st);

  ctx.save();
  drawGrove(ctx, st, nowFn());

  if (fadeLevel <= 0.001) {
    ctx.restore();
    return;
  }
  const grove = st.grove;
  const base = grove ? isoFn(grove.gx, grove.gy) : { x: 0, y: 0 };
  for (let i = 0; i < st.flies.length; i++) {
    const f = st.flies[i];
    if (!isFinite(f.x)) f.x = base.x;
    if (!isFinite(f.y)) f.y = base.y;
    const x = f.x;
    const y = f.y;

    ctx.globalAlpha = fadeLevel * 0.28;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 8, 8);

    ctx.globalAlpha = fadeLevel;
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildFireflies) window.GuildFireflies = { flies: [], grove: null };
  const st = window.GuildFireflies;
  st.update = update;
  st.draw = draw;
  st.__rawUpdate = update;
  st.__probe = function () {
    return {
      flyCount: Array.isArray(st.flies) ? st.flies.length : 0,
      grove: st.grove,
      fadeLevel: fadeLevel,
      swarmMode: swarmMode,
      returning: returning
    };
  };
}

export {};
