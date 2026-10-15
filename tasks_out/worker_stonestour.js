const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

let stones = [];
let stoneRead = Object.create(null);
let stoneDate = Object.create(null);
let note = { active:false, stoneIndex:-1, text:'', start:0, duration:6 };
let lastOpenedKey = null;
let listenersBound = false;
let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function hasContract() {
  const w = root();
  if (!w || !w.V) return false;
  if (typeof w.iso !== 'function') return false;
  if (typeof w.fitText !== 'function') return false;
  if (!w.GuildVisitor) return false;
  return true;
}
function isoFn(gx, gy) {
  const w = root();
  const Vv = getV();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
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
function getState() { const w = root(); return w && w.GuildVisitor; }
function allTasksFn() {
  const w = root();
  if (w && Array.isArray(w.allTasks)) return w.allTasks.slice();
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks.slice();
  return [];
}
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function mapStatus(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'pending' || s === 'todo' || s === 'queued' || s === 'backlog' || s === 'new') return 'pending';
  if (s === 'in_progress' || s === 'inprogress' || s === 'doing' || s === 'active' || s === 'processing' || s === 'running' || s === 'building' || s === 'started') return 'in_progress';
  if (s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'passed' || s === 'finished') return 'done';
  if (s === 'failed' || s === 'failure' || s === 'error' || s === 'errored' || s === 'broken' || s === 'rejected') return 'failed';
  return 'pending';
}
function firstTask(tasks, predicate) {
  for (let i = 0; i < tasks.length; i++) if (predicate(tasks[i])) return tasks[i];
  return null;
}
function lastTask(tasks, predicate) {
  for (let i = tasks.length - 1; i >= 0; i--) if (predicate(tasks[i])) return tasks[i];
  return null;
}
function taskText(t) { return String(t && (t.title != null ? t.title : (t.id != null ? t.id : 'Milestone'))); }
function currentDate() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}
function criticalProps(Vv) {
  const out = BUILDINGS.slice();
  if (Vv && Array.isArray(Vv.desks)) {
    for (let i = 0; i < Vv.desks.length; i++) {
      const d = Vv.desks[i];
      if (d) out.push({ gx:d.tileX, gy:d.tileY });
    }
  }
  out.push({gx:0,gy:-1},{gx:1,gy:-1},{gx:-1,gy:1},{gx:1,gy:0},{gx:1,gy:1});
  return out;
}
function candidatesFor(Vv, s, minDistance) {
  const minC = -2 - s;
  const maxC = 1 + s;
  const props = criticalProps(Vv);
  const out = [];
  for (let gy = minC; gy <= maxC; gy++) {
    for (let gx = minC; gx <= maxC; gx++) {
      if (tileRing(gx, gy) !== s) continue;
      let ok = true;
      if (minDistance > 0) {
        for (let i = 0; i < props.length; i++) {
          const p = props[i];
          const dist = Math.max(Math.abs(gx - p.gx), Math.abs(gy - p.gy));
          if (dist < minDistance) { ok = false; break; }
        }
      } else {
        for (let i = 0; i < props.length; i++) {
          const p = props[i];
          if (gx === p.gx && gy === p.gy) { ok = false; break; }
        }
      }
      if (ok) out.push({ gx:gx, gy:gy });
    }
  }
  return out;
}
function choosePositions(Vv, s, count) {
  if (count <= 0) return [];
  let cands = candidatesFor(Vv, s, 2);
  if (cands.length < count) cands = candidatesFor(Vv, s, 1);
  if (cands.length < count && !cands.length) cands = candidatesFor(Vv, s, 0);
  if (!cands.length) return [];
  const minC = -2 - s;
  const maxC = 1 + s;
  const cx = (minC + maxC) * 0.5;
  const cy = cx;
  cands.sort(function (a, b) {
    return Math.atan2(a.gy - cy, a.gx - cx) - Math.atan2(b.gy - cy, b.gx - cx);
  });
  const out = [];
  for (let i = 0; i < count; i++) {
    let idx = 0;
    if (cands.length > 1) idx = Math.round(i * (cands.length - 1) / Math.max(1, count - 1));
    if (idx >= cands.length) idx = cands.length - 1;
    out.push(cands[idx]);
  }
  return out;
}
function buildStones() {
  const Vv = getV();
  if (!Vv || !hasContract()) return;
  const tasks = allTasksFn();
  const seen = Object.create(null);
  const milestones = [];
  function add(key, title, task) {
    if (!task || seen[String(task.id)]) return;
    seen[String(task.id)] = true;
    milestones.push({ key:key, label:title, task:task });
  }
  const doneTasks = tasks.filter(function (t) { return mapStatus(t.status) === 'done'; });
  add('firstDone', 'FIRST DONE', firstTask(tasks, function (t) { return mapStatus(t.status) === 'done'; }));
  add('firstEconomy', 'FIRST ECONOMY QUEST', firstTask(tasks, function (t) {
    const text = (taskText(t) + ' ' + String(t.project || '')).toLowerCase();
    return /econom|trade|market|coin|gold|treasury|budget|cash/i.test(text);
  }));
  add('firstSpectacle', 'FIRST SPECTACLE', firstTask(tasks, function (t) {
    const text = (taskText(t) + ' ' + String(t.project || '')).toLowerCase();
    return /spectacle|show|demo|display|pageant|stage|fair|exhibit/i.test(text);
  }));
  add('latestDone', 'LATEST DONE', lastTask(tasks, function (t) { return mapStatus(t.status) === 'done'; }));
  add('firstPending', 'FIRST PENDING', firstTask(tasks, function (t) { return mapStatus(t.status) === 'pending'; }));
  add('firstInProgress', 'FIRST IN PROGRESS', firstTask(tasks, function (t) { return mapStatus(t.status) === 'in_progress'; }));
  add('firstFailed', 'FIRST FAILED', firstTask(tasks, function (t) { return mapStatus(t.status) === 'failed'; }));
  if (!milestones.length && tasks.length) add('firstTask', 'FIRST QUEST', tasks[0]);

  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const positions = choosePositions(Vv, s, milestones.length);
  const next = [];
  for (let i = 0; i < milestones.length; i++) {
    if (i >= positions.length) break;
    const m = milestones[i];
    const pos = positions[i];
    const key = m.key + ':' + String(m.task.id);
    if (stoneDate[key] == null) stoneDate[key] = currentDate();
    if (stoneRead[key] == null) stoneRead[key] = false;
    next.push({
      key:key,
      kind:m.key,
      label:m.label,
      title:taskText(m.task),
      date:stoneDate[key],
      task:m.task,
      read:!!stoneRead[key],
      gx:pos.gx,
      gy:pos.gy
    });
  }
  for (let i = 0; i < next.length; i++) {
    if (stoneRead[next[i].key]) next[i].read = true;
  }
  stones = next;
}
function getVisitorTile() {
  const vis = getState();
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) return { gx:vis.gx, gy:vis.gy };
  return null;
}
function nearestStoneIndex(vis) {
  if (!vis || !stones.length) return -1;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < stones.length; i++) {
    const st = stones[i];
    const d = Math.hypot(vis.gx - st.gx, vis.gy - st.gy);
    if (d <= 2.0 && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
function openNote(index) {
  if (index < 0 || index >= stones.length) return;
  const st = stones[index];
  note.active = true;
  note.stoneIndex = index;
  note.text = stoneDate[st.key] + '  \u2014  ' + st.title;
  note.start = nowFn();
  st.read = true;
  stoneRead[st.key] = true;
  lastOpenedKey = st.key;
  cueFn('note');
}
function closeNote() {
  note.active = false;
  note.stoneIndex = -1;
}
function nextUnreadIndex() {
  if (!stones.length) return -1;
  const unread = [];
  for (let i = 0; i < stones.length; i++) if (!stones[i].read) unread.push(i);
  if (!unread.length) return -1;
  if (lastOpenedKey) {
    for (let i = 0; i < stones.length; i++) {
      if (stones[i].key === lastOpenedKey) {
        for (let k = 0; k < unread.length; k++) {
          if (unread[k] > i) return unread[k];
        }
        return unread[0];
      }
    }
  }
  return unread[0];
}
function onKeydown(e) {
  if (!hasContract()) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const k = normKey(e);
  const vis = getVisitorTile();
  if (!vis) return;
  if (k === 'e' || k === ' ') {
    const idx = nearestStoneIndex(vis);
    if (idx >= 0) {
      openNote(idx);
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      return;
    }
    if (note.active) {
      closeNote();
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
  if (k === 'escape' && note.active) {
    closeNote();
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}
function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  window.addEventListener('keydown', onKeydown, true);
}
function update(now) {
  if (!hasContract()) return;
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  buildStones();
  if (note.active) {
    const st = stones[note.stoneIndex];
    if (!st || (now - note.start) / 1000 >= note.duration) closeNote();
  }
}
function drawStones(ctx, now) {
  if (!ctx || !stones.length) return;
  for (let i = 0; i < stones.length; i++) {
    const st = stones[i];
    const p = isoFn(st.gx, st.gy);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const unread = !st.read;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + i);
    ctx.save();
    if (unread) {
      ctx.globalAlpha = 0.18 + 0.12 * pulse;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - 8, y - 10, 16, 12);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x - 5, y, 10, 4);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(x - 4, y - 3, 8, 4);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x - 3, y - 5, 6, 4);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 1, y - 6, 2, 2);
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(x + 4, y - 2, 2, 5);
    ctx.restore();
  }
}
function drawNote(ctx, now) {
  if (!note.active || note.stoneIndex < 0 || note.stoneIndex >= stones.length) return;
  const Vv = getV();
  if (!Vv || !Vv.canvas) return;
  const st = stones[note.stoneIndex];
  const p = isoFn(st.gx, st.gy);
  const age = (now - note.start) / 1000;
  const alpha = age >= note.duration - 1 ? Math.max(0, note.duration - age) : 1;
  if (alpha <= 0) return;
  const canvas = Vv.canvas;
  const bw = Math.min(canvas.width - 40, 280);
  const bh = 24;
  const bx = Math.round(p.x - bw * 0.5);
  const by = Math.round(p.y - bh - 46);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(244,232,193,0.94)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#6b4a2d';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#2b1d0e';
  ctx.font = '11px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fitFn(note.text, bw - 12), bx + 6, by + bh * 0.5);
  ctx.restore();
}
function drawChevron(ctx, now) {
  const idx = nextUnreadIndex();
  if (idx < 0) return;
  const vis = getVisitorTile();
  if (!vis) return;
  const st = stones[idx];
  const vp = isoFn(vis.gx, vis.gy);
  const sp = isoFn(st.gx, st.gy);
  const dx = sp.x - (vp.x + 6);
  const dy = sp.y - (vp.y - 18);
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(vp.x + 6, vp.y - 18);
  ctx.rotate(ang);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(10, 0);
  ctx.lineTo(2, 6);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}
function draw(ctx) {
  if (!hasContract() || !ctx) return;
  const n = nowFn();
  drawStones(ctx, n);
  drawChevron(ctx, n);
  drawNote(ctx, n);
}

bindListeners();

if (typeof window !== 'undefined') {
  window.GuildStoneTour = {
    update: update,
    draw: draw,
    __rawUpdate: update,
    stones: stones,
    note: note
  };
}

export {};
