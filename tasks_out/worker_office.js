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
const BUILDINGS = [
  { project: 'P1', gx: -2, gy: 0, h: 28, wall: '#6b4a2d', roof: '#8b5a2b', sign: 'parchment' },
  { project: 'P2', gx: 0, gy: -2, h: 36, wall: '#40404f', roof: '#5a5a6b', sign: 'flask' },
  { project: 'P3', gx: 1, gy: 0, h: 30, wall: '#52525b', roof: '#71717a', sign: 'anvil' },
  { project: 'P4', gx: 0, gy: 1, h: 29, wall: '#7a5a44', roof: '#9a7a5e', sign: 'brush' }
];
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
  shake: { active: false, t: 0, duration: 0.3, amp: 3 },
  dayPhase: 0,
  dayHour: 0,
  daylight: 0,
  nightFactor: 1,
  starAlpha: 1,
  torchIntensity: 1,
  weather: 'CLEAR',
  weatherDate: '',
  weatherFactor: 0,
  wind: 0,
  rainDrops: [],
  snowFlakes: []
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
function hexRgb(hex) {
  const h = String(hex || '').replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}
function lerpColor(a, b, t) {
  t = clamp(t == null ? 0 : t, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t)
  };
}
function rgbStr(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }
function updateGrid() {
  const s = V.growthStep;
  const scale = Math.min(1, 384 / ((2 + 2 * s) * 35));
  const c = V.canvas;
  V.grid = { originX: Math.round(c.width * 0.5), originY: Math.round(c.height * 0.42),
             tileW: 70 * scale, tileH: 35 * scale };
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function computeDiurnal() {
  const d = new Date();
  const hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  V.dayHour = hour;
  V.dayPhase = hour / 24;
  let dl = 0;
  if (hour < 5) dl = 0;
  else if (hour < 7) dl = (hour - 5) / 2;
  else if (hour < 17) dl = 1;
  else if (hour < 19) dl = 1 - (hour - 17) / 2;
  else dl = 0;
  V.daylight = clamp(dl, 0, 1);
  V.nightFactor = 1 - V.daylight;
  V.starAlpha = (hour >= 19 || hour < 5) ? 1 : (hour < 10 ? clamp((10 - hour) / 5, 0, 1) : 0);
  V.torchIntensity = 0.08 + 1.92 * V.nightFactor;
}
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}
function dateKeyLocal(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
function updateWeather() {
  const d = new Date();
  const key = dateKeyLocal(d);
  if (V.weatherDate === key) return;
  V.weatherDate = key;
  const r = seeded(hashString(key) * 0.000001 + 7.25);
  if (r < 0.70) {
    V.weather = 'CLEAR';
    V.weatherFactor = 0.0;
  } else if (r < 0.90) {
    V.weather = 'RAIN';
    V.weatherFactor = 0.72;
  } else {
    V.weather = 'SNOW';
    V.weatherFactor = 0.28;
  }
}
function updateEnvironment() {
  computeDiurnal();
  updateWeather();
  V.wind = Math.sin(V.dayPhase) + V.weatherFactor;
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
  V.primeBaseline = true;
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
  V.shake = { active: false, t: 0, duration: 0.3, amp: 3 };
  V.dayPhase = 0;
  V.dayHour = 0;
  V.daylight = 0;
  V.nightFactor = 1;
  V.starAlpha = 1;
  V.torchIntensity = 1;
  V.weather = 'CLEAR';
  V.weatherDate = '';
  V.weatherFactor = 0;
  V.wind = 0;
  V.rainDrops = [];
  V.snowFlakes = [];
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
  for (let i = 0; i < 60; i++) {
    V.rainDrops.push({
      xSeed: seeded(900 + i * 3.1),
      ySeed: seeded(901 + i * 5.7),
      speed: 360 + seeded(902 + i * 7.9) * 260,
      drift: 0.2 + seeded(903 + i * 11.3) * 0.6
    });
  }
  for (let i = 0; i < 40; i++) {
    V.snowFlakes.push({
      xSeed: seeded(1500 + i * 4.7),
      ySeed: seeded(1501 + i * 6.1),
      speed: 18 + seeded(1502 + i * 8.3) * 26,
      phase: seeded(1503 + i * 9.7) * Math.PI * 2
    });
  }
  updateEnvironment();
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
function parseProject(title, workerIndex) {
  const text = String(title == null ? '' : title);
  const m = text.match(/^\s*(P[1-4])\s*:/i);
  if (m) return m[1].toUpperCase();
  return 'W' + (workerIndex == null ? 0 : workerIndex);
}
function projectBuildingIndex(project) {
  for (let i = 0; i < BUILDINGS.length; i++) if (BUILDINGS[i].project === project) return i;
  return null;
}
function workerStateLabel(meta) {
  const tasks = (meta && Array.isArray(meta.tasks)) ? meta.tasks : [];
  const allDone = tasks.length === 0 || tasks.every(function (t) { return t.status === 'done'; });
  return allDone ? 'IDLE' : 'WORKING';
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
      name: '',
      workerState: 'IDLE',
      project: null,
      zTimer: 2 + rand() * 4
    };
    V.workerStates.push(st);
  }
  if (V.workerStates.length > count) V.workerStates = V.workerStates.slice(0, count);
}
function normalizeBoard(data) {
  let prevTotalDone = V.totalDone;
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
      const taskTitle = (raw.title != null ? raw.title : (raw.name != null ? raw.name : ('Task ' + (j + 1))));
      const task = {
        id: (raw.id != null ? raw.id : (raw.key != null ? raw.key : (raw.name != null ? raw.name : ('task_' + j)))),
        title: taskTitle,
        status: mapStatus(raw.status != null ? raw.status : (raw.state != null ? raw.state : raw.phase)),
        desk: desk,
        project: parseProject(taskTitle, i)
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
    let newDone = 0;
    for (let t = 0; t < nw.tasks.length; t++) if (nw.tasks[t].status === 'done' && !prevDone.has(nw.tasks[t].id)) newDone++;
    const st = V.workerStates[i];
    st.index = i;
    st.name = nw.name;
    st.workerState = workerStateLabel(nw);
    const focus0 = chooseFocus(nw.tasks);
    st.project = focus0 ? focus0.project : null;
    if (newDone > 0) {
      st.flash.active = true;
      st.flash.t = 0;
      st.flash.duration = 0.9;
      st.flash.count = newDone;
      st.flashHandled = false;
      V.xpFlash.active = true;
      V.xpFlash.t = 0;
      for (let kd = 0; kd < newDone; kd++) {
        V.xpTexts.push({ x: st.x + 6 + kd * 8, y: st.y - 22, vy: -18, t: 0, duration: 1.1 });
      }
      for (let kd = 0; kd < 5; kd++) {
        V.particles.push({ id: V.particleId++, kind: 'ember', src: -1, x: st.x + 8 + (rand() - 0.5) * 8, y: st.y - 8, vx: (rand() - 0.5) * 24, vy: -24 - rand() * 16, phase: rand() * Math.PI * 2, life: 0.5 + rand() * 0.4, age: 0, size: 2, color: rand() < 0.5 ? '#ff5a1f' : '#ffc27a' });
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
  if (V.primeBaseline) { V.primeBaseline = false; prevTotalDone = totalDone; }
  if (totalDone > prevTotalDone) {
    V.levelUp = { active: true, t: 0, duration: 2 };
    V.shake = { active: true, t: 0, duration: 0.3, amp: 3 };
    const cx = V.canvas.width * 0.5;
    const cy = V.canvas.height * 0.45;
    for (let fi = 0; fi < 20; fi++) {
      const ang = (fi / 20) * Math.PI * 2 + rand() * 0.2;
      const speed = 50 + rand() * 90;
      V.particles.push({ id: V.particleId++, kind: 'firework', src: -2, x: cx, y: cy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, phase: rand() * Math.PI * 2, life: 0.8 + rand() * 0.5, age: 0, size: 2, color: rand() < 0.5 ? '#facc15' : '#ff8c1a' });
    }
  }
  V.totalDone = totalDone;
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
function idleAdvance(w) {
  if (!w) return;
  w.idleTarget = (w.index == null ? 0 : w.index);
}
function easeOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - t, 3);
}
function updateParticles(dt) {
  const now = V.nowTime || Date.now();
  const c = V.canvas;
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
  if (V.mapLevel >= 7) {
    let zCount = 0;
    const cp = guildCatPos();
    for (let i = 0; i < V.particles.length; i++) if (V.particles[i].kind === 'z') zCount++;
    while (zCount < 2) {
      V.particles.push({
        id: V.particleId++,
        kind: 'z',
        x: cp.x - 6 + (rand() - 0.5) * 6,
        y: cp.y - 10,
        vx: (rand() - 0.5) * 4,
        vy: -12 - rand() * 5,
        phase: rand() * Math.PI * 2,
        life: 1.6 + rand() * 0.8,
        age: 0,
        size: 2,
        color: '#e8e6df'
      });
      zCount++;
    }
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
    } else if (p.kind === 'firework') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy += 24 * dt;
    } else if (p.kind === 'z') {
      p.x += (p.vx + Math.sin(p.age * 2 + p.phase) * 2) * dt;
      p.y += p.vy * dt;
    }
    next.push(p);
  }
  V.particles = next;
}
function update(dt) {
  updateEnvironment();
  V.dt = dt;
  for (let wi = 0; wi < V.workerStates.length; wi++) {
    const w = V.workerStates[wi];
    const workerMeta = V.workers[wi] || {};
    const tasks = Array.isArray(workerMeta.tasks) ? workerMeta.tasks : (Array.isArray(w.tasks) ? w.tasks : []);
    w.tasks = tasks;
    const allDone = tasks.length === 0 || tasks.every(function (t) { return t.status === 'done'; });
    const workingState = !allDone;
    w.workerState = workingState ? 'WORKING' : 'IDLE';
    const focus = chooseFocus(tasks);
    if (allDone) {
      w.mode = 'idle';
    } else if (focus) {
      if (w.mode === 'idle' || w.mode !== 'done') w.mode = focus.status;
    } else {
      w.mode = 'idle';
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
      } else {
        w.mode = 'idle';
      }
    }
    let target = null;
    if (!workingState) {
      w.mode = 'idle';
      target = campfireSitPos(w.index);
    } else {
      const project = (focus && focus.project) ? focus.project : w.project;
      const bi = projectBuildingIndex(project);
      if (bi != null) target = buildingWorkSpot(bi);
      else if (w.targetDesk != null && V.desks[w.targetDesk]) {
        const d = V.desks[w.targetDesk];
        target = { x: d.x + d.w * 0.5 - 6, y: d.y + d.h + 3 };
      } else if (focus != null && focus.desk != null && V.desks[focus.desk]) {
        const d = V.desks[focus.desk];
        w.targetDesk = focus.desk;
        target = { x: d.x + d.w * 0.5 - 6, y: d.y + d.h + 3 };
      } else {
        target = { x: w.x, y: w.y };
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
        if (!workingState) {
          if (!w.idleArrivedAt) w.idleArrivedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
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
    if (workingState && (w.mode === 'in_progress' || w.mode === 'pending') && w.atDesk) {
      w.typingPhase += dt * 7;
    } else {
      w.typingPhase += dt * 0.6;
    }
    if (!workingState) {
      w.zTimer -= dt;
      if (w.zTimer <= 0) {
        V.particles.push({ id: V.particleId++, kind: 'z', x: Math.round(w.x) + 4, y: Math.round(w.y) - 12, vx: (rand() - 0.5) * 4, vy: -12 - rand() * 5, phase: rand() * Math.PI * 2, life: 1.6 + rand() * 0.8, age: 0, size: 2, color: '#e8e6df' });
        w.zTimer = 3 + rand() * 4;
      }
    } else {
      w.zTimer = 2 + rand() * 3;
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
  const nextXp = [];
  for (let i = 0; i < V.xpTexts.length; i++) {
    const xp = V.xpTexts[i];
    xp.t += dt;
    xp.y += xp.vy * dt;
    if (xp.t < xp.duration) nextXp.push(xp);
  }
  V.xpTexts = nextXp;
  if (V.levelUp.active) {
    V.levelUp.t += dt;
    if (V.levelUp.t >= V.levelUp.duration) V.levelUp.active = false;
  }
  if (V.shake.active) {
    V.shake.t += dt;
    if (V.shake.t >= V.shake.duration) V.shake.active = false;
  }
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
function guildCatPos() {
  const base = iso(1, 1);
  return { x: Math.round(base.x + 8), y: Math.round(base.y - 6) };
}
function buildingWorkSpot(index) {
  const b = BUILDINGS[index];
  const p = iso(b.gx, b.gy);
  return { x: Math.round(p.x + 2), y: Math.round(p.y + 12) };
}
function campfireBase() {
  const base = iso(0, -1);
  return { x: Math.round(base.x + 12), y: Math.round(base.y + 22) };
}
function campfireSitPos(index) {
  const base = campfireBase();
  const offsets = [{ x: -12, y: 4 }, { x: 12, y: 6 }, { x: 0, y: 8 }];
  const off = offsets[(index == null ? 0 : index) % offsets.length];
  return { x: base.x + off.x, y: base.y + off.y };
}
function drawSky(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  const dl = V.daylight;
  const nightTop = hexRgb('#1a1a2e');
  const nightBottom = hexRgb('#0d0a1e');
  const dayTop = hexRgb('#8fc9f0');
  const dayBottom = hexRgb('#ffe8bc');
  const topC = lerpColor(nightTop, dayTop, dl);
  const bottomC = lerpColor(nightBottom, dayBottom, dl);
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, rgbStr(topC));
  g.addColorStop(1, rgbStr(bottomC));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const ngAlpha = 0.10 * V.nightFactor;
  if (ngAlpha > 0.005) {
    const ng = ctx.createRadialGradient(c.width * 0.35, c.height * 0.24, 20, c.width * 0.35, c.height * 0.24, 170);
    ng.addColorStop(0, 'rgba(255,110,220,' + (0.10 * V.nightFactor) + ')');
    ng.addColorStop(1, 'rgba(255,110,220,0.00)');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  if (V.weather === 'RAIN') {
    ctx.fillStyle = 'rgba(0,0,20,0.18)';
    ctx.fillRect(0, 0, c.width, c.height);
  } else if (V.weather === 'SNOW') {
    ctx.fillStyle = 'rgba(200,225,255,' + (0.05 + 0.06 * V.nightFactor) + ')';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  const drawStars = function (arr, bright) {
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      const x = (p.x + now * 0.001 * p.speed) % c.width;
      const y = p.y + Math.sin(now * 0.00035 + p.phase) * 1.2;
      const tw = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.0023 + p.phase))) * (V.starAlpha || 0);
      if (tw <= 0.01) continue;
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
  if (V.daylight > 0.12) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(mx - 7, my - 7, 14, 14);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(mx - 4, my - 4, 8, 8);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 9, my - 1, 3, 2);
    ctx.fillRect(mx + 6, my - 1, 3, 2);
    ctx.fillRect(mx - 1, my - 9, 2, 3);
    ctx.fillRect(mx - 1, my + 6, 2, 3);
  } else {
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
  drawClockDial(c);
  ctx.globalAlpha = 1;
}
function drawClockDial(c) {
  const ctx = V.ctx;
  const cx = c.width - 46;
  const cy = 26;
  const r = 22;
  ctx.strokeStyle = 'rgba(230,225,210,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const dx = (t * 2 - 1) * r;
    const rad = Math.sqrt(Math.max(0, r * r - dx * dx));
    const x = Math.round(cx + dx);
    const y = Math.round(cy - rad);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,225,210,0.65)';
  for (let h = 0; h <= 24; h += 6) {
    const t = h / 24;
    const dx = (t * 2 - 1) * r;
    const rad = Math.sqrt(Math.max(0, r * r - dx * dx));
    ctx.fillRect(Math.round(cx + dx) - 1, Math.round(cy - rad) - 1, 2, 2);
  }
  const frac = clamp(V.dayHour / 24, 0, 1);
  const dx = (frac * 2 - 1) * r;
  const rad = Math.sqrt(Math.max(0, r * r - dx * dx));
  const px = Math.round(cx + dx);
  const py = Math.round(cy - rad);
  if (V.daylight > 0.12) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(px - 1, py - 1, 2, 2);
  } else {
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(px - 2, py - 2, 4, 4);
    ctx.fillStyle = '#b9b5a8';
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.fillStyle = 'rgba(230,225,210,0.75)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('24H', cx, cy + 8);
  ctx.textAlign = 'left';
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
    const sway = Math.sin(now * 0.0015 + i * 1.7) * 4 + V.wind * 6;
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
  if (V.weather === 'SNOW') {
    const inner = outerCorners();
    if (inner) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) {
        const a = inner[i];
        const b = inner[(i + 1) % 4];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(6, Math.round(dist / 6));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      }
    }
  }
}
function drawBuildings(now) {
  const ctx = V.ctx;
  if (!V.grid) return;
  const lit = [false, false, false, false];
  for (let i = 0; i < V.allTasks.length; i++) {
    const t = V.allTasks[i];
    if (!t) continue;
    const bi = projectBuildingIndex(t.project);
    if (bi == null) continue;
    if (t.status === 'pending' || t.status === 'in_progress') lit[bi] = true;
  }
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i];
    const pt = iso(b.gx, b.gy);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.007 + i));
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x - 14, y - 2, 28, 4);
    ctx.fillStyle = b.wall;
    ctx.fillRect(x - 13, y - b.h, 26, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(x - 13, y - b.h, 7, b.h);
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(x, y - b.h - 7);
    ctx.lineTo(x + 15, y - b.h + 3);
    ctx.lineTo(x, y - b.h + 13);
    ctx.lineTo(x - 15, y - b.h + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b1d0e';
    ctx.fillRect(x - 3, y - 8, 6, 8);
    const winX = x - 5;
    const winY = y - b.h + 8;
    if (lit[i]) {
      ctx.globalAlpha = 0.42 * pulse;
      ctx.fillStyle = '#ffc27a';
      ctx.fillRect(winX - 4, winY - 4, 18, 16);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = lit[i] ? '#ffe7b8' : '#262633';
    ctx.fillRect(winX, winY, 10, 8);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.strokeRect(winX, winY, 10, 8);
    if (i === 0) {
      const sway = Math.round(Math.sin(now * 0.004) * 3 + V.wind * 2);
      ctx.fillStyle = '#5a3f25';
      ctx.fillRect(x + 10 + sway, y - b.h - 16, 2, 14);
      ctx.fillStyle = '#f4e8c1';
      ctx.fillRect(x + 4 + sway, y - b.h - 24, 18, 12);
      ctx.fillStyle = '#6b4a2d';
      ctx.fillRect(x + 6 + sway, y - b.h - 20, 14, 1);
      ctx.fillRect(x + 6 + sway, y - b.h - 16, 14, 1);
    } else if (i === 1) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 8, y - b.h - 18, 2, 14);
      ctx.fillStyle = '#2d6a4f';
      ctx.fillRect(x + 3, y - b.h - 26, 14, 14);
      ctx.fillStyle = '#d1fae5';
      ctx.fillRect(x + 6, y - b.h - 22, 8, 8);
      ctx.fillStyle = '#065f46';
      ctx.fillRect(x + 8, y - b.h - 26, 4, 4);
    } else if (i === 2) {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(x + 8, y - b.h - 16, 2, 14);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(x + 3, y - b.h - 24, 16, 10);
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(x + 6, y - b.h - 21, 10, 4);
      ctx.fillRect(x + 5, y - b.h - 17, 3, 3);
      ctx.fillRect(x + 12, y - b.h - 17, 3, 3);
    } else {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(x + 8, y - b.h - 16, 2, 14);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(x + 3, y - b.h - 24, 18, 12);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + 6, y - b.h - 21, 10, 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x + 6, y - b.h - 17, 8, 2);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x + 6, y - b.h - 13, 6, 2);
    }
    ctx.globalAlpha = 1;
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
    const base = iso(0, -1);
    const px = Math.round(base.x);
    const py = Math.round(base.y);
    const sway = Math.round(Math.sin(now * 0.004) * 3 + V.wind * 4);
    ctx.fillStyle = '#4b3320';
    ctx.fillRect(px - 2, py - 50, 4, 52);
    ctx.fillStyle = '#5a1118';
    ctx.fillRect(px + 2 + sway, py - 48, 30, 22);
    ctx.fillStyle = '#7a1620';
    ctx.fillRect(px + 2 + sway, py - 48, 30, 4);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(px + 14 + sway, py - 40, 4, 4);
    ctx.fillRect(px + 9 + sway, py - 36, 2, 2);
    ctx.fillRect(px + 21 + sway, py - 36, 2, 2);
    ctx.fillRect(px + 12 + sway, py - 30, 12, 2);
    const cp = campfireBase();
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cp.x - 12, cp.y - 3, 6, 4);
    ctx.fillRect(cp.x - 4, cp.y - 1, 7, 4);
    ctx.fillRect(cp.x + 4, cp.y - 4, 6, 4);
    ctx.fillRect(cp.x - 8, cp.y + 2, 5, 3);
    ctx.fillRect(cp.x + 1, cp.y + 1, 6, 3);
    const frame = Math.floor(now / 170) % 3;
    const flameH = frame === 0 ? 10 : (frame === 1 ? 13 : 8);
    const flameW = frame === 0 ? 8 : (frame === 1 ? 10 : 6);
    ctx.fillStyle = '#ff6b1a';
    ctx.fillRect(cp.x - Math.round(flameW * 0.5), cp.y - flameH, flameW, flameH);
    ctx.fillStyle = '#ffc27a';
    ctx.fillRect(cp.x - Math.round(flameW * 0.25), cp.y - flameH + 2, Math.max(2, Math.round(flameW * 0.5)), Math.max(2, flameH - 3));
  }
  if (V.mapLevel >= 3) {
    const base = iso(1, -1);
    const x = Math.round(base.x);
    const y = Math.round(base.y);
    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(x - 20, y - 46, 40, 46);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x - 16, y - 42, 32, 38);
    const bookColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
    for (let row = 0; row < 3; row++) {
      const ry = y - 40 + row * 13;
      for (let b = 0; b < 5; b++) {
        ctx.fillStyle = bookColors[(row + b) % bookColors.length];
        ctx.fillRect(x - 14 + b * 6, ry, 4, 9);
      }
      ctx.fillStyle = '#3a2a15';
      ctx.fillRect(x - 18, ry - 2, 36, 2);
    }
  }
  if (V.mapLevel >= 5) {
    const base = iso(-1, 1);
    const x = Math.round(base.x);
    const y = Math.round(base.y);
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(x - 22, y - 20, 44, 22);
    ctx.fillStyle = '#555555';
    ctx.fillRect(x - 22, y - 20, 44, 4);
    ctx.fillStyle = '#333333';
    ctx.fillRect(x - 10, y - 30, 20, 8);
    ctx.fillRect(x - 5, y - 22, 10, 6);
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.008));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(x - 7, y - 16, 14, 7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffc27a';
    ctx.fillRect(x - 4, y - 15, 4, 3);
    ctx.fillRect(x + 2, y - 14, 3, 2);
    for (let s = 0; s < 3; s++) {
      const prog = (now * 0.0012 + s * 0.33) % 1;
      const wx = x + Math.round(Math.sin(now * 0.003 + s) * 4);
      const wy = y - 24 - Math.round(prog * 18);
      const alpha = (1 - prog) * 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#b0b0b0';
      ctx.fillRect(wx, wy, 2, 2);
      ctx.fillRect(wx + 2, wy - 2, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  if (V.mapLevel >= 7) {
    const base = iso(1, 0);
    const x = Math.round(base.x);
    const y = Math.round(base.y);
    const coins = [{ x: -11, y: -3 }, { x: -5, y: -1 }, { x: 1, y: -2 }, { x: 7, y: -3 }, { x: -8, y: -8 }, { x: -2, y: -9 }, { x: 4, y: -8 }, { x: 0, y: -14 }];
    for (let i = 0; i < coins.length; i++) {
      const cn = coins[i];
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(x + cn.x, y + cn.y, 7, 4);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x + cn.x + 1, y + cn.y, 4, 2);
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(x + cn.x + 1, y + cn.y + 3, 5, 1);
    }
    const glintIndex = Math.floor(now / 900) % coins.length;
    const pulse = now % 1100;
    if (pulse < 130) {
      const cn = coins[glintIndex];
      ctx.globalAlpha = 1 - (pulse / 130);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + cn.x + 2, y + cn.y + 1, 2, 1);
      ctx.globalAlpha = 1;
    }
    const cp = guildCatPos();
    ctx.fillStyle = '#9ca3af';
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(cp.x, cp.y, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cp.x - 8, cp.y - 4, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(cp.x - 9, cp.y - 6, 18, 12);
      ctx.fillRect(cp.x - 13, cp.y - 8, 10, 8);
    }
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cp.x - 11, cp.y - 9, 2, 4);
    ctx.fillRect(cp.x - 7, cp.y - 9, 2, 4);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(cp.x - 10, cp.y - 4, 4, 1);
    const tailSway = Math.round(V.wind * 3 + (Math.sin(now * 0.0013) > 0.93 ? -5 : 0));
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(cp.x + 7 + tailSway, cp.y - 2, 6, 2);
    ctx.fillRect(cp.x + 12 + tailSway * 2, cp.y - 4, 4, 2);
  }
}
function drawTorch(cx, cy, index, now) {
  const ctx = V.ctx;
  const intensity = V.torchIntensity || 1;
  let b = Math.max(0.32, Math.min(1, 0.58 + 0.34 * Math.sin(now * 0.012 + index * 2.1) + (rand() - 0.5) * 0.16));
  b = clamp(b * intensity, 0, 1);
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
  const sitting = (w.mode === 'idle' && w.atDesk);
  const bob = w.moving ? (w.walkFrame % 2 === 0 ? 0 : 1) : (sitting ? 0 : Math.round(Math.sin(w.bob) * 1.1));
  const x = Math.round(w.x);
  const y = Math.round(w.y) + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 4, Math.round(w.y) + 17, 20, 4);
  const frame = w.moving ? (w.walkFrame % 4) : 0;
  const vertical = (w.facing === 'up' || w.facing === 'down');
  let leftY = y + 10, rightY = y + 10, leftH = 8, rightH = 8;
  if (sitting) { leftY = y + 13; rightY = y + 13; leftH = 4; rightH = 4; }
  else if (frame === 1) { leftY = y + 9; rightY = y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = y + 11; rightY = y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = y + 12; rightY = y + 9; leftH = 5; rightH = 8; }
  if (vertical && !sitting) {
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
  if ((w.mode === 'in_progress' || w.mode === 'pending') && w.atDesk) {
    for (let k = 0; k < 3; k++) {
      const px = x + 4 + k * 4 + Math.sin(w.typingPhase * 1.7 + k) * 2;
      const py = y - 19 - (Math.floor(w.typingPhase * 3 + k * 1.1) % 6);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
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
  ctx.save();
  if (V.shake.active) {
    const progress = V.shake.t / V.shake.duration;
    const decay = Math.max(0, 1 - progress);
    const amp = V.shake.amp * decay;
    ctx.translate(Math.sin(now * 0.123) * amp, Math.cos(now * 0.171) * amp);
  }
  drawSky(now);
  drawIslandUnderside(now);
  drawFloor(now);
  drawWeather(c, now);
  drawBuildings(now);
  drawShadows();
  drawProps(now);
  drawWorkers(now);
  drawParticles(now);
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
    } else if (p.kind === 'firework') {
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    } else if (p.kind === 'z') {
      ctx.globalAlpha = lifeRatio;
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = p.color;
      ctx.fillText('z', Math.round(p.x), Math.round(p.y));
    }
  }
  ctx.globalAlpha = 1;
}
function drawLighting(now) {
  const ctx = V.ctx;
  const c = V.canvas;
  const gr = godRayGeometry();
  const shimmer = 0.92 + 0.08 * Math.sin(now * 0.0019);
  if (V.daylight > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.06 * shimmer * V.daylight;
    ctx.fillStyle = 'rgba(200,230,255,1)';
    ctx.beginPath();
    ctx.moveTo(gr.topX - 10, gr.topY);
    ctx.lineTo(gr.topX + 10, gr.topY);
    ctx.lineTo(gr.bottomX + gr.bottomHalf, gr.bottomY);
    ctx.lineTo(gr.bottomX - gr.bottomHalf, gr.bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < V.torchPts.length; i++) {
    const tp = V.torchPts[i];
    const pulse = 0.58 + 0.34 * Math.sin(now * 0.012 + i * 2.1) + (rand() - 0.5) * 0.14;
    const radius = 42 + pulse * 16;
    const intensity = V.torchIntensity || 1;
    const gradient = ctx.createRadialGradient(tp.x, tp.y, 2, tp.x, tp.y, radius);
    gradient.addColorStop(0, 'rgba(255,180,90,' + (0.36 * intensity) + ')');
    gradient.addColorStop(0.45, 'rgba(255,120,40,' + (0.16 * intensity) + ')');
    gradient.addColorStop(1, 'rgba(255,90,20,0)');
    if (intensity > 0.05) {
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let wi = 0; wi < V.workerStates.length; wi++) {
    const w = V.workerStates[wi];
    const lx = Math.round(w.x) + 9;
    const ly = Math.round(w.y) - 8;
    const halo = ctx.createRadialGradient(lx, ly, 1, lx, ly, 15);
    halo.addColorStop(0, 'rgba(255,240,170,0.28)');
    halo.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lx, ly, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(lx - 1, ly - 1, 2, 2);
  }
  ctx.globalCompositeOperation = prevComposite;
  const vg = ctx.createRadialGradient(c.width * 0.5, c.height * 0.5, c.width * 0.28, c.width * 0.5, c.height * 0.5, c.width * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let y = 0; y < c.height; y += 3) {
    ctx.fillRect(0, y, c.width, 1);
  }
}
function drawWeather(c, now) {
  const ctx = V.ctx;
  if (V.weather === 'RAIN') {
    const t = now * 0.001;
    ctx.strokeStyle = 'rgba(180,210,255,0.62)';
    ctx.lineWidth = 1;
    for (let i = 0; i < V.rainDrops.length; i++) {
      const drop = V.rainDrops[i];
      const y = (drop.ySeed * (c.height + 80) + t * drop.speed) % (c.height + 80) - 40;
      const x = drop.xSeed * (c.width * 0.78) + c.width * 0.11 + drop.drift * 18 + V.wind * 8;
      ctx.beginPath();
      ctx.moveTo(Math.round(x), Math.round(y));
      ctx.lineTo(Math.round(x + 3), Math.round(y + 11));
      ctx.stroke();
    }
    const minC = -2 - V.growthStep;
    const maxC = 1 + V.growthStep;
    ctx.fillStyle = 'rgba(210,225,255,0.45)';
    for (let i = 0; i < 26; i++) {
      const gx = minC + Math.floor(seeded(1300 + i * 17.1) * (maxC - minC + 1));
      const gy = minC + Math.floor(seeded(1301 + i * 19.3) * (maxC - minC + 1));
      const pt = iso(gx + 0.5, gy + 0.5);
      const pulse = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(now * 0.009 + i * 1.7));
      ctx.globalAlpha = pulse * 0.45;
      ctx.fillRect(Math.round(pt.x) - 2, Math.round(pt.y) + 2, 4, 1);
      ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) + 4, 2, 1);
    }
    ctx.globalAlpha = 1;
  } else if (V.weather === 'SNOW') {
    const t = now * 0.001;
    for (let i = 0; i < V.snowFlakes.length; i++) {
      const fl = V.snowFlakes[i];
      const y = (fl.ySeed * c.height + t * fl.speed) % c.height;
      const sway = Math.sin(t * 0.9 + fl.phase) * (8 + Math.abs(V.wind) * 7);
      const x = fl.xSeed * c.width + sway;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
}
function drawUI(c, now) {
  const ctx = V.ctx;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < V.xpTexts.length; i++) {
    const xp = V.xpTexts[i];
    const a = Math.max(0, 1 - (xp.t / xp.duration));
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('+1 XP', Math.round(xp.x), Math.round(xp.y));
  }
  ctx.globalAlpha = 1;
  if (V.levelUp.active) {
    const f = V.levelUp;
    const a = f.t < 1.5 ? 1 : Math.max(0, 1 - (f.t - 1.5) / 0.5);
    if (a > 0) {
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(c.width * 0.5 - 100, c.height * 0.5 - 42, 200, 84);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.width * 0.5 - 100, c.height * 0.5 - 42, 200, 84);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL UP!', c.width * 0.5, c.height * 0.5);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
  if (V.xpFlash.active) {
    const f = V.xpFlash;
    const a = Math.max(0, 1 - (f.t / f.duration));
    if (a > 0 && V.workerStates.length) {
      const w = V.workerStates[0];
      const fx = Math.round(w.x) + 4;
      const fy = Math.round(w.y) - 24 - Math.round(f.t * 16);
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(fx - 16, Math.round(w.y) - 6 - 16, 32, 32);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('+XP', fx - 12, fy);
      ctx.globalAlpha = 1;
    }
  }
  const pendingCount = V.allTasks.filter(function (t) { return t.status === 'pending'; }).length;
  const doneCount = V.allTasks.filter(function (t) { return t.status === 'done'; }).length;
  const failedCount = V.allTasks.filter(function (t) { return t.status === 'failed'; }).length;
  const totalCount = V.allTasks.length;
  const topH = 34;
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(0, 0, c.width, topH);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, topH - 2, c.width, 2);
  ctx.font = 'bold 13px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3d37a';
  ctx.fillText('WORKER GUILD ONLINE', 12, 17);
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
  let chipX = 228;
  for (let i = 0; i < V.workers.length; i++) {
    const meta = V.workers[i];
    const name = String(meta.name || (i === 0 ? 'MISSINGNO' : 'STEP5'));
    const label = workerStateLabel(meta);
    const isStep = i === 1 || name.toLowerCase().indexOf('step') !== -1;
    const accent = isStep ? '#a78bfa' : '#facc15';
    const stateColor = label === 'WORKING' ? '#22c55e' : '#9ca3af';
    const prefix = '[' + name + ': ';
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = accent;
    ctx.fillText(prefix, chipX, 17);
    const pw = ctx.measureText(prefix).width;
    ctx.fillStyle = stateColor;
    ctx.fillText(label, chipX + pw, 17);
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = accent;
    ctx.fillText(']', chipX + pw + lw, 17);
    const total = ctx.measureText(prefix + label + ']').width;
    chipX += total + 10;
  }
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '12px monospace';
  ctx.fillText('Pending: ' + pendingCount + '   Done: ' + doneCount + '   Failed: ' + failedCount + '   Total: ' + totalCount, c.width - 360, 17);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('WEATHER: ' + V.weather, c.width - 520, 17);
  drawRightPanel(c, now, doneCount, totalCount);
  drawChat(c);
  drawBottomBar(c, doneCount, totalCount);
}
function drawRightPanel(c, now, doneCount, totalCount) {
  const ctx = V.ctx;
  const panelW = 232;
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
  const rowH = 20;
  const startY = panelY + 36;
  let y = startY;
  for (let wi = 0; wi < V.workers.length; wi++) {
    const worker = V.workers[wi];
    if (y + 16 > panelY + panelH - 8) break;
    const headerColor = wi === 1 ? '#6d28d9' : '#b45309';
    ctx.fillStyle = wi === 1 ? 'rgba(139,92,246,0.28)' : 'rgba(250,204,21,0.28)';
    ctx.fillRect(panelX + 4, y, panelW - 8, 16);
    ctx.fillStyle = headerColor;
    ctx.font = 'bold 12px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(worker.name || (wi === 0 ? 'MISSINGNO' : 'STEP5')), panelX + 10, y + 8);
    y += 18;
    const tasks = Array.isArray(worker.tasks) ? worker.tasks : [];
    for (let i = 0; i < tasks.length; i++) {
      if (y + rowH > panelY + panelH - 8) break;
      const t = tasks[i];
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
      const maxChars = 22;
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
      y += rowH;
    }
    y += 5;
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
  const lines = V.chatLines.slice(-6);
  const lineH = 14;
  const startY = chatY + chatH - (lines.length * lineH) - 6;
  ctx.font = '12px monospace';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineH + lineH * 0.5;
    const prefix = '[' + line.name + '] ';
    ctx.fillStyle = line.color;
    ctx.fillText(prefix, chatX + 8, y);
    const px = chatX + 8 + ctx.measureText(prefix).width;
    const raw = String(line.text || '');
    const maxChars = 42;
    const shown = raw.length > maxChars ? raw.slice(0, maxChars - 1) + '\u2026' : raw;
    ctx.fillStyle = 'rgba(230, 210, 150, 0.78)';
    ctx.fillText(shown, px, y);
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
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('MAP LEVEL ' + V.mapLevel + '/9', c.width - 16, bottomY + bottomH * 0.5);
  ctx.textAlign = 'left';
}
if (typeof window !== 'undefined') {
  window.init = init;
}
