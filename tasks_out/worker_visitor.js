const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];
let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return { gx:0, gy:2.6, facing:'down', moving:false, walkFrame:0, walkTimer:0, dialogue:null, dialogueCooldown:0 };
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

function isWalkable(gx, gy, Vv) {
  if (!Vv || !Vv.grid) return false;
  const rx = Math.round(gx);
  const ry = Math.round(gy);
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  if (rx < minC || rx > maxC || ry < minC || ry > maxC) return false;
  if (tileRing(rx, ry) > s) return false;
  for (let i = 0; i < BUILDINGS.length; i++) {
    if (rx === BUILDINGS[i].gx && ry === BUILDINGS[i].gy) return false;
  }
  return true;
}

function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function tryOpenDialogue(vis, now) {
  if (!vis || vis.dialogue) return;
  if (vis.dialogueCooldown > 0) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const vp = isoFn(vis.gx, vis.gy);
  let best = -1;
  let bestDist = Infinity;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w) continue;
    const d = tileDistance(w.x, w.y, vp.x, vp.y, Vv.grid);
    if (d <= 1.5 && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best < 0) return;
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  const meta = metas[best] || {};
  const name = (meta.name != null) ? meta.name : (best === 0 ? 'MISSINGNO' : 'STEP5');
  const tasks = Array.isArray(meta.tasks) ? meta.tasks : [];
  const task = tasks.find(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
  let text;
  if (task) {
    const title = fitFn(String(task.title != null ? task.title : task.id), 240);
    const line = fitFn(latestTickForWorker(meta) || '', 360);
    text = 'I am on ' + title + '. Latest log: ' + line;
  } else {
    text = 'All my quests are done. The cat takes shifts.';
  }
  vis.dialogue = { workerIndex: best, name: name, color: workerColor(best, name), text: text, start: now };
}

