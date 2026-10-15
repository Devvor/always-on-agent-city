const PATCH_TILES = [];
for (let fx = 4; fx <= 6; fx++) {
  for (let fy = 0; fy <= 3; fy++) {
    PATCH_TILES.push({ fx: fx, fy: fy, gx: fx + 0.5, gy: fy + 0.5 });
  }
}

let lastTime = null;

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
function getState() { const w = root(); return w && w.GuildButterfly; }

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function randomPatchPoint() {
  const t = PATCH_TILES[Math.floor(Math.random() * PATCH_TILES.length)];
  return { gx: t.gx + (Math.random() - 0.5) * 0.45, gy: t.gy + (Math.random() - 0.5) * 0.45 };
}

function clampPatch(gx, gy) {
  let tx = Math.floor(gx);
  let ty = Math.floor(gy);
  tx = clamp(tx, 4, 6);
  ty = clamp(ty, 0, 3);
  const x = clamp(gx, tx + 0.05, tx + 0.95);
  const y = clamp(gy, ty + 0.05, ty + 0.95);
  return { gx: x, gy: y };
}

function nearestTileIndex(gx, gy) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < PATCH_TILES.length; i++) {
    const t = PATCH_TILES[i];
    const d = Math.hypot(t.gx - gx, t.gy - gy);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function createState() {
  const butterflies = [];
  for (let i = 0; i < 5; i++) {
    const point = randomPatchPoint();
    butterflies.push({
      id: i,
      gx: point.gx,
      gy: point.gy,
      target: randomPatchPoint(),
      dwell: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      wingPhase: Math.random() * Math.PI * 2,
      speed: 0.32 + Math.random() * 0.18,
      color: (i % 2 === 0) ? '#facc15' : '#a78bfa',
      settled: false,
      anchorIndex: (i * 3 + 2) % PATCH_TILES.length
    });
  }
  return { butterflies: butterflies, patchTiles: PATCH_TILES.slice() };
}

function isDay(Vv) {
  return (Vv && Vv.daylight != null ? Vv.daylight : 0) > 0.25 && (Vv && Vv.nightFactor != null ? Vv.nightFactor : 1) < 0.7;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const day = isDay(Vv);
  const butterflies = Array.isArray(st.butterflies) ? st.butterflies : [];
  for (let i = 0; i < butterflies.length; i++) {
    const b = butterflies[i];
    if (!b.target) b.target = randomPatchPoint();
    if (day) {
      b.settled = false;
      b.dwell -= dt;
      if (b.dwell <= 0) {
        b.target = randomPatchPoint();
        b.dwell = 1.0 + Math.random() * 2.0;
      }
      const dx = b.target.gx - b.gx;
      const dy = b.target.gy - b.gy;
      const dist = Math.hypot(dx, dy);
      const step = b.speed * dt;
      if (dist <= 0.05 || step >= dist) {
        b.gx = b.target.gx;
        b.gy = b.target.gy;
      } else {
        b.gx += (dx / dist) * step;
        b.gy += (dy / dist) * step;
      }
      const clamped = clampPatch(b.gx, b.gy);
      b.gx = clamped.gx;
      b.gy = clamped.gy;
      b.wingPhase += dt * 13.0;
    } else {
      if (b.anchorIndex == null) b.anchorIndex = i % PATCH_TILES.length;
      b.anchorIndex = nearestTileIndex(b.gx, b.gy);
      const tile = PATCH_TILES[b.anchorIndex % PATCH_TILES.length];
      const dx = tile.gx - b.gx;
      const dy = tile.gy - b.gy;
      const dist = Math.hypot(dx, dy);
      const step = 0.28 * dt;
      if (dist <= 0.06 || step >= dist) {
        b.gx = tile.gx;
        b.gy = tile.gy;
        b.settled = true;
      } else {
        b.gx += (dx / dist) * step;
        b.gy += (dy / dist) * step;
        b.settled = false;
      }
      b.wingPhase += dt * 1.4;
    }
  }
}

function drawPatch(ctx, Vv, now, day) {
  const ctx2 = ctx;
  for (let i = 0; i < PATCH_TILES.length; i++) {
    const t = PATCH_TILES[i];
    const pt = isoFn(t.gx, t.gy);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    ctx2.fillStyle = '#22c55e';
    ctx2.fillRect(x - 1, y - 9, 2, 9);
    const bloom = day ? '#facc15' : '#a78bfa';
    ctx2.fillStyle = bloom;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx2.fillRect(Math.round(x + Math.cos(a) * 4 - 1), Math.round(y - 12 + Math.sin(a) * 3 - 1), 3, 3);
    }
    ctx2.fillStyle = '#f3d37a';
    ctx2.fillRect(x - 2, y - 13, 5, 5);
  }
}

function drawButterfly(ctx, b, now, Vv) {
  const day = isDay(Vv);
  const pt = isoFn(b.gx, b.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const bodyX = x + 8;
  const bob = day ? Math.round(Math.sin(now * 0.004 + b.phase) * 1.5) : 0;
  const by = y - 15 + bob;
  const flap = day ? Math.sin(now * 0.018 + b.wingPhase) : 0.08 * Math.sin(now * 0.003 + b.wingPhase);
  const spread = day ? (6 + Math.abs(flap) * 2) : 2;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x, y + 3, 16, 3);

  ctx.fillStyle = b.color;
  ctx.fillRect(Math.round(bodyX - spread), by + Math.round(flap * 3), spread, 5);
  ctx.fillRect(Math.round(bodyX + 2), by - Math.round(flap * 3), spread, 5);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(bodyX, by - 2, 2, 8);
  ctx.fillStyle = b.color;
  ctx.fillRect(bodyX - 1, by - 4, 4, 3);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(bodyX, by - 6, 1, 2);
  ctx.fillRect(bodyX + 1, by - 6, 1, 2);
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  const day = isDay(Vv);
  drawPatch(ctx, Vv, n, day);
  const butterflies = Array.isArray(st.butterflies) ? st.butterflies : [];
  for (let i = 0; i < butterflies.length; i++) {
    drawButterfly(ctx, butterflies[i], n, Vv);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildButterfly) window.GuildButterfly = createState();
  window.GuildButterfly.update = update;
  window.GuildButterfly.draw = draw;
  window.GuildButterfly.__probe = function () {
    const st = getState();
    return { count: (st && Array.isArray(st.butterflies)) ? st.butterflies.length : 0, day: isDay(getV()) };
  };
}

export {};
