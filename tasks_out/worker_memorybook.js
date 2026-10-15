const PAGE_SIZE = 5;
let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function iso(gx, gy) {
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
  const Vv = getV();
  const ctx = Vv && Vv.ctx;
  if (ctx && typeof ctx.measureText === 'function') {
    text = (text == null ? '' : String(text));
    if (!isFinite(maxW) || maxW <= 0) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    const ell = '\u2026';
    for (let i = text.length; i > 0; i--) {
      const cand = text.slice(0, i) + ell;
      if (ctx.measureText(cand).width <= maxW) return cand;
    }
    return ctx.measureText(ell).width <= maxW ? ell : '';
  }
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

const api = {
  gx: -7.5,
  gy: 4.5,
  page: 0,
  entries: [],
  seen: new Set(),
  pressed: pressed,
  prevPressed: prevPressed,
  historyInitialized: false,
  lastGrowthStep: null,
  levelUpWasActive: false,
  lastCollect: 0
};

function toTs(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && isFinite(value)) {
    if (value > 0 && value < 1e12) return value * 1000;
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return toTs(Number(trimmed));
    const parsed = Date.parse(trimmed);
    return isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    return toTs(value.ts != null ? value.ts : (value.timestamp != null ? value.timestamp : (value.time != null ? value.time : (value.date != null ? value.date : null))));
  }
  return null;
}

function taskStatusDone(value) {
  const s = String(value == null ? '' : value).toLowerCase().replace(/[\s-]+/g, '_');
  return s === 'done' || s === 'completed' || s === 'complete' || s === 'success' || s === 'finished' || s === 'passed';
}

function taskTimestamp(task, fallback) {
  const keys = ['completedAt', 'completed_on', 'doneAt', 'finishedAt', 'updatedAt', 'createdAt', 'timestamp', 'ts', 'time', 'date'];
  for (let i = 0; i < keys.length; i++) {
    if (task && task[keys[i]] != null) {
      const ts = toTs(task[keys[i]]);
      if (ts != null) return ts;
    }
  }
  return fallback;
}

function isEventLike(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const strKeys = ['title', 'name', 'event', 'label', 'type', 'message', 'text', 'msg', 'line', 'status'];
  if (strKeys.some(function (k) { return typeof v[k] === 'string'; })) return true;
  const tsKeys = ['timestamp', 'ts', 'time', 'date', 'createdAt', 'completedAt', 'updatedAt', 'finishedAt'];
  if (tsKeys.some(function (k) { return v[k] != null; })) return true;
  return false;
}

function eventTitle(raw) {
  const title = raw.title != null ? raw.title : (raw.name != null ? raw.name : (raw.event != null ? raw.event : (raw.label != null ? raw.label : (raw.type != null ? raw.type : null))));
  const msg = raw.message != null ? raw.message : (raw.text != null ? raw.text : (raw.msg != null ? raw.msg : (raw.line != null ? raw.line : null)));
  if (title != null && msg != null && String(msg) !== String(title)) return String(title) + ' \u2014 ' + String(msg).slice(0, 80);
  if (title != null) return String(title);
  if (msg != null) return String(msg);
  return 'Ceremony';
}

function eventTimestamp(raw, fallback) {
  const keys = ['timestamp', 'ts', 'time', 'date', 'createdAt', 'completedAt', 'updatedAt', 'finishedAt', 'timeMs'];
  for (let i = 0; i < keys.length; i++) {
    if (raw && raw[keys[i]] != null) {
      const ts = toTs(raw[keys[i]]);
      if (ts != null) return ts;
    }
  }
  return fallback;
}

function addEntry(entry) {
  if (!entry || !entry.id) return;
  if (api.seen.has(entry.id)) return;
  api.seen.add(entry.id);
  api.entries.push({
    id: String(entry.id),
    ts: (typeof entry.ts === 'number' && isFinite(entry.ts)) ? entry.ts : nowFn(),
    text: String(entry.text == null ? '' : entry.text)
  });
  if (api.entries.length > 240) api.entries = api.entries.slice(-240);
}

