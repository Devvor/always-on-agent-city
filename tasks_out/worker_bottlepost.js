// worker_bottlemessage.js — GuildBottleMessage: dawn bottles carrying real guild history.
const DAWN_START = 5;
const DAWN_END = 7;
const REACH = 1.15;

const ANCHORS = [
  { gx: 0.8, gy: 8.8 },
  { gx: 2.4, gy: 9.2 },
  { gx: 0.2, gy: 8.0 },
  { gx: 5.4, gy: 4.4 },
  { gx: 6.6, gy: 6.4 }
];

const DONE_TEMPLATES = [
  'Sun-bleached scrap: the guild finished "TITLE".',
  'A note from the tide: "TITLE" is done at last.',
  'Bottle log: one quest, "TITLE", complete.'
];
const FAILED_TEMPLATES = [
  'Waterlogged apology: "TITLE" failed twice; the cat watched.',
  'A soggy attempt: "TITLE" sank before it swam.',
  'Stained parchment: "TITLE" broke, then broke again.',
  'Half a tale: "TITLE" - abandoned at high tide.'
];
const FALLBACK_LINES = [
  'The bottle is empty but for salt: "keep shipping."',
  'A hopeful line: "the queue will empty one day."',
  'Faint pencil: "tomorrow, we merge."'
];

let pressed = new Set();
let prevPressed = new Set();

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildBottleMessage; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function dayKey(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

function createState() {
  return {
    bottles: [],
    held: null,
    overlay: null,
    coins: [],
    floats: [],
    nextId: 1,
    lastTime: null,
    everSpawned: false,
    dawnKey: null
  };
}

function taskTitle(t) {
  if (!t) return '';
  if (t.title != null) return String(t.title);
  if (t.name != null) return String(t.name);
  if (t.id != null) return String(t.id);
  return '';
}
function rawStatus(t) {
  if (!t) return '';
  if (t.status != null) return String(t.status);
  if (t.state != null) return String(t.state);
  if (t.phase != null) return String(t.phase);
  return '';
}
function isDone(s) {
  const v = String(s == null ? '' : s).toLowerCase();
  return v === 'done' || v === 'completed' || v === 'complete' || v === 'success' || v === 'passed' || v === 'finished' ||
    v.indexOf('done') !== -1 || v.indexOf('complete') !== -1;
}
function isFailed(s) {
  const v = String(s == null ? '' : s).toLowerCase();
  return v === 'failed' || v === 'failure' || v === 'error' || v === 'errored' || v === 'broken' || v === 'rejected' ||
    v.indexOf('fail') !== -1 || v.indexOf('error') !== -1;
}
function historyTasks() {
  const w = root();
  const Vv = getV();
  const lists = [];
  if (Vv && Array.isArray(Vv.allTasks)) lists.push(Vv.allTasks);
  if (w && Array.isArray(w.allTasks)) lists.push(w.allTasks);
  if (Vv && Array.isArray(Vv.tasks)) lists.push(Vv.tasks);
  for (let i = 0; i < lists.length; i++) if (lists[i] && lists[i].length) return lists[i];
  return [];
}
function historyTicks() {
  const w = root();
  const Vv = getV();
  if (Vv && Array.isArray(Vv.recentTicks) && Vv.recentTicks.length) return Vv.recentTicks;
  if (w && Array.isArray(w.recentTicks) && w.recentTicks.length) return w.recentTicks;
  return [];
}

function collectLines() {
  const out = [];
  const tasks = historyTasks();
  for (let i = 0; i < tasks.length; i++) {
    const title = taskTitle(tasks[i]).trim();
    if (!title) continue;
    const st = rawStatus(tasks[i]);
    if (isDone(st)) out.push(pick(DONE_TEMPLATES).replace('TITLE', fitFn(title, 60)));
    else if (isFailed(st)) out.push(pick(FAILED_TEMPLATES).replace('TITLE', fitFn(title, 60)));
  }
  const ticks = historyTicks();
  for (let i = 0; i < ticks.length; i++) {
    const line = String(ticks[i] == null ? '' : ticks[i]).trim();
    if (line) out.push('Smeared ink: "' + fitFn(line, 90) + '"');
  }
  if (!out.length) return FALLBACK_LINES.slice();
  return out;
}

function spawnBottles(now) {
  const st = getState();
  if (!st) return;
  const lines = collectLines();
  const pool = ANCHORS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const count = 1 + (Math.random() < 0.55 ? 1 : 0);
  const used = [];
  st.bottles = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    let line = pick(lines);
    let guard = 0;
    while (used.indexOf(line) !== -1 && guard < 10) { line = pick(lines); guard++; }
    used.push(line);
    const a = pool[i];
    st.bottles.push({
      id: st.nextId++,
      gx: a.gx + (Math.random() - 0.5) * 0.5,
      gy: a.gy + (Math.random() - 0.5) * 0.4,
      seed: Math.random() * Math.PI * 2,
      line: line,
      born: now
    });
  }
  st.spawnedAt = now;
}

