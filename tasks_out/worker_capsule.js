const CAPSULE_TILE = { gx: -5, gy: 3 };
const SESSION_FLAGS = ['worker_capsule_plaque_shown', 'guildCapsuleShown', 'capsulePlaqueShown'];
let memorySeen = false;
let pressed = new Set();

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildCapsule; }
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
  return String(text == null ? '' : text);
}
function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function createState() {
  return { gx: CAPSULE_TILE.gx, gy: CAPSULE_TILE.gy, visible: false, facts: null, start: 0, duration: 9000 };
}

function storageGet(key) {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage.getItem(key);
  } catch (e) {}
  return null;
}
function storageSet(key, value) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
  } catch (e) {}
}
function sessionSeen() {
  if (memorySeen) return true;
  for (let i = 0; i < SESSION_FLAGS.length; i++) {
    if (storageGet(SESSION_FLAGS[i]) === '1') return true;
  }
  return false;
}
function markSeen() {
  memorySeen = true;
  for (let i = 0; i < SESSION_FLAGS.length; i++) storageSet(SESSION_FLAGS[i], '1');
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function getTaskLists() {
  const out = [];
  const r = root();
  if (r && Array.isArray(r.allTasks)) out.push(r.allTasks);
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) out.push(Vv.allTasks);
  if (Vv && Array.isArray(Vv.tasks)) out.push(Vv.tasks);
  if (r && Array.isArray(r.tasks)) out.push(r.tasks);
  return out;
}
function allTasks() {
  const lists = getTaskLists();
  for (let i = 0; i < lists.length; i++) if (lists[i].length) return lists[i];
  return [];
}

function workerMetas() {
  const Vv = getV();
  const r = root();
  const candidates = [];
  if (Vv && Array.isArray(Vv.workers)) candidates.push(Vv.workers);
  if (Vv && Array.isArray(Vv.allWorkers)) candidates.push(Vv.allWorkers);
  if (r && Array.isArray(r.workers)) candidates.push(r.workers);
  if (r && Array.isArray(r.allWorkers)) candidates.push(r.allWorkers);
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].length) return candidates[i];
  }
  return [];
}

function taskTitle(t) {
  if (!t) return '';
  if (t.title != null) return t.title;
  if (t.name != null) return t.name;
  if (t.id != null) return t.id;
  if (t.key != null) return t.key;
  return '';
}
function rawStatus(t) {
  if (!t) return '';
  if (t.status != null) return t.status;
  if (t.state != null) return t.state;
  if (t.phase != null) return t.phase;
  return '';
}
function isDone(v) {
  const s = String(v == null ? '' : v).toLowerCase();
  return s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'passed' || s === 'finished' ||
    s.indexOf('done') !== -1 || s.indexOf('complete') !== -1 || s.indexOf('success') !== -1;
}
function isFailed(v) {
  const s = String(v == null ? '' : v).toLowerCase();
  return s === 'failed' || s === 'failure' || s === 'error' || s === 'errored' || s === 'broken' || s === 'rejected' ||
    s.indexOf('fail') !== -1 || s.indexOf('error') !== -1;
}
function taskTime(t) {
  if (!t || typeof t !== 'object') return null;
  const keys = ['createdAt', 'created', 'created_at', 'startedAt', 'started', 'timestamp', 'time', 'updatedAt', 'completedAt', 'doneAt'];
  for (let i = 0; i < keys.length; i++) {
    const v = t[keys[i]];
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') {
      const ms = Date.parse(v);
      if (!isNaN(ms)) return ms;
      const n = Number(v);
      if (isFinite(n)) return n;
    }
  }
  return null;
}

function collectFacts() {
  const tasks = allTasks();
  let oldestDone = null;
  let oldestTime = null;
  let oldestHasTime = false;
  let oldestIndex = -1;
  let firstFailure = null;
  let firstFailureTime = null;
  let firstFailureHasTime = false;
  let firstFailureIndex = -1;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const st = rawStatus(t);
    if (isDone(st)) {
      const ti = taskTime(t);
      if (ti != null) {
        if (!oldestHasTime || ti < oldestTime) {
          oldestHasTime = true;
          oldestTime = ti;
          oldestDone = t;
        }
      } else if (!oldestHasTime && oldestIndex < 0) {
        oldestIndex = i;
        oldestDone = t;
      }
    }
    if (isFailed(st)) {
      const ti = taskTime(t);
      if (ti != null) {
        if (!firstFailureHasTime || ti < firstFailureTime) {
          firstFailureHasTime = true;
          firstFailureTime = ti;
          firstFailure = t;
        }
      } else if (!firstFailureHasTime && firstFailureIndex < 0) {
        firstFailureIndex = i;
        firstFailure = t;
      }
    }
  }

  const names = [];
  const seenNames = {};
  const metas = workerMetas();
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const nm = m && (m.name != null ? m.name : m.id);
    if (nm == null) continue;
    const s = String(nm).trim();
    if (!s || seenNames[s]) continue;
    seenNames[s] = true;
    names.push(s);
  }
  if (!names.length) {
    const taskNames = {};
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const owner = t && (t.worker != null ? t.worker : (t.workerName != null ? t.workerName : (t.assignee != null ? t.assignee : t.owner)));
      if (owner == null) continue;
      const s = String(owner).trim();
      if (!s || taskNames[s]) continue;
      taskNames[s] = true;
      names.push(s);
    }
  }

  return {
    oldestTitle: oldestDone ? String(taskTitle(oldestDone)) : '',
    firstFailureTitle: firstFailure ? String(taskTitle(firstFailure)) : '',
    workerNames: names.join(', ')
  };
}

