const BUILDINGS = [{ gx: -2, gy: 0 }, { gx: 0, gy: -2 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 }];

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
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

const state = {
  lastTime: null,
  initialized: false,
  fireflies: [],
  idleOffsets: []
};

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function existingProps(Vv) {
  const props = BUILDINGS.slice();
  const level = Vv && typeof Vv.mapLevel === 'number' ? Vv.mapLevel : 1;
  if (level >= 3) props.push({ gx: 1, gy: -1 });
  if (level >= 5) props.push({ gx: -1, gy: 1 });
  if (level >= 7) {
    props.push({ gx: 1, gy: 0 });
    props.push({ gx: 1, gy: 1 });
  }
  return props;
}

function distTilesFromProps(gx, gy, props) {
  for (let i = 0; i < props.length; i++) {
    if (Math.hypot(gx - props[i].gx, gy - props[i].gy) < 2) return false;
  }
  return true;
}

function spawnFirefly(Vv) {
  const props = existingProps(Vv);
  const growthStep = Vv && typeof Vv.growthStep === 'number' ? Vv.growthStep : 0;
  const minC = -2 - growthStep;
  const maxC = 1 + growthStep;
  let gx = -2;
  let gy = -2;
  for (let tries = 0; tries < 24; tries++) {
    const cx = clamp(-2 + (Math.floor(Math.random() * 3) - 1), minC, maxC);
    const cy = clamp(-2 + (Math.floor(Math.random() * 3) - 1), minC, maxC);
    if (tileRing(cx, cy) > growthStep) continue;
    if (!distTilesFromProps(cx, cy, props)) continue;
    gx = cx;
    gy = cy;
    break;
  }
  const pt = isoFn(gx + 0.5, gy + 0.5);
  return {
    x: pt.x + (Math.random() - 0.5) * 8,
    y: pt.y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 8,
    vy: (Math.random() - 0.5) * 8,
    phase: Math.random() * Math.PI * 2,
    life: 8 + Math.random() * 6,
    age: 0,
    size: Math.random() < 0.6 ? 1 : 2,
    wanderTimer: Math.random() * 2
  };
}

function getPuddlePoints() {
  const w = root();
  const gp = w && w.GuildPuddles;
  if (gp) {
    const keys = ['puddles', 'tiles', 'points', 'positions'];
    for (let i = 0; i < keys.length; i++) {
      const arr = gp[keys[i]];
      if (Array.isArray(arr)) {
        const out = [];
        for (let j = 0; j < arr.length; j++) {
          const p = arr[j];
          if (!p) continue;
          if (typeof p.x === 'number' && typeof p.y === 'number') out.push({ x: p.x, y: p.y });
          else if (typeof p.gx === 'number' && typeof p.gy === 'number') {
            const pt = isoFn(p.gx, p.gy);
            out.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
          }
        }
        if (out.length) return out;
      }
    }
    const fns = ['getPuddles', 'getTiles', 'getPoints'];
    for (let i = 0; i < fns.length; i++) {
      if (gp && typeof gp[fns[i]] === 'function') {
        try {
          const arr = gp[fns[i]]();
          if (Array.isArray(arr)) {
            const out = [];
            for (let j = 0; j < arr.length; j++) {
              const p = arr[j];
              if (!p) continue;
              if (typeof p.x === 'number' && typeof p.y === 'number') out.push({ x: p.x, y: p.y });
              else if (typeof p.gx === 'number' && typeof p.gy === 'number') {
                const pt = isoFn(p.gx, p.gy);
                out.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
              }
            }
            if (out.length) return out;
          }
        } catch (e) {}
      }
    }
  }

  const Vv = getV();
  if (!Vv || !Vv.grid) return [];
  const growthStep = typeof Vv.growthStep === 'number' ? Vv.growthStep : 0;
  const minC = -2 - growthStep;
  const maxC = 1 + growthStep;
  const out = [];
  for (let i = 0; i < 26; i++) {
    const gx = minC + Math.floor((Math.abs(Math.sin(1300 + i * 17.1)) || 0) * (maxC - minC + 1));
    const gy = minC + Math.floor((Math.abs(Math.sin(1301 + i * 19.3)) || 0) * (maxC - minC + 1));
    const pt = isoFn(gx + 0.5, gy + 0.5);
    out.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
  }
  return out;
}

function contractReady() {
  const w = root();
  const Vv = getV();
  return !!(w && Vv);
}

function init() {
  if (!root()) return false;
  const Vv = getV();
  if (!Vv) return false;
  state.initialized = true;
  if (state.lastTime === null) state.lastTime = nowFn();
  return true;
}

