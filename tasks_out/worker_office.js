function init(canvas, apiBase) {
  if (!canvas) return;
  if (!canvas.width) canvas.width = 960;
  if (!canvas.height) canvas.height = 640;
  V.canvas = canvas;
  V.ctx = canvas.getContext('2d');
  V.apiBase = String(apiBase || '').replace(/\/+$/, '');
  V.ctx.imageSmoothingEnabled = false;
  buildScene();
  fetchBoard();
  if (V.pollTimer) clearInterval(V.pollTimer);
  V.pollTimer = setInterval(fetchBoard, 5000);
  V.lastTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  requestAnimationFrame(frame);
}

const V = {
  canvas: null,
  ctx: null,
  apiBase: '',
  lastTime: 0,
  pollTimer: null,
  fetching: false,
  offline: false,
  windowStatus: 'OPEN',
  tasks: [],
  desks: [],
  worker: null,
  rnd: 123456789,
  flash: null
};

function rand() {
  V.rnd = (V.rnd * 1664525 + 1013904223) >>> 0;
  return V.rnd / 4294967296;
}

function buildScene() {
  const c = V.canvas;
  V.desks = [];
  const cols = 6;
  const rows = 5;
  V.grid = { cols: cols, rows: rows, originX: c.width * 0.5, originY: c.height * 0.28, tileW: 72, tileH: 36 };
  const positions = [ [1, 1], [4, 1], [1, 3], [4, 3] ];
  for (let i = 0; i < positions.length; i++) {
    const p = iso(positions[i][0], positions[i][1]);
    V.desks.push({ id: i, tileX: positions[i][0], tileY: positions[i][1], x: p.x - 28, y: p.y - 10, w: 56, h: 26 });
  }
  V.worker = { x: V.desks[0].x + 8, y: V.desks[0].y + V.desks[0].h + 2, targetDesk: 0, mode: 'idle', atDesk: false, idleTarget: 1, idleArrivedAt: 0, typingPhase: 0, lastDoneId: null, flashHandled: false };
  V.flash = { active: false, t: 0, duration: 0.9, desk: 0 };
}

function iso(gx, gy) {
  const g = V.grid;
  return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
}

async function fetchBoard() {
  if (V.fetching) return;
  V.fetching = true;
  try {
    const response = await fetch(V.apiBase + '/api/board', { cache: 'no-store' });
    if (!response.ok) throw new Error('bad status');
    const data = await response.json();
    V.offline = false;
    normalizeBoard(data);
  } catch (e) {
    V.offline = true;
  } finally {
    V.fetching = false;
  }
}

function collectTasks(data) {
  if (Array.isArray(data)) return data.slice();
  if (!data || typeof data !== 'object') return [];
  const directKeys = ['tasks', 'items', 'jobs', 'cards', 'tickets', 'todos', 'work', 'board'];
  for (let i = 0; i < directKeys.length; i++) {
    const key = directKeys[i];
    if (Array.isArray(data[key])) return data[key].slice();
  }
  const statusKeys = ['pending', 'todo', 'queued', 'in_progress', 'in-progress', 'doing', 'active', 'processing', 'building', 'done', 'completed', 'complete', 'success', 'failed', 'error', 'failure'];
  let out = [];
  let found = false;
  for (const key in data) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    if (!Array.isArray(data[key])) continue;
    const lk = String(key).toLowerCase();
    let inferred = null;
    for (let i = 0; i < statusKeys.length; i++) {
      if (lk === statusKeys[i] || lk.indexOf(statusKeys[i]) !== -1) { inferred = statusKeys[i]; break; }
    }
    if (inferred) {
      found = true;
      for (let i = 0; i < data[key].length; i++) {
        const item = data[key][i];
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const copy = Object.assign({}, item);
          if (copy.status == null && copy.state == null) copy.status = inferred;
          out.push(copy);
        }
      }
    }
  }
  if (found) return out;
  for (const key in data) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      const nested = collectTasks(data[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function detectWindow(data) {
  const candidates = [];
  if (data && typeof data === 'object') {
    candidates.push(data.window, data.window_status, data.windowStatus, data.windowState, data.office, data.officeStatus);
    candidates.push(data.status, data.state, data.open, data.is_open, data.isOpen, data.opened);
  }
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c == null) continue;
    if (typeof c === 'boolean') return c ? 'OPEN' : 'CLOSED';
    if (typeof c === 'number') return c ? 'OPEN' : 'CLOSED';
    if (typeof c === 'string') {
      const u = c.toUpperCase();
      if (u.indexOf('OPEN') !== -1 || u === 'ACTIVE' || u === 'TRUE' || u === '1') return 'OPEN';
      if (u.indexOf('CLOSE') !== -1 || u === 'INACTIVE' || u === 'FALSE' || u === '0') return 'CLOSED';
    }
    if (typeof c === 'object') {
      if (typeof c.open === 'boolean') return c.open ? 'OPEN' : 'CLOSED';
      if (typeof c.opened === 'boolean') return c.opened ? 'OPEN' : 'CLOSED';
      if (typeof c.status === 'string') {
        const u = c.status.toUpperCase();
        if (u.indexOf('OPEN') !== -1) return 'OPEN';
        if (u.indexOf('CLOSE') !== -1) return 'CLOSED';
      }
      if (typeof c.state === 'string') {
        const u = c.state.toUpperCase();
        if (u.indexOf('OPEN') !== -1) return 'OPEN';
        if (u.indexOf('CLOSE') !== -1) return 'CLOSED';
      }
    }
  }
  return V.windowStatus || 'OPEN';
}

