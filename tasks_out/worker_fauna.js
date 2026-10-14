const PATCH_GX = -1;
const PATCH_GY = 0;
const PATCH_SIZE = 4;
const BIRD_COUNT = 3;
const PECK_CYCLE = 0.9;
const HOP_INTERVAL = 3.2;
const FLY_INTERVAL = 10;
const FLY_DURATION = 2.0;
const SCATTER_DIST_TILES = 1.2;
const SCATTER_COOLDOWN = 3.0;
const SCATTER_RISE = 20;
const SCATTER_FLAP = 0.5;
const WING_FLAP = 2;
const SHADOW_W = 3;
const SHADOW_H = 1;
const BODY_W = 5;
const BODY_H = 5;
const HEAD_W = 3;
const HEAD_H = 3;
const BEAK_W = 1;
const BEAK_H = 2;

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
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function tryCue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function randSeed(seed) {
  let x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

function createBird(id) {
  const gx = PATCH_GX + randSeed(1000 + id * 7.3) * (PATCH_SIZE - 1);
  const gy = PATCH_GY + randSeed(2000 + id * 11.9) * (PATCH_SIZE - 1);
  return {
    id: id,
    gx: gx,
    gy: gy,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    state: 'peck',
    t: randSeed(3000 + id * 13.1) * 4,
    targetGx: gx,
    targetGy: gy,
    flapPhase: 0,
    scatterT: 0,
    lastScatter: 0,
    bobOffset: 0
  };
}

function initBirds() {
  const birds = [];
  for (let i = 0; i < BIRD_COUNT; i++) birds.push(createBird(i));
  return birds;
}

function birdPatchCenter() {
  return { gx: PATCH_GX + (PATCH_SIZE - 1) * 0.5, gy: PATCH_GY + (PATCH_SIZE - 1) * 0.5 };
}

function birdInPatch(b) {
  const cx = birdPatchCenter();
  const minGx = cx.gx - (PATCH_SIZE - 1) * 0.5;
  const maxGx = cx.gx + (PATCH_SIZE - 1) * 0.5;
  const minGy = cx.gy - (PATCH_SIZE - 1) * 0.5;
  const maxGy = cx.gy + (PATCH_SIZE - 1) * 0.5;
  return b.gx >= minGx && b.gx <= maxGx && b.gy >= minGy && b.gy <= maxGy;
}

function snapToPatch(b) {
  const cx = birdPatchCenter();
  const minGx = cx.gx - (PATCH_SIZE - 1) * 0.5;
  const maxGx = cx.gx + (PATCH_SIZE - 1) * 0.5;
  const minGy = cx.gy - (PATCH_SIZE - 1) * 0.5;
  const maxGy = cx.gy + (PATCH_SIZE - 1) * 0.5;
  if (b.gx < minGx) b.gx = minGx;
  if (b.gx > maxGx) b.gx = maxGx;
  if (b.gy < minGy) b.gy = minGy;
  if (b.gy > maxGy) b.gy = maxGy;
}

function visitorTileDist(b) {
  const vis = getVisitor();
  if (!vis || typeof vis.gx !== 'number' || typeof vis.gy !== 'number') return Infinity;
  const g = getV() && getV().grid;
  if (!g) return Infinity;
  const dx = vis.gx - b.gx;
  const dy = vis.gy - b.gy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function startScatter(b) {
  const now = nowFn();
  if (now - b.lastScatter < SCATTER_COOLDOWN * 1000) return;
  b.lastScatter = now;
  b.state = 'air';
  b.scatterT = 0;
  b.vx = 0;
  b.vy = 0;
  const cx = birdPatchCenter();
  const angle = randSeed(5000 + b.id * 17.3) * Math.PI * 2;
  const dist = 2.5 + randSeed(6000 + b.id * 19.7) * 1.5;
  b.targetGx = cx.gx + Math.cos(angle) * dist;
  b.targetGy = cx.gy + Math.sin(angle) * dist;
  snapToPatch(b);
  tryCue('pop');
}

function updateBird(b, dt, now) {
  b.t += dt;
  const pt = isoFn(b.gx, b.gy);
  b.x = pt.x;
  b.y = pt.y;

  if (b.state === 'air') {
    b.scatterT += dt;
    const progress = b.scatterT / SCATTER_FLAP;
    if (progress >= 1) {
      b.state = 'peck';
      b.t = 0;
      b.scatterT = 0;
      b.vx = 0;
      b.vy = 0;
      b.gx = b.targetGx;
      b.gy = b.targetGy;
      snapToPatch(b);
      const pt2 = isoFn(b.gx, b.gy);
      b.x = pt2.x;
      b.y = pt2.y;
      return;
    }
    const rise = SCATTER_RISE * Math.sin(progress * Math.PI);
    b.y -= rise;
    b.flapPhase = progress * Math.PI * 4;
    const cx = birdPatchCenter();
    const dx = b.targetGx - b.gx;
    const dy = b.targetGy - b.gy;
    b.gx += dx * dt / SCATTER_FLAP;
    b.gy += dy * dt / SCATTER_FLAP;
    const pt3 = isoFn(b.gx, b.gy);
    b.x = pt3.x;
    b.y = pt3.y - rise;
    return;
  }

  if (b.state === 'hop') {
    b.t += dt;
    if (b.t >= HOP_INTERVAL) {
      b.t = 0;
      b.state = 'peck';
    }
    return;
  }

  b.state = 'peck';
  if (b.t >= PECK_CYCLE) {
    b.t = 0;
    if (randSeed(7000 + b.id * 23.1 + now * 0.001) < 0.5) {
      b.state = 'hop';
      b.t = 0;
      const cx = birdPatchCenter();
      const angle = randSeed(8000 + b.id * 29.3) * Math.PI * 2;
      const step = 0.6 + randSeed(9000 + b.id * 31.7) * 0.6;
      b.targetGx = b.gx + Math.cos(angle) * step;
      b.targetGy = b.gy + Math.sin(angle) * step;
      snapToPatch(b);
      const pt2 = isoFn(b.gx, b.gy);
      b.x = pt2.x;
      b.y = pt2.y;
    }
  }
  if (b.t >= FLY_INTERVAL + randSeed(4000 + b.id * 13.1) * 4) {
    b.state = 'air';
    b.scatterT = 0;
    b.vx = 0;
    b.vy = 0;
    const cx = birdPatchCenter();
    const angle = randSeed(5000 + b.id * 17.3) * Math.PI * 2;
    const dist = 1.5 + randSeed(6000 + b.id * 19.7) * 1.0;
    b.targetGx = cx.gx + Math.cos(angle) * dist;
    b.targetGy = cx.gy + Math.sin(angle) * dist;
    snapToPatch(b);
    tryCue('pop');
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  if (!w) return;
  const Vv = w.V;
  if (!Vv || Vv.gameState !== 'play') return;
  const fauna = w.GuildFauna;
  if (!fauna || !Array.isArray(fauna.birds)) return;
  if (fauna.birds.length === 0) {
    fauna.birds = initBirds();
  }
  let dt = 0;
  if (fauna._lastTime != null && isFinite(fauna._lastTime)) {
    dt = (now - fauna._lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
  }
  fauna._lastTime = now;

  const birds = fauna.birds;
  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    const dist = visitorTileDist(b);
    if (dist < SCATTER_DIST_TILES) {
      startScatter(b);
    }
    updateBird(b, dt, now);
  }
}

function drawBird(ctx, b, now) {
  if (!ctx) return;
  const pt = isoFn(b.gx, b.gy);
  let x = Math.round(pt.x);
  let y = Math.round(pt.y);

  if (b.state === 'air') {
    const rise = SCATTER_RISE * Math.sin((b.scatterT / SCATTER_FLAP) * Math.PI);
    y -= rise;
    const flap = Math.sin(b.flapPhase) > 0 ? WING_FLAP : 0;
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(x - Math.round(BODY_W * 0.5) + flap, y - 4, BODY_W, BODY_H);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x - Math.round(HEAD_W * 0.5) + flap, y - 7, HEAD_W, HEAD_H);
    ctx.fillStyle = '#f59540';
    ctx.fillRect(x + 2 + flap, y - 6, BEAK_W, BEAK_H);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(x - Math.round(BODY_W * 0.5) - 2 + flap, y - 2, 2, 4);
    ctx.fillRect(x + BODY_W - Math.round(BODY_W * 0.5) + flap, y - 2, 2, 4);
    return;
  }

  const peckBob = (Math.sin(b.t * Math.PI * 2 / PECK_CYCLE) > 0.3) ? 1 : 0;
  const hopBob = (b.state === 'hop') ? Math.round(Math.sin(b.t * Math.PI * 2 / HOP_INTERVAL) * 1) : 0;
  const bob = peckBob + hopBob;
  y += bob;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  if (ctx.ellipse) {
    ctx.ellipse(x + BODY_W * 0.5, y + BODY_H + 2, SHADOW_W, SHADOW_H, 0, 0, Math.PI * 2);
  } else {
    ctx.fillRect(x, y + BODY_H, SHADOW_W, SHADOW_H);
  }
  ctx.fill();

  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x, y, BODY_W, BODY_H);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x + 1, y - 2, HEAD_W, HEAD_H);
  ctx.fillStyle = '#f59540';
  ctx.fillRect(x + 3, y - 1, BEAK_W, BEAK_H);
}

function draw(ctx) {
  const w = root();
  if (!w) return;
  const Vv = w.V;
  if (!Vv || Vv.gameState !== 'play') return;
  const fauna = w.GuildFauna;
  if (!fauna || !Array.isArray(fauna.birds)) return;
  if (fauna.birds.length === 0) return;
  const now = nowFn();
  const birds = fauna.birds;
  for (let i = 0; i < birds.length; i++) {
    drawBird(ctx, birds[i], now);
  }
}

function probe() {
  const w = root();
  if (!w) return { birds: 0 };
  const fauna = w.GuildFauna;
  if (!fauna || !Array.isArray(fauna.birds)) return { birds: 0 };
  return { birds: fauna.birds.length };
}

if (typeof window !== 'undefined') {
  if (!window.GuildFauna) {
    window.GuildFauna = { birds: [], coos: [] };
  }
  window.GuildFauna.update = update;
  window.GuildFauna.draw = draw;
  window.GuildFauna.__probe = probe;
}

export {};
