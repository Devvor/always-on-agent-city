let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;
let cachedTasksRef = null;
let cachedTasksLen = -1;
let cachedRows = [];
let panelRect = null;
let lastCanvas = null;

const PW = 380;
const PH = 260;
const ROW_H = 18;
const LIST_PAD = 14;

function createState() {
  return { gx: -2.8, gy: 2.6, open: false, scroll: 0 };
}

function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function getV() {
  const w = root();
  return w && w.V;
}

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
  const Vv = getV();
  const ctx = Vv && Vv.ctx;
  if (!ctx) return String(text == null ? '' : text);
  text = String(text == null ? '' : text);
  if (!isFinite(maxW) || maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  const ell = '\u2026';
  for (let i = text.length; i > 0; i--) {
    const cand = text.slice(0, i) + ell;
    if (ctx.measureText(cand).width <= maxW) return cand;
  }
  return ctx.measureText(ell).width <= maxW ? ell : '';
}

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

function getState() {
  const w = root();
  return w && w.GuildArchives;
}

function getCanvas() {
  const Vv = getV();
  if (Vv && Vv.canvas) return Vv.canvas;
  if (lastCanvas) return lastCanvas;
  const w = root();
  return (w && w.V && w.V.canvas) ? w.V.canvas : null;
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function visitorNear() {
  const st = getState();
  if (!st) return false;
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return Math.hypot(st.gx - vis.gx, st.gy - vis.gy) <= 1.6;
}

function taskDateStr(updatedAt) {
  if (updatedAt == null) return '';
  try {
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  } catch (e) {
    return '';
  }
}

function dateTs(updatedAt) {
  if (updatedAt == null) return -Infinity;
  const n = Date.parse(updatedAt);
  return isNaN(n) ? -Infinity : n;
}

function getDoneTasks() {
  const Vv = getV();
  const all = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  if (all !== cachedTasksRef || all.length !== cachedTasksLen) {
    cachedTasksRef = all;
    cachedTasksLen = all.length;
    const done = [];
    for (let i = 0; i < all.length; i++) {
      const t = all[i];
      if (t && t.status === 'done') done.push(t);
    }
    const rows = done.map(function (t) {
      const id = (t.id != null) ? t.id : '';
      const titleRaw = (t.title != null) ? t.title : (t.id != null ? t.id : '');
      const fittedTitle = fitFn(String(titleRaw), PW - LIST_PAD * 2);
      const date = taskDateStr(t.updated_at);
      return {
        id: id,
        title: titleRaw,
        text: String(id) + ' - ' + fittedTitle + ' - ' + date,
        task: t
      };
    });
    rows.sort(function (a, b) {
      const ta = dateTs(a.task.updated_at);
      const tb = dateTs(b.task.updated_at);
      if (tb > ta) return 1;
      if (ta > tb) return -1;
      return 0;
    });
    cachedRows = rows;
  }
  return cachedRows || [];
}

function clampScroll(st) {
  if (!st) return;
  if (typeof st.scroll !== 'number' || !isFinite(st.scroll)) st.scroll = 0;
  const rows = getDoneTasks();
  const listH = PH - 88;
  const contentH = rows.length ? rows.length * ROW_H : listH;
  const max = Math.max(0, contentH - listH);
  if (st.scroll < 0) st.scroll = 0;
  if (st.scroll > max) st.scroll = max;
}

function toggleOpen() {
  const st = getState();
  if (!st) return;
  const wasOpen = !!st.open;
  st.open = !st.open;
  if (st.open && !wasOpen) {
    try {
      const w = root();
      if (w && typeof w.cue === 'function') w.cue('done');
    } catch (e) {}
  }
  if (!st.open) st.scroll = 0;
}

function canvasPoint(e) {
  const canvas = getCanvas();
  if (canvas && typeof canvas.getBoundingClientRect === 'function') {
    try {
      const rect = canvas.getBoundingClientRect();
      const rw = rect.width || canvas.width || 1;
      const rh = rect.height || canvas.height || 1;
      return {
        x: (e.clientX - rect.left) * (canvas.width / rw),
        y: (e.clientY - rect.top) * (canvas.height / rh)
      };
    } catch (err) {}
  }
  if (typeof e.offsetX === 'number' && typeof e.offsetY === 'number') {
    return { x: e.offsetX, y: e.offsetY };
  }
  return { x: 0, y: 0 };
}

function mapCanvasToUser(pt) {
  const Vv = getV();
  const canvas = getCanvas();
  const cam = Vv && Vv.camera;
  if (!canvas || !cam) return pt || { x: 0, y: 0 };
  const z = isFinite(cam.zoom) && cam.zoom ? cam.zoom : 1;
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.5;
  const panX = isFinite(cam.x) ? cam.x : 0;
  const panY = isFinite(cam.y) ? cam.y : 0;
  return {
    x: ((pt.x - cx) / z) - panX + cx,
    y: ((pt.y - cy) / z) - panY + cy
  };
}

function drawLectern(ctx, st, now) {
  if (!ctx || !st) return;
  const pos = isoFn(st.gx, st.gy);
  const x = Math.round(pos.x);
  const y = Math.round(pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 15, y + 2, 30, 4);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 2, y - 20, 4, 22);

  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(x - 14, y - 27, 28, 12);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 12, y - 30, 24, 3);
  ctx.fillRect(x - 10, y - 33, 20, 3);

  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(x - 11, y - 26, 10, 9);
  ctx.fillRect(x + 1, y - 26, 10, 9);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 1, y - 26, 2, 9);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 14, y - 27, 28, 1);
  ctx.fillRect(x - 14, y - 16, 28, 1);
  ctx.fillRect(x - 14, y - 27, 1, 12);
  ctx.fillRect(x + 13, y - 27, 1, 12);

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x + 14, y - 7, 4, 1);
  ctx.fillRect(x + 16, y - 6, 3, 1);
  ctx.fillRect(x + 18, y - 5, 2, 1);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 19, y - 4, 1, 1);
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const st = getState();
  const Vv = getV();
  const play = !!(Vv && Vv.gameState === 'play');

  if (st && play && k === 'e') {
    if (!prevPressed.has(k)) {
      if (st.open || visitorNear()) {
        toggleOpen();
        try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (err) {}
      }
    }
  }

  if (st && st.open && (k === 'arrowup' || k === 'arrowdown')) {
    if (k === 'arrowup') st.scroll -= ROW_H * 2;
    else st.scroll += ROW_H * 2;
    clampScroll(st);
    try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (err) {}
  }

  if (k === 'e' || k === 'arrowup' || k === 'arrowdown') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function onWheel(e) {
  const st = getState();
  if (!st || !st.open) return;
  const rect = panelRect;
  if (!rect) return;
  let pt = null;
  try { pt = canvasPoint(e); } catch (err) { return; }
  if (!pt) return;
  const mapped = mapCanvasToUser(pt);
  if (mapped.x < rect.x || mapped.x > rect.x + rect.w ||
      mapped.y < rect.y || mapped.y > rect.y + rect.h) return;

  const delta = (e && typeof e.deltaY === 'number') ? e.deltaY : 0;
  st.scroll += delta;
  clampScroll(st);
  try { if (e && typeof e.preventDefault === 'function') e.preventDefault(); } catch (err) {}
  try { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); } catch (err) {}
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) {
    lastTime = now;
    return;
  }

  if (Vv && Vv.gameState === 'play') {
    const ePressed = pressed.has('e');
    const eWas = prevPressed.has('e');
    if (ePressed && !eWas) {
      if (st.open || visitorNear() || !(root() && root().GuildVisitor)) {
        toggleOpen();
      }
    }
  }

  try { clampScroll(st); } catch (e) {}
  try { getDoneTasks(); } catch (e) {}

  lastTime = now;
  prevPressed = new Set(pressed);
}

