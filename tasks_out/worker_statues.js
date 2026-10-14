const NAMES = ['missingno', 'step5', 'laguna', 'longcat'];
const COLORS = ['#d4af37', '#8b5cf6', '#10b981', '#f59e0b'];
const RAW_POSITIONS = [{ gx: 5, gy: -3 }, { gx: 4, gy: -2 }, { gx: 6, gy: -2 }, { gx: 5, gy: -1 }];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

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
  const t = (text == null ? '' : String(text));
  return t.length > 24 ? t.slice(0, 24) : t;
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function tileRing(gx, gy) {
  function layer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(layer(gx), layer(gy));
}

function getState() { const w = root(); return w && w.GuildStatues; }

function createState() {
  return {
    statues: NAMES.map(function (name, i) {
      return {
        index: i,
        name: name,
        color: COLORS[i],
        rawGx: RAW_POSITIONS[i].gx,
        rawGy: RAW_POSITIONS[i].gy,
        gx: RAW_POSITIONS[i].gx,
        gy: RAW_POSITIONS[i].gy,
        x: 0,
        y: 0,
        done: 0,
        gleamActive: false,
        gleam: false,
        gleamStart: null,
        gleamDuration: 1200,
        gleamEnd: null,
        shineDuration: 1200,
        shinePeriod: 5000
      };
    }),
    lastGleam: null,
    lastGleamIndex: -1,
    _prevDone: [0, 0, 0, 0],
    _primed: false,
    _now: 0
  };
}

function ensureStatues(gs) {
  if (!gs) return;
  if (!Array.isArray(gs.statues) || gs.statues.length !== NAMES.length) {
    gs.statues = createState().statues;
  }
  for (let i = 0; i < gs.statues.length; i++) {
    const s = gs.statues[i];
    if (!s || typeof s !== 'object') {
      gs.statues[i] = createState().statues[i];
      continue;
    }
    if (s.name == null) s.name = NAMES[i];
    if (s.color == null) s.color = COLORS[i];
    if (typeof s.rawGx !== 'number') s.rawGx = RAW_POSITIONS[i].gx;
    if (typeof s.rawGy !== 'number') s.rawGy = RAW_POSITIONS[i].gy;
    if (typeof s.gleamDuration !== 'number') s.gleamDuration = 1200;
    if (typeof s.shinePeriod !== 'number') s.shinePeriod = 5000;
    if (typeof s.shineDuration !== 'number') s.shineDuration = 1200;
  }
}

function clampOnIsland(gx, gy, s) {
  const minC = -2 - s;
  const maxC = 1 + s;
  let x = clamp(gx, minC, maxC);
  let y = clamp(gy, minC, maxC);
  let guard = 0;
  while (guard < 100 && tileRing(Math.round(x), Math.round(y)) > s) {
    if (x > 0) x -= 1;
    else if (x < 0) x += 1;
    if (y > 0) y -= 1;
    else if (y < 0) y += 1;
    x = clamp(x, minC, maxC);
    y = clamp(y, minC, maxC);
    guard++;
    if (x === 0 && y === 0) break;
  }
  return { gx: x, gy: y };
}

function doneCountFor(Vv, index) {
  if (!Vv || !Array.isArray(Vv.workers) || index < 0 || index >= Vv.workers.length) return 0;
  const worker = Vv.workers[index];
  if (!worker || !Array.isArray(worker.tasks)) return 0;
  let count = 0;
  for (let i = 0; i < worker.tasks.length; i++) {
    const task = worker.tasks[i];
    if (task && task.status === 'done') count++;
  }
  return count;
}

function lightenHex(hex) {
  const h = String(hex || '').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return 'rgb(' + Math.min(255, r + 82) + ',' + Math.min(255, g + 82) + ',' + Math.min(255, b + 82) + ')';
}

function drawPlinth(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 8, y + 1, 16, 4);
  ctx.fillStyle = '#334155';
  ctx.fillRect(x - 7, y - 4, 14, 4);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x - 7, y - 10, 14, 6);
}

