const ANCHOR = { gx: -2, gy: -2 };

let pressedE = false;
let prevPressedE = false;
let state = {
  anchor: { gx: ANCHOR.gx, gy: ANCHOR.gy },
  lineIndex: 0,
  lines: [],
  shipped: 0,
  streak: 0,
  topWorker: 'MISSINGNO',
  topDone: 0
};

function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function guard() {
  const w = root();
  if (!w) return null;
  if (typeof w.V !== 'object' || w.V === null) return null;
  if (typeof w.iso !== 'function') return null;
  if (typeof w.fitText !== 'function') return null;
  if (!w.GuildVisitor) return null;
  const allTasks = Array.isArray(w.allTasks) ? w.allTasks : (Array.isArray(w.V.allTasks) ? w.V.allTasks : null);
  if (!allTasks) return null;
  return w;
}

function hasCue(w) {
  return !!(w && typeof w.cue === 'function');
}

function makeLines(w) {
  const Vv = w.V;
  const allTasks = Array.isArray(w.allTasks) ? w.allTasks : (Array.isArray(Vv.allTasks) ? Vv.allTasks : []);
  let shipped = allTasks.filter(function (t) { return t && t.status === 'done'; }).length;
  if (Vv && typeof Vv.totalDone === 'number') shipped = Vv.totalDone;

  let streak = 0;
  for (let i = allTasks.length - 1; i >= 0; i--) {
    const t = allTasks[i];
    if (t && t.status === 'done') streak += 1;
    else break;
  }
  if (!streak && shipped > 0) streak = 1;

  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  let topIndex = 0;
  let topDone = -1;
  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i] || {};
    const tasks = Array.isArray(worker.tasks) ? worker.tasks : [];
    const done = tasks.filter(function (t) { return t && t.status === 'done'; }).length;
    if (done > topDone) {
      topDone = done;
      topIndex = i;
    }
  }
  if (workers.length === 0) topIndex = -1;
  const topWorker = (topIndex >= 0 && workers[topIndex] && workers[topIndex].name != null)
    ? workers[topIndex].name
    : 'MISSINGNO';
  if (topDone < 0) topDone = 0;

  state.shipped = shipped;
  state.streak = streak;
  state.topWorker = String(topWorker);
  state.topDone = topDone;

  return [
    'Top star: ' + String(topWorker) + ' leads with ' + topDone + ' cleared.',
    'Quests shipped: ' + shipped + ' to the astral ledger.',
    'Current streak: ' + streak + ' cleared in a row.',
    String(topWorker) + ' keeps the telescope aligned.',
    'Shipped ' + shipped + '; streak ' + streak + ' burns bright.',
    'The void records ' + String(topWorker) + ' at the zenith.'
  ];
}

function update(now) {
  if (typeof now !== 'number') now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  const w = guard();
  if (!w) return;
  const Vv = w.V;
  if (Vv.gameState !== 'play') return;

  if (hasCue(w)) {
    try { /* cue is available, but only used elsewhere if needed */ } catch (e) {}
  }

  state.lines = makeLines(w);
  if (state.lines.length > 0 && pressedE && !prevPressedE) {
    state.lineIndex = (state.lineIndex + 1) % state.lines.length;
  }
  if (state.lines.length > 0 && state.lineIndex >= state.lines.length) state.lineIndex = 0;

  prevPressedE = pressedE;
}

function draw(ctx) {
  if (!ctx) return;
  const w = guard();
  if (!w) return;
  const Vv = w.V;
  if (Vv.gameState !== 'play') return;

  const iso = w.iso;
  const fitText = w.fitText;
  const pt = iso(state.anchor.gx, state.anchor.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 12, y + 4, 24, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, y - 16, 4, 16);
  ctx.fillRect(x - 10, y - 8, 20, 3);
  ctx.fillRect(x - 12, y - 14, 3, 7);
  ctx.fillRect(x + 9, y - 14, 3, 7);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 5, y - 20, 10, 4);

  const line = (state.lines && state.lines.length) ? state.lines[state.lineIndex] : '';
  const boxW = 220;
  const boxH = 18;
  const bx = Math.round(x - boxW * 0.5);
  const by = y - 46;

  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.fillStyle = '#d4af37';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const shown = fitText(String(line || ''), boxW - 8);
  ctx.fillText(shown, bx + 4, by + boxH * 0.5);
}

function onKeydown(e) {
  if (!guard()) return;
  const k = normKey(e);
  if (k === 'e') {
    pressedE = true;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const k = normKey(e);
  if (k === 'e') pressedE = false;
}

if (typeof window !== 'undefined') {
  if (!window.__gsListeners) {
    window.__gsListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
  window.GuildStargazing = {
    update: update,
    draw: draw,
    __probe: function () { return { index: state.lineIndex, lines: state.lines.slice(), streak: state.streak }; }
  };
}

export {};