function mapStatus(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'pending' || s === 'todo' || s === 'queued' || s === 'backlog' || s === 'new') return 'pending';
  if (s === 'in_progress' || s === 'inprogress' || s === 'doing' || s === 'active' || s === 'processing' || s === 'running' || s === 'building' || s === 'started') return 'in_progress';
  if (s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'passed' || s === 'finished') return 'done';
  if (s === 'failed' || s === 'failure' || s === 'error' || s === 'errored' || s === 'broken' || s === 'rejected') return 'failed';
  return 'pending';
}

function parseDeskRaw(task) {
  if (!task || typeof task !== 'object') return null;
  let value = task.desk;
  if (value == null) value = task.desk_index;
  if (value == null) value = task.deskIndex;
  if (value == null) value = task.desk_id;
  if (value == null) value = task.deskId;
  if (value == null) value = task.location;
  if (value == null) value = task.pos;
  if (value == null) value = task.position;
  if (value == null) return null;
  if (typeof value === 'number' && isFinite(value)) return value;
  const m = String(value).match(/-?\d+/);
  if (m) return parseInt(m[0], 10);
  return null;
}

function normalizeBoard(data) {
  V.windowStatus = detectWindow(data);
  const rawTasks = collectTasks(data);
  const deskValues = [];
  for (let i = 0; i < rawTasks.length; i++) {
    const v = parseDeskRaw(rawTasks[i]);
    if (v != null) deskValues.push(v);
  }
  const oneBased = deskValues.length > 0 && deskValues.indexOf(0) === -1 && Math.min.apply(null, deskValues) >= 1 && Math.max.apply(null, deskValues) <= V.desks.length;
  const tasks = [];
  for (let i = 0; i < rawTasks.length; i++) {
    const raw = rawTasks[i] || {};
    let desk = parseDeskRaw(raw);
    if (desk == null) desk = i % V.desks.length;
    if (oneBased) desk = desk - 1;
    desk = ((desk % V.desks.length) + V.desks.length) % V.desks.length;
    const task = { id: (raw.id != null ? raw.id : (raw.key != null ? raw.key : (raw.name != null ? raw.name : ('task_' + i)))), title: (raw.title != null ? raw.title : (raw.name != null ? raw.name : ('Task ' + (i + 1)))), status: mapStatus(raw.status != null ? raw.status : (raw.state != null ? raw.state : raw.phase)), desk: desk };
    tasks.push(task);
  }
  const prevTasks = V.tasks.slice();
  V.tasks = tasks;
  updateWorker(tasks, prevTasks);
}

function chooseFocus(tasks) {
  const priority = ['failed', 'pending', 'in_progress', 'done'];
  for (let p = 0; p < priority.length; p++) {
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status === priority[p]) return tasks[i];
    }
  }
  return null;
}

function updateWorker(tasks, prevTasks) {
  const focus = chooseFocus(tasks);
  const w = V.worker;
  if (focus) {
    w.mode = focus.status;
    w.targetDesk = focus.desk;
    if (focus.status === 'done' && w.lastDoneId !== focus.id) {
      V.flash.active = true;
      V.flash.t = 0;
      V.flash.desk = focus.desk;
      w.lastDoneId = focus.id;
      w.flashHandled = false;
    }
  } else {
    w.mode = 'idle';
    w.targetDesk = null;
  }
}

