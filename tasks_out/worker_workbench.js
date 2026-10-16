// tasks_out/worker_workbench.js
// FOREMAN WORKBENCH -- a W museum wing prop: a gold-trimmed wooden bench with a
// desk lamp and a parchment stack. Read-only FX layer (never writes to V or to
// worker positions). Anchor: W wing (-5,3), placed with offset (-1.5,-2) so it
// stands 2+ tiles clear of the curator cart (-4.8,3.2) and the other W-wing
// props. State on window.GuildWorkbench; the client render loop auto-discovers
// the global and calls update(now)/draw(ctx) while V.gameState === 'play'.

const ANCHOR_GX = -5.0;
const ANCHOR_GY = 3.0;
const BENCH_GX = ANCHOR_GX - 1.5;   // -6.5
const BENCH_GY = ANCHOR_GY - 2.0;   //  1.0
const CART_GX = -4.8;               // existing curator cart tile
const CART_GY = 3.2;
const NEAR_DIST = 1.5;              // tiles: memo readable + panel shown
const PIN_MS = 8000;                // memo stays pinned after [E]

let lastTime = null;
let prevE = false;
const pressed = new Set();

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildWorkbench; }
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
  text = String(text == null ? '' : text);
  if (!isFinite(maxW) || maxW <= 0) return '';
  return text;
}

function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function normStatus(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'passed' || s === 'finished') return 'done';
  if (s === 'pending' || s === 'todo' || s === 'queued' || s === 'backlog' || s === 'new') return 'pending';
  if (s === 'in_progress' || s === 'inprogress' || s === 'doing' || s === 'active' || s === 'processing' || s === 'running' || s === 'started') return 'in_progress';
  if (s === 'failed' || s === 'failure' || s === 'error' || s === 'errored' || s === 'broken' || s === 'rejected') return 'failed';
  return 'other';
}

function taskTitle(task) {
  if (!task) return '';
  const t = (task.title != null ? task.title : (task.name != null ? task.name : task.id));
  return String(t == null ? '' : t).trim();
}

function createState() {
  return {
    gx: BENCH_GX,
    gy: BENCH_GY,
    near: false,
    dist: Infinity,
    pinnedUntil: 0,
    glow: 0,
    lines: [],
    counts: { done: 0, pending: 0, active: 0, failed: 0 },
    refreshAt: 0
  };
}

// Memo derived ONLY from a read of V.allTasks: counts by status + the oldest
// pending quest. Four short, actionable lines.
function computeMemo(Vv) {
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  let done = 0, pending = 0, active = 0, failed = 0;
  let oldestPending = null, oldestActive = null;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const s = normStatus(task && (task.status != null ? task.status : task.state));
    if (s === 'done') done++;
    else if (s === 'pending') { pending++; if (!oldestPending) oldestPending = task; }
    else if (s === 'in_progress') { active++; if (!oldestActive) oldestActive = task; }
    else if (s === 'failed') failed++;
  }
  const lines = ['FOREMAN MEMO'];
  if (!tasks.length) {
    lines.push('No quests on the board');
    lines.push('The guild is between jobs');
    lines.push('NEXT: ask for work');
  } else {
    lines.push('OPEN ' + pending + '   WIP ' + active + '   DONE ' + done);
    lines.push(failed > 0 ? ('FAILED ' + failed + ' - retry first') : 'No failures - keep shipping');
    if (oldestPending) lines.push('NEXT: ' + taskTitle(oldestPending));
    else if (oldestActive) lines.push('NEXT: finish ' + taskTitle(oldestActive));
    else lines.push('Queue clear - build something');
  }
  return { lines: lines.slice(0, 4), counts: { done: done, pending: pending, active: active, failed: failed } };
}

function onKeydown(e) {
  const k = e && e.key === ' ' ? ' ' : String((e && e.key) || '').toLowerCase();
  if (k) pressed.add(k);
}

