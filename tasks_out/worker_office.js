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
  flash: { active: false, t: 0, duration: 0.9, count: 0 },
  xpFlash: { active: false, t: 0, duration: 1.1 },
  recentTicks: [],
  floorShade: [],
  grid: null
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
  V.grid = { cols: cols, rows: rows, originX: Math.round(c.width * 0.5), originY: Math.round(c.height * 0.28), tileW: 72, tileH: 36 };
  const positions = [ [1, 1], [4, 1], [1, 3], [4, 3] ];
  for (let i = 0; i < positions.length; i++) {
    const p = iso(positions[i][0], positions[i][1]);
    V.desks.push({ id: i, tileX: positions[i][0], tileY: positions[i][1], x: Math.round(p.x - 28), y: Math.round(p.y - 10), w: 56, h: 26 });
  }
  V.worker = { x: V.desks[0].x + 8, y: V.desks[0].y + V.desks[0].h + 2, targetDesk: 0, mode: 'idle', atDesk: false, idleTarget: 1, idleArrivedAt: 0, typingPhase: 0, lastDoneId: null, flashHandled: false, moving: false, walkFrame: 0, walkTimer: 0, bob: 0 };
  V.flash = { active: false, t: 0, duration: 0.9, count: 0 };
  V.xpFlash = { active: false, t: 0, duration: 1.1 };
  V.recentTicks = [];
  V.floorShade = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const r = rand();
      const red = Math.floor(92 + r * 30);
      const green = Math.floor(55 + r * 20);
      const blue = Math.floor(26 + r * 12);
      V.floorShade.push('rgb(' + red + ',' + green + ',' + blue + ')');
    }
  }
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

function extractRecentTicks(data) {
  const candidateKeys = ['recent_ticks', 'recentTicks', 'recent', 'ticks', 'log', 'logs', 'events', 'history'];
  let arr = null;
  if (data && typeof data === 'object') {
    for (let i = 0; i < candidateKeys.length; i++) {
      const key = candidateKeys[i];
      if (Array.isArray(data[key])) { arr = data[key]; break; }
    }
    if (!arr) {
      for (const key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
          const nested = extractRecentTicks(data[key]);
          if (Array.isArray(nested)) { arr = nested; break; }
        }
      }
    }
  }
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (let i = 0; i < arr.length; i++) out.push(tickText(arr[i]));
  return out.slice(-6);
}

function tickText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.msg === 'string') return value.msg;
    if (typeof value.line === 'string') return value.line;
    if (typeof value.event === 'string') return value.event;
    if (typeof value.status === 'string') return value.status;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value);
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
  const recent = extractRecentTicks(data);
  V.recentTicks = Array.isArray(recent) ? recent : [];
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
  const prevDone = new Set();
  for (let i = 0; i < prevTasks.length; i++) if (prevTasks[i].status === 'done') prevDone.add(prevTasks[i].id);
  let newDone = 0;
  for (let i = 0; i < tasks.length; i++) if (tasks[i].status === 'done' && !prevDone.has(tasks[i].id)) newDone++;
  if (newDone > 0) {
    V.flash.active = true;
    V.flash.t = 0;
    V.flash.duration = 0.9;
    V.flash.count = newDone;
    V.worker.flashHandled = false;
  }
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
  w.moving = false;
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
      w.moving = true;
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
  if (w.moving) {
    w.walkTimer += dt;
    if (w.walkTimer > 0.15) {
      w.walkFrame ^= 1;
      w.walkTimer = 0;
    }
  } else {
    w.walkFrame = 0;
    w.walkTimer = 0;
    w.bob += dt * 2.2;
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
  if (status === 'pending') return '#f59e0b';
  if (status === 'in_progress') return '#3b82f6';
  if (status === 'done') return '#22c55e';
  if (status === 'failed') return '#ef4444';
  return '#9aa0a6';
}

