const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];
let lastTime = null;
let spawnTimer = 0;
let spawnInterval = 4 + Math.random() * 2;
let dryStart = null;
let wasRaining = false;

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
function getState() { const w = root(); return w && w.GuildPuddles; }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function floorTiles(Vv) {
  const tiles = [];
  if (!Vv || !Vv.grid) return tiles;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const clamped = Math.max(0, Math.min(8, s));
  const minC = -2 - clamped;
  const maxC = 1 + clamped;
  for (let gy = minC; gy <= maxC; gy++) {
    for (let gx = minC; gx <= maxC; gx++) {
      if (tileRing(gx, gy) > clamped) continue;
      let isBuilding = false;
      for (let i = 0; i < BUILDINGS.length; i++) {
        if (gx === BUILDINGS[i].gx && gy === BUILDINGS[i].gy) { isBuilding = true; break; }
      }
      if (!isBuilding) tiles.push({ gx: gx, gy: gy });
    }
  }
  return tiles;
}

function randomFloorSpot(Vv) {
  const tiles = floorTiles(Vv);
  if (!tiles.length) return null;
  const idx = Math.floor(Math.random() * tiles.length);
  const t = tiles[idx];
  return isoFn(t.gx + 0.5, t.gy + 0.5);
}

function nearestWorkerColor(Vv) {
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  if (!ws.length) return '#facc15';
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w) continue;
    const d = Math.hypot(w.x, w.y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  if (best == null) return '#facc15';
  const meta = metas[best] || {};
  const n = String(meta.name || '').toLowerCase();
  return (best === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function spawnPuddle(Vv) {
  const spot = randomFloorSpot(Vv);
  if (!spot) return null;
  return {
    x: spot.x,
    y: spot.y,
    born: nowFn(),
    growEnd: nowFn() + 1000,
    size: 0,
    rippleAt: nowFn() + 1500,
    color: nearestWorkerColor(Vv)
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const raining = (typeof Vv.weather === 'string' && Vv.weather === 'RAIN');

  if (raining) {
    dryStart = null;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (st.puddles.length < 12) {
        const p = spawnPuddle(Vv);
        if (p) st.puddles.push(p);
      }
      spawnTimer = 3 + Math.random() * 3;
    }
    for (let i = 0; i < st.puddles.length; i++) {
      const p = st.puddles[i];
      if (now - p.growEnd < 0) p.size = Math.max(0, (now - p.born) / 1000);
      if (now - p.rippleAt >= 0) {
        p.rippleAt = now + 1500;
      }
    }
  } else {
    if (wasRaining) {
      dryStart = now;
    }
    if (dryStart !== null) {
      const elapsed = (now - dryStart) / 1000;
      const fade = Math.max(0, 1 - elapsed / 4);
      for (let i = 0; i < st.puddles.length; i++) {
        st.puddles[i].fade = fade;
      }
      if (elapsed >= 4) {
        st.puddles.length = 0;
        dryStart = null;
      }
    }
  }
  wasRaining = raining;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !ctx) return;
  const now = nowFn();
  const raining = (typeof Vv.weather === 'string' && Vv.weather === 'RAIN');
  for (let i = 0; i < st.puddles.length; i++) {
    const p = st.puddles[i];
    const age = (now - p.born) / 1000;
    const grow = Math.min(1, age);
    const fade = (typeof p.fade === 'number') ? p.fade : 1;
    const sz = 5 + 5 * grow * fade;
    const w = 10 * sz * 0.5;
    const h = 5 * sz * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.45 * fade;
    ctx.fillStyle = 'rgba(40,60,90,0.45)';
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, w, h, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(Math.round(p.x - w), Math.round(p.y - h * 0.5), Math.round(w * 2), Math.round(h));
    }
    if (raining && now - p.rippleAt >= -1500 && now - p.rippleAt <= 0) {
      const rAge = (now - p.rippleAt) / 1500;
      const rGrow = Math.min(1, rAge);
      const rw = 12 * rGrow;
      const rh = 6 * rGrow;
      ctx.globalAlpha = 0.28 * fade * (1 - rGrow);
      ctx.strokeStyle = 'rgba(180,210,255,0.5)';
      ctx.lineWidth = 1;
      if (ctx.ellipse) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rw, rh, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const glintT = (now * 0.003) % 1;
    if (glintT < 0.5) {
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = p.color || '#facc15';
      ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildPuddles) window.GuildPuddles = { puddles: [] };
  window.GuildPuddles.update = update;
  window.GuildPuddles.draw = draw;
  window.GuildPuddles.__probe = function () { return { puddles: (getState() && getState().puddles) ? getState().puddles.length : 0 }; };
}

export {};
