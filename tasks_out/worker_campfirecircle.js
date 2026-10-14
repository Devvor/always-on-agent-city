# worker_campfirecircle.js — a fresh module in the style of worker_visitor.js / worker_office.js
const BUILDINGS = [{ gx: -2, gy: 0 }, { gx: 0, gy: -2 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 }];
let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return {
    gx: 0, gy: -1, facing: 'down', sitting: false,
    stories: [], current: null, cooldown: 0, fireBright: 0,
    sparkTimer: 0, spark: null
  };
}

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
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildVisitor; }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function tickText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.msg === 'string') return value.msg;
    if (typeof value.line === 'string') return value.line;
    if (typeof value.event === 'string') return value.event;
    if (typeof value.status === 'string') return value.status;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value);
}

function latestTickForWorker(worker) {
  const ticks = Array.isArray(worker && worker.recentTicks) ? worker.recentTicks : [];
  const name = String(worker && worker.name != null ? worker.name : '').trim();
  let chosen = null;
  for (let i = ticks.length - 1; i >= 0; i--) {
    const line = tickText(ticks[i]);
    if (!line) continue;
    if (name && line.toLowerCase().indexOf(name.toLowerCase()) !== -1) { chosen = line; break; }
  }
  if (!chosen && ticks.length) chosen = tickText(ticks[ticks.length - 1]);
  return chosen ? String(chosen).trim() : '';
}

function collectStories(Vv) {
  const stories = [];
  const metas = Array.isArray(Vv && Vv.workers) ? Vv.workers : [];
  for (let i = 0; i < metas.length; i++) {
    const meta = metas[i] || {};
    const name = String(meta.name != null ? meta.name : (i === 0 ? 'MISSINGNO' : (i === 1 ? 'STEP5' : ('WORKER ' + (i + 1)))));
    const line = latestTickForWorker(meta);
    if (line) {
      stories.push({ workerIndex: i, name: name, color: workerColor(i, name), text: line });
    }
  }
  if (!stories.length) {
    const allTicks = Array.isArray(Vv && Vv.recentTicks) ? Vv.recentTicks : [];
    for (let i = 0; i < allTicks.length; i++) {
      const line = tickText(allTicks[i]);
      if (line) {
        stories.push({ workerIndex: 0, name: 'VISITOR', color: '#facc15', text: String(line).trim() });
      }
    }
  }
  return stories;
}

function pickStory(vis, Vv) {
  if (!vis.stories || !vis.stories.length) return null;
  if (vis.current) return vis.current;
  const idx = Math.floor(Math.random() * vis.stories.length);
  return vis.stories[idx];
}

function sparkFx(vis, now) {
  if (!vis.spark) {
    vis.spark = { x: 0, y: 0, vx: (Math.random() - 0.5) * 24, vy: -30 - Math.random() * 14, life: 0.5 + Math.random() * 0.4, age: 0, size: 2 };
  }
  const s = vis.spark;
  s.x += s.vx * 0.016;
  s.y += s.vy * 0.016;
  s.vy += 6 * 0.016;
  s.age += 0.016;
  if (s.age >= s.life) vis.spark = null;
  return s;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const vis = getState();
  const Vv = getV();
  if (!vis || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (vis.cooldown > 0) vis.cooldown = Math.max(0, vis.cooldown - dt);

  if (!vis.stories || !vis.stories.length) {
    vis.stories = collectStories(Vv);
    vis.current = null;
  }

  if (vis.cooldown <= 0 && !vis.current) {
    vis.current = pickStory(vis, Vv);
    if (vis.current) {
      vis.cooldown = 4 + Math.random() * 3;
      vis.fireBright = 1;
    }
  }

  if (vis.fireBright > 0) vis.fireBright = Math.max(0, vis.fireBright - dt * 1.2);

  vis.sparkTimer -= dt;
  if (vis.sparkTimer <= 0) {
    vis.sparkTimer = 0.3 + Math.random() * 0.5;
    vis.spark = null;
  }
  if (vis.spark) sparkFx(vis, now);
}

function drawCampfire(ctx, vis, Vv, now) {
  if (!ctx || !vis) return;
  const base = isoFn(vis.gx, vis.gy);
  const x = Math.round(base.x);
  const y = Math.round(base.y);

  const fireBright = vis.fireBright || 0;
  const flameFrame = Math.floor(now / 170) % 3;
  const flameH = flameFrame === 0 ? 10 : (flameFrame === 1 ? 13 : 8);
  const flameW = flameFrame === 0 ? 8 : (flameFrame === 1 ? 10 : 6);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 2, y - 50, 4, 52);

  ctx.fillStyle = '#ff6b1a';
  ctx.fillRect(x - Math.round(flameW * 0.5), y - flameH, flameW, flameH);
  ctx.fillStyle = '#ffc27a';
  ctx.fillRect(x - Math.round(flameW * 0.25), y - flameH + 2, Math.max(2, Math.round(flameW * 0.5)), Math.max(2, flameH - 3));

  if (fireBright > 0.02) {
    const r = 24 + fireBright * 28;
    const grad = ctx.createRadialGradient(x, y - flameH + 4, 2, x, y - flameH + 4, r);
    grad.addColorStop(0, 'rgba(255,180,90,' + (0.34 * fireBright) + ')');
    grad.addColorStop(0.5, 'rgba(255,120,40,' + (0.18 * fireBright) + ')');
    grad.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - flameH - r, r * 2, r * 2);
  }

  if (vis.spark) {
    const s = vis.spark;
    ctx.fillStyle = '#ffc27a';
    ctx.fillRect(Math.round(s.x + x), Math.round(s.y + y - flameH), s.size, s.size);
  }

  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 12, y - 3, 6, 4);
  ctx.fillRect(x - 4, y - 1, 7, 4);
  ctx.fillRect(x + 4, y - 4, 6, 4);
  ctx.fillRect(x - 8, y + 2, 5, 3);
  ctx.fillRect(x + 1, y + 1, 6, 3);
}