function render(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = '#0d1324';
  ctx.fillRect(0, 0, c.width, c.height);

  const g = V.grid;
  for (let gy = 0; gy < g.rows; gy++) {
    for (let gx = 0; gx < g.cols; gx++) {
      const p0 = iso(gx, gy);
      const p1 = iso(gx + 1, gy);
      const p2 = iso(gx + 1, gy + 1);
      const p3 = iso(gx, gy + 1);
      ctx.fillStyle = V.floorShade[gy * g.cols + gx] || '#5c3d24';
      ctx.beginPath();
      ctx.moveTo(Math.round(p0.x), Math.round(p0.y));
      ctx.lineTo(Math.round(p1.x), Math.round(p1.y));
      ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
      ctx.lineTo(Math.round(p3.x), Math.round(p3.y));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const backLeft = iso(0, 0);
  const backRight = iso(g.cols, 0);
  const wallH = 54;
  const wallX = Math.round(backLeft.x - 6);
  const wallW = Math.round((backRight.x - backLeft.x) + 12);
  const wallY = Math.round(backLeft.y - wallH);
  ctx.fillStyle = '#3a4252';
  ctx.fillRect(wallX, wallY, wallW, wallH);
  ctx.fillStyle = '#4b5566';
  for (let gx = 0; gx < g.cols; gx++) {
    const p = iso(gx + 0.5, 0);
    ctx.fillRect(Math.round(p.x - 2), wallY + 8, 4, wallH - 16);
  }
  ctx.strokeStyle = '#202733';
  ctx.lineWidth = 2;
  ctx.strokeRect(wallX, wallY, wallW, wallH);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = wallY + 10; y < wallY + wallH; y += 9) {
    ctx.fillRect(wallX + 4, y, wallW - 8, 1);
  }

  drawTorch(Math.round(wallX + wallW * 0.25), Math.round(wallY + wallH * 0.48), 0, now);
  drawTorch(Math.round(wallX + wallW * 0.75), Math.round(wallY + wallH * 0.48), 1, now);

  const deskTasks = [];
  for (let i = 0; i < V.desks.length; i++) deskTasks.push([]);
  for (let i = 0; i < V.tasks.length; i++) {
    const t = V.tasks[i];
    if (deskTasks[t.desk]) deskTasks[t.desk].push(t);
  }

  for (let i = 0; i < V.desks.length; i++) {
    const d = V.desks[i];
    const sideH = Math.round(d.h * 0.36);
    ctx.fillStyle = '#4b321f';
    ctx.fillRect(d.x, d.y + d.h - sideH, d.w, sideH);
    ctx.fillStyle = '#8b643f';
    ctx.fillRect(d.x, d.y, d.w, d.h - sideH);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(d.x + 3, d.y + 4, d.w - 6, 1);
    ctx.fillRect(d.x + 3, d.y + 9, d.w - 6, 1);
    ctx.fillStyle = '#332211';
    ctx.fillRect(d.x, d.y + d.h - 3, d.w, 2);

    const tasksHere = deskTasks[i];
    for (let j = 0; j < tasksHere.length && j < 3; j++) {
      const t = tasksHere[j];
      const dx = d.x + 9 + j * 16;
      const dy = d.y - 12;
      const col = colorForStatus(t.status);
      let pulse = 1;
      if (t.status === 'pending' || t.status === 'in_progress') {
        pulse = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(now * 0.006 + i * 1.3 + j));
      }
      ctx.globalAlpha = 0.18 * pulse;
      ctx.fillStyle = col;
      ctx.fillRect(dx - 3, dy - 3, 14, 17);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = col;
      ctx.fillRect(dx, dy, 8, 11);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, 8, 11);
      if (t.status === 'in_progress') {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(dx + 2, dy + 3, 4, 1);
        ctx.fillRect(dx + 2, dy + 6, 4, 1);
      }
      if (t.status === 'done') {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(dx + 2, dy + 5, 4, 1);
      }
      if (t.status === 'failed') {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(dx + 1, dy + 4, 6, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (V.flash.active) {
    const a = Math.max(0, 1 - (V.flash.t / V.flash.duration));
    if (a > 0) {
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = '#facc15';
      const w = V.worker;
      ctx.fillRect(Math.round(w.x) - 12, Math.round(w.y) - 18, 36, 36);
      ctx.globalAlpha = 1;
    }
  }

  drawWorker(V.worker, now);

  if (V.xpFlash.active) {
    const f = V.xpFlash;
    f.t += 0; // time is advanced in update; kept for symmetry
    const a = Math.max(0, 1 - (f.t / f.duration));
    if (a > 0) {
      const w = V.worker;
      const wx = Math.round(w.x) + 4;
      const wy = Math.round(w.y) - 6;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(wx - 16, wy - 16, 32, 32);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 12px monospace';
      ctx.textBaseline = 'middle';
      const fy = Math.round(w.y) - 24 - Math.round(f.t * 16);
      ctx.fillText('+XP', wx - 12, fy);
      ctx.globalAlpha = 1;
    }
  }

  const pendingCount = V.tasks.filter(function (t) { return t.status === 'pending'; }).length;
  const doneCount = V.tasks.filter(function (t) { return t.status === 'done'; }).length;
  const failedCount = V.tasks.filter(function (t) { return t.status === 'failed'; }).length;
  const totalCount = V.tasks.length;

  const topH = 34;
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, c.width, topH);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, topH - 2, c.width, 2);
  ctx.font = 'bold 13px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3d37a';
  ctx.fillText('MISSINGNO WORKER ONLINE', 12, 17);
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
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(statusText, c.width * 0.5, 17);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '12px monospace';
  ctx.fillText('Pending: ' + pendingCount + '   Done: ' + doneCount + '   Failed: ' + failedCount + '   Total: ' + totalCount, c.width - 348, 17);

  drawRightPanel(c, now, doneCount, totalCount);
  drawChat(c);
  drawBottomBar(c, doneCount, totalCount);
}

function drawTorch(cx, cy, index, now) {
  const ctx = V.ctx;
  const b = Math.max(0.32, Math.min(1, 0.58 + 0.34 * Math.sin(now * 0.012 + index * 2.1) + (rand() - 0.5) * 0.16));
  const sizes = [46, 34, 22, 12];
  for (let k = 0; k < sizes.length; k++) {
    const a = b * (0.24 - k * 0.045);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = k < 2 ? '#ff8c1a' : '#ffc27a';
    const s = sizes[k];
    ctx.fillRect(cx - Math.round(s * 0.5), cy - Math.round(s * 0.5), s, s);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(cx - 2, cy + 8, 4, 13);
  ctx.fillStyle = '#ff9a3c';
  const fh = Math.round(7 + b * 4);
  ctx.fillRect(cx - 3, cy + 9 - fh, 6, fh);
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(cx - 1, cy + 10 - fh, 2, Math.max(2, fh - 3));
}

function drawWorker(w, now) {
  const ctx = V.ctx;
  const bob = w.moving ? 0 : Math.round(Math.sin(w.bob) * 1.1);
  const x = Math.round(w.x);
  const y = Math.round(w.y) + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 4, Math.round(w.y) + 17, 20, 4);

  if (w.moving && w.walkFrame === 1) {
    ctx.fillStyle = '#26323f';
    ctx.fillRect(x + 2, y + 9, 4, 8);
    ctx.fillRect(x + 10, y + 12, 4, 5);
  } else if (w.moving && w.walkFrame === 0) {
    ctx.fillStyle = '#26323f';
    ctx.fillRect(x + 2, y + 12, 4, 5);
    ctx.fillRect(x + 10, y + 9, 4, 8);
  } else {
    ctx.fillStyle = '#26323f';
    ctx.fillRect(x + 2, y + 10, 4, 8);
    ctx.fillRect(x + 10, y + 10, 4, 8);
  }

  ctx.fillStyle = '#9a6334';
  ctx.fillRect(x + 1, y - 2, 14, 12);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 3, y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, y - 8, 2, 2);
  ctx.fillRect(x + 9, y - 8, 2, 2);
  ctx.fillStyle = '#7c4a24';
  ctx.fillRect(x + 4, y - 12, 8, 2);

  if (w.mode === 'in_progress' && w.atDesk) {
    const swing = Math.round(Math.sin(w.typingPhase) * 2);
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 13, y + 4 + swing, 4, 2);
    ctx.fillRect(x - 3, y + 5 - swing, 4, 2);
  } else if (w.mode === 'pending') {
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 13, y + 4, 4, 2);
  } else if (w.mode === 'failed') {
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 1, y + 4, 3, 2);
    ctx.fillRect(x + 12, y + 4, 3, 2);
  }

  let bubbleText = null;
  let bubbleColor = '#ffffff';
  if (w.mode === 'pending') { bubbleText = 'building...'; bubbleColor = '#f59e0b'; }
  else if (w.mode === 'failed') { bubbleText = 'failed'; bubbleColor = '#ef4444'; }
  else if (w.mode === 'done') { bubbleText = 'done'; bubbleColor = '#22c55e'; }
  if (bubbleText && w.atDesk) {
    const bw = Math.max(60, bubbleText.length * 7 + 10);
    const bx = x - 10;
    const by = y - 30;
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

  const tagW = 76;
  const tagH = 12;
  const cx = x + 7;
  const tagX = cx - Math.round(tagW * 0.5);
  const tagY = y - 35;
  ctx.fillStyle = 'rgba(10, 10, 12, 0.88)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 9px monospace';
  ctx.textBaseline = 'middle';
  const name = 'MISSINGNO';
  const metrics = ctx.measureText(name);
  ctx.fillText(name, tagX + (tagW - metrics.width) * 0.5, tagY + tagH * 0.5 + 1);

  const barX = tagX + 3;
  const barY = tagY + tagH + 3;
  const barW = tagW - 6;
  const barH = 3;
  const total = Math.max(1, V.tasks.length);
  const done = V.tasks.filter(function (t) { return t.status === 'done'; }).length;
  const ratio = V.tasks.length ? done / total : 0;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
}