function drawShine(ctx, x, y, now, statue) {
  const period = statue.shinePeriod || 5000;
  const duration = statue.shineDuration || 1200;
  const cycle = now % period;
  if (cycle >= duration) return;
  const progress = cycle / duration;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - 20, 8, 10);
  ctx.clip();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.translate(x - 8 + progress * 16, y - 15);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(0, -12, 2, 24);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const gs = getState();
  if (!gs) return;
  const Vv = getV();

  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;

  ensureStatues(gs);
  gs._now = now;

  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  for (let i = 0; i < gs.statues.length; i++) {
    const statue = gs.statues[i];
    const clamped = clampOnIsland(statue.rawGx, statue.rawGy, s);
    statue.gx = clamped.gx;
    statue.gy = clamped.gy;
    const point = isoFn(clamped.gx, clamped.gy);
    statue.x = Math.round(point.x);
    statue.y = Math.round(point.y);
    const age = (statue.gleamStart == null) ? Infinity : (now - statue.gleamStart);
    statue.gleamActive = age >= 0 && age < statue.gleamDuration;
    statue.gleam = statue.gleamActive;
    statue.gleamEnd = (statue.gleamStart == null) ? null : (statue.gleamStart + statue.gleamDuration);
    if (!statue.gleamActive && statue.gleamStart != null && age >= statue.gleamDuration) {
      statue.gleamStart = null;
    }
  }

  if (!Vv) return;

  const counts = [0, 0, 0, 0];
  for (let i = 0; i < counts.length; i++) counts[i] = doneCountFor(Vv, i);

  if (!gs._primed) {
    gs._prevDone = counts.slice();
    gs._primed = true;
    for (let i = 0; i < gs.statues.length; i++) gs.statues[i].done = counts[i];
    return;
  }

  const prev = (Array.isArray(gs._prevDone) && gs._prevDone.length === counts.length)
    ? gs._prevDone
    : [0, 0, 0, 0];

  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > prev[i]) {
      const statue = gs.statues[i];
      if (statue) {
        statue.done = counts[i];
        statue.gleamActive = true;
        statue.gleam = true;
        statue.gleamStart = now;
        statue.gleamEnd = now + statue.gleamDuration;
      }
      gs.lastGleam = now;
      gs.lastGleamIndex = i;
    }
    prev[i] = counts[i];
    if (gs.statues[i]) gs.statues[i].done = counts[i];
  }
  gs._prevDone = prev;
}

function draw(ctx) {
  if (!ctx) return;
  const gs = getState();
  if (!gs) return;
  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;

  ensureStatues(gs);
  const now = nowFn();

  for (let i = 0; i < gs.statues.length; i++) {
    const statue = gs.statues[i];
    const x = Math.round(statue.x || 0);
    const y = Math.round(statue.y || 0);

    drawPlinth(ctx, x, y);

    ctx.fillStyle = statue.color;
    ctx.fillRect(x - 4, y - 20, 8, 10);
    ctx.fillStyle = lightenHex(statue.color);
    ctx.fillRect(x - 3, y - 17, 1, 3);

    drawShine(ctx, x, y, now, statue);

    const gleamAge = (statue.gleamStart == null) ? Infinity : (now - statue.gleamStart);
    if (gleamAge >= 0 && gleamAge < statue.gleamDuration) {
      const progress = gleamAge / statue.gleamDuration;
      const ringRadius = 4 + progress * 18;
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - progress) * 0.86);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 15, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, (1 - progress) * 0.24);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - 4, y - 15 - Math.round(progress * 16) - 10, 8, 12 + Math.round(progress * 6));
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    const displayName = (typeof fitFn === 'function') ? fitFn(statue.name, 40) : String(statue.name);
    const shownName = fitFn(displayName, 40);
    ctx.font = 'bold 8px monospace';
    const textWidth = ctx.measureText(shownName).width;
    const plateW = Math.max(16, Math.round(textWidth) + 6);
    const plateH = 10;
    const plateX = x - Math.round(plateW * 0.5);
    const plateY = y + 3;
    ctx.fillStyle = 'rgba(10,12,16,0.88)';
    ctx.fillRect(plateX, plateY, plateW, plateH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(plateX, plateY, plateW, plateH);
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shownName, x, plateY + plateH * 0.5 + 1);
    ctx.textAlign = 'left';
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildStatues) window.GuildStatues = createState();
  const installed = window.GuildStatues;
  ensureStatues(installed);
  installed.update = update;
  installed.draw = draw;
  installed.__probe = function () {
    return { statues: installed.statues, lastGleam: installed.lastGleam };
  };
}

export {};