function closeDialogue(vis, now) {
  if (!vis) return;
  vis.dialogue = null;
  vis.dialogueCooldown = 0.5;
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const Vv = getV();
  const vis = getState();
  if (vis && Vv && Vv.gameState === 'play' && (k === 'e' || k === ' ')) {
    if (vis.dialogue) closeDialogue(vis, nowFn());
    else tryOpenDialogue(vis, nowFn());
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
  if (k === 'escape' && vis && vis.dialogue) {
    closeDialogue(vis, nowFn());
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

  if (vis.dialogueCooldown > 0) vis.dialogueCooldown = Math.max(0, vis.dialogueCooldown - dt);

  const ePressed = pressed.has('e') || pressed.has(' ');
  const eWas = prevPressed.has('e') || prevPressed.has(' ');
  const escNow = pressed.has('escape');
  const escWas = prevPressed.has('escape');

  if (vis.dialogueCooldown <= 0) {
    if (!vis.dialogue && !eWas && ePressed) tryOpenDialogue(vis, now);
    if (vis.dialogue && ePressed && !eWas) closeDialogue(vis, now);
    if (vis.dialogue && escNow && !escWas) closeDialogue(vis, now);
  }
  if (vis.dialogue && now - vis.dialogue.start >= 6000) closeDialogue(vis, now);

  let vx = 0;
  let vy = 0;
  if (pressed.has('w') || pressed.has('arrowup')) vy -= 1;
  if (pressed.has('s') || pressed.has('arrowdown')) vy += 1;
  if (pressed.has('a') || pressed.has('arrowleft')) vx -= 1;
  if (pressed.has('d') || pressed.has('arrowright')) vx += 1;

  const len = Math.hypot(vx, vy);
  let moving = false;
  if (len > 0) {
    vx /= len;
    vy /= len;
    moving = !vis.dialogue;
  }
  if (len > 0) {
    if (Math.abs(vx) > Math.abs(vy)) vis.facing = (vx > 0) ? 'right' : 'left';
    else vis.facing = (vy > 0) ? 'down' : 'up';
  }
  vis.moving = moving;

  if (moving) {
    const nx = vis.gx + vx * 2.2 * dt;
    const ny = vis.gy + vy * 2.2 * dt;
    if (isWalkable(nx, ny, Vv)) {
      vis.gx = nx;
      vis.gy = ny;
    }
    vis.walkTimer += dt;
    while (vis.walkTimer >= 0.15) {
      vis.walkFrame = (vis.walkFrame + 1) % 4;
      vis.walkTimer -= 0.15;
    }
  } else {
    vis.walkFrame = 0;
    vis.walkTimer = 0;
  }

  prevPressed = new Set(pressed);
}

function drawVisitor(ctx, vis, Vv, now) {
  if (!ctx || !vis) return;
  const pt = isoFn(vis.gx, vis.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const moving = vis.moving;
  const bob = moving ? (vis.walkFrame % 2 === 0 ? 0 : 1) : 0;
  const Y = y + bob;
  const frame = moving ? (vis.walkFrame % 4) : 0;
  const vertical = (vis.facing === 'up' || vis.facing === 'down');
  const facing = vis.facing;

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 4, y + 17, 20, 4);

  let leftY = Y + 10, rightY = Y + 10, leftH = 8, rightH = 8;
  if (frame === 1) { leftY = Y + 9; rightY = Y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = Y + 11; rightY = Y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = Y + 12; rightY = Y + 9; leftH = 5; rightH = 8; }
  if (vertical) { leftY = Y + 10; rightY = Y + 10; leftH = 7; rightH = 7; }

  ctx.fillStyle = '#4b5563';
  if (facing === 'left') {
    ctx.fillRect(x + 10, leftY, 4, leftH);
    ctx.fillRect(x + 2, rightY, 4, rightH);
  } else if (facing === 'right') {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  } else if (facing === 'up') {
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 11, rightY, 3, rightH);
  } else {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  }

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x + 1, Y - 2, 14, 12);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 3, Y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, Y - 8, 2, 2);
  ctx.fillRect(x + 9, Y - 8, 2, 2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 4, Y - 12, 8, 2);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 2, Y + 3, 12, 2);

  ctx.font = 'bold 9px monospace';
  const name = 'VISITOR';
  const tw = ctx.measureText(name).width;
  const pw = Math.round(tw) + 8;
  const ph = 12;
  const px = x + 7 - Math.round(pw * 0.5);
  const py = Y - 35;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';
}

function drawDialogue(ctx, vis, Vv, now) {
  if (!ctx || !vis || !vis.dialogue) return;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const d = vis.dialogue;
  const boxW = Math.min(canvas.width - 40, 480);
  const boxH = 56;
  const bx = Math.round((canvas.width - boxW) * 0.5);
  const by = canvas.height - boxH - 14;

  ctx.fillStyle = 'rgba(20,16,10,0.90)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.beginPath();
  ctx.moveTo(bx + Math.round(boxW * 0.5) - 6, by);
  ctx.lineTo(bx + Math.round(boxW * 0.5) + 6, by);
  ctx.lineTo(bx + Math.round(boxW * 0.5), by - 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(20,16,10,0.90)';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 2, by + 2, boxW - 4, boxH - 4);
  ctx.clip();

  ctx.fillStyle = d.color || '#facc15';
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fitFn(d.name, boxW - 16), bx + 10, by + 14);

  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  const shown = fitFn(d.text, boxW - 16);
  ctx.fillText(shown, bx + 10, by + 36);
  ctx.restore();
}

function draw(ctx) {
  const vis = getState();
  const Vv = getV();
  if (!vis || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  drawVisitor(ctx, vis, Vv, n);
  drawDialogue(ctx, vis, Vv, n);
}

if (typeof window !== 'undefined') {
  if (!window.GuildVisitor) window.GuildVisitor = createState();
  window.GuildVisitor.update = update;
  window.GuildVisitor.draw = draw;
  window.GuildVisitor.__probe = function () { return { pressed: Array.from(pressed), prev: Array.from(prevPressed) }; };
  window.GuildVisitor.__rawUpdate = update;
  window.GuildVisitor.__keys = pressed;
  if (!window.__gvListeners) {
    window.__gvListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
