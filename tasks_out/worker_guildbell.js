const SWING_MS = 3000;
const BANNER_MS = 4000;
const MAX_ANGLE = 0.55;

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

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function createState() {
  return {
    gx: -1.5,
    gy: -2.5,
    rings: 0,
    lastDoneCount: null,
    seenDoneIds: new Set(),
    swingActive: false,
    swingStart: 0,
    bannerActive: false,
    bannerStart: 0,
    bannerText: '',
    queue: []
  };
}

function normalizeState(s) {
  if (!s || typeof s !== 'object') return createState();
  if (typeof s.gx !== 'number') s.gx = -1.5;
  if (typeof s.gy !== 'number') s.gy = -2.5;
  if (typeof s.rings !== 'number') s.rings = 0;
  if (s.lastDoneCount === undefined) s.lastDoneCount = null;
  if (!(s.seenDoneIds instanceof Set)) s.seenDoneIds = new Set;
  if (typeof s.swingActive !== 'boolean') s.swingActive = false;
  if (typeof s.swingStart !== 'number') s.swingStart = 0;
  if (typeof s.bannerActive !== 'boolean') s.bannerActive = false;
  if (typeof s.bannerStart !== 'number') s.bannerStart = 0;
  if (typeof s.bannerText !== 'string') s.bannerText = '';
  if (!Array.isArray(s.queue)) s.queue = [];
  return s;
}

function getState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildBell) w.GuildBell = createState();
  w.GuildBell = normalizeState(w.GuildBell);
  return w.GuildBell;
}

function easeOutCubic(t) {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function taskKey(task, index) {
  if (task && task.id != null) return 'id:' + String(task.id);
  if (task && task.title != null) return 'title:' + String(task.title);
  return 'idx:' + index;
}

function getDoneList(tasks) {
  const out = [];
  if (!Array.isArray(tasks)) return out;
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i] && tasks[i].status === 'done') out.push({ task: tasks[i], index: i });
  }
  return out;
}

function newestDoneTask(tasks, seen) {
  const doneList = getDoneList(tasks);
  const fresh = [];
  for (let i = 0; i < doneList.length; i++) {
    const key = taskKey(doneList[i].task, doneList[i].index);
    if (!seen.has(key)) fresh.push(doneList[i].task);
  }
  if (fresh.length) return fresh[fresh.length - 1];
  if (doneList.length) return doneList[doneList.length - 1].task;
  return null;
}

function updateActive(s, now) {
  if (s.swingActive && now - s.swingStart >= SWING_MS) s.swingActive = false;
  if (s.bannerActive && now - s.bannerStart >= BANNER_MS) {
    s.bannerActive = false;
    s.bannerText = '';
  }
}

function processQueue(s, now) {
  if (s.queue.length === 0) return;
  if (s.swingActive || s.bannerActive) return;
  const job = s.queue.shift();
  s.swingActive = true;
  s.swingStart = now;
  s.bannerActive = true;
  s.bannerStart = now;
  s.bannerText = job.text;
}

function update(now) {
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const s = getState();
  if (!s) return;
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();

  updateActive(s, now);

  const tasks = Array.isArray(Vv.allTasks) ? Vv.allTasks : [];
  const doneList = getDoneList(tasks);
  const count = doneList.length;

  if (s.lastDoneCount === null) {
    s.lastDoneCount = count;
    s.seenDoneIds = new Set();
    for (let i = 0; i < doneList.length; i++) s.seenDoneIds.add(taskKey(doneList[i].task, doneList[i].index));
  } else if (count > s.lastDoneCount) {
    const candidate = newestDoneTask(tasks, s.seenDoneIds);
    let fragment = '';
    if (candidate) {
      if (candidate.id != null && String(candidate.id).trim() !== '') fragment = String(candidate.id);
      else if (candidate.title != null) fragment = String(candidate.title);
    }
    const text = fitFn('QUEST SHIPPED - ' + (fragment || 'QUEST'), 260);

    s.rings += 1;
    try {
      const w = root();
      if (w && typeof w.cue === 'function') w.cue('done');
    } catch (e) {}

    const job = { text: text };
    if (s.swingActive || s.bannerActive) {
      s.queue.push(job);
    } else {
      s.swingActive = true;
      s.swingStart = now;
      s.bannerActive = true;
      s.bannerStart = now;
      s.bannerText = text;
    }

    s.lastDoneCount = count;
    s.seenDoneIds = new Set();
    for (let i = 0; i < doneList.length; i++) s.seenDoneIds.add(taskKey(doneList[i].task, doneList[i].index));
  } else {
    s.lastDoneCount = count;
    s.seenDoneIds = new Set();
    for (let i = 0; i < doneList.length; i++) s.seenDoneIds.add(taskKey(doneList[i].task, doneList[i].index));
  }

  processQueue(s, now);
}

function currentAngle(s, now) {
  if (!s.swingActive) return 0;
  const t = clamp((now - s.swingStart) / SWING_MS, 0, 1);
  const decay = Math.pow(1 - t, 3);
  const sign = (s.rings % 2 === 0) ? -1 : 1;
  return sign * MAX_ANGLE * decay;
}

function draw(ctx) {
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const s = getState();
  if (!s) return;
  const now = nowFn();
  updateActive(s, now);
  processQueue(s, now);

  const pt = isoFn(s.gx, s.gy);
  const cx = Math.round(pt.x);
  const cy = Math.round(pt.y);
  const angle = currentAngle(s, now);

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(cx - 9, cy + 2, 18, 4);

  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(cx - 10, cy - 34, 4, 34);
  ctx.fillRect(cx + 6, cy - 34, 4, 34);
  ctx.fillRect(cx - 10, cy - 34, 20, 4);

  const pivotX = cx;
  const pivotY = cy - 30;
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(-1, 0, 2, 12);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-6, 12, 12, 9);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fillRect(-4, 14, 3, 3);
  ctx.restore();

  if (s.bannerActive && s.bannerText) {
    const age = (now - s.bannerStart) / 1000;
    const progress = clamp(age / 4, 0, 1);
    const alpha = progress < 0.75 ? 1 : Math.max(0, (1 - progress) / 0.25);
    const floatY = Math.round(age * 6);
    const text = s.bannerText;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 11px monospace';
    const textW = ctx.measureText(text).width;
    const bw = Math.ceil(textW) + 16;
    const bh = 20;
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(cy - 52 - floatY);

    ctx.fillStyle = 'rgba(10,10,12,0.90)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + bw * 0.5, by + bh * 0.5 + 1);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildBell) window.GuildBell = createState();
  window.GuildBell = normalizeState(window.GuildBell);
  window.GuildBell.update = update;
  window.GuildBell.draw = draw;
  window.GuildBell.__probe = function () {
    const s = getState();
    return { rings: s ? (s.rings | 0) : 0 };
  };
}

export {};
