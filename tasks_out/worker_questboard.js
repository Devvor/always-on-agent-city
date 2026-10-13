const BUILDING_POSTS = [];

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
function getState() { const w = root(); return w && w.GuildQuestBoard; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

function createState() {
  return { gx: -1.6, gy: 4.2, open: false, scroll: 0, lastToggle: 0 };
}

let pressed = new Set();
let prevPressed = new Set();

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }

function visitorInRange(vis, board) {
  if (!vis || typeof vis !== 'object' || !board) return false;
  if (!isFiniteNum(vis.gx) || !isFiniteNum(vis.gy)) return false;
  if (!isFiniteNum(board.gx) || !isFiniteNum(board.gy)) return false;
  return Math.hypot(vis.gx - board.gx, vis.gy - board.gy) <= 1.6;
}

function statusColor(status) {
  const s = String(status == null ? '' : status).toLowerCase();
  if (s === 'done') return '#22c55e';
  if (s === 'pending') return '#f59e0b';
  if (s === 'failed') return '#ef4444';
  return '#e8e6df';
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const Vv = getV();
  const board = getState();
  const vis = getVisitor();
  if (board && Vv && Vv.gameState === 'play' && k === 'e' && !prevPressed.has('e')) {
    if (visitorInRange(vis, board)) {
      board.open = !board.open;
      board.scroll = 0;
      board.lastToggle = nowFn();
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  if (k === 'e') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const Vv = getV();
  if (!w || !Vv || Vv.gameState !== 'play') return;
  const board = getState();
  if (!board) return;
  const vis = getVisitor();
  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');
  if (!eWas && ePressed && visitorInRange(vis, board)) {
    board.open = !board.open;
    board.scroll = 0;
    board.lastToggle = now;
  }
  prevPressed = new Set(pressed);
}

function drawBoard(ctx, board, Vv, now) {
  if (!ctx || !board) return;
  const p = isoFn(board.gx, board.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 15, y - 2, 4, 30);
  ctx.fillRect(x + 11, y - 2, 4, 30);

  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(x - 20, y - 28, 40, 24);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 20, y - 28, 40, 4);
  ctx.fillRect(x - 20, y - 8, 40, 4);
  ctx.fillRect(x - 20, y - 28, 4, 24);
  ctx.fillRect(x + 16, y - 28, 4, 24);

  const paperOffsets = [-14, -4, 6];
  for (let i = 0; i < paperOffsets.length; i++) {
    const ox = paperOffsets[i];
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(x + ox, y - 22, 9, 11);
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x + ox + 3, y - 24, 2, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(x + ox + 1, y - 19, 7, 1);
    ctx.fillRect(x + ox + 1, y - 16, 7, 1);
  }
}

function drawPanel(ctx, board, Vv, now) {
  if (!ctx || !board || !board.open) return;
  const p = isoFn(board.gx, board.gy);
  const panelW = 176;
  const panelH = 224;
  const panelX = Math.round(p.x - panelW * 0.5);
  const panelY = Math.round(p.y - panelH - 18);

  ctx.fillStyle = '#0d1324';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX + 1, panelY + 1, panelW - 2, panelH - 2);
  ctx.clip();

  const innerX = panelX + 8;
  const innerW = panelW - 16;
  const scroll = isFiniteNum(board.scroll) ? board.scroll : 0;

  ctx.font = 'bold 11px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(fitFn('QUESTS', innerW), innerX, panelY + 13);

  let y = panelY + 28 - scroll;
  const lineH = 13;
  const rawTasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  const tasks = rawTasks.length ? rawTasks.slice().reverse().slice(0, 10) : [];

  ctx.font = '10px monospace';
  if (tasks.length === 0) {
    ctx.fillStyle = '#e8e6df';
    ctx.fillText(fitFn('no quests', innerW), innerX, y + Math.round(lineH * 0.5));
    y += lineH + 2;
  } else {
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i] || {};
      const idText = t.id != null ? String(t.id) : ('task ' + (i + 1));
      const statusText = t.status != null ? String(t.status) : 'pending';
      ctx.fillStyle = statusColor(statusText);
      const line = fitFn(idText + ': ' + statusText, innerW);
      ctx.fillText(line, innerX, y + Math.round(lineH * 0.5));
      y += lineH + 2;
    }
  }

  const footerY = panelY + panelH - 13;
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(fitFn('[E] CLOSE', innerW), innerX, footerY);
  ctx.restore();
}

function draw(ctx) {
  const board = getState();
  if (!board) return;
  const Vv = getV();
  drawBoard(ctx, board, Vv, nowFn());
  if (board.open) drawPanel(ctx, board, Vv, nowFn());
}

if (typeof window !== 'undefined') {
  if (!window.GuildQuestBoard || typeof window.GuildQuestBoard !== 'object') {
    window.GuildQuestBoard = createState();
  } else {
    const b = window.GuildQuestBoard;
    if (!isFiniteNum(b.gx)) b.gx = -1.6;
    if (!isFiniteNum(b.gy)) b.gy = 4.2;
    if (typeof b.open !== 'boolean') b.open = false;
    if (!isFiniteNum(b.scroll)) b.scroll = 0;
    if (!isFiniteNum(b.lastToggle)) b.lastToggle = 0;
  }
  const board = window.GuildQuestBoard;
  board.update = update;
  board.draw = draw;
  board.__probe = function () {
    return { pressed: Array.from(pressed), prev: Array.from(prevPressed), open: board.open, gx: board.gx, gy: board.gy };
  };
  if (!window.__gqbListeners) {
    window.__gqbListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