function onKeyup(e) {
  const k = e && e.key === ' ' ? ' ' : String((e && e.key) || '').toLowerCase();
  if (k) pressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { lastTime = now; prevE = false; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const w = root();
  const vis = w && w.GuildVisitor;
  const hasVis = !!(vis && isFinite(vis.gx) && isFinite(vis.gy));
  const d = hasVis ? Math.hypot(vis.gx - st.gx, vis.gy - st.gy) : Infinity;
  st.dist = d;
  st.near = hasVis && d <= NEAR_DIST;

  if (now >= st.refreshAt) {
    const memo = computeMemo(Vv);
    st.lines = memo.lines;
    st.counts = memo.counts;
    st.refreshAt = now + 400;
  }

  // [E] pins the memo readable and brightens the lamp for a beat.
  const eNow = pressed.has('e');
  if (eNow && !prevE && (st.near || now < st.pinnedUntil)) {
    st.pinnedUntil = now + PIN_MS;
    st.glow = 1;
    cueFn('chime');
  }
  prevE = eNow;
  if (st.glow > 0) st.glow = Math.max(0, st.glow - dt * 1.1);
}

function drawLampGlow(ctx, cx, cy, inten) {
  if (inten <= 0.01 || typeof ctx.createRadialGradient !== 'function') return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const r = 40;
  const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,224,138,' + (0.34 * inten).toFixed(3) + ')');
  grad.addColorStop(0.5, 'rgba(212,175,55,' + (0.12 * inten).toFixed(3) + ')');
  grad.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
}

function drawBench(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 20, y + 11, 40, 5);
  }

  // legs
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(x - 17, y + 1, 4, 13);
  ctx.fillRect(x + 13, y + 1, 4, 13);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 5, y + 4, 4, 10);
  ctx.fillRect(x + 1, y + 4, 4, 10);

  // lower shelf
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 17, y + 7, 34, 3);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(x - 17, y + 10, 34, 1);

  // bench top: side face + top face
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 21, y - 5, 42, 7);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 21, y - 5, 42, 1);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 21, y - 10, 42, 6);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 21, y - 5, 42, 1);

  // gold trim
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 21, y - 5, 42, 1);
  ctx.fillRect(x - 21, y - 10, 3, 6);
  ctx.fillRect(x + 18, y - 10, 3, 6);
}

function drawLamp(ctx, now, x, y, night, boost) {
  const flick = 0.72 + 0.28 * Math.sin(now * 0.008) * Math.sin(now * 0.0031);
  const lx = x - 10;
  const ltop = y - 30;

  // base
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(lx - 4, y - 12, 9, 3);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(lx - 2, y - 14, 5, 2);

  // stem
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(lx - 1, ltop + 7, 2, 8);

  // shade
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(lx - 6, ltop, 12, 6);
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(lx - 6, ltop + 5, 12, 2);
  ctx.fillStyle = '#f3d37a';
  ctx.fillRect(lx - 6, ltop, 12, 1);

  // bulb + warm glow (always flickers; stronger at night; [E] boosts it)
  const inten = clamp((0.4 + 0.6 * night) * flick + boost * 0.6, 0, 1.4);
  drawLampGlow(ctx, lx, ltop + 7, inten);
  ctx.fillStyle = 'rgba(255,238,180,' + clamp(0.6 + boost * 0.4, 0, 1).toFixed(2) + ')';
  ctx.fillRect(lx - 2, ltop + 6, 4, 3);
}

function drawParchment(ctx, x, y) {
  // stacked sheets on the right end of the bench
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(x + 2, y - 14, 16, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x + 2, y - 14, 16, 1);
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x + 3, y - 16, 15, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x + 3, y - 16, 15, 1);
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x + 4, y - 18, 14, 3);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x + 4, y - 18, 14, 1);

  // rolled top sheet with a gold seal edge
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x + 4, y - 22, 14, 4);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 4, y - 22, 14, 1);
  ctx.fillRect(x + 17, y - 22, 1, 4);
}