function distant(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function idleAdvance(w) {
  if (w.idleTarget == null) w.idleTarget = 0;
  if (w.targetDesk == null) {
    w.targetDesk = w.idleTarget;
    w.idleArrivedAt = 0;
  }
}

function update(dt) {
  const w = V.worker;
  if (V.tasks.length === 0 || chooseFocus(V.tasks) == null) {
    w.mode = 'idle';
    idleAdvance(w);
  }
  if (V.flash.active) {
    V.flash.t += dt;
    if (V.flash.t >= V.flash.duration) {
      V.flash.active = false;
      w.flashHandled = true;
    }
  }
  if (w.mode === 'done' && !V.flash.active && w.flashHandled) {
    w.flashHandled = false;
    const next = V.tasks.find(function (t) { return t.status !== 'done' && t.id !== w.lastDoneId; }) || V.tasks.find(function (t) { return t.status !== 'done'; });
    if (next) {
      w.mode = next.status;
      w.targetDesk = next.desk;
    } else {
      w.mode = 'idle';
      w.targetDesk = null;
      idleAdvance(w);
    }
  }

  let target = null;
  if (w.targetDesk != null && V.desks[w.targetDesk]) {
    const d = V.desks[w.targetDesk];
    target = { x: d.x + d.w * 0.5 - 6, y: d.y + d.h + 3 };
  }
  if (!target && w.mode === 'idle') {
    idleAdvance(w);
    if (w.targetDesk != null && V.desks[w.targetDesk]) {
      const d = V.desks[w.targetDesk];
      target = { x: d.x + d.w * 0.5 - 6, y: d.y + d.h + 3 };
    }
  }
  if (target) {
    const dx = target.x - w.x;
    const dy = target.y - w.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1.2) {
      const step = 58 * dt;
      if (step >= dist) {
        w.x = target.x;
        w.y = target.y;
      } else {
        w.x += (dx / dist) * step;
        w.y += (dy / dist) * step;
      }
      w.atDesk = false;
    } else {
      w.x = target.x;
      w.y = target.y;
      w.atDesk = true;
      if (w.mode === 'idle') {
        if (!w.idleArrivedAt) w.idleArrivedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now - w.idleArrivedAt > 1400) {
          w.idleTarget = (w.targetDesk + 1 + Math.floor(rand() * 2)) % V.desks.length;
          w.targetDesk = null;
          w.idleArrivedAt = 0;
        }
      }
    }
  } else {
    w.atDesk = false;
  }
  if (w.mode === 'in_progress' && w.atDesk) {
    w.typingPhase += dt * 7;
  } else {
    w.typingPhase += dt * 0.6;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - V.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  V.lastTime = now;
  try { update(dt); } catch (e) {}
  try { render(now); } catch (e) {}
}

function colorForStatus(status) {
  if (status === 'pending') return '#9aa0a6';
  if (status === 'in_progress') return '#3b82f6';
  if (status === 'done') return '#22c55e';
  if (status === 'failed') return '#ef4444';
  return '#9aa0a6';
}

