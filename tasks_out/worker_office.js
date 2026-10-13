```python
function init(canvas, apiBase) {
  if (!canvas) return;
  if (!canvas.width) canvas.width = 960;
  if (!canvas.height) canvas.height = 640;
  V.canvas = canvas;
  V.ctx = canvas.getContext('2d');
  V.apiBase = String(apiBase || '').replace(/\/+$/, '');
  V.ctx.imageSmoothingEnabled = false;
  V.nowTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
  nowTime: 0,
  dt: 0,
  pollTimer: null,
  fetching: false,
  offline: false,
  windowStatus: 'OPEN',
  tasks: [],
  allTasks: [],
  desks: [],
  worker: null,
  workerStates: [],
  workers: [],
  rnd: 123456789,
  flash: { active: false, t: 0, duration: 0.9, count: 0 },
  xpFlash: { active: false, t: 0, duration: 1.1 },
  recentTicks: [],
  chatLines: [],
  floorShade: [],
  grid: null,
  totalDone: 0,
  growthStep: 0,
  mapLevel: 1,
  mapGlint: { active: false, t: 0, duration: 1.2, step: -1 },
  growthAnim: null,
  particleId: 0,
  particles: [],
  leafAccum: 0,
  starsSmall: [],
  starsBright: [],
  floatingRocks: [],
  torchPts: [],
  nebulaPhase: 0,
  xpTexts: [],
  levelUp: { active: false, t: 0, duration: 2 },
  screenShake: { active: false, t: 0, duration: 0.3 },
  questGlints: []
};

function rand() {
  V.rnd = (V.rnd * 1664525 + 1013904223) >>> 0;
  return V.rnd / 4294967296;
}

function seeded(seed) {
  var x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

function resetRng() {
  V.rnd = 123456789;
}

function updateGrid() {
  const s = V.growthStep;
  const scale = Math.min(1, 384 / ((2 + 2 * s) * 35));
  const c = V.canvas;
  V.grid = { originX: Math.round(c.width * 0.5), originY: Math.round(c.height * 0.42),
             tileW: 70 * scale, tileH: 35 * scale };
}

function buildScene() {
  const c = V.canvas;
  V.desks = [];
  updateGrid();
  const positions = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (let i = 0; i < positions.length; i++) {
    const p = iso(positions[i][0], positions[i][1]);
    V.desks.push({ id: i, tileX: positions[i][0], tileY: positions[i][1], x: Math.round(p.x - 28), y: Math.round(p.y - 10), w: 56, h: 26 });
  }
  V.workerStates = [];
  V.workers = [];
  V.tasks = [];
  V.allTasks = [];
  V.chatLines = [];
  V.recentTicks = [];
  V.totalDone = 0;
  V.growthStep = 0;
  V.mapLevel = 1;
  V.mapGlint = { active: false, t: 0, duration: 1.2, step: -1 };
  V.growthAnim = null;
  V.flash = { active: false, t: 0, duration: 0.9, count: 0 };
  V.xpFlash = { active: false, t: 0, duration: 1.1 };
  V.particles = [];
  V.leafAccum = 0;
  V.torchPts = [];
  V.xpTexts = [];
  V.levelUp = { active: false, t: 0, duration: 2 };
  V.screenShake = { active: false, t: 0, duration: 0.3 };
  V.questGlints = [];
  resetRng();

  V.starsSmall = [];
  for (let i = 0; i < 60; i++) {
    const seed = i + 1;
    V.starsSmall.push({
      x: seeded(seed * 3.1) * c.width,
      y: seeded(seed * 7.3) * c.height * 0.62,
      speed: 2 + seeded(seed * 11.9) * 8,
      phase: seeded(seed * 17.7) * Math.PI * 2,
      size: seeded(seed * 23.3) < 0.35 ? 2 : 1,
      blue: seeded(seed * 29.1) < 0.3
    });
  }
  V.starsBright = [];
  for (let i = 0; i < 25; i++) {
    const seed = 100 + i;
    V.starsBright.push({
      x: seeded(seed * 4.7) * c.width,
      y: seeded(seed * 8.9) * c.height * 0.58,
      speed: 6 + seeded(seed * 13.1) * 12,
      phase: seeded(seed * 19.3) * Math.PI * 2,
      size: 2 + Math.round(seeded(seed * 27.7) * 2),
      blue: seeded(seed * 31.9) < 0.5
    });
  }
  V.floatingRocks = [];
  for (let i = 0; i < 4; i++) {
    const seed = 200 + i;
    V.floatingRocks.push({
      x: c.width * 0.5 + (seeded(seed * 5.1) - 0.5) * 360,
      y: c.height * 0.78 + seeded(seed * 9.7) * 70,
      phase: seeded(seed * 14.3) * Math.PI * 2,
      depth: 60 + seeded(seed * 18.9) * 30,
      size: 8 + seeded(seed * 22.7) * 12,
      shade: Math.floor(seeded(seed * 27.1) * 3)
    });
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

function chooseFocus(tasks) {
  const priority = ['failed', 'pending', 'in_progress', 'done'];
  for (let p = 0; p < priority.length; p++) {
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status === priority[p]) return tasks[i];
    }
  }
  return null;
}

function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  if (index === 1 || n.indexOf('step') !== -1) return '#a78bfa';
  return '#facc15';
}

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function ensureWorkerStates(count) {
  while (V.workerStates.length < count) {
    const i = V.workerStates.length;
    const deskIndex = V.desks.length ? ((i * 2) % V.desks.length) : 0;
    const st = {
      index: i,
      x: V.desks.length ? V.desks[deskIndex].x + 8 : 0,
      y: V.desks.length ? V.desks[deskIndex].y + V.desks[deskIndex].h + 2 : 0,
      targetDesk: deskIndex,
      mode: 'idle',
      atDesk: false,
      idleTarget: deskIndex,
      idleArrivedAt: 0,
      typingPhase: 0,
      lastDoneId: null,
      flashHandled: false,
      moving: false,
      walkFrame: 0,
      walkTimer: 0,
      bob: 0,
      facing: 'down',
      tasks: [],
      flash: { active: false, t: 0, duration: 0.9, count: 0 },
      xpFlash: { active: false, t: 0, duration: 1.1 },
      name: ''
    };
    V.workerStates.push(st);
  }
  if (V.workerStates.length > count) V.workerStates = V.workerStates.slice(0, count);
}

function normalizeBoard(data) {
  const prevTotalDone = V.totalDone;
  const root = data && typeof data === 'object' ? data : {};
  const roots = Array.isArray(root.workers) ? root.workers.slice() : [root];
  const metas = [];
  for (let i = 0; i < roots.length; i++) {
    const src = roots[i] && typeof roots[i] === 'object' ? roots[i] : {};
    let rawTasks = collectTasks(src);
    if (!rawTasks.length && i === 0) rawTasks = collectTasks(root);
    const recentRaw = extractRecentTicks(src);
    const recentTicks = Array.isArray(recentRaw) ? recentRaw : (i === 0 ? extractRecentTicks(root) : []);
    const safeRecent = Array.isArray(recentTicks) ? recentTicks : [];
    const name = src.name != null ? src.name : (i === 0 ? 'MISSINGNO' : (i === 1 ? 'STEP5' : ('WORKER ' + (i + 1))));
    const model = src.model != null ? src.model : 'worker';
    const windowSrc = Object.assign({}, root, src);
    const win = detectWindow(windowSrc);
    metas.push({ name: name, model: model, windowStatus: win, rawTasks: rawTasks, recentTicks: safeRecent });
  }

  const deskVals = [];
  for (let i = 0; i < metas.length; i++) {
    const rawTasks = metas[i].rawTasks || [];
    for (let j = 0; j < rawTasks.length; j++) {
      const v = parseDeskRaw(rawTasks[j]);
      if (v != null) deskVals.push(v);
    }
  }
  const oneBased = deskVals.length > 0 && deskVals.indexOf(0) === -1 && Math.min.apply(null, deskVals) >= 1 && Math.max.apply(null, deskVals) <= V.desks.length;

  const normalized = metas.map(function (meta, i) {
    const tasks = [];
    const rawTasks = meta.rawTasks || [];
    for (let j = 0; j < rawTasks.length; j++) {
      const raw = rawTasks[j] || {};
      let desk = parseDeskRaw(raw);
      if (desk == null) desk = j % V.desks.length;
      if (oneBased) desk = desk - 1;
      desk = ((desk % V.desks.length) + V.desks.length) % V.desks.length;
      const task = {
        id: (raw.id != null ? raw.id : (raw.key != null ? raw.key : (raw.name != null ? raw.name : ('task_' + j)))),
        title: (raw.title != null ? raw.title : (raw.name != null ? raw.name : ('Task ' + (j + 1)))),
        status: mapStatus(raw.status != null ? raw.status : (raw.state != null ? raw.state : raw.phase)),
        desk: desk
      };
      tasks.push(task);
    }
    return { name: meta.name, model: meta.model, windowStatus: meta.windowStatus, tasks: tasks, recentTicks: meta.recentTicks.slice() };
  });

  const prevWorkers = V.workers.slice();
  ensureWorkerStates(normalized.length);

  let totalDone = 0;
  for (let i = 0; i < normalized.length; i++) {
    const nw = normalized[i];
    const pw = prevWorkers[i];
    const prevTasks = (pw && Array.isArray(pw.tasks)) ? pw.tasks : [];
    const prevDone = new Set();
    for (let p = 0; p < prevTasks.length; p++) if (prevTasks[p].status === 'done') prevDone.add(prevTasks[p].id);
    const newlyDone = [];
    for (let t = 0; t < nw.tasks.length; t++) if (nw.tasks[t].status === 'done' && !prevDone.has(nw.tasks[t].id)) newlyDone.push(nw.tasks[t].id);
    const newDone = newlyDone.length;
    const st = V.workerStates[i];
    st.index = i;
    st.name = nw.name;
    if (newDone > 0) {
      st.flash.active = true;
      st.flash.t = 0;
      st.flash.duration = 0.9;
      st.flash.count = newDone;
      st.flashHandled = false;
      V.xpFlash.active = true;
      V.xpFlash.t = 0;
      spawnXpFx(i, newDone);
      for (let g = 0; g < newlyDone.length; g++) {
        V.questGlints.push({ key: i + ':' + newlyDone[g], t: 0, duration: 0.5 });
      }
    }
    st.tasks = nw.tasks;
    const focus = chooseFocus(nw.tasks);
    if (focus) {
      st.mode = focus.status;
      st.targetDesk = focus.desk;
    } else {
      st.mode = 'idle';
      st.targetDesk = null;
      idleAdvance(st);
    }
    for (let t = 0; t < nw.tasks.length; t++) if (nw.tasks[t].status === 'done') totalDone++;
  }

  const newSteps = Math.min(8, Math.floor(totalDone / 2));
  const newlyUnlocked = newSteps > V.growthStep;
  if (newlyUnlocked) {
    V.mapGlint = { active: true, t: 0, duration: 1.2, step: newSteps };
    V.growthAnim = {
      active: true,
      step: newSteps,
      startTime: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
      duration: 1500,
      triggered: false
    };
  }
  if (newSteps > V.growthStep) V.growthStep = newSteps;
  V.mapLevel = V.growthStep + 1;
  updateGrid();
  V.totalDone = totalDone;

  const oldLevel = Math.floor((prevTotalDone || 0) / 10);
  const newLevel = Math.floor(totalDone / 10);
  if (newLevel > oldLevel) triggerLevelUp();

  V.workers = normalized;
  V.tasks = normalized.length ? normalized[0].tasks.slice() : [];
  V.windowStatus = normalized.length ? normalized[0].windowStatus : (V.windowStatus || detectWindow(root));
  V.allTasks = [];
  for (let i = 0; i < normalized.length; i++) {
    const tks = normalized[i].tasks || [];
    for (let j = 0; j < tks.length; j++) V.allTasks.push(tks[j]);
  }
  V.recentTicks = normalized.length ? normalized[0].recentTicks.slice() : [];

  V.chatLines = [];
  for (let i = 0; i < normalized.length; i++) {
    const worker = normalized[i];
    const col = workerColor(i, worker.name);
    const ticks = Array.isArray(worker.recentTicks) ? worker.recentTicks : [];
    for (let j = 0; j < ticks.length; j++) V.chatLines.push({ name: worker.name, color: col, text: String(ticks[j]) });
  }

  V.worker = V.workerStates.length ? V.workerStates[0] : null;
}

function spawnXpFx(wi, count) {
  const w = V.workerStates[wi];
  if (!w) return;
  for (let c = 0; c < count; c++) {
    V.xpTexts.push({ x: Math.round(w.x) + 4, baseY: Math.round(w.y) - 16, age: 0, life: 1.0 });
    for (let e = 0; e < 6; e++) {
      const ang = (Math.PI * 2 / 6) * e + (rand() - 0.5) * 0.6;
      const sp = 30 + rand() * 30;
      V.particles.push({
        id: V.particleId++,
        kind: 'ember',
        x: Math.round(w.x) + 8,
        y: Math.round(w.y) - 4,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 20,
        phase: rand() * Math.PI * 2,
        life: 0.6 + rand() * 0.4,
        age: 0,
        size: 2,
        color: rand() < 0.5 ? '#ff5a1f' : '#ffc27a'
      });
    }
  }
}

function triggerLevelUp() {
  V.levelUp = { active: true, t: 0, duration: 2 };
  V.screenShake = { active: true, t: 0, duration: 0.3 };
  const c = V.canvas;
  const cx = c.width * 0.5;
  const cy = c.height * 0.5;
  for (let k = 0; k < 20; k++) {
    const ang = (Math.PI * 2 / 20) * k;
    const speed = 80 + rand() * 60;
    V.particles.push({
      id: V.particleId++,
      kind: 'ember',
      x: cx,
      y: cy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      phase: rand() * Math.PI * 2,
      life: 0.8 + rand() * 0.4,
      age: 0,
      size: 2,
      color: rand() < 0.5 ? '#ff5a1f' : '#ffc27a'
    });
  }
}

function anyFailed() {
  for (let i = 0; i < V.workerStates.length; i++) if (V.workerStates[i].mode === 'failed') return true;
  for (let i = 0; i < V.allTasks.length; i++) if (V.allTasks[i].status === 'failed') return true;
  return false;
}

function idleAdvance(w) {
  if (w.idleTarget == null) w.idleTarget = 0;
  if (w.targetDesk == null) {
    w.targetDesk = w.idleTarget;
    w.idleArrivedAt = 0;
  }
}

function easeOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - t, 3);
}

function updateParticles(dt) {
  const now = V.nowTime || Date.now();
  const c = V.canvas;

  if (V.mapLevel >= 7) {
    let catzCount = 0;
    for (let i = 0; i < V.particles.length; i++) if (V.particles[i].kind === 'catz') catzCount++;
    const tp = iso(1, 1);
    const cx = Math.round(tp.x - 14) + 16;
    const cy = Math.round(tp.y + 2) - 6;
    while (catzCount < 3) {
      V.particles.push({
        id: V.particleId++,
        kind: 'catz',
        x: cx + (rand() - 0.5) * 6,
        y: cy - rand() * 6,
        vx: (rand() - 0.5) * 6,
        vy: -12 - rand() * 6,
        phase: rand() * Math.PI * 2,
        life: 1.6 + rand() * 0.8,
        age: 0,
        size: 2,
        color: '#e2e8f0'
      });
      catzCount++;
    }
  }

  if (Array.isArray(V.torchPts)) {
    for (let ti = 0; ti < V.torchPts.length; ti++) {
      let cnt = 0;
      for (let i = 0; i < V.particles.length; i++) if (V.particles[i].kind === 'ember' && V.particles[i].src === ti) cnt++;
      while (cnt < 4) {
        const tp = V.torchPts[ti];
        V.particles.push({
          id: V.particleId++,
          kind: 'ember',
          src: ti,
          x: tp.x + (rand() - 0.5) * 6,
          y: tp.y - 2,
          vx: (rand() - 0.5) * 10,
          vy: -18 - rand() * 18,
          phase: rand() * Math.PI * 2,
          life: 1.2 + rand() * 0.8,
          age: 0,
          size: 2,
          color: rand() < 0.5 ? '#ff5a1f' : '#ffc27a'
        });
        cnt++;
      }
    }
  }

  let moteCount = 0;
  for (let i = 0; i < V.particles.length; i++) if (V.particles[i].kind === 'mote') moteCount++;
  while (moteCount < 24) {
    const gr = godRayGeometry();
    const t = rand();
    const y = gr.topY + t * (gr.bottomY - gr.topY);
    const half = 8 + (gr.bottomHalf - 8) * t;
    V.particles.push({
      id: V.particleId++,
      kind: 'mote',
      x: gr.topX + (rand() - 0.5) * half * 2,
      y: y,
      vx: (rand() - 0.5) * 8,
      vy: 6 + rand() * 10,
      phase: rand() * Math.PI * 2,
      life: 3 + rand() * 2,
      age: 0,
      size: 1,
      color: 'rgba(240,248,255,0.85)'
    });
    moteCount++;
  }

  let ffCount = 0;
  for (let i = 0; i < V.particles.length; i++) if (V.particles[i].kind === 'firefly') ffCount++;
  while (ffCount < 4) {
    const side = Math.floor(rand() * 4);
    let x = c.width * 0.5;
    let y = c.height * 0.5;
    if (side === 0) { x = 40 + rand() * 120; y = 180 + rand() * 260; }
    else if (side === 1) { x = c.width - 40 - rand() * 120; y = 180 + rand() * 260; }
    else if (side === 2) { x = 120 + rand() * (c.width - 240); y = c.height * 0.35 + rand() * 80; }
    else { x = 120 + rand() * (c.width - 240); y = c.height * 0.72 + rand() * 80; }
    V.particles.push({
      id: V.particleId++,
      kind: 'firefly',
      x: x,
      y: y,
      vx: (rand() - 0.5) * 18,
      vy: (rand() - 0.5) * 18,
      wander: 0,
      wanderTimer: rand() * 2,
      phase: rand() * Math.PI * 2,
      life: 10 + rand() * 8,
      age: 0,
      size: 2,
      color: '#facc15'
    });
    ffCount++;
  }

  V.leafAccum += dt;
  let leafCount = 0;
  for (let i = 0; i < V.particles.length; i++) if (V.particles[i].kind === 'leaf') leafCount++;
  if (V.leafAccum > 5 + rand() * 7 && leafCount < 2) {
    V.particles.push({
      id: V.particleId++,
      kind: 'leaf',
      x: 120 + rand() * (c.width - 240),
      y: -10,
      vx: (rand() - 0.5) * 8,
      vy: 28 + rand() * 18,
      sway: 1 + rand() * 1.5,
      phase: rand() * Math.PI * 2,
      life: 6 + rand() * 3,
      age: 0,
      size: 3,
      color: '#8b6b3f'
    });
    V.leafAccum = 0;
  }

  if (V.growthAnim && V.growthAnim.active) {
    const progress = Math.max(0, Math.min(1, (now - V.growthAnim.startTime) / V.growthAnim.duration));
    if (progress >= 0.99 && !V.growthAnim.triggered) {
      V.growthAnim.triggered = true;
      const ring = V.growthAnim.step;
      const minC = -2 - (ring - 1);
      const maxC = 1 + (ring - 1);
      for (let gy = minC; gy <= maxC; gy++) {
        for (let gx = minC; gx <= maxC; gx++) {
          if (tileRing(gx, gy) !== ring) continue;
          const pt = iso(gx, gy);
          for (let k = 0; k < 3; k++) {
            V.particles.push({
              id: V.particleId++,
              kind: 'puff',
              x: pt.x + (rand() - 0.5) * 20,
              y: pt.y + (rand() - 0.5) * 8,
              vx: (rand() - 0.5) * 24,
              vy: -6 - rand() * 14,
              phase: rand() * Math.PI * 2,
              life: 0.7 + rand() * 0.6,
              age: 0,
              size: 3,
              color: 'rgba(150,145,135,0.85)'
            });
          }
        }
      }
    }
    if (progress >= 1) V.growthAnim.active = false;
  }

  const next = [];
  for (let i = 0; i < V.particles.length; i++) {
    const p = V.particles[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    if (p.kind === 'ember') {
      p.x += (p.vx + Math.sin(p.age * 9 + p.phase) * 7) * dt;
      p.y += p.vy * dt;
      p.vy += 6 * dt;
    } else if (p.kind === 'mote') {
      p.x += (p.vx + Math.sin(p.age * 2 + p.phase) * 3) * dt;
      p.y += p.vy * dt;
      if (p.y > godRayGeometry().bottomY) {
        p.y = godRayGeometry().topY + rand() * 20;
        p.x = godRayGeometry().topX + (rand() - 0.5) * 16;
      }
    } else if (p.kind === 'firefly') {
      p.wanderTimer -= dt;
      if (p.wanderTimer <= 0) {
        p.vx = (rand() - 0.5) * 24;
        p.vy = (rand() - 0.5) * 24;
        p.wanderTimer = 1 + rand() * 2;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 20) { p.x = 20; p.vx = Math.abs(p.vx); }
      if (p.x > c.width - 20) { p.x = c.width - 20; p.vx = -Math.abs(p.vx); }
      if (p.y < 80) { p.y = 80; p.vy = Math.abs(p.vy); }
      if (p.y > c.height - 90) { p.y = c.height - 90; p.vy = -Math.abs(p.vy); }
    } else if (p.kind === 'leaf') {
      p.x += Math.sin(p.age * 1.4 + p.phase) * 18 * dt;
      p.y += p.vy * dt;
    } else if (p.kind === 'puff') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vy += 12 * dt;
    } else if (p.kind === 'catz') {
      p.x += Math.sin(p.age * 2 + p.phase) * 6 * dt;
      p.y -= 14 * dt;
    }
    next.push(p);
  }
  V.particles = next;
}

function update(dt) {
  V.dt = dt;
  for (let wi = 0; wi < V.workerStates.length; wi++) {
    const w = V.workerStates[wi];
    const workerMeta = V.workers[wi] || {};
    const tasks = Array.isArray(workerMeta.tasks) ? workerMeta.tasks : (Array.isArray(w.tasks) ? w.tasks : []);
    w.tasks = tasks;

    if (tasks.length === 0 || chooseFocus(tasks) == null) {
      w.mode = 'idle';
      idleAdvance(w);
    }

    if (w.flash.active) {
      w.flash.t += dt;
      if (w.flash.t >= w.flash.duration) {
        w.flash.active = false;
        w.flashHandled = true;
      }
    }
    if (w.mode === 'done' && !w.flash.active && w.flashHandled) {
      w.flashHandled = false;
      const next = tasks.find(function (t) { return t.status !== 'done' && t.id !== w.lastDoneId; }) || tasks.find(function (t) { return t.status !== 'done'; });
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
      if (Math.abs(dx) > Math.abs(dy)) w.facing = dx >= 0 ? 'right' : 'left';
      else w.facing = dy >= 0 ? 'down' : 'up';
      w.moving = false;
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
      w.moving = false;
    }

    if (w.moving) {
      w.walkTimer += dt;
      while (w.walkTimer >= 0.15) {
        w.walkFrame = (w.walkFrame + 1) % 4;
        w.walkTimer -= 0.15;
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

  if (V.mapGlint.active) {
    V.mapGlint.t += dt;
    if (V.mapGlint.t >= V.mapGlint.duration) V.mapGlint.active = false;
  }

  if (V.xpFlash.active) {
    V.xpFlash.t += dt;
    if (V.xpFlash.t >= V.xpFlash.duration) V.xpFlash.active = false;
  }

  if (V.levelUp.active) {
    V.levelUp.t += dt;
    if (V.levelUp.t >= V.levelUp.duration) V.levelUp.active = false;
  }

  if (V.screenShake.active) {
    V.screenShake.t += dt;
    if (V.screenShake.t >= V.screenShake.duration) V.screenShake.active = false;
  }

  const nextTexts = [];
  for (let i = 0; i < V.xpTexts.length; i++) {
    const txt = V.xpTexts[i];
    txt.age += dt;
    if (txt.age < txt.life) nextTexts.push(txt);
  }
  V.xpTexts = nextTexts;

  const nextGlins = [];
  for (let i = 0; i < V.questGlints.length; i++) {
    const g = V.questGlints[i];
    g.t += dt;
    if (g.t < g.duration) nextGlins.push(g);
  }
  V.questGlints = nextGlins;

  updateParticles(dt);
}

function frame(now) {
  requestAnimationFrame(frame);
  V.nowTime = now;
  let dt = (now - V.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  V.lastTime = now;
  V.dt = dt;
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

function outerCorners() {
  const g = V.grid;
  if (!g) return null;
  const minC = -2 - V.growthStep;
  const maxC = 1 + V.growthStep;
  return [
    iso(minC, minC),
    iso(maxC, minC),
    iso(maxC, maxC),
    iso(minC, maxC)
  ];
}

function godRayGeometry() {
  const c = V.canvas;
  const g = V.grid;
  const center = iso(0, 0);
  const moonX = Math.round(c.width * 0.72);
  const moonY = Math.round(c.height * 0.15);
  return {
    topX: moonX,
    topY: moonY + 24,
    bottomX: center.x,
    bottomY: center.y - 10,
    bottomHalf: 58
  };
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function drawSky(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#1a1a2e');
  g.addColorStop(1, '#0d0a1e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  const ng = ctx.createRadialGradient(c.width * 0.35, c.height * 0.24, 20, c.width * 0.35, c.height * 0.24, 170);
  ng.addColorStop(0, 'rgba(255,110,220,0.10)');
  ng.addColorStop(1, 'rgba(255,110,220,0.00)');
  ctx.fillStyle = ng;
  ctx.fillRect(0, 0, c.width, c.height);

  const drawStars = function (arr, bright) {
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      const x = (p.x + now * 0.001 * p.speed) % c.width;
      const y = p.y + Math.sin(now * 0.00035 + p.phase) * 1.2;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.0023 + p.phase));
      ctx.globalAlpha = tw;
      ctx.fillStyle = p.blue ? (bright ? '#dbeafe' : '#bfdbfe') : '#ffffff';
      ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };
  drawStars(V.starsSmall, false);
  drawStars(V.starsBright, true);

  const mx = Math.round(c.width * 0.72);
  const my = Math.round(c.height * 0.15);
  const mr = 34;
  for (let yy = -mr; yy <= mr; yy += 3) {
    for (let xx = -mr; xx <= mr; xx += 3) {
      if (xx * xx + yy * yy <= mr * mr) {
        ctx.fillStyle = '#e8e6df';
        ctx.fillRect(mx + xx - 1, my + yy - 1, 4, 4);
      }
    }
  }
  const craters = [[-8, -6, 7], [7, 3, 9], [-3, 9, 6]];
  for (let i = 0; i < craters.length; i++) {
    const cr = craters[i];
    const crx = mx + cr[0];
    const cry = my + cr[1];
    const crr = cr[2];
    for (let yy = -crr; yy <= crr; yy += 2) {
      for (let xx = -crr; xx <= crr; xx += 2) {
        if (xx * xx + yy * yy <= crr * crr) {
          ctx.fillStyle = '#b9b5a8';
          ctx.fillRect(crx + xx, cry + yy, 2, 2);
        }
      }
    }
  }
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx - 18, my - 18, 8, 6);
  ctx.globalAlpha = 1;
}

function drawIslandUnderside(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  const corners = outerCorners();
  if (!corners) return;
  const pts = corners;
  const sideOffset = [-10, 8, 12, -6];
  const sideDepth = [76, 86, 70, 80];
  const rockColors = ['#3a342f', '#2f2823', '#25201d'];

  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    const ax = a.x + sideOffset[i];
    const ay = a.y + sideDepth[i];
    const bx = b.x + sideOffset[(i + 1) % 4];
    const by = b.y + sideDepth[(i + 1) % 4];
    ctx.fillStyle = rockColors[i % rockColors.length];
    ctx.beginPath();
    ctx.moveTo(Math.round(a.x), Math.round(a.y));
    ctx.lineTo(Math.round(b.x), Math.round(b.y));
    ctx.lineTo(Math.round(bx), Math.round(by));
    ctx.lineTo(Math.round(ax), Math.round(ay));
    ctx.closePath();
    ctx.fill();
  }

  for (let band = 0; band < 3; band++) {
    const t0 = band / 3;
    const t1 = (band + 1) / 3;
    ctx.globalAlpha = 0.55 - band * 0.12;
    ctx.fillStyle = band === 0 ? '#5b524a' : (band === 1 ? '#4a423b' : '#3b342f');
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      const ax = a.x + sideOffset[i];
      const ay = a.y + sideDepth[i];
      const bx = b.x + sideOffset[(i + 1) % 4];
      const by = b.y + sideDepth[(i + 1) % 4];
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x + (ax - a.x) * t0), Math.round(a.y + (ay - a.y) * t0));
      ctx.lineTo(Math.round(b.x + (bx - b.x) * t0), Math.round(b.y + (by - b.y) * t0));
      ctx.lineTo(Math.round(b.x + (bx - b.x) * t1), Math.round(b.y + (by - b.y) * t1));
      ctx.lineTo(Math.round(a.x + (ax - a.x) * t1), Math.round(a.y + (ay - a.y) * t1));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < V.floatingRocks.length; i++) {
    const r = V.floatingRocks[i];
    const bob = Math.sin(now * 0.001 + r.phase) * 3;
    const x = r.x;
    const y = r.y + bob;
    ctx.fillStyle = r.shade === 2 ? '#3f3832' : (r.shade === 1 ? '#4b443d' : '#5a5147');
    ctx.fillRect(Math.round(x - r.size * 0.5), Math.round(y), r.size, Math.round(r.size * 0.6));
    ctx.fillStyle = '#6a6157';
    ctx.fillRect(Math.round(x - r.size * 0.5 + 2), Math.round(y + 1), Math.max(1, Math.round(r.size * 0.4)), 2);
  }

  for (let i = 0; i < 5; i++) {
    const edge = i % 4;
    const a = pts[edge];
    const b = pts[(edge + 1) % 4];
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const sway = Math.sin(now * 0.0015 + i * 1.7) * 4;
    ctx.fillStyle = '#2f4a2f';
    for (let s = 0; s < 24; s += 4) {
      ctx.fillRect(Math.round(mx + sway * (s / 24) - 1), Math.round(my + s), 2, 4);
    }
  }
}

function drawFloor(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  const g = V.grid;
  const minC = -2 - V.growthStep;
  const maxC = 1 + V.growthStep;

  let growthProgress = 0;
  let growthStep = -1;
  if (V.growthAnim && V.growthAnim.active) {
    growthProgress = clamp((now - V.growthAnim.startTime) / V.growthAnim.duration, 0, 1);
    growthStep = V.growthAnim.step;
  }
  const growthEase = easeOutCubic(growthProgress);

  for (let gy = minC; gy <= maxC; gy++) {
    for (let gx = minC; gx <= maxC; gx++) {
      const ring = tileRing(gx, gy);
      if (ring > V.growthStep) continue;
      const p0 = iso(gx, gy);
      const p1 = iso(gx + 1, gy);
      const p2 = iso(gx + 1, gy + 1);
      const p3 = iso(gx, gy + 1);

      let shift = 0;
      let alphaMul = 1;
      if (V.growthAnim && V.growthAnim.active && ring === growthStep) {
        shift = Math.round(40 * (1 - growthEase));
        alphaMul = 0.3 + 0.7 * growthEase;
      }

      const lighten = ring * 16;
      const red = Math.min(235, 86 + lighten + ((Math.abs(gx * 17 + gy * 31)) % 18));
      const green = Math.min(220, 52 + Math.round(lighten * 0.7) + ((Math.abs(gx * 13 + gy * 19)) % 12));
      const blue = Math.min(190, 24 + Math.round(lighten * 0.5) + ((Math.abs(gx * 23 + gy * 7)) % 10));

      ctx.save();
      ctx.translate(0, shift);
      ctx.globalAlpha = alphaMul;
      ctx.fillStyle = 'rgb(' + red + ',' + green + ',' + blue + ')';
      ctx.beginPath();
      ctx.moveTo(Math.round(p0.x), Math.round(p0.y));
      ctx.lineTo(Math.round(p1.x), Math.round(p1.y));
      ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
      ctx.lineTo(Math.round(p3.x), Math.round(p3.y));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (V.mapGlint.active && ring === V.mapGlint.step) {
        const a = Math.max(0, 1 - (V.mapGlint.t / V.mapGlint.duration));
        if (a > 0) {
          ctx.globalAlpha = a * 0.62;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(Math.round(p0.x), Math.round(p0.y));
          ctx.lineTo(Math.round(p1.x), Math.round(p1.y));
          ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
          ctx.lineTo(Math.round(p3.x), Math.round(p3.y));
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
  }

  const pts = outerCorners();
  if (pts) {
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      ctx.beginPath();
      ctx.moveTo(Math.round(a.x), Math.round(a.y));
      ctx.lineTo(Math.round(b.x), Math.round(b.y));
      ctx.stroke();
    }
    ctx.fillStyle = '#34d399';
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(dist / 42));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        ctx.fillRect(Math.round(x - 1), Math.round(y - 4), 2, 3);
        ctx.fillRect(Math.round(x + 2), Math.round(y - 6), 2, 4);
        ctx.fillRect(Math.round(x - 3), Math.round(y - 6), 1, 2);
      }
    }
  }
}

function drawShadows() {
  const ctx = V.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const desks = V.desks;
  for (let i = 0; i < desks.length; i++) {
    const d = desks[i];
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(d.x + d.w * 0.5, d.y + d.h + 4, d.w * 0.46, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(d.x + d.w * 0.1, d.y + d.h + 1, Math.round(d.w * 0.8), 6);
    }
  }
  for (let wi = 0; wi < V.workerStates.length; wi++) {
    const w = V.workerStates[wi];
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(w.x + 8, w.y + 18, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(Math.round(w.x) - 1, Math.round(w.y) + 16, 18, 5);
    }
  }
  ctx.restore();
}

function drawProps(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  const minC = -2 - V.growthStep;
  const maxC = 1 + V.growthStep;
  const wallH = 54;
  const backLeft = iso(minC, minC);
  const backRight = iso(maxC, minC);
  const wallX = Math.round(backLeft.x - 6);
  const wallW = Math.round((backRight.x - backLeft.x) + 12);
  const wallY = Math.round(backLeft.y - wallH);

  ctx.fillStyle = '#3a4252';
  ctx.fillRect(wallX, wallY, wallW, wallH);
  ctx.fillStyle = '#4b5566';
  for (let gx = minC; gx <= maxC; gx++) {
    const p = iso(gx + 0.5, minC);
    ctx.fillRect(Math.round(p.x - 2), wallY + 8, 4, wallH - 16);
  }
  ctx.strokeStyle = '#202733';
  ctx.lineWidth = 2;
  ctx.strokeRect(wallX, wallY, wallW, wallH);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = wallY + 10; y < wallY + wallH; y += 9) {
    ctx.fillRect(wallX + 4, y, wallW - 8, 1);
  }

  V.torchPts = [
    { x: Math.round(wallX + wallW * 0.25), y: Math.round(wallY + wallH * 0.48) },
    { x: Math.round(wallX + wallW * 0.75), y: Math.round(wallY + wallH * 0.48) }
  ];
  drawTorch(V.torchPts[0].x, V.torchPts[0].y, 0, now);
  drawTorch(V.torchPts[1].x, V.torchPts[1].y, 1, now);

  const deskTasks = [];
  for (let i = 0; i < V.desks.length; i++) deskTasks.push([]);
  for (let i = 0; i < V.allTasks.length; i++) {
    const t = V.allTasks[i];
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

  if (V.mapLevel >= 1) {
    const core = iso(0, 0);
    const px = Math.round(core.x);
    const py = Math.round(core.y);
    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(px - 2, py - 62, 4, 62);
    for (let col = 0; col < 5; col++) {
      const cx = px - 10 + col * 4 + Math.round(Math.sin(now * 0.003 + col * 0.7) * 1.5);
      const top = py - 58 + Math.round(Math.sin(now * 0.003 + col * 0.5) * 2);
      ctx.fillStyle = col === 2 ? '#facc15' : '#8b1a1a';
      ctx.fillRect(cx, top, 4, 30);
    }
    ctx.fillStyle = '#facc15';
    ctx.fillRect(px - 3, py - 44, 6, 3);
    ctx.fillRect(px - 1, py - 48, 2, 6);
  }

  if (V.mapLevel >= 3) {
    const bp = iso(0, -2 - V.growthStep);
    const x = Math.round(bp.x - 24);
    const y = Math.round(bp.y - 46);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x, y, 48, 52);
    ctx.fillStyle = '#4b321f';
    ctx.fillRect(x + 4, y + 4, 40, 44);
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = '#8b643f';
      ctx.fillRect(x + 4, y + 6 + s * 14, 40, 3);
    }
    const bookColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a78bfa'];
    for (let s = 0; s < 3; s++) {
      for (let b = 0; b < 8; b++) {
        ctx.fillStyle = bookColors[(s * 3 + b) % bookColors.length];
        ctx.fillRect(x + 6 + b * 5, y + 2 + s * 14, 4, 11);
      }
    }
  }

  if (V.mapLevel >= 5) {
    const fp = iso(-1, -1);
    const x = Math.round(fp.x - 18);
    const y = Math.round(fp.y - 6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x, y + 14, 44, 20);
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 8, y + 4, 28, 14);
    ctx.fillRect(x + 14, y - 4, 14, 8);
    const pulse = 0.6 + 0.4 * Math.sin(now * 0.008);
    ctx.fillStyle = 'rgba(255,120,40,' + pulse + ')';
    ctx.fillRect(x + 12, y + 18, 20, 8);
    for (let k = 0; k < 3; k++) {
      const sy = y - (((now * 0.04 + k * 11) % 28));
      ctx.fillStyle = 'rgba(180,180,180,0.55)';
      ctx.fillRect(x + 15 + k * 6, Math.round(sy), 2, 3);
    }
  }

  if (V.mapLevel >= 7) {
    const tp = iso(1, 1);
    const x = Math.round(tp.x - 4);
    const y = Math.round(tp.y - 6);
    ctx.fillStyle = '#facc15';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(x + (i % 3) * 5 - 4, y + Math.floor(i / 3) * 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe68a';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x - 2 + i * 6, y - 12 + (i % 2) * 2, 2, 2);
    }
    const gl = 0.5 + 0.5 * Math.sin(now * 0.006);
    ctx.globalAlpha = 0.35 * gl;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 12, y - 12, 26, 6);
    ctx.globalAlpha = 1;

    const rx = x - 12;
    const ry = y + 6;
    ctx.fillStyle = '#9f7aea';
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(rx + 6, ry + 10, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(rx - 12, ry + 3, 36, 14);
    }
    ctx.fillStyle = '#cbd5e1';
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(rx + 6, ry + 4, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rx + 16, ry - 1, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(rx - 6, ry - 3, 24, 14);
      ctx.fillRect(rx + 9, ry - 7, 14, 12);
    }
    const twitch = anyFailed() ? Math.round(Math.sin(now * 0.03) * 2) : 0;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(rx + 11, ry - 8 + twitch, 3, 3);
    ctx.fillRect(rx + 19, ry - 8, 3, 3);
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(rx + 12, ry - 7 + twitch, 2, 2);
    ctx.fillRect(rx + 20, ry - 7, 2, 2);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + 15, ry - 1);
    ctx.lineTo(rx + 20, ry - 1);
    ctx.stroke();
    const tailFlick = Math.round(Math.sin(now * 0.004) * 4);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(rx - 5 + tailFlick, ry + 2, 8, 3);
  }
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

function drawWorker(w, meta, now) {
  const ctx = V.ctx;
  const index = (w.index != null ? w.index : 0);
  const isStep = index === 1 || String(meta.name || '').toLowerCase().indexOf('step') !== -1;
  const robeColor = isStep ? '#7c3aed' : '#9a6334';
  const legColor = isStep ? '#4c1d95' : '#26323f';
  const nameColor = isStep ? '#c4b5fd' : '#facc15';
  const nameBorder = isStep ? '#a78bfa' : '#facc15';

  const bob = w.moving ? (w.walkFrame % 2 === 0 ? 0 : 1) : Math.round(Math.sin(w.bob) * 1.1);
  const x = Math.round(w.x);
  const y = Math.round(w.y) + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 4, Math.round(w.y) + 17, 20, 4);

  const frame = w.moving ? (w.walkFrame % 4) : 0;
  const vertical = (w.facing === 'up' || w.facing === 'down');
  let leftY = y + 10, rightY = y + 10, leftH = 8, rightH = 8;
  if (frame === 1) { leftY = y + 9; rightY = y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = y + 11; rightY = y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = y + 12; rightY = y + 9; leftH = 5; rightH = 8; }
  if (vertical) {
    leftY = y + 10;
    rightY = y + 10;
    leftH = 7;
    rightH = 7;
  }
  if (w.facing === 'left') {
    ctx.fillStyle = legColor;
    ctx.fillRect(x + 10, leftY, 4, leftH);
    ctx.fillRect(x + 2, rightY, 4, rightH);
  } else if (w.facing === 'right') {
    ctx.fillStyle = legColor;
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  } else if (w.facing === 'up') {
    ctx.fillStyle = legColor;
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 11, rightY, 3, rightH);
  } else {
    ctx.fillStyle = legColor;
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  }

  ctx.fillStyle = robeColor;
  ctx.fillRect(x + 1, y - 2, 14, 12);
  ctx.fillStyle = isStep ? '#ddd6fe' : '#f1c9a5';
  ctx.fillRect(x + 3, y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, y - 8, 2, 2);
  ctx.fillRect(x + 9, y - 8, 2, 2);
  ctx.fillStyle = isStep ? '#8b5cf6' : '#7c4a24';
  ctx.fillRect(x + 4, y - 12, 8, 2);

  if (w.mode === 'in_progress' && w.atDesk) {
    const swing = Math.round(Math.sin(w.typingPhase) * 2);
    ctx.fillStyle = isStep ? '#ddd6fe' : '#f1c9a5';
    ctx.fillRect(x + 13, y + 4 + swing, 4, 2);
    ctx.fillRect(x - 3, y + 5 - swing, 4, 2);
  } else if (w.mode === 'pending') {
    ctx.fillStyle = isStep ? '#ddd6fe' : '#f1c9a5';
    ctx.fillRect(x + 13, y + 4, 4, 2);
  } else if (w.mode === 'failed') {
    ctx.fillStyle = isStep ? '#ddd6fe' : '#f1c9a5';
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

  const name = (meta.name != null ? meta.name : (index === 0 ? 'MISSINGNO' : 'STEP5'));
  const tagW = 76;
  const tagH = 12;
  const cx = x + 7;
  const tagX = cx - Math.round(tagW * 0.5);
  const tagY = y - 35;
  ctx.fillStyle = 'rgba(10, 10, 12, 0.88)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = nameBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = nameColor;
  ctx.font = 'bold 9px monospace';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(name);
  ctx.fillText(name, tagX + (tagW - metrics.width) * 0.5, tagY + tagH * 0.5 + 1);

  const barX = tagX + 3;
  const barY = tagY + tagH + 3;
  const barW = tagW - 6;
  const barH = 3;
  const tasks = Array.isArray(meta.tasks) ? meta.tasks : [];
  const total = Math.max(1, tasks.length);
  const done = tasks.filter(function (t) { return t.status === 'done'; }).length;
  const ratio = tasks.length ? done / total : 0;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = nameColor;
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
}

function render(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  ctx.clearRect(0, 0, c.width, c.height);

  let shakeX = 0;
  let shakeY = 0;
  if (V.screenShake.active) {
    const p = V.screenShake.t / V.screenShake.duration;
    const decay = Math.max(0, 1 - p);
    shakeX = Math.sin(V.screenShake.t * 60) * 3 * decay;
    shakeY = Math.cos(V.screenShake.t * 73) * 2.1 * decay;
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawSky(now);
  drawIslandUnderside(now);
  drawFloor(now);
  drawShadows();
  drawProps(now);
  drawWorkers(now);
  drawParticles(now);
  drawFloatingXp(now);
  drawLevelBanner(now);
  drawLighting(now);
  drawUI(c, now);

  ctx.restore();
}

function drawWorkers(now) {
  const ctx = V.ctx;
  for (let wi = 0; wi < V.workerStates.length; wi++) {
    const w = V.workerStates[wi];
    const meta = V.workers[wi] || {};
    if (w.flash.active) {
      const a = Math.max(0, 1 - (w.flash.t / w.flash.duration));
      if (a > 0) {
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = workerColor(wi, meta.name);
        ctx.fillRect(Math.round(w.x) - 12, Math.round(w.y) - 18, 36, 36);
        ctx.globalAlpha = 1;
      }
    }
    drawWorker(w, meta, now);
  }
}

function drawParticles(now) {
  const ctx = V.ctx;
  for (let i = 0; i < V.particles.length; i++) {
    const p = V.particles[i];
    const lifeRatio = Math.max(0, 1 - (p.age / p.life));
    ctx.globalAlpha = lifeRatio;
    if (p.kind === 'ember') {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    } else if (p.kind === 'mote') {
      ctx.globalAlpha = lifeRatio * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    } else if (p.kind === 'firefly') {
      const blink = 0.5 + 0.5 * Math.sin(now * 0.009 + p.phase + p.age * 3);
      ctx.globalAlpha = lifeRatio * (0.55 + 0.45 * blink);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    } else if (p.kind === 'leaf') {
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    } else if (p.kind === 'puff') {
      const grow = 1 + p.age * 2.2;
      ctx.globalAlpha = lifeRatio * 0.7;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - (p.size * grow) * 0.5), Math.round(p.y - (p.size * grow) * 0.5), Math.round(p.size * grow), Math.round(p.size * grow));
    } else if (p.kind === 'catz') {
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 9px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText('z', Math.round(p.x), Math.round(p.y));
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloatingXp(now) {
  const ctx = V.ctx;
