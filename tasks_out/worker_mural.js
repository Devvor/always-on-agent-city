const MURAL_GX = -5.0;
const MURAL_GY = 3.5;

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
function getVisitor() {
  const w = root();
  return w && w.GuildVisitor;
}
function getState() {
  const w = root();
  return w && w.GuildMural;
}

function createState() {
  return {
    gx: MURAL_GX,
    gy: MURAL_GY,
    ticks: [],
    done: 0,
    pending: 0,
    failed: 0,
    lastTaskSig: '',
    lastGridSig: '',
    panel: null
  };
}

function normalizeStatus(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'passed' || s === 'finished') return 'done';
  if (s === 'failed' || s === 'failure' || s === 'error' || s === 'errored' || s === 'broken' || s === 'rejected') return 'failed';
  if (s === 'in_progress' || s === 'inprogress' || s === 'doing' || s === 'active' || s === 'processing' || s === 'running' || s === 'building' || s === 'started') return 'in_progress';
  return 'pending';
}

function colorForStatus(status) {
  const s = normalizeStatus(status);
  if (s === 'done') return '#d4af37';
  if (s === 'failed') return '#ef4444';
  if (s === 'in_progress') return '#3b82f6';
  return '#f59e0b';
}

function ensureCache(Vv) {
  const st = getState();
  if (!st) return null;
  try {
    const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
    const g = Vv && Vv.grid ? Vv.grid : null;
    const gridSig = g ? [g.tileW, g.tileH, g.originX, g.originY].join(',') : '0,0,0,0';
    const taskSig = tasks.length + '|' + tasks.map(function (t) {
      const v = (t && typeof t === 'object') ? (t.status != null ? t.status : (t.state != null ? t.state : '')) : (t == null ? '' : t);
      return String(v);
    }).join(',');

    if (st.lastTaskSig === taskSig && st.lastGridSig === gridSig && Array.isArray(st.ticks)) {
      return st;
    }
    st.lastTaskSig = taskSig;
    st.lastGridSig = gridSig;

    let done = 0;
    let pending = 0;
    let failed = 0;
    const ticks = [];

    const tileW = (g && isFinite(g.tileW)) ? g.tileW : 70;
    const base = isoFn(st.gx, st.gy);
    const scale = Math.min(1.4, Math.max(0.85, tileW / 70));
    const pw = Math.round(148 * scale);
    const ph = Math.round(88 * scale);
    const left = Math.round(base.x - pw * 0.5);
    const top = Math.round(base.y - ph * 0.5) - Math.round(8 * scale);
    const tickW = Math.max(2, Math.round(2 * scale));
    const tickH = Math.max(6, Math.round(9 * scale));
    const gap = Math.max(2, Math.round(3 * scale));
    const rowH = Math.max(10, Math.round(13 * scale));
    const pad = Math.max(8, Math.round(10 * scale));
    const usable = pw - pad * 2;
    const perRow = Math.max(1, Math.floor((usable + gap) / (tickW + gap)));
    const tickTop = top + Math.round(ph * 0.34);

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i] || {};
      const status = (t.status != null) ? t.status : (t.state != null ? t.state : 'pending');
      const n = normalizeStatus(status);
      if (n === 'done') done++;
      else if (n === 'failed') failed++;
      else pending++;

      const row = Math.floor(i / perRow);
      const col = i % perRow;
      ticks.push({
        x: left + pad + col * (tickW + gap),
        y: tickTop + row * rowH,
        w: tickW,
        h: tickH,
        color: colorForStatus(status)
      });
    }

    st.done = done;
    st.pending = pending;
    st.failed = failed;
    st.ticks = ticks;
    st.panel = { x: left, y: top, w: pw, h: ph };
    return st;
  } catch (e) {
    return st;
  }
}

function update(now) {
  try {
    const Vv = getV();
    const st = getState();
    if (!st) return;
    if (Vv && Vv.gameState && Vv.gameState !== 'play') return;
    ensureCache(Vv);
  } catch (e) {}
}

function draw(ctx) {
  try {
    const Vv = getV();
    if (!ctx || !Vv) return;
    if (Vv.gameState && Vv.gameState !== 'play') return;

    const st = ensureCache(Vv);
    if (!st || !st.panel) return;

    const p = st.panel;
    const base = isoFn(st.gx, st.gy);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(p.x + 4, p.y + p.h + 4, p.w - 8, 8);

    ctx.fillStyle = '#6b655d';
    ctx.fillRect(p.x, p.y, p.w, p.h);

    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(p.x, p.y, Math.max(5, Math.round(p.w * 0.16)), p.h);

    ctx.strokeStyle = '#2a241f';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);

    const baselineY = p.y + Math.round(p.h * 0.30);
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 8, baselineY);
    ctx.lineTo(p.x + p.w - 8, baselineY);
    ctx.stroke();

    for (let i = 0; i < st.ticks.length; i++) {
      const t = st.ticks[i];
      ctx.fillStyle = t.color;
      ctx.fillRect(t.x, t.y, t.w, t.h);
    }

    const countText = 'DONE ' + st.done + ' / FAIL ' + st.failed;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8e6df';
    ctx.fillText(countText, p.x + p.w * 0.5, p.y + p.h - 13);

    const visitor = getVisitor();
    let near = false;
    if (visitor && isFinite(visitor.gx) && isFinite(visitor.gy)) {
      const dist = Math.hypot(visitor.gx - st.gx, visitor.gy - st.gy);
      near = dist <= 1.8;
    }
    if (near) {
      const label = fitFn('THE GUILD RECORD - every tick is a real quest', p.w + 70);
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#f3d37a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, base.x, p.y - 6);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildMural) window.GuildMural = createState();
  window.GuildMural.update = update;
  window.GuildMural.draw = draw;
  window.GuildMural.__probe = function () {
    try {
      ensureCache(getV());
      const st = getState();
      return { done: st ? st.done : 0, pending: st ? st.pending : 0, failed: st ? st.failed : 0 };
    } catch (e) {
      return { done: 0, pending: 0, failed: 0 };
    }
  };
  window.GuildMural.__rawUpdate = update;
}

export {};