function drawRightPanel(c, now, doneCount, totalCount) {
  const ctx = V.ctx;
  const panelW = 220;
  const panelX = c.width - panelW - 12;
  const panelY = 44;
  const panelH = c.height - 44 - 58;
  ctx.fillStyle = '#d9c8a3';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  ctx.fillStyle = '#4a2f16';
  ctx.fillRect(panelX + 4, panelY + 4, panelW - 8, 24);
  ctx.fillStyle = '#f3e6bf';
  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('QUEST LOG', panelX + panelW * 0.5, panelY + 16);
  ctx.textAlign = 'left';

  const rowH = 22;
  const startY = panelY + 36;
  const maxRows = Math.max(1, Math.floor((panelH - 44) / rowH));
  const tasks = V.tasks.slice(0, maxRows);
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const y = startY + i * rowH;
    const active = t.status === 'in_progress';
    if (active) {
      ctx.fillStyle = 'rgba(255, 233, 168, 0.72)';
      ctx.fillRect(panelX + 4, y - 2, panelW - 8, rowH);
    }
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';
    if (t.status === 'pending') ctx.fillStyle = '#b45309';
    else if (t.status === 'in_progress') ctx.fillStyle = '#1d4ed8';
    else if (t.status === 'done') ctx.fillStyle = '#15803d';
    else if (t.status === 'failed') ctx.fillStyle = '#b91c1c';
    else ctx.fillStyle = '#333333';
    let glyph = '';
    if (t.status === 'pending') glyph = '!';
    else if (t.status === 'done') glyph = '\u2713';
    else if (t.status === 'failed') glyph = '\u2717';
    else if (t.status === 'in_progress') glyph = '\u25B6';
    ctx.fillText(glyph, panelX + 10, y + 8);

    const title = String(t.title || t.id || '');
    const maxChars = 20;
    const shown = title.length > maxChars ? title.slice(0, maxChars - 1) + '\u2026' : title;
    const tx = panelX + 30;
    if (t.status === 'done') ctx.fillStyle = 'rgba(40, 30, 20, 0.55)';
    else ctx.fillStyle = '#2b1d0e';
    ctx.fillText(shown, tx, y + 8);
    if (t.status === 'done') {
      const m = ctx.measureText(shown);
      const ly = y + 8;
      ctx.strokeStyle = 'rgba(40, 30, 20, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, ly);
      ctx.lineTo(tx + m.width, ly);
      ctx.stroke();
    }
  }
  if (V.tasks.length > maxRows) {
    ctx.fillStyle = 'rgba(40,30,20,0.55)';
    ctx.font = '10px monospace';
    ctx.fillText('+' + (V.tasks.length - maxRows) + ' more', panelX + 12, panelY + panelH - 12);
  }
}