function drawPanel(ctx, st, now) {
  if (!ctx || !st) return;
  const canvas = getCanvas();
  if (canvas) lastCanvas = canvas;
  const cw = (canvas && isFinite(canvas.width)) ? canvas.width : (ctx.canvas && isFinite(ctx.canvas.width) ? ctx.canvas.width : 640);
  const ch = (canvas && isFinite(canvas.height)) ? canvas.height : (ctx.canvas && isFinite(ctx.canvas.height) ? ctx.canvas.height : 480);

  const px = Math.round((cw - PW) * 0.5);
  const py = Math.round((ch - PH) * 0.5);
  panelRect = { x: px, y: py, w: PW, h: PH };

  ctx.fillStyle = '#1c1a16';
  ctx.fillRect(px, py, PW, PH);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, PW, PH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, PW, PH);
  ctx.clip();

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUILD ARCHIVES', px + PW * 0.5, py + 22);

  const listX = px + LIST_PAD;
  const listY = py + 44;
  const listW = PW - LIST_PAD * 2;
  const listH = PH - 88;

  clampScroll(st);

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX, listY, listW, listH);
  ctx.clip();

  const rows = getDoneTasks();
  if (!rows.length) {
    ctx.fillStyle = '#e8e6df';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('the archives await their first entry...', listX + listW * 0.5, listY + listH * 0.5);
  } else {
    let ry = listY - st.scroll;
    for (let i = 0; i < rows.length; i++) {
      const rowY = ry;
      if (rowY + ROW_H > listY && rowY < listY + listH) {
        ctx.fillStyle = (i % 2 === 0) ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.20)';
        ctx.fillRect(listX, rowY, listW, ROW_H);
        ctx.fillStyle = '#e8e6df';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(rows[i].text, listX + 4, rowY + ROW_H * 0.5);
      }
      ry += ROW_H;
    }
  }
  ctx.restore();

  ctx.fillStyle = '#d4af37';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('[E] CLOSE', px + PW * 0.5, py + PH - 14);

  ctx.restore();
  ctx.textAlign = 'left';
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const n = nowFn();
  if (!st) return;

  drawLectern(ctx, st, n);

  if (visitorNear()) {
    const pos = isoFn(st.gx, st.gy);
    const x = Math.round(pos.x);
    const y = Math.round(pos.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 74, y - 50, 148, 24);
    ctx.clip();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d4af37';
    const floatY = y - 38 + Math.round(Math.sin(n * 0.004) * 1);
    ctx.fillText('[E] READ THE ARCHIVES', x, floatY);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  if (st.open) drawPanel(ctx, st, n);
}

if (typeof window !== 'undefined') {
  if (!window.GuildArchives) window.GuildArchives = createState();
  window.GuildArchives.update = update;
  window.GuildArchives.draw = draw;
  window.GuildArchives.__probe = function () {
    return {
      pressed: Array.from(pressed),
      prev: Array.from(prevPressed),
      open: !!(getState() && getState().open),
      scroll: getState() ? getState().scroll : 0,
      panel: panelRect
    };
  };
  window.GuildArchives.__rawUpdate = update;
  window.GuildArchives.__keys = pressed;
  if (!window.__gaListeners) {
    window.__gaListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  }
}

export {};