function distanceToVisitor() {
  const Vv = getV();
  const vis = root() && root().GuildVisitor;
  if (!vis || !Vv || !Vv.grid) return Infinity;
  const cp = isoFn(CAPSULE_TILE.gx, CAPSULE_TILE.gy);
  const vp = isoFn(vis.gx, vis.gy);
  return tileDistance(cp.x, cp.y, vp.x, vp.y, Vv.grid);
}

function trigger(now) {
  const st = getState();
  if (!st || st.visible || sessionSeen()) return;
  st.facts = collectFacts();
  st.visible = true;
  st.start = now;
  markSeen();
}

function hide() {
  const st = getState();
  if (st) {
    st.visible = false;
    st.facts = null;
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const Vv = getV();
  const vis = root() && root().GuildVisitor;
  if (vis && Vv && Vv.gameState === 'play' && (k === 'e' || k === ' ')) {
    if (distanceToVisitor() <= 1 && !sessionSeen()) {
      trigger(nowFn());
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  if (k === 'escape') {
    const st = getState();
    if (st && st.visible) {
      hide();
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const st = getState();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (st.visible && (now - st.start) >= st.duration) {
    st.visible = false;
    st.facts = null;
  }
}

function drawProp(ctx, now) {
  const cp = isoFn(CAPSULE_TILE.gx, CAPSULE_TILE.gy);
  const x = Math.round(cp.x);
  const y = Math.round(cp.y);

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 12, y + 10, 24, 4);

  ctx.fillStyle = '#4b321f';
  ctx.fillRect(x - 13, y + 2, 26, 8);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 13, y + 2, 26, 2);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 8, y - 4, 16, 6);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - 6, y - 3, 12, 3);
  ctx.fillStyle = '#111111';
  ctx.fillRect(x - 8, y + 1, 16, 1);
  ctx.fillStyle = '#a78bfa';
  ctx.fillRect(x - 4, y - 2, 2, 2);
  ctx.fillRect(x + 2, y - 2, 2, 2);

  const vis = root() && root().GuildVisitor;
  const Vv = getV();
  if (vis && Vv && Vv.gameState === 'play' && distanceToVisitor() <= 1 && !sessionSeen()) {
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(x - 20, y - 26, 40, 14);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 20, y - 26, 40, 14);
    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Press E', x, y - 19);
    ctx.textAlign = 'left';
  }
}

function drawPanel(ctx, now) {
  const st = getState();
  if (!st || !st.visible || !st.facts) return;
  const Vv = getV();
  const c = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!c) return;

  const age = (now - st.start) / 1000;
  if (age >= st.duration / 1000) {
    st.visible = false;
    st.facts = null;
    return;
  }
  const remain = (st.duration / 1000) - age;
  let alpha = 1;
  if (remain < 1) alpha = Math.max(0, remain);

  const facts = st.facts;
  const lines = [];
  if (facts.oldestTitle) lines.push('Hark! The oldest quest completed is "' + facts.oldestTitle + '".');
  else lines.push('Hark! No completed quest adorns the chronicle.');
  if (facts.firstFailureTitle) lines.push('The first mishap recorded: "' + facts.firstFailureTitle + '".');
  else lines.push('No mishap has scarred the record.');
  lines.push('Guild roster: ' + (facts.workerNames || 'none named.'));

  const boxW = Math.min(c.width - 40, 460);
  const boxH = 22 + lines.length * 16;
  const bx = Math.round((c.width - boxW) * 0.5);
  const by = 52;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(20,16,10,0.92)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fitFn('CAPSULE CHRONICLE', boxW - 16), bx + 8, by + 6);

  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(fitFn(lines[i], boxW - 16), bx + 8, by + 22 + i * 16);
  }
  ctx.restore();
}

function draw(ctx) {
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  drawProp(ctx, n);
  drawPanel(ctx, n);
}

if (typeof window !== 'undefined') {
  if (!window.GuildCapsule) window.GuildCapsule = createState();
  window.GuildCapsule.update = update;
  window.GuildCapsule.draw = draw;
  window.GuildCapsule.__keys = pressed;
  if (!window.__gcListeners) {
    window.__gcListeners = true;
    window.addEventListener('keydown', onKeydown, true);
    window.addEventListener('keyup', onKeyup, true);
  }
}

export {};
