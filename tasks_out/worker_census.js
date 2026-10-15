let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return { gx: -2.9, gy: -0.2, open: false };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildCensus; }
function isoFn(gx, gy) {
  const w = root();
  const Vv = getV();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
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

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function stateText(ws) {
  let s = '';
  if (ws == null) s = '';
  else if (typeof ws === 'string') s = ws;
  else if (ws && typeof ws.workerState === 'string') s = ws.workerState;
  else if (ws && typeof ws.state === 'string') s = ws.state;
  else if (ws && typeof ws.mode === 'string') s = ws.mode;
  else if (ws && typeof ws.status === 'string') s = ws.status;
  else s = String(ws);
  if (/nap/i.test(s)) return 'napping';
  if (/idle/i.test(s)) return 'idle';
  return 'working';
}

function archetypeFor(name) {
  const n = String(name == null ? '' : name).toLowerCase();
  if (n.indexOf('glitch') !== -1) return 'glitcher';
  if (n.indexOf('poet') !== -1) return 'poet';
  if (n.indexOf('rookie') !== -1) return 'rookie';
  if (n.indexOf('sage') !== -1) return 'sage';
  return 'rookie';
}

function gatherWorkers(Vv) {
  const workers = Array.isArray(Vv && Vv.workers) ? Vv.workers : [];
  const states = Array.isArray(Vv && Vv.workerStates) ? Vv.workerStates : [];
  const out = [];
  for (let i = 0; i < workers.length; i++) {
    const meta = workers[i];
    if (!meta || typeof meta !== 'object') continue;
    out.push({ meta: meta, state: stateText(states[i]) });
  }
  return out;
}

function onRange() {
  const w = root();
  const st = getState();
  const vis = w && w.GuildVisitor;
  if (!st || !vis) return false;
  return Math.hypot((vis.gx || 0) - st.gx, (vis.gy || 0) - st.gy) <= 1.6;
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) {
    lastTime = now;
    return;
  }
  if (Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');
  if (ePressed && !eWas) {
    if (st.open) st.open = false;
    else if (onRange()) st.open = true;
  }

  prevPressed = new Set(pressed);
}

function drawProp(ctx) {
  const Vv = getV();
  const st = getState();
  if (!ctx || !Vv || !st) return;
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 15, y + 17, 32, 5);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 16, y - 24, 32, 42);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 16, y - 24, 32, 42);

  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(x - 12, y - 19, 24, 32);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 12, y - 19, 24, 32);

  const rows = gatherWorkers(Vv);
  let onDuty = 0;
  for (let i = 0; i < rows.length; i++) if (rows[i].state === 'working') onDuty++;
  const line = onDuty + ' OF ' + rows.length + ' WORKERS ON DUTY';

  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1f2937';
  ctx.fillText(fitFn(line, 20), x, y - 17);

  if (onRange()) {
    ctx.font = 'bold 9px monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#f3d37a';
    ctx.fillText(fitFn('[E] census', 70), x, y - 27);
  }
}

function drawPanel(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !st.open || !Vv) return;
  const canvas = ctx.canvas || Vv.canvas;
  if (!canvas) return;

  const rows = gatherWorkers(Vv);
  const panelW = Math.min(canvas.width - 40, 320);
  const rowH = 20;
  const headerH = 26;
  const panelH = Math.min(canvas.height - 40, headerH + rows.length * rowH + 12);
  const bx = Math.round((canvas.width - panelW) * 0.5);
  const by = Math.round((canvas.height - panelH) * 0.5);

  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(bx, by, panelW, panelH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, panelW, panelH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 3, by + 3, panelW - 6, panelH - 6);
  ctx.clip();

  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#6b4a2f';
  ctx.fillText(fitFn('GUILD CENSUS', panelW - 20), bx + panelW * 0.5, by + 14);

  const nameX = bx + 28;
  const archX = bx + 112;
  const stateX = bx + 188;
  const doneX = bx + 250;
  const doneMaxW = bx + panelW - 12 - doneX;
  let y = by + headerH;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const working = row.state === 'working';
    ctx.fillStyle = working ? '#22c55e' : 'rgba(95, 80, 60, 0.35)';
    ctx.fillRect(bx + 12, y + 5, 7, 7);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px monospace';
    ctx.fillStyle = '#2b1d0e';
    ctx.fillText(fitFn(String(row.meta.name == null ? '' : row.meta.name), archX - nameX - 8), nameX, y + 9);
    ctx.fillText(fitFn(archetypeFor(row.meta.name), stateX - archX - 8), archX, y + 9);
    ctx.fillText(fitFn(row.state, doneX - stateX - 8), stateX, y + 9);

    ctx.textAlign = 'right';
    const tasks = Array.isArray(row.meta.tasks) ? row.meta.tasks : [];
    const doneCount = tasks.filter(function (t) { return t && t.status === 'done'; }).length;
    ctx.fillText(fitFn(doneCount + ' done', doneMaxW), bx + panelW - 12, y + 9);

    y += rowH;
  }

  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;
  drawProp(ctx);
  drawPanel(ctx);
}

if (typeof window !== 'undefined') {
  if (!window.GuildCensus) window.GuildCensus = createState();
  const state = window.GuildCensus;
  state.update = update;
  state.draw = draw;
  state.__probe = function () {
    return {
      gx: state.gx,
      gy: state.gy,
      open: state.open,
      pressed: Array.from(pressed),
      prevPressed: Array.from(prevPressed),
      inRange: onRange()
    };
  };
  state.__rawUpdate = update;
  state.__keys = pressed;
  if (!window.__gcensListeners) {
    window.__gcensListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
