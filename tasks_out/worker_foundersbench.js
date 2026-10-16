const BENCH_X = 4.5;
const BENCH_Y = -2.5;
const PLAQUE_GX = 6.2;
const PLAQUE_GY = -3.2;
const NEAR_PROMPT = 1.5;
const DWELL_RADIUS = 1.0;
const DWELL_TIME = 1.5;
const AWAY_RELEASE = 1.5;

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildFoundersbench; }

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

function softCue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

function tileDist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function firstFounderName() {
  const Vv = getV();
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  if (!tasks.length) return '';
  let task = null;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t && t.status === 'done' && (t.title != null || t.id != null)) { task = t; break; }
  }
  if (!task) {
    const t0 = tasks[0];
    if (t0 && (t0.title != null || t0.id != null)) task = t0;
  }
  if (!task) return '';
  const title = String(task.title != null ? task.title : task.id).trim();
  return title ? fitFn(title, 34) : '';
}

function plaqueLines() {
  const lines = ['For the ones who started it'];
  const name = firstFounderName();
  if (name) lines.push(name);
  return lines;
}

function createState() {
  return {
    x: BENCH_X,
    y: BENCH_Y,
    sitting: false,
    near: false,
    dwell: 0,
    heart: null,
    plaques: [{ gx: PLAQUE_GX, gy: PLAQUE_GY }]
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const Vv = getV();
  const st = getState();
  if (!w || !Vv || !st || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const vis = getVisitor();
  const hasVis = !!(vis && isFinite(vis.gx) && isFinite(vis.gy));
  const d = hasVis ? tileDist(vis.gx, vis.gy, BENCH_X, BENCH_Y) : Infinity;
  st.near = hasVis && d <= NEAR_PROMPT;
  st.dist = d;

  if (hasVis && !st.sitting) {
    if (d <= DWELL_RADIUS) st.dwell += dt;
    else st.dwell = 0;
    if (st.dwell >= DWELL_TIME) {
      st.sitting = true;
      st.dwell = 0;
      st.heart = { t: 0, dur: 1.6 };
      softCue('chime');
    }
  } else if (!hasVis) {
    st.dwell = 0;
  }

  if (st.sitting && (!hasVis || d > AWAY_RELEASE)) {
    st.sitting = false;
    st.dwell = 0;
  }

  if (st.heart) {
    st.heart.t += dt;
    if (st.heart.t >= st.heart.dur) st.heart = null;
  }
}

function drawPaw(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 3.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(Math.round(cx - 3), Math.round(cy), 6, 4);
  }
  const toes = [[-4, -2], [-1.4, -3.4], [1.4, -3.4], [4, -2]];
  for (let i = 0; i < toes.length; i++) {
    const tx = cx + toes[i][0];
    const ty = cy + toes[i][1];
    if (typeof ctx.arc === 'function') {
      ctx.beginPath();
      ctx.arc(tx, ty, 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
    }
  }
}

function drawPlaque(ctx, Vv, now) {
  const pt = isoFn(PLAQUE_GX, PLAQUE_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 10, y, 20, 4);
  }
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 15, y - 30, 30, 30);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 14, y - 29, 28, 28);
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(x - 14, y - 29, 28, 2);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 14, y - 3, 28, 2);
  drawPaw(ctx, x, y - 21, '#d4af37');

  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  ctx.fillStyle = dl < 0.3 ? '#fde68a' : '#f3d37a';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = plaqueLines();
  for (let i = 0; i < lines.length && i < 3; i++) {
    const shown = fitFn(lines[i], 26);
    ctx.fillText(shown, x, y - 11 + i * 8);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawBench(ctx, Vv, now, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 14, y + 1, 28, 5);
  }
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 13, y - 6, 4, 9);
  ctx.fillRect(x + 9, y - 6, 4, 9);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 13, y + 1, 4, 2);
  ctx.fillRect(x + 9, y + 1, 4, 2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 15, y - 9, 30, 5);
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(x - 15, y - 9, 30, 1);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 15, y - 4, 30, 2);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 13, y - 16, 3, 8);
  ctx.fillRect(x + 10, y - 16, 3, 8);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 14, y - 18, 28, 3);
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(x - 14, y - 18, 28, 1);
}