function distToVisitor(b) {
  const vis = getVisitor();
  if (!vis || !b || !isFinite(vis.gx) || !isFinite(vis.gy)) return Infinity;
  return Math.hypot(vis.gx - b.gx, vis.gy - b.gy);
}
function nearestBottle() {
  const st = getState();
  if (!st || !st.bottles.length) return null;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < st.bottles.length; i++) {
    const d = distToVisitor(st.bottles[i]);
    if (d <= REACH && d < bestD) { bestD = d; best = st.bottles[i]; }
  }
  return best;
}

function creditCoin(st, fromX, fromY, now) {
  const w = root();
  let credited = false;
  if (w && w.GuildEconomy && typeof w.GuildEconomy.credit === 'function') {
    try { w.GuildEconomy.credit(-1, 1); credited = true; } catch (e) {}
  }
  if (!credited) {
    const Vv = getV();
    if (Vv && typeof Vv.purse === 'number') Vv.purse += 1;
  }
  const vis = getVisitor();
  const vp = (vis && isFinite(vis.gx) && isFinite(vis.gy)) ? isoFn(vis.gx, vis.gy) : { x: fromX, y: fromY - 20 };
  st.coins.push({ x: fromX, y: fromY, tx: vp.x + 8, ty: vp.y - 8, start: now, dur: 520 });
  st.floats.push({ x: vp.x + 8, y: vp.y - 18, start: now, dur: 1300, text: '+1' });
  cueFn('done');
}

function collect(b, now) {
  const st = getState();
  if (!st || !b) return;
  st.bottles = st.bottles.filter(function (x) { return x.id !== b.id; });
  st.held = { id: b.id, gx: b.gx, gy: b.gy, seed: b.seed, line: b.line, start: now };
  st.overlay = { line: b.line, start: now };
  cueFn('done');
}
function tossBack(now) {
  const st = getState();
  if (!st || !st.held) return;
  const p = isoFn(st.held.gx, st.held.gy);
  const held = st.held;
  st.held = null;
  st.overlay = null;
  creditCoin(st, p.x + 6, p.y - 6, now);
}
function putBack(now) {
  const st = getState();
  if (!st || !st.held) return;
  const h = st.held;
  st.bottles.push({ id: h.id, gx: h.gx, gy: h.gy, seed: h.seed, line: h.line, born: now - 2000 });
  st.held = null;
  st.overlay = null;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') {
    st.lastTime = now;
    prevPressed = new Set(pressed);
    return;
  }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const h = (typeof Vv.dayHour === 'number') ? Vv.dayHour : 0;
  const key = dayKey(new Date());
  const isDawn = h >= DAWN_START && h < DAWN_END;
  if (!st.everSpawned) {
    st.everSpawned = true;
    spawnBottles(now);
    st.dawnKey = isDawn ? key : null;
  } else if (isDawn && st.dawnKey !== key) {
    st.dawnKey = key;
    spawnBottles(now);
  }

  const keptCoins = [];
  for (let i = 0; i < st.coins.length; i++) if (now - st.coins[i].start < st.coins[i].dur) keptCoins.push(st.coins[i]);
  st.coins = keptCoins;
  const keptFloats = [];
  for (let i = 0; i < st.floats.length; i++) if (now - st.floats[i].start < st.floats[i].dur) keptFloats.push(st.floats[i]);
  st.floats = keptFloats;

  const eNow = pressed.has('e') || pressed.has(' ');
  const eWas = prevPressed.has('e') || prevPressed.has(' ');
  const escNow = pressed.has('escape');
  const escWas = prevPressed.has('escape');

  if (eNow && !eWas) {
    if (st.held) tossBack(now);
    else {
      const b = nearestBottle();
      if (b) collect(b, now);
    }
  }
  if (escNow && !escWas && st.held) putBack(now);

  prevPressed = new Set(pressed);
}

function drawGlass(ctx, x, y) {
  ctx.fillStyle = 'rgba(59,130,246,0.30)';
  ctx.fillRect(x - 4, y - 8, 9, 10);
  ctx.fillRect(x - 2, y - 13, 5, 5);
  ctx.fillStyle = '#8b6b3f';
  ctx.fillRect(x - 2, y - 15, 5, 3);
  ctx.fillStyle = '#d9c8a3';
  ctx.fillRect(x - 2, y - 6, 5, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x - 3, y - 7, 1, 7);
  ctx.fillRect(x - 1, y - 12, 1, 4);
}

