const BENCH_GX = -2;
const BENCH_GY = -2;
const BENCH_SEAT_GX = BENCH_GX + 0.5;
const BENCH_SEAT_GY = BENCH_GY + 0.5;

let pressed = new Set();
let prevPressed = new Set();
let state = null;

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
  text = (text == null ? '' : String(text));
  if (!isFinite(maxW) || maxW <= 0) return '';
  return text;
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildStoryBench; }
function allTasksFn() {
  const w = root();
  if (!w) return [];
  if (Array.isArray(w.allTasks)) return w.allTasks;
  if (w.V && Array.isArray(w.V.allTasks)) return w.V.allTasks;
  return [];
}
function hasContract() {
  const w = root();
  if (!w || !w.V || typeof w.iso !== 'function' || typeof w.fitText !== 'function' || !w.GuildVisitor || typeof w.cue !== 'function') return false;
  return Array.isArray(w.allTasks) || (w.V && Array.isArray(w.V.allTasks));
}
function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}
function createState() {
  return { mode: 'idle', visitorSitting: false, workerIndex: -1, bubbleText: null, bubbleStart: 0, bubbleDur: 6, prevPressed: new Set() };
}
function craftStory(index, meta, allTasks) {
  const tasks = Array.isArray(allTasks) && allTasks.length ? allTasks : (Array.isArray(meta && meta.tasks) ? meta.tasks : []);
  let task = null;
  for (let i = 0; i < tasks.length; i++) { if (tasks[i] && (tasks[i].title != null || tasks[i].id != null)) { task = tasks[i]; break; } }
  const title = task ? String(task.title != null ? task.title : task.id) : 'untitled task';
  const status = task ? String(task.status != null ? task.status : 'done') : 'idle';
  const step = index === 1 || (meta && /step/i.test(String(meta.name || '')));
  let line = step
    ? 'Step5 archives "' + title + '" (' + status + ') into the W wing.'
    : 'Missingno files "' + title + '" (' + status + ') into the W wing.';
  return fitFn(line, 220);
}
function findIdleWorker() {
  const Vv = getV();
  if (!Vv || !Array.isArray(Vv.workerStates)) return -1;
  for (let i = 0; i < Vv.workerStates.length; i++) {
    const w = Vv.workerStates[i];
    const meta = (Array.isArray(Vv.workers) ? Vv.workers[i] : null) || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(w && w.tasks) ? w.tasks : []);
    const working = tasks.some(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
    if (!working) return i;
  }
  return -1;
}
function workerSeatSpot() {
  return isoFn(BENCH_GX + 1.0, BENCH_GY + 0.4);
}
function lockVisitorSeat() {
  if (!state || !state.visitorSitting) return;
  const vis = getVisitor();
  if (!vis) return;
  vis.gx = BENCH_SEAT_GX;
  vis.gy = BENCH_SEAT_GY;
  vis.moving = false;
  vis.walkFrame = 0;
  vis.walkTimer = 0;
}
function onKeydown(e) {
  const k = e && e.key === ' ' ? ' ' : String((e && e.key) || '').toLowerCase();
  if (!k) return;
  pressed.add(k);
}
function onKeyup(e) {
  const k = e && e.key === ' ' ? ' ' : String((e && e.key) || '').toLowerCase();
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}
function update(now) {
  if (typeof now !== 'number') now = nowFn();
  if (!state) { if (hasContract()) initModule(); if (!state) return; }
  const Vv = getV();
  const vis = getVisitor();
  if (!Vv || Vv.gameState !== 'play' || !vis) {
    prevPressed = new Set(pressed);
    return;
  }
  const eNow = pressed.has('e') || pressed.has(' ');
  const eWas = prevPressed.has('e') || prevPressed.has(' ');
  const eEdge = eNow && !eWas;

  const benchTileDist = Math.hypot(vis.gx - (BENCH_GX + 0.5), vis.gy - (BENCH_GY + 0.5));
  const nearBench = isFinite(benchTileDist) && benchTileDist <= 1.7;

  if (eEdge && nearBench) {
    if (!state.visitorSitting) {
      const idx = findIdleWorker();
      if (idx >= 0) {
        state.visitorSitting = true;
        state.workerIndex = idx;
        state.bubbleText = null;
        state.bubbleStart = 0;
        const w = Vv.workerStates && Vv.workerStates[idx];
        const spot = workerSeatSpot();
        if (w) {
          w.mode = 'idle';
          w.workerState = 'IDLE';
          w.wanderPlan = { nextAt: 99999, mode: 'campfire', spot: spot };
          w.idleArrivedAt = 0;
          w.sitting = true;
        }
        vis.gx = BENCH_SEAT_GX;
        vis.gy = BENCH_SEAT_GY;
        vis.moving = false;
        vis.walkFrame = 0;
      }
    } else {
      state.visitorSitting = false;
      const idx = state.workerIndex;
      if (idx >= 0 && Vv.workerStates && Vv.workerStates[idx]) {
        const w = Vv.workerStates[idx];
        w.wanderPlan = { nextAt: 0, mode: 'campfire', spot: isoFn(0, -1) };
        w.sitting = false;
      }
      state.workerIndex = -1;
    }
  }

  if (state.visitorSitting && state.workerIndex >= 0) {
    const w = Vv.workerStates && Vv.workerStates[state.workerIndex];
    if (w) {
      const spot = workerSeatSpot();
      if (!w.wanderPlan || w.wanderPlan.mode !== 'campfire') {
        w.wanderPlan = { nextAt: 99999, mode: 'campfire', spot: spot };
      }
      if (!state.bubbleText) {
        const dist = Math.hypot(w.x - spot.x, w.y - spot.y);
        if (dist <= 3.5 || w.atDesk) {
          const meta = Array.isArray(Vv.workers) ? (Vv.workers[state.workerIndex] || {}) : {};
          state.bubbleText = craftStory(state.workerIndex, meta, allTasksFn());
          state.bubbleStart = now;
          try { const r = root(); if (r && typeof r.cue === 'function') r.cue('done'); } catch (e) {}
        }
      }
    }
  }

  if (state.bubbleText) {
    const age = (now - state.bubbleStart) / 1000;
    if (isFinite(age) && age >= state.bubbleDur) state.bubbleText = null;
  }

  lockVisitorSeat();
  prevPressed = new Set(pressed);
}
function drawBench(ctx, Vv, now) {
  const pt = isoFn(BENCH_GX + 0.5, BENCH_GY + 0.5);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 15, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 12, y + 14, 24, 5);
  }
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 12, y - 1, 3, 13);
  ctx.fillRect(x + 9, y - 1, 3, 13);
  ctx.fillRect(x - 7, y - 1, 2, 12);
  ctx.fillRect(x + 5, y - 1, 2, 12);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 14, y - 7, 28, 5);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 14, y - 7, 28, 1);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 14, y - 15, 28, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 14, y - 11, 28, 2);

  if (state) {
    const vis = getVisitor();
    let nearBench = false;
    if (vis) {
      const d = Math.hypot(vis.gx - (BENCH_GX + 0.5), vis.gy - (BENCH_GY + 0.5));
      nearBench = isFinite(d) && d <= 1.7;
    }
    if (nearBench && !state.visitorSitting) {
      const tw = 58;
      const bx = x - Math.round(tw * 0.5);
      const by = y - 40;
      ctx.fillStyle = 'rgba(10,10,12,0.88)';
      ctx.fillRect(bx, by, tw, 14);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, tw, 14);
      ctx.fillStyle = '#f3d37a';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn('E to sit', tw - 6), x, by + 7);
      ctx.textAlign = 'left';
    }
  }
}
function drawBubble(ctx, Vv, now) {
  if (!state || !state.bubbleText) return;
  const age = (now - state.bubbleStart) / 1000;
  if (!isFinite(age) || age < 0) return;
  if (age >= state.bubbleDur) { state.bubbleText = null; return; }
  const alpha = age <= 4 ? 1 : Math.max(0, 1 - (age - 4) / 2);
  const color = state.workerIndex >= 0 && Array.isArray(Vv.workers) ? workerColor(state.workerIndex, (Vv.workers[state.workerIndex] || {}).name) : '#facc15';
  let bx = 0, by = 0, tipX = 0, tipY = 0;
  if (state.workerIndex >= 0 && Array.isArray(Vv.workerStates) && Vv.workerStates[state.workerIndex]) {
    const w = Vv.workerStates[state.workerIndex];
    tipX = Math.round(w.x + 8);
    tipY = Math.round(w.y - 20);
    bx = tipX - 56;
    by = Math.round(w.y - 58);
  } else {
    const pt = isoFn(BENCH_GX + 0.5, BENCH_GY + 0.5);
    tipX = Math.round(pt.x + 8);
    tipY = Math.round(pt.y - 10);
    bx = tipX - 56;
    by = tipY - 32;
  }
  const bw = 112;
  const bh = 16;
  bx = Math.max(4, bx);
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (canvas) bx = Math.min(bx, canvas.width - bw - 4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 - 3, by + bh);
  ctx.lineTo(bx + bw * 0.5 + 3, by + bh);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 - 3, by + bh);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 + 3, by + bh);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fitFn(state.bubbleText, bw - 12), bx + 6, by + bh * 0.5);
  ctx.restore();
}
function draw(ctx) {
  if (!state) { if (hasContract()) initModule(); if (!state) return; }
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  drawBench(ctx, Vv, n);
  drawBubble(ctx, Vv, n);
}
function initModule() {
  if (!hasContract()) return;
  if (typeof window !== 'undefined' && !window.GuildStoryBench) window.GuildStoryBench = createState();
  state = getState();
  if (!state) return;
  state.update = update;
  state.draw = draw;
  if (typeof window !== 'undefined' && !window.__storyBenchListeners) {
    window.__storyBenchListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
  const vis = getVisitor();
  if (vis && typeof vis.update === 'function' && !vis.__storyBenchWrapped) {
    const original = vis.update;
    vis.update = function (now) {
      const r = original(now);
      lockVisitorSeat();
      return r;
    };
    vis.__storyBenchWrapped = true;
  }
}
if (typeof window !== 'undefined') {
  initModule();
}
export {};
