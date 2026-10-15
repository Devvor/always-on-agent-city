const BUILDINGS = [];

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
function getState() { const w = root(); return w && w.GuildRoutines; }

function hashString(str) {
  let h = 0;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function workerName(meta, index) {
  if (meta && meta.name != null) return String(meta.name);
  return 'WORKER ' + (index + 1);
}

function computeSlot(name, nowMs) {
  const minute = Math.floor((typeof nowMs === 'number' ? nowMs : Date.now()) / 60000);
  const roll = (hashString(name) + minute * 37) % 100;
  if (roll < 60) return 'DESK';
  if (roll < 85) return 'BREAK';
  return 'PATROL';
}

function createState() {
  return {
    slots: {},
    board: { gx: -1.2, gy: 4.8 },
    lastTime: null
  };
}

function hasCore() {
  const w = root();
  const Vv = getV();
  return !!(w && Vv && Vv.gameState === 'play' && typeof w.iso === 'function');
}

function visitorPoint() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return null;
  return isoFn(vis.gx, vis.gy);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !hasCore() || !Array.isArray(Vv.workers)) {
    if (state) state.lastTime = now;
    return;
  }
  if (state.lastTime === null) state.lastTime = now;
  state.lastTime = now;

  const nextSlots = {};
  for (let i = 0; i < Vv.workers.length; i++) {
    const meta = Vv.workers[i];
    const name = workerName(meta, i);
    nextSlots[name] = computeSlot(name, Date.now());
  }
  state.slots = nextSlots;
  state.board = { gx: -1.2, gy: 4.8 };
}

function drawGhost(ctx, x, y, alpha) {
  if (!ctx || !isFinite(x) || !isFinite(y)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(Math.round(x) - 5, Math.round(y) - 18, 10, 8);
  ctx.fillRect(Math.round(x) - 7, Math.round(y) - 10, 14, 15);
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#f3d37a';
  ctx.fillRect(Math.round(x) - 2, Math.round(y) - 16, 4, 3);
  ctx.restore();
}

function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  const Vv = getV();
  if (!state || !hasCore()) return;

  const w = root();
  state.board = state.board || { gx: -1.2, gy: 4.8 };
  const now = nowFn();

  const vpt = visitorPoint();

  if (Array.isArray(Vv.workerStates) && Array.isArray(Vv.workers)) {
    for (let i = 0; i < Vv.workers.length; i++) {
      const meta = Vv.workers[i];
      const name = workerName(meta, i);
      const slot = state.slots && typeof state.slots[name] === 'string' ? state.slots[name] : computeSlot(name, Date.now());
      if (slot !== 'BREAK') continue;

      const ws = Vv.workerStates[i];
      if (!ws || !isFinite(ws.x) || !isFinite(ws.y)) continue;

      const hash = hashString(name);
      const campPt = isoFn(0, -1);
      const target = { x: campPt.x + 12, y: campPt.y + 22 };
      const phase = 0.5 + 0.5 * Math.sin(now * 0.0011 + hash * 0.001);
      const gx = lerp(ws.x, target.x, phase);
      const gy = lerp(ws.y, target.y, phase);

      if (vpt) {
        const dist = Math.hypot(gx - vpt.x, gy - vpt.y);
        if (dist < 26) continue;
      }
      drawGhost(ctx, gx, gy, 0.34);
    }
  }

  const bp = isoFn(state.board.gx, state.board.gy);
  const boardW = 132;
  const boardH = 20 + (Array.isArray(Vv.workers) ? Vv.workers.length : 0) * 12 + 8;
  const x = Math.round(bp.x - boardW * 0.5);
  const y = Math.round(bp.y - boardH * 0.5);

  ctx.save();
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 3, y - 3, boardW + 6, boardH + 6);
  ctx.fillStyle = '#3b2a18';
  ctx.fillRect(x, y, boardW, boardH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, boardW, boardH);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const header = fitFn('SHIFT ROSTER', boardW - 8);
  ctx.fillText(header, x + boardW * 0.5, y + 8);

  const contentX = x + 6;
  const contentY = y + 16;
  const contentW = boardW - 12;
  const contentH = boardH - 20;
  ctx.beginPath();
  ctx.rect(contentX, contentY, contentW, contentH);
  ctx.clip();

  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let rowY = contentY + 6;
  for (let i = 0; i < workers.length; i++) {
    const meta = workers[i];
    const name = workerName(meta, i);
    const slot = state.slots && typeof state.slots[name] === 'string' ? state.slots[name] : computeSlot(name, Date.now());
    const line = fitFn(name + '  ' + slot, contentW);
    ctx.fillStyle = slot === 'BREAK' ? '#d4af37' : '#ffffff';
    ctx.fillText(line, contentX, rowY);
    rowY += 12;
    if (rowY > contentY + contentH) break;
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

if (typeof window !== 'undefined') {
  if (!window.GuildRoutines) window.GuildRoutines = createState();
  const st = window.GuildRoutines;
  st.slots = st.slots || {};
  st.board = st.board || { gx: -1.2, gy: 4.8 };
  st.update = update;
  st.draw = draw;
  st.__probe = function () { return { slots: st.slots }; };
}

export {};