function drawChat(c) {
  const ctx = V.ctx;
  const bottomH = 52;
  const chatW = 300;
  const chatH = 14 + 6 * 14 + 8;
  const chatX = 12;
  const chatY = c.height - bottomH - chatH - 8;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.fillRect(chatX, chatY, chatW, chatH);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(chatX, chatY, chatW, chatH);
  const lines = V.recentTicks.slice(-6);
  const lineH = 14;
  const startY = chatY + chatH - (lines.length * lineH) - 6;
  ctx.font = '12px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(230, 210, 150, 0.78)';
  for (let i = 0; i < lines.length; i++) {
    const raw = String(lines[i]);
    const maxChars = 42;
    const shown = raw.length > maxChars ? raw.slice(0, maxChars - 1) + '\u2026' : raw;
    ctx.fillText('> ' + shown, chatX + 8, startY + i * lineH + lineH * 0.5);
  }
}

function drawBottomBar(c, doneCount, totalCount) {
  const ctx = V.ctx;
  const bottomH = 52;
  const bottomY = c.height - bottomH;
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, bottomY, c.width, bottomH);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, bottomY, c.width, 2);

  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 14px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('LVL ' + doneCount, 18, bottomY + bottomH * 0.5);

  const barX = 92;
  const barY = bottomY + 12;
  const barW = c.width - 190;
  const barH = 24;
  ctx.fillStyle = '#1f1708';
  ctx.fillRect(barX - 4, barY - 4, barW + 8, barH + 8);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX - 4, barY - 4, barW + 8, barH + 8);
  ctx.fillStyle = '#2a1f0c';
  ctx.fillRect(barX, barY, barW, barH);
  const ratio = totalCount ? doneCount / totalCount : 0;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(barX, barY, Math.round(barW * ratio), Math.round(barH * 0.45));
  ctx.fillStyle = '#1f1708';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('XP ' + doneCount + ' / ' + totalCount, barX + barW * 0.5, barY + barH * 0.5 + 1);
  ctx.textAlign = 'left';
}

if (typeof window !== 'undefined') {
  window.init = init;
}