function render(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = '#182028';
  ctx.fillRect(0, 0, c.width, c.height);

  const g = V.grid;
  for (let gy = 0; gy < g.rows; gy++) {
    for (let gx = 0; gx < g.cols; gx++) {
      const p0 = iso(gx, gy);
      const p1 = iso(gx + 1, gy);
      const p2 = iso(gx + 1, gy + 1);
      const p3 = iso(gx, gy + 1);
      ctx.fillStyle = ((gx + gy) % 2 === 0) ? '#2a3a2a' : '#243324';
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const backLeft = iso(0, 0);
  const backRight = iso(g.cols, 0);
  const wallH = 52;
  ctx.fillStyle = '#6b5344';
  ctx.fillRect(backLeft.x - 6, backLeft.y - wallH, (backRight.x - backLeft.x) + 12, wallH);
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(backLeft.x - 6, backLeft.y - wallH, (backRight.x - backLeft.x) + 12, wallH);
  ctx.fillStyle = '#5a4234';
  for (let gx = 0; gx < g.cols; gx++) {
    const p = iso(gx + 0.5, 0);
    ctx.fillRect(p.x - 2, backLeft.y - wallH + 6, 4, wallH - 12);
  }

  const deskTasks = [];
  for (let i = 0; i < V.desks.length; i++) deskTasks.push([]);
  for (let i = 0; i < V.tasks.length; i++) {
    const t = V.tasks[i];
    if (deskTasks[t.desk]) deskTasks[t.desk].push(t);
  }

  for (let i = 0; i < V.desks.length; i++) {
    const d = V.desks[i];
    ctx.fillStyle = '#7b5a3a';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#332211';
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(d.x + 4, d.y + d.h - 7, d.w - 8, 4);
    const tasksHere = deskTasks[i];
    for (let j = 0; j < tasksHere.length && j < 3; j++) {
      const t = tasksHere[j];
      const dx = d.x + 9 + j * 3;
      const dy = d.y - 11;
      const col = colorForStatus(t.status);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = col;
      ctx.fillRect(dx - 2, dy - 2, 12, 15);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.fillRect(dx, dy, 8, 11);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, 8, 11);
      if (t.status === 'in_progress') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(dx + 2, dy + 3, 4, 1);
        ctx.fillRect(dx + 2, dy + 6, 4, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (V.flash.active) {
    const d = V.desks[V.flash.desk] || V.desks[0];
    const a = 1 - (V.flash.t / V.flash.duration);
    if (a > 0) {
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(d.x - 8, d.y - 8, d.w + 16, d.h + 16);
      ctx.globalAlpha = 1;
    }
  }

  drawWorker(V.worker, now);

  const pendingCount = V.tasks.filter(function (t) { return t.status === 'pending'; }).length;
  const doneCount = V.tasks.filter(function (t) { return t.status === 'done'; }).length;
  const failedCount = V.tasks.filter(function (t) { return t.status === 'failed'; }).length;

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, c.width, 30);
  ctx.font = 'bold 13px monospace';
  ctx.textBaseline = 'middle';
  let statusText = V.windowStatus;
  let statusColor = '#bdc3c7';
  if (V.offline) {
    statusText = 'OFFLINE';
    statusColor = '#ef4444';
  } else if (V.windowStatus === 'OPEN') {
    statusColor = '#22c55e';
  } else if (V.windowStatus === 'CLOSED') {
    statusColor = '#ef4444';
  }
  ctx.fillStyle = statusColor;
  ctx.fillText(statusText, 12, 15);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Pending: ' + pendingCount + '   Done: ' + doneCount + '   Failed: ' + failedCount, 118, 15);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillText('Tasks: ' + V.tasks.length, c.width - 96, 15);
}

function drawWorker(w, now) {
  const ctx = V.ctx;
  const x = Math.round(w.x);
  const y = Math.round(w.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 3, y + 15, 16, 4);
  ctx.fillStyle = '#26323f';
  ctx.fillRect(x + 2, y + 11, 4, 7);
  ctx.fillRect(x + 9, y + 11, 4, 7);
  ctx.fillStyle = '#d97732';
  ctx.fillRect(x + 1, y + 2, 13, 10);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 4, y - 7, 7, 8);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, y - 4, 2, 2);
  ctx.fillRect(x + 9, y - 4, 2, 2);

  if (w.mode === 'in_progress' && w.atDesk) {
    const swing = Math.sin(w.typingPhase) * 2;
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 13, y + 5 + swing, 4, 2);
    ctx.fillRect(x - 3, y + 6 - swing, 4, 2);
  } else if (w.mode === 'pending') {
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 13, y + 4, 3, 2);
  } else if (w.mode === 'failed') {
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 1, y + 4, 3, 2);
    ctx.fillRect(x + 13, y + 4, 3, 2);
  }

  let bubbleText = null;
  let bubbleColor = '#ffffff';
  if (w.mode === 'pending') { bubbleText = 'building...'; bubbleColor = '#f59e0b'; }
  else if (w.mode === 'failed') { bubbleText = 'failed'; bubbleColor = '#ef4444'; }
  else if (w.mode === 'done') { bubbleText = 'done'; bubbleColor = '#22c55e'; }
  if (bubbleText && w.atDesk) {
    const bw = Math.max(58, bubbleText.length * 7 + 10);
    const bx = x - 8;
    const by = y - 28;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.fillRect(bx, by, bw, 18);
    ctx.strokeStyle = bubbleColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, 18);
    ctx.fillStyle = '#111827';
    ctx.font = '11px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubbleText, bx + 5, by + 9);
  }
}

if (typeof window !== 'undefined') {
  window.init = init;
}
