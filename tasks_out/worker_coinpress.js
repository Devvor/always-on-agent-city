const PRESS_TILE = { gx: 1, gy: 5 };
const PRESS_ANIM = 0.7;

let pressed = new Set();
let lastTime = null;

function createState() {
  return {
    name: 'COINPRESS',
    gx: PRESS_TILE.gx,
    gy: PRESS_TILE.gy,
    prop: { gx: PRESS_TILE.gx, gy: PRESS_TILE.gy },
    press: { gx: PRESS_TILE.gx, gy: PRESS_TILE.gy },
    location: { gx: PRESS_TILE.gx, gy: PRESS_TILE.gy },
    facing: 'up',
    moving: false,
    walkFrame: 0,
    walkTimer: 0,
    used: false,
    pressed: false,
    stamped: false,
    done: false,
    prevE: false,
    pressAnim: 0,
    shelf: [],
    coins: [],
    souvenirs: [],
    lastCoin: null,
    stampCount: 0
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() {
  const w = root();
  if (w && !w.GuildCoinPress) w.GuildCoinPress = createState();
  return w && w.GuildCoinPress;
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
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function externalKeys() {
  const vis = getVisitor();
  return (vis && vis.__keys instanceof Set) ? vis.__keys : null;
}
function isPressedKey(key) {
  return pressed.has(key) || !!(externalKeys() && externalKeys().has(key));
}
function cueNow() {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(); } catch (e) {}
  }
}
function allTasksList() {
  const w = root();
  if (w && Array.isArray(w.allTasks)) return w.allTasks.slice();
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks.slice();
  const out = [];
  const workers = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  for (let i = 0; i < workers.length; i++) {
    const tasks = Array.isArray(workers[i] && workers[i].tasks) ? workers[i].tasks : [];
    for (let j = 0; j < tasks.length; j++) out.push(tasks[j]);
  }
  return out;
}
function isDoneStatus(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[\s-]+/g, '_');
  return s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'finished' || s === 'passed';
}
function taskStatus(task) {
  if (!task || typeof task !== 'object') return '';
  return task.status != null ? task.status : (task.state != null ? task.state : task.phase);
}
function doneTasks() {
  const tasks = allTasksList();
  const out = [];
  for (let i = 0; i < tasks.length; i++) {
    if (isDoneStatus(taskStatus(tasks[i]))) out.push(tasks[i]);
  }
  return out;
}
function taskTimestamp(task, index) {
  const keys = ['completedAt', 'doneAt', 'finishedAt', 'updatedAt', 'createdAt', 'timestamp', 'time', 'stamp', 'date'];
  let found = false;
  let value = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const raw = task && task[key];
    if (raw == null) continue;
    let parsed = null;
    if (typeof raw === 'number' && isFinite(raw)) parsed = raw;
    else if (typeof raw === 'string') {
      const ms = Date.parse(raw);
      if (isFinite(ms)) parsed = ms;
    }
    if (parsed != null && (!found || parsed > value)) {
      found = true;
      value = parsed;
    }
  }
  return found ? { found: true, value: value, index: index } : { found: false, value: index, index: index };
}
function newestDoneTask(tasks) {
  const list = Array.isArray(tasks) ? tasks : allTasksList();
  let best = null;
  let bestScore = null;
  let bestIndex = -1;
  for (let i = 0; i < list.length; i++) {
    const task = list[i];
    if (!isDoneStatus(taskStatus(task))) continue;
    const score = taskTimestamp(task, i);
    if (!best) {
      best = task;
      bestScore = score;
      bestIndex = i;
      continue;
    }
    const foundWins = score.found && !bestScore.found;
    const foundTie = score.found === bestScore.found;
    const higherValue = foundTie && score.found && score.value > bestScore.value;
    const higherFallback = foundTie && !score.found && i > bestIndex;
    const equalValueLater = foundTie && score.found && score.value === bestScore.value && i > bestIndex;
    if (foundWins || higherValue || higherFallback || equalValueLater) {
      best = task;
      bestScore = score;
      bestIndex = i;
    }
  }
  return best;
}
function shortTitleOf(task) {
  if (!task) return 'souvenir';
  const value = task.title != null ? task.title : (task.name != null ? task.name : (task.id != null ? task.id : 'souvenir'));
  return String(value == null ? 'souvenir' : value).trim().slice(0, 32);
}
function visitorTilePos(vis) {
  if (!vis) return null;
  if (typeof vis.gx === 'number' && isFinite(vis.gx) && typeof vis.gy === 'number' && isFinite(vis.gy)) {
    return { gx: vis.gx, gy: vis.gy };
  }
  return null;
}
function withinOneTile(state, vis) {
  if (!state || !vis) return false;
  const pos = visitorTilePos(vis);
  if (!pos) return false;
  return Math.hypot(pos.gx - state.gx, pos.gy - state.gy) <= 1;
}
function stampCoin(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  if (!state || state.used) return false;
  const vis = getVisitor();
  const Vv = getV();
  if (!vis || !Vv || Vv.gameState !== 'play') return false;
  if (!withinOneTile(state, vis)) return false;

  const all = allTasksList();
  const count = doneTasks().length;
  const task = newestDoneTask(all);
  const rawTitle = shortTitleOf(task);
  const shortTitle = fitFn(rawTitle, 160) || rawTitle;

  const coin = {
    count: count,
    title: shortTitle,
    shortTitle: shortTitle,
    task: task,
    stampedAt: now
  };

  state.used = true;
  state.pressed = true;
  state.stamped = true;
  state.done = true;
  state.lastCoin = coin;
  state.shelf.push(coin);
  state.coins = state.shelf;
  state.souvenirs = state.shelf;
  state.stampCount = state.shelf.length;
  state.pressAnim = PRESS_ANIM;
  cueNow();
  return true;
}
function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const state = getState();
  const vis = getVisitor();
  const Vv = getV();
  if (state && vis && Vv && Vv.gameState === 'play' && (k === 'e' || k === ' ') && !state.used && withinOneTile(state, vis)) {
    stampCoin(nowFn());
  }
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
}
function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const vis = getVisitor();
  const Vv = getV();
  if (!state) {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (state.pressAnim > 0) state.pressAnim = Math.max(0, state.pressAnim - dt);
  state.pressed = state.used;
  state.stamped = state.used;
  state.done = state.used;

  if (!Vv || Vv.gameState !== 'play') return;
  const ePressed = isPressedKey('e') || isPressedKey(' ');
  if (!state.used && vis && withinOneTile(state, vis) && ePressed && !state.prevE) {
    stampCoin(now);
  }
  state.prevE = ePressed;
}
function drawPress(ctx, state, Vv, now) {
  if (!ctx || !state) return;
  const p = isoFn(state.gx, state.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(x - 18, y + 2, 36, 6);

  ctx.fillStyle = '#6b4f33';
  ctx.fillRect(x - 14, y - 14, 28, 18);
  ctx.fillStyle = '#4f3722';
  ctx.fillRect(x - 14, y - 14, 6, 18);
  ctx.fillStyle = '#8b653f';
  ctx.fillRect(x - 10, y - 10, 20, 10);

  const remaining = (PRESS_ANIM > 0) ? clamp01(state.pressAnim / PRESS_ANIM) : 0;
  const t = 1 - remaining;
  const drop = Math.sin(Math.min(1, t) * Math.PI) * 12;

  ctx.fillStyle = '#5a4028';
  ctx.fillRect(x - 3, y - 28 + drop, 6, 20);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 9, y - 34 + drop, 18, 10);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - 6, y - 32 + drop, 12, 4);
  ctx.fillStyle = '#854d0e';
  ctx.fillRect(x - 7, y - 25 + drop, 14, 2);
}
function drawShelf(ctx, state, vis, Vv, now) {
  if (!ctx || !state || !state.shelf || !state.shelf.length || !vis) return;
  const pos = visitorTilePos(vis);
  if (!pos) return;
  const p = isoFn(pos.gx, pos.gy);
  const x = Math.round(p.x + 8);
  const y = Math.round(p.y - 30);
  const shelfW = 34;
  const shelfH = 12;

  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(x - shelfW * 0.5, y, shelfW, shelfH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - shelfW * 0.5, y, shelfW, shelfH);

  for (let i = 0; i < state.shelf.length; i++) {
    const coin = state.shelf[i];
    const cx = x - 12 + i * 10;
    const cy = y + 3;
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(cx, cy, 8, 5);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx + 1, cy, 5, 2);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(cx + 1, cy + 4, 6, 1);
  }

  const coin = state.lastCoin;
  if (coin) {
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shown = fitFn(String(coin.count) + '  ' + coin.shortTitle, shelfW - 4);
    ctx.fillText(shown, x, y + shelfH + 8);
    ctx.textAlign = 'left';
  }
}
function clamp01(v) {
  if (!isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
function draw(ctx) {
  const state = getState();
  const vis = getVisitor();
  const Vv = getV();
  if (!ctx || !state || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  drawPress(ctx, state, Vv, now);
  drawShelf(ctx, state, vis, Vv, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildCoinPress) window.GuildCoinPress = createState();
  window.GuildCoinPress.update = update;
  window.GuildCoinPress.draw = draw;
  window.GuildCoinPress.stamp = stampCoin;
  window.GuildCoinPress.state = window.GuildCoinPress;
  window.GuildCoinPress.__keys = pressed;
  window.GuildCoinPress.createState = createState;
  if (!window.__gcpListeners) {
    window.__gcpListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