function updateIdleOffsets(Vv) {
  const out = [];
  const workers = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  const metas = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  for (let i = 0; i < workers.length; i++) {
    const meta = metas[i] || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(workers[i].tasks) ? workers[i].tasks : []);
    const active = tasks.some(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
    out.push({ active: !active });
  }
  state.idleOffsets = out;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') {
    state.lastTime = now;
    return;
  }
  if (!contractReady()) return;

  if (state.lastTime === null) state.lastTime = now;
  let dt = (now - state.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  state.lastTime = now;

  updateIdleOffsets(Vv);

  const nightFactor = typeof Vv.nightFactor === 'number' ? Vv.nightFactor : 0;
  const starAlpha = typeof Vv.starAlpha === 'number' ? Vv.starAlpha : 0;
  const night = nightFactor > 0.35 || starAlpha > 0.5;

  if (!night) {
    state.fireflies = [];
    return;
  }

  const target = Math.min(6, Math.max(3, Math.round(3 + nightFactor * 3)));

  let kept = [];
  for (let i = 0; i < state.fireflies.length; i++) {
    const ff = state.fireflies[i];
    if (ff && ff.age < ff.life) kept.push(ff);
  }
  while (kept.length < target) kept.push(spawnFirefly(Vv));
  if (kept.length > target) kept = kept.slice(kept.length - target);

  const anchor = isoFn(-1.5, -1.5);
  const nowSec = now * 0.001;
  const c = Vv.canvas;
  const canvasW = c && c.width ? c.width : 960;
  const canvasH = c && c.height ? c.height : 640;

  for (let i = 0; i < kept.length; i++) {
    const ff = kept[i];
    ff.age += dt;

    ff.wanderTimer -= dt;
    if (ff.wanderTimer <= 0) {
      ff.vx = (Math.random() - 0.5) * 8;
      ff.vy = (Math.random() - 0.5) * 8;
      ff.wanderTimer = 1.2 + Math.random() * 2.2;
    }

    ff.x += (ff.vx + Math.sin(nowSec + ff.phase) * 1.5) * dt;
    ff.y += (ff.vy + Math.cos(nowSec * 0.8 + ff.phase) * 1.0) * dt;
    ff.x += (anchor.x - ff.x) * 0.015;
    ff.y += (anchor.y - ff.y) * 0.015;

    if (ff.x < 8) { ff.x = 8; ff.vx = Math.abs(ff.vx); }
    if (ff.x > canvasW - 8) { ff.x = canvasW - 8; ff.vx = -Math.abs(ff.vx); }
    if (ff.y < 80) { ff.y = 80; ff.vy = Math.abs(ff.vy); }
    if (ff.y > canvasH - 90) { ff.y = canvasH - 90; ff.vy = -Math.abs(ff.vy); }
  }

  state.fireflies = kept;
}

function drawFireflies(ctx, now) {
  for (let i = 0; i < state.fireflies.length; i++) {
    const ff = state.fireflies[i];
    const lifeRatio = Math.max(0, 1 - (ff.age / ff.life));
    if (lifeRatio <= 0.01) continue;
    const blink = 0.5 + 0.5 * Math.sin(now * 0.009 + ff.phase + ff.age * 3);
    ctx.globalAlpha = lifeRatio * (0.5 + 0.45 * blink);
    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(Math.round(ff.x), Math.round(ff.y), ff.size, ff.size);
    ctx.globalAlpha = lifeRatio * (0.4 + 0.3 * blink);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(ff.x), Math.round(ff.y), 1, 1);
  }
}

function drawRainStreaks(ctx, now, Vv) {
  if (!Vv || Vv.weather !== 'RAIN') return;
  const drops = Array.isArray(Vv.rainDrops) ? Vv.rainDrops : [];
  const c = Vv.canvas;
  const canvasW = c && c.width ? c.width : 960;
  const canvasH = c && c.height ? c.height : 640;
  const t = now * 0.001;
  ctx.strokeStyle = 'rgba(230,255,240,0.50)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < drops.length; i++) {
    const drop = drops[i];
    const y = (drop.ySeed * (canvasH + 80) + t * drop.speed) % (canvasH + 80) - 40;
    const x = drop.xSeed * (canvasW * 0.78) + canvasW * 0.11 + drop.drift * 18 + (Vv.wind || 0) * 8;
    ctx.moveTo(Math.round(x), Math.round(y));
    ctx.lineTo(Math.round(x + 2), Math.round(y + 9));
  }
  ctx.stroke();
}

function drawShimmer(ctx, now) {
  const pts = getPuddlePoints();
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const phase = now * 0.004 + i * 0.8;
    const wobble = 0.5 + 0.5 * Math.sin(phase);
    ctx.globalAlpha = 0.10 + 0.07 * wobble;
    ctx.fillStyle = '#b7f7d5';
    ctx.fillRect(Math.round(pt.x) - 3, Math.round(pt.y) + 1, 7, 2);
    if (Math.sin(phase * 1.7) > 0.45) {
      ctx.globalAlpha = (0.10 + 0.07 * wobble) * 0.7;
      ctx.fillStyle = '#eafff3';
      ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) + 3, 3, 1);
    }
  }
}

function drawIdleHighlights(ctx, now, Vv) {
  const workers = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  const offsets = state.idleOffsets || [];
  for (let i = 0; i < workers.length; i++) {
    const info = offsets[i];
    if (!info || !info.active) continue;
    const w = workers[i];
    if (!w) continue;
    const phase = now * 0.002 + i * 1.3;
    const ox = Math.round(Math.sin(phase) * 1.5);
    const oy = Math.round(Math.cos(phase * 0.9) * 1.0);
    ctx.globalAlpha = 0.32 + 0.12 * (0.5 + 0.5 * Math.sin(phase * 2));
    ctx.fillStyle = Math.sin(phase) > 0 ? '#eafff3' : '#b7f7d5';
    ctx.fillRect(Math.round(w.x) + 7 + ox, Math.round(w.y) - 10 + oy, 3, 3);
  }
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play' || !contractReady()) return;

  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  try {
    if (state.fireflies.length) drawFireflies(ctx, typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (Vv.weather === 'RAIN') {
      drawRainStreaks(ctx, typeof performance !== 'undefined' ? performance.now() : Date.now(), Vv);
      drawShimmer(ctx, typeof performance !== 'undefined' ? performance.now() : Date.now());
    }
    drawIdleHighlights(ctx, typeof performance !== 'undefined' ? performance.now() : Date.now(), Vv);
  } finally {
    ctx.globalCompositeOperation = prevComposite;
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildBreathe) {
    window.GuildBreathe = { update: update, draw: draw, init: init };
  }
  try { window.GuildBreathe.init(); } catch (e) {}
}

export {};