function ingestTasks(tasks, now) {
  if (!Array.isArray(tasks)) return;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || typeof t !== 'object') continue;
    const status = t.status != null ? t.status : (t.state != null ? t.state : t.phase);
    if (!taskStatusDone(status)) continue;
    const idVal = t.id != null ? t.id : (t.key != null ? t.key : (t.name != null ? t.name : (t.title != null ? t.title : ('task_' + i))));
    const title = String(t.title != null ? t.title : (t.name != null ? t.name : (t.id != null ? t.id : ('Task ' + (i + 1)))));
    let text = title;
    const low = title.toLowerCase();
    if (low.indexOf('festival') !== -1) text = 'Festival complete: ' + title;
    else if (low.indexOf('arc') !== -1) text = 'Arc complete: ' + title;
    else text = 'Quest milestone: ' + title;
    addEntry({ id: 'task:' + String(idVal), ts: taskTimestamp(t, now), text: text });
  }
}

function walkCeremony(source, obj, now, depth, path) {
  depth = (typeof depth === 'number') ? depth : 0;
  path = path || '';
  if (depth > 3 || !obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i];
      if (isEventLike(item)) {
        addEntry({ id: 'ceremony:' + source + path + '[' + i + ']', ts: eventTimestamp(item, now), text: eventTitle(item) });
      } else {
        walkCeremony(source, item, now, depth + 1, path + '[' + i + ']');
      }
    }
    return;
  }
  if (path === '' && isEventLike(obj)) {
    addEntry({ id: 'ceremony:' + source, ts: eventTimestamp(obj, now), text: eventTitle(obj) });
  }
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const val = obj[key];
    if (!val || typeof val !== 'object') continue;
    if (isEventLike(val)) {
      addEntry({ id: 'ceremony:' + source + path + '.' + key, ts: eventTimestamp(val, now), text: eventTitle(val) });
    } else {
      walkCeremony(source, val, now, depth + 1, path + '.' + key);
    }
  }
}

function collectCeremonyGlobals(now) {
  const w = root();
  if (!w) return;
  const keys = Object.keys(w).filter(function (k) {
    return /^Guild/i.test(k) && k !== 'GuildMemoryBook' && k !== 'GuildVisitor' &&
      /ceremony|festival|arc|level|milestone|memory|history|event|celebration|quest|plaque/i.test(k);
  });
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = w[key];
    if (!value || typeof value !== 'object') continue;
    walkCeremony(key, value, now, 0, '');
  }
}