function drawMemoPanel(ctx, Vv, x, y) {
  const st = getState();
  const lines = (st && Array.isArray(st.lines)) ? st.lines : [];
  if (!lines.length) return;

  const lineH = 11;
  const padX = 9;
  const padY = 8;
  const panelW = 166;
  const panelH = padY * 2 + lines.length * lineH;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);

  let px = Math.round(x - panelW / 2);
  if (canvas) px = clamp(px, 6, Math.max(6, canvas.width - panelW - 6));
  let py = Math.round(y - 46 - panelH);
  let above = true;
  if (canvas && py < 8) { above = false; py = Math.round(y + 24); }

  // pointer tail down to the bench top
  if (above && typeof ctx.beginPath === 'function') {
    ctx.fillStyle = '#6b4a2d';
    ctx.beginPath();
    ctx.moveTo(x - 5, py + panelH - 1);
    ctx.lineTo(x + 5, py + panelH - 1);
    ctx.lineTo(x, y - 12);
    ctx.closePath();
    ctx.fill();
  }

  // parchment scroll body
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(px - 2, py, panelW + 4, panelH);
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(px, py + 1, panelW, panelH - 2);
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(px + 1, py + 2, panelW - 2, panelH - 4);

  // rolled ends
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(px - 3, py - 4, panelW + 6, 5);
  ctx.fillRect(px - 3, py + panelH - 1, panelW + 6, 5);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(px - 3, py - 4, panelW + 6, 1);
  ctx.fillRect(px - 3, py + panelH + 3, panelW + 6, 1);

  // gold trim
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);

  // text (dark ink on parchment; header in deep gold)
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let i = 0; i < lines.length; i++) {
    const header = (i === 0);
    ctx.font = header ? 'bold 10px monospace' : '10px monospace';
    ctx.fillStyle = header ? '#b8860b' : '#4b321f';
    ctx.fillText(fitFn(lines[i], panelW - padX * 2), px + padX, py + padY + i * lineH);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawPrompt(ctx, now, x, y) {
  const bob = Math.sin(now * 0.0032) * 1.5;
  const px = x - 22;
  const py = y - 34 + bob;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  if (typeof ctx.beginPath === 'function') {
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', px, py + 1);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function draw(ctx) {
  const w = root();
  if (!ctx || !w) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const now = nowFn();
  const pt = isoFn(BENCH_GX, BENCH_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const night = 1 - clamp(dl, 0, 1);
  const boost = (typeof st.glow === 'number') ? st.glow : 0;

  drawBench(ctx, x, y);
  drawLamp(ctx, now, x, y, night, boost);
  drawParchment(ctx, x, y);

  if (st.near || now < st.pinnedUntil) {
    drawMemoPanel(ctx, Vv, x, y);
    drawPrompt(ctx, now, x, y);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildWorkbench) window.GuildWorkbench = createState();
  const st = window.GuildWorkbench;
  if (st.gx == null) st.gx = BENCH_GX;
  if (st.gy == null) st.gy = BENCH_GY;
  if (!Array.isArray(st.lines)) st.lines = [];
  if (st.counts == null) st.counts = { done: 0, pending: 0, active: 0, failed: 0 };
  st.update = update;
  st.draw = draw;
  st.__rawUpdate = update;
  st.__probe = function () {
    const s = getState() || {};
    const gx = (s.gx == null ? BENCH_GX : s.gx);
    const gy = (s.gy == null ? BENCH_GY : s.gy);
    return {
      gx: gx,
      gy: gy,
      near: !!s.near,
      dist: s.dist,
      cartClearance: Math.hypot(gx - CART_GX, gy - CART_GY),
      counts: s.counts || { done: 0, pending: 0, active: 0, failed: 0 },
      lines: Array.isArray(s.lines) ? s.lines.slice() : []
    };
  };
  if (!window.__gwbListeners) {
    window.__gwbListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