function drawBottle(ctx, b, now) {
  const age = (now - b.born) / 1000;
  const ease = clamp(age / 1.6, 0, 1);
  const gy = b.gy + (1 - ease) * 2.2;
  const bob = Math.sin(now * 0.0022 + b.seed) * 1.4;
  const p = isoFn(b.gx, gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y + bob);

  const rp = ((now * 0.001) + b.seed) % 1;
  ctx.globalAlpha = 0.22 * (1 - rp);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y + 3, 3 + rp * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 5, y + 3, 10, 3);
  drawGlass(ctx, x, y);
}

function drawHeld(ctx, now) {
  const st = getState();
  const vis = getVisitor();
  if (!st || !st.held || !vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
  const p = isoFn(vis.gx, vis.gy);
  drawGlass(ctx, Math.round(p.x + 12), Math.round(p.y - 6 + Math.sin(now * 0.004) * 1));
}

function drawCoins(ctx, now) {
  const st = getState();
  if (!st) return;
  for (let i = 0; i < st.coins.length; i++) {
    const c = st.coins[i];
    const t = clamp((now - c.start) / c.dur, 0, 1);
    const e = easeOutCubic(t);
    const x = Math.round(c.x + (c.tx - c.x) * e);
    const y = Math.round(c.y + (c.ty - c.y) * e - Math.sin(t * Math.PI) * 16);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x - 3, y - 2, 7, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x - 2, y - 2, 4, 2);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(x - 2, y + 1, 5, 1);
  }
  for (let i = 0; i < st.floats.length; i++) {
    const f = st.floats[i];
    const a = Math.max(0, 1 - (now - f.start) / f.dur);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, Math.round(f.x), Math.round(f.y - (now - f.start) * 0.02));
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

function drawHint(ctx, now) {
  const st = getState();
  const vis = getVisitor();
  if (!st || st.held) return;
  const b = nearestBottle();
  if (!b || !vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
  const p = isoFn(b.gx, b.gy);
  ctx.fillStyle = '#d4af37';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('[E] read the bottle', 130), Math.round(p.x), Math.round(p.y - 26 + Math.sin(now * 0.005) * 1));
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, maxW) {
  const words = String(text == null ? '' : text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width <= maxW) cur = test;
    else { if (cur) lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  if (!lines.length) lines.push('');
  if (lines.length > 4) return lines.slice(0, 4);
  return lines;
}

function drawOverlay(ctx, now) {
  const st = getState();
  const Vv = getV();
  if (!st || !st.overlay) return;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '11px monospace';
  const boxW = Math.min(cw - 40, 470);
  const pad = 12;
  const maxTextW = boxW - pad * 2;
  const lines = wrapText(ctx, st.overlay.line, maxTextW);
  const boxH = 58 + lines.length * 17;
  const bx = Math.round((cw - boxW) * 0.5);
  const by = Math.round(ch * 0.26);

  ctx.fillStyle = 'rgba(20,16,10,0.92)';
  ctx.fillRect(bx - 3, by - 3, boxW + 6, boxH + 6);
  ctx.fillStyle = '#d9c8a3';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 4, by + 4, boxW - 8, boxH - 8);

  drawGlass(ctx, bx + 16, by + 26);

  ctx.fillStyle = '#4a2f16';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('MESSAGE IN A BOTTLE', boxW - 60), bx + 28, by + 20);

  ctx.fillStyle = '#2b1d0e';
  ctx.font = '11px monospace';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(fitFn(lines[i], maxTextW), bx + pad, by + 42 + i * 17);
  }

  const prompt = '[E] toss it back to sea  (+1)';
  ctx.fillStyle = '#7a5230';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(fitFn(prompt, boxW - 20), bx + boxW * 0.5, by + boxH - 14);
  ctx.textAlign = 'left';
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  const now = (typeof Vv.nowTime === 'number' && Vv.nowTime) ? Vv.nowTime : nowFn();
  for (let i = 0; i < st.bottles.length; i++) drawBottle(ctx, st.bottles[i], now);
  drawHeld(ctx, now);
  drawCoins(ctx, now);
  drawHint(ctx, now);
  drawOverlay(ctx, now);
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  if (k === 'e' || k === ' ' || k === 'escape') prevPressed.add(k);
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

if (typeof window !== 'undefined') {
  if (!window.GuildBottleMessage) window.GuildBottleMessage = createState();
  const g = window.GuildBottleMessage;
  if (!Array.isArray(g.bottles)) g.bottles = [];
  if (!Array.isArray(g.coins)) g.coins = [];
  if (!Array.isArray(g.floats)) g.floats = [];
  if (typeof g.nextId !== 'number') g.nextId = 1;
  g.update = update;
  g.draw = draw;
  g.__keys = pressed;
  g.__probe = function () {
    const st = getState();
    return {
      bottles: st ? st.bottles.length : 0,
      held: !!(st && st.held),
      overlay: !!(st && st.overlay),
      coins: st ? st.coins.length : 0,
      lines: st ? st.bottles.map(function (b) { return b.line; }) : []
    };
  };
  if (!window.__gbmListeners) {
    window.__gbmListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
