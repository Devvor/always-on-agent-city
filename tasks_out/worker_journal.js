const STARTERS = ['still thinking about', 'mumbles something like', 'remembers'];

let lastTime = null;
let lastUpdateNow = Date.now();

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function getState() { const w = root(); return w && w.GuildJournal; }

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

function escapeRegex(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function recentTicksFor(worker) {
  if (!worker || typeof worker !== 'object') return [];
  const keys = ['recentTicks', 'recent_ticks', 'recent', 'ticks', 'log', 'logs', 'events', 'history'];
  for (let i = 0; i < keys.length; i++) {
    if (Array.isArray(worker[keys[i]])) return worker[keys[i]];
  }
  return [];
}

function latestTickForWorker(worker) {
  const ticks = recentTicksFor(worker);
  const collected = [];
  for (let i = 0; i < ticks.length; i++) {
    const line = tickText(ticks[i]);
    if (line) collected.push(String(line).trim());
  }
  const name = String(worker && worker.name != null ? worker.name : '').trim();
  let chosen = null;
  for (let i = collected.length - 1; i >= 0; i--) {
    if (name && collected[i].toLowerCase().indexOf(name.toLowerCase()) !== -1) { chosen = collected[i]; break; }
  }
  if (!chosen && collected.length) chosen = collected[collected.length - 1];
  return chosen ? String(chosen).trim() : '';
}

function idleIndices(Vv) {
  const out = [];
  const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  for (let i = 0; i < ws.length; i++) {
    if (ws[i] && ws[i].workerState === 'IDLE') out.push(i);
  }
  return out;
}

function randomInterval() {
  return 12000 + Math.random() * 8000;
}

function paraphraseTick(line, name) {
  let s = String(line == null ? '' : line).trim();
  if (name) {
    s = s.replace(new RegExp('^' + escapeRegex(name) + '\\s*:\\s*', 'i'), '');
  }
  const m = s.match(/\s(?:—|–|-|:)\s(.+)$/);
  let tail = m ? m[1].trim() : s;
  tail = tail.replace(/\b(DONE|PENDING|IN_PROGRESS|FAILED|COMPLETED|PASSED|SUCCESS)\b/gi, '').replace(/\s+/g, ' ').trim();
  if (!tail) tail = s.replace(/\s+/g, ' ').trim();
  if (tail && /^[A-Z]/.test(tail) && tail.length > 1) tail = tail.charAt(0).toLowerCase() + tail.slice(1);
  return tail || 'something new';
}

function makeBubble(index, Vv, now) {
  const meta = (Vv && Array.isArray(Vv.workers)) ? (Vv.workers[index] || {}) : {};
  const name = meta && meta.name != null ? String(meta.name) : '';
  const latest = latestTickForWorker(meta);
  const hasTick = latest.length > 0;
  let body;
  if (hasTick) {
    const starter = STARTERS[Math.floor(Math.random() * STARTERS.length)];
    body = starter + ' ' + paraphraseTick(latest, name);
  } else {
    body = 'dreams of fresh quests';
  }
  let text = name ? (name + ': ' + body) : body;
  text = fitFn(text, 140);
  if (!text) text = fitFn('dreams of fresh quests', 140) || 'dreams of fresh quests';
  return { workerIndex: index, name: name, text: text, start: now, duration: 5, expireAt: now + 5000 };
}

function processTimers(J, Vv, now) {
  if (!Array.isArray(J.timers)) J.timers = [];
  const due = J.timers.filter(function (t) { return t && typeof t.at === 'number' && t.at <= now; });
  J.timers = J.timers.filter(function (t) { return !(t && typeof t.at === 'number' && t.at <= now); });

  for (let i = 0; i < due.length; i++) {
    const t = due[i];
    if (!t || !t.kind) continue;
    if (t.kind === 'expire') {
      J.bubble = null;
      J.timers.push({ at: now + randomInterval(), kind: 'pick' });
    } else if (t.kind === 'pick') {
      if (J.bubble) {
        if (!J.timers.some(function (x) { return x && x.kind === 'expire'; })) {
          J.timers.push({ at: J.bubble.start + J.bubble.duration * 1000, kind: 'expire' });
        }
        continue;
      }
      const choices = idleIndices(Vv);
      if (choices.length) {
        J.bubble = makeBubble(choices[Math.floor(Math.random() * choices.length)], Vv, now);
        J.timers.push({ at: J.bubble.start + J.bubble.duration * 1000, kind: 'expire' });
      } else {
        J.timers.push({ at: now + randomInterval(), kind: 'pick' });
      }
    }
  }

  if (J.bubble && now >= J.bubble.start + J.bubble.duration * 1000) {
    J.bubble = null;
  }

  if (J.bubble && !J.timers.some(function (t) { return t && t.kind === 'expire'; })) {
    J.timers.push({ at: J.bubble.start + J.bubble.duration * 1000, kind: 'expire' });
  }

  if (!J.bubble && J.timers.length === 0) {
    J.timers.push({ at: now + randomInterval(), kind: 'pick' });
  }
}

function updateImpl(now) {
  if (typeof now !== 'number') now = nowFn();
  const J = getState();
  const Vv = getV();
  if (!J || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    lastUpdateNow = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;
  lastUpdateNow = now;
  if (!Array.isArray(J.timers)) J.timers = [];
  if (J.bubble === undefined) J.bubble = null;
  processTimers(J, Vv, now);
}

function update(now) {
  try { updateImpl(now); } catch (e) {}
}

function drawCloud(ctx, x, y, w, h) {
  const r = Math.min(12, Math.round(h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImpl(ctx) {
  const J = getState();
  const Vv = getV();
  if (!J || !Vv || Vv.gameState !== 'play') return;
  const b = J.bubble;
  if (!b) return;
  const now = lastUpdateNow != null ? lastUpdateNow : nowFn();
  const age = (now - b.start) / 1000;
  if (!isFinite(age) || age < 0 || age >= b.duration) return;

  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const w = states[b.workerIndex];
  if (!w) return;

  const cx = (typeof w.x === 'number' && isFinite(w.x)) ? w.x : 0;
  const cy = (typeof w.y === 'number' && isFinite(w.y)) ? w.y : 0;

  ctx.font = '11px monospace';
  const text = String(b.text == null ? '' : b.text);
  const textW = ctx.measureText(text).width;
  const bw = Math.max(44, Math.ceil(textW + 18));
  const bh = 24;
  let x = Math.round(cx + 8 - bw / 2);
  let y = Math.round(cy - bh - 44);
  if (y <= 60) y = 62;

  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (canvas && canvas.width) {
    x = Math.max(4, Math.min(x, canvas.width - bw - 4));
  }

  const fadeIn = 0.4;
  const fadeOut = 0.4;
  let alpha = 1;
  if (age < fadeIn) alpha = age / fadeIn;
  else if (age > b.duration - fadeOut) alpha = (b.duration - age) / fadeOut;
  if (!isFinite(alpha)) alpha = 1;
  alpha = Math.max(0, Math.min(1, alpha));

  ctx.save();
  ctx.globalAlpha = alpha;
  drawCloud(ctx, x, y, bw, bh);
  ctx.fillStyle = 'rgba(16, 16, 22, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 9, y + bh * 0.5 + 1);
  ctx.restore();
}

function draw(ctx) {
  try { drawImpl(ctx); } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildJournal) window.GuildJournal = { timers: [], bubble: null };
  const J = window.GuildJournal;
  if (!Array.isArray(J.timers)) J.timers = [];
  if (Object.prototype.hasOwnProperty.call(J, 'bubble') === false) J.bubble = null;
  J.update = update;
  J.draw = draw;
  J.__probe = function () { return { timers: J.timers.slice(), bubble: J.bubble, lastNow: lastUpdateNow }; };
}

export {};
