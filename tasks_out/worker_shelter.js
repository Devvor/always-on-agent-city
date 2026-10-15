const SPOT_TILES = [{ gx: -7.0, gy: 8.5 }, { gx: 7.0, gy: 8.5 }];   // GREAT RESIZE

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildShelter; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { return w.iso(gx, gy); } catch (e) { }
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isRain(Vv) {
  try { return !!Vv && Vv.weather != null && String(Vv.weather).trim().toUpperCase() === 'RAIN'; }
  catch (e) { return false; }
}
function hasIdleString(value, depth) {
  depth = depth || 0;
  if (depth > 5) return false;
  if (typeof value === 'string') return /IDLE/i.test(value);
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (hasIdleString(value[i], depth + 1)) return true;
    return false;
  }
  for (const k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k) && hasIdleString(value[k], depth + 1)) return true;
  }
  return false;
}
function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}
function tileDistancePx(ax, ay, bx, by, g) {
  if (!g || !isFinite(g.tileW) || !isFinite(g.tileH) || g.tileW === 0 || g.tileH === 0) return Infinity;
  const dx = ax - bx;
  const dy = ay - by;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}
function createState() {
  return { spots: [], active: false, update: update, draw: draw, __probe: probe };
}
function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const gs = getState();
  if (!gs) return;
  const rain = isRain(Vv);
  gs.active = rain;
  gs.spots = SPOT_TILES.map(function (s) { return { gx: s.gx, gy: s.gy }; });
  try {
    if (root() && root().GuildShelter) root().GuildShelter.active = gs.active;
  } catch (e) { }
}
function drawAwning(ctx, spot, now) {
  const pt = isoFn(spot.gx, spot.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 13, y - 20, 3, 20);
  ctx.fillRect(x + 10, y - 20, 3, 20);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#e8e6df' : '#4a3423';
    ctx.fillRect(x - 16 + i * 5, y - 26, 5, 8);
  }
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 16, y - 19, 32, 2);
  const t = now * 0.006;
  for (let k = 0; k < 5; k++) {
    const bx = x - 14 + k * 6;
    const bounce = Math.abs(Math.sin(t + k * 1.3)) * 4;
    ctx.fillStyle = 'rgba(210,225,255,0.82)';
    ctx.fillRect(Math.round(bx), Math.round(y - 16 - bounce), 1, 1);
  }
}
function probe() {
  const Vv = getV();
  const gs = getState();
  const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  let idle = 0;
  for (let i = 0; i < ws.length; i++) if (hasIdleString(ws[i])) idle++;
  return { active: !!(gs && gs.active), spots: gs ? gs.spots.slice() : [], rain: isRain(Vv), idleWorkers: idle };
}
function draw(ctx) {
  const Vv = getV();
  const gs = getState();
  if (!gs) return;
  const rain = isRain(Vv);
  gs.active = rain;
  if (!gs.spots || !gs.spots.length) gs.spots = SPOT_TILES.map(function (s) { return { gx: s.gx, gy: s.gy }; });
  if (!rain || !ctx || typeof ctx.fillRect !== 'function') return;
  for (let i = 0; i < gs.spots.length; i++) drawAwning(ctx, gs.spots[i], (typeof performance !== 'undefined' ? performance.now() : Date.now()));

  const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  const metas = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const idle = [];
  for (let wi = 0; wi < ws.length; wi++) {
    const w = ws[wi];
    if (!hasIdleString(w)) continue;
    const meta = metas[wi] && typeof metas[wi] === 'object' ? metas[wi] : {};
    const name = (w && typeof w.name === 'string') ? w.name : (meta.name != null ? meta.name : '');
    idle.push({ w: w, index: wi, color: workerColor(wi, name) });
  }

  for (let i = 0; i < idle.length; i++) {
    const item = idle[i];
    const w = item.w;
    const xBase = Math.round(typeof w.x === 'number' ? w.x : 0);
    const yBase = Math.round(typeof w.y === 'number' ? w.y : 0);
    const shiver = (Math.sin(now * 0.027 + item.index * 1.7) > 0) ? 1 : -1;
    const cx = xBase + 8 + shiver;
    const cy = yBase - 22;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3423';
    ctx.fillRect(cx, cy + 1, 1, 11);
  }

  for (let i = 0; i < idle.length; i++) {
    for (let j = i + 1; j < idle.length; j++) {
      const a = idle[i].w;
      const b = idle[j].w;
      const ax = typeof a.x === 'number' ? a.x : 0;
      const ay = typeof a.y === 'number' ? a.y : 0;
      const bx = typeof b.x === 'number' ? b.x : 0;
      const by = typeof b.y === 'number' ? b.y : 0;
      const dist = tileDistancePx(ax, ay, bx, by, Vv.grid);
      if (!isFinite(dist) || dist > 1.2) continue;
      const mx = Math.round((ax + bx) * 0.5) + 8;
      const my = Math.round((ay + by) * 0.5) - 16;
      for (let k = 0; k < 3; k++) {
        const px = mx + (k - 1) * 2;
        const py = my - k * 2 + Math.round(Math.sin(now * 0.003 + k) * 1);
        ctx.fillStyle = (k % 2 === 0) ? 'rgba(232,230,223,0.9)' : 'rgba(180,185,195,0.8)';
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildShelter) window.GuildShelter = createState();
  const gs = window.GuildShelter;
  gs.update = update;
  gs.draw = draw;
  gs.__probe = probe;
  window.GuildShelter = gs;
}

export {};