function collectEntries(now) {
  const Vv = getV();
  const allTasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : (Array.isArray(root() && root().allTasks) ? root().allTasks : []);
  if (!api.historyInitialized) {
    api.lastGrowthStep = (Vv && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
    api.levelUpWasActive = false;
    api.historyInitialized = true;
  }
  ingestTasks(allTasks, now);
  if (root() && Array.isArray(root().allTasks) && root().allTasks !== allTasks) ingestTasks(root().allTasks, now);
  collectCeremonyGlobals(now);
  if (Vv) {
    if (api.lastGrowthStep == null) api.lastGrowthStep = isFinite(Vv.growthStep) ? Vv.growthStep : 0;
    if (isFinite(Vv.growthStep) && Vv.growthStep > api.lastGrowthStep) {
      for (let s = api.lastGrowthStep + 1; s <= Vv.growthStep; s++) {
        addEntry({ id: 'growth:' + s, ts: now, text: 'Map growth ceremony: level ' + (s + 1) });
      }
      api.lastGrowthStep = Vv.growthStep;
    }
    const active = !!(Vv.levelUp && Vv.levelUp.active);
    if (active && !api.levelUpWasActive) {
      addEntry({ id: 'levelup:' + now, ts: now, text: 'Level-up ceremony' });
    }
    api.levelUpWasActive = active;
  }
}

function isNearVisitor() {
  const vis = root() ? root().GuildVisitor : null;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return Math.hypot(vis.gx - api.gx, vis.gy - api.gy) <= 1.8;
}

function flipPage(dir) {
  const total = Math.max(1, Math.ceil(api.entries.length / PAGE_SIZE));
  if (total <= 1) return;
  const step = (typeof dir === 'number' && isFinite(dir)) ? dir : 1;
  api.page = (api.page + step + total) % total;
  try { cueFn('click'); } catch (e) {}
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  if (k === ' ' || k === 'e' || k === 'escape') {
    const w = root();
    if (w && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function stamp(ts) {
  try {
    const d = new Date(ts);
    if (!isFinite(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return hh + ':' + mm + ':' + ss;
  } catch (e) {
    return '';
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  if (api.lastTime === null) api.lastTime = now;
  api.lastTime = now;
  collectEntries(now);
  const near = isNearVisitor();
  const eNow = api.pressed.has('e') || api.pressed.has(' ');
  const eWas = api.prevPressed.has('e') || api.prevPressed.has(' ');
  if (near && !eWas && eNow) flipPage(1);
  api.prevPressed = new Set(api.pressed);
  const total = Math.max(1, Math.ceil(api.entries.length / PAGE_SIZE));
  if (api.page > total - 1) api.page = 0;
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;
  collectEntries(nowFn());
  const sorted = api.entries.slice().sort(function (a, b) { return b.ts - a.ts; });
  const total = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (api.page > total - 1) api.page = 0;
  const pageEntries = sorted.slice(api.page * PAGE_SIZE, api.page * PAGE_SIZE + PAGE_SIZE);

  const pt = iso(api.gx, api.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const bw = 236;
  const bh = 124;
  const bx = x - Math.round(bw * 0.5);
  const by = y - bh + 4;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(bx + 6, y + 4, bw - 4, 6);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(bx - 9, by - 6, bw + 18, bh + 12);
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(bx + Math.round(bw * 0.5) - 1, by + 2, 2, bh - 4);

  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(fitFn('FESTIVAL MEMORY BOOK', bw - 16), bx + 8, by + 14);

  ctx.font = '9px monospace';
  ctx.fillStyle = '#f3d37a';
  ctx.fillText(fitFn('Page ' + (api.page + 1) + '/' + total, bw - 16), bx + 8, by + 28);

  if (!pageEntries.length) {
    ctx.font = '10px monospace';
    ctx.fillStyle = '#f3d37a';
    ctx.fillText(fitFn('No memories yet...', bw - 16), bx + 8, by + 48);
  } else {
    ctx.font = '10px monospace';
    const rowH = 15;
    let ry = by + 42;
    for (let i = 0; i < pageEntries.length; i++) {
      const e = pageEntries[i];
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(bx + 8, ry - 2, 3, 3);

      const t = stamp(e.ts);
      const timeW = Math.round(ctx.measureText('00:00:00').width) + 2;
      ctx.fillStyle = '#f3d37a';
      ctx.fillText(fitFn(t, timeW), bx + 14, ry);
      const tw = ctx.measureText(fitFn(t, timeW)).width;

      ctx.fillStyle = '#facc15';
      ctx.fillText(fitFn(e.text, bx + bw - 8 - (bx + 14 + tw + 4)), bx + 14 + tw + 4, ry);
      ry += rowH;
    }
  }

  const near = isNearVisitor();
  if (near) {
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#facc15';
    const hint = total > 1 ? 'E: flip page' : 'E: read page';
    ctx.fillText(fitFn(hint, Math.round(bw * 0.5) - 8), bx + 8, by + bh - 8);
    const prompt = 'E to flip memory pages';
    ctx.fillStyle = '#f3d37a';
    ctx.fillText(fitFn(prompt, 180), x - 60, by - 16);
  }
}

if (typeof window !== 'undefined') {
  api.update = update;
  api.draw = draw;
  api.flip = flipPage;
  api.flipPage = flipPage;
  api.__pressed = api.pressed;
  api.__prevPressed = api.prevPressed;
  window.GuildMemoryBook = api;

  if (!window.__gmbListeners) {
    window.__gmbListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