function drawSeated(ctx, Vv, now, x, y) {
  const t = now * 0.001;
  const breath = Math.sin(t * 1.5) * 1.0;
  const seatY = y - 9;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 6, seatY + 4, 12, 2);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 4, seatY + 3, 3, 7);
  ctx.fillRect(x + 1, seatY + 3, 3, 7);
  const bodyTop = seatY - 13 + breath;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x - 5, bodyTop, 10, 13);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x - 7, bodyTop + 2, 2, 8);
  ctx.fillRect(x + 5, bodyTop + 2, 2, 8);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 5, bodyTop + 7, 10, 2);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x - 4, bodyTop - 8, 8, 8);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 4, bodyTop - 9, 8, 2);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x - 2, bodyTop - 5, 2, 2);
  ctx.fillRect(x + 1, bodyTop - 5, 2, 2);
  ctx.restore();
}

function drawPrompt(ctx, st, now, x, y) {
  if (!st || !st.near || st.sitting) return;
  const t = now * 0.001;
  const bob = Math.sin(t * 3.2) * 1.5;
  const px = x;
  const py = y - 36 + bob;
  ctx.save();
  ctx.globalAlpha = 0.85;
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

function drawHeart(ctx, st, now, x, y) {
  const h = st && st.heart;
  if (!h) return;
  const p = h.t / h.dur;
  if (!isFinite(p) || p < 0 || p > 1) return;
  const rise = p * 26;
  const sway = Math.sin(p * Math.PI * 2) * 4;
  const alpha = p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3);
  const size = 4;
  const hx = x + sway;
  const hy = y - 30 - rise;
  ctx.save();
  ctx.globalAlpha = alpha * 0.95;
  ctx.fillStyle = '#d4af37';
  if (typeof ctx.bezierCurveTo === 'function') {
    ctx.beginPath();
    ctx.moveTo(hx, hy + size * 0.7);
    ctx.bezierCurveTo(hx - size * 1.1, hy - size * 0.2, hx - size * 0.6, hy - size, hx, hy - size * 0.25);
    ctx.bezierCurveTo(hx + size * 0.6, hy - size, hx + size * 1.1, hy - size * 0.2, hx, hy + size * 0.7);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 4, 4);
  }
  ctx.restore();
}

function draw(ctx) {
  const w = root();
  if (!ctx || !w) return;
  const Vv = getV();
  const st = getState();
  if (!Vv || !st || Vv.gameState !== 'play') return;
  const now = nowFn();
  const bp = isoFn(BENCH_X, BENCH_Y);
  const x = Math.round(bp.x);
  const y = Math.round(bp.y);
  drawPlaque(ctx, Vv, now);
  drawBench(ctx, Vv, now, x, y);
  if (st.sitting) drawSeated(ctx, Vv, now, x, y);
  drawPrompt(ctx, st, now, x, y);
  drawHeart(ctx, st, now, x, y);
}

if (typeof window !== 'undefined') {
  if (!window.GuildFoundersbench) window.GuildFoundersbench = createState();
  const st = window.GuildFoundersbench;
  if (st.x == null) st.x = BENCH_X;
  if (st.y == null) st.y = BENCH_Y;
  if (typeof st.sitting !== 'boolean') st.sitting = false;
  if (!Array.isArray(st.plaques)) st.plaques = [{ gx: PLAQUE_GX, gy: PLAQUE_GY }];
  if (st.heart === undefined) st.heart = null;
  st.update = update;
  st.draw = draw;
  st.__rawUpdate = update;
  st.__probe = function () {
    const s = window.GuildFoundersbench;
    return {
      x: s.x,
      y: s.y,
      sitting: !!s.sitting,
      near: !!s.near,
      plaques: Array.isArray(s.plaques) ? s.plaques.length : 0
    };
  };
}

export {};