function drawSitters(ctx, vis, Vv, now) {
  if (!ctx || !vis) return;
  const base = isoFn(vis.gx, vis.gy);
  const cx = Math.round(base.x);
  const cy = Math.round(base.y);
  const offsets = [{ x: -12, y: 4 }, { x: 12, y: 6 }, { x: 0, y: 8 }];
  const metas = Array.isArray(Vv && Vv.workers) ? Vv.workers : [];
  const count = Math.min(3, metas.length);
  for (let i = 0; i < count; i++) {
    const off = offsets[i];
    const sx = cx + off.x;
    const sy = cy + off.y;
    const meta = metas[i] || {};
    const name = String(meta.name != null ? meta.name : (i === 0 ? 'MISSINGNO' : (i === 1 ? 'STEP5' : ('WORKER ' + (i + 1)))));
    const color = workerColor(i, name);
    const isStep = i === 1 || name.toLowerCase().indexOf('step') !== -1;
    const robeColor = isStep ? '#7c3aed' : '#9a6334';
    const legColor = isStep ? '#4c1d95' : '#26323f';

    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(sx - 4, sy + 17, 20, 4);

    ctx.fillStyle = legColor;
    ctx.fillRect(sx + 2, sy + 13, 4, 4);
    ctx.fillRect(sx + 10, sy + 13, 4, 4);

    ctx.fillStyle = robeColor;
    ctx.fillRect(sx + 1, sy - 2, 14, 12);
    ctx.fillStyle = isStep ? '#ddd6fe' : '#f1c9a5';
    ctx.fillRect(sx + 3, sy - 11, 10, 9);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(sx + 5, sy - 8, 2, 2);
    ctx.fillRect(sx + 9, sy - 8, 2, 2);
    ctx.fillStyle = isStep ? '#8b5cf6' : '#7c4a24';
    ctx.fillRect(sx + 4, sy - 12, 8, 2);

    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(sx - 6, sy - 28, 24, 10);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 6, sy - 28, 24, 10);
    ctx.fillStyle = color;
    ctx.font = 'bold 8px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const shortName = name.length > 8 ? name.slice(0, 8) : name;
    ctx.fillText(shortName, sx + 6, sy - 23);
    ctx.textAlign = 'left';
  }
}

function drawStoryBubble(ctx, vis, Vv, now) {
  if (!ctx || !vis || !vis.current) return;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const d = vis.current;
  const boxW = Math.min(canvas.width - 40, 420);
  const boxH = 44;
  const bx = Math.round((canvas.width - boxW) * 0.5);
  const by = Math.round(canvas.height * 0.5 - 60);

  ctx.fillStyle = 'rgba(20,16,10,0.90)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.fillStyle = d.color || '#facc15';
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fitFn(d.name, boxW - 16), bx + 10, by + 12);

  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  ctx.fillText(fitFn(d.text, boxW - 16), bx + 10, by + 30);
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const vis = getState();
  const Vv = getV();
  if (!vis || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  drawCampfire(ctx, vis, Vv, n);
  drawSitters(ctx, vis, Vv, n);
  drawStoryBubble(ctx, vis, Vv, n);
}

if (typeof window !== 'undefined') {
  if (!window.GuildVisitor) window.GuildVisitor = createState();
  window.GuildVisitor.update = update;
  window.GuildVisitor.draw = draw;
  window.GuildVisitor.__probe = function () { return { stories: vis.stories ? vis.stories.length : 0, current: vis.current ? vis.current.text : null }; };
  window.GuildVisitor.__rawUpdate = update;
  if (!window.__gvListeners) {
    window.__gvListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const vis = getState();
  if (vis && k === 'e') {
    vis.current = null;
    vis.cooldown = 0.3;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
  if (k === 'e' || k === ' ' || k === 'escape') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

export {};
