const ANCHOR = { gx: 4, gy: -2.8 };   // SE heroes' plaza (x 4..6, y -3..-1), 2+ tiles clear of statues/props
const MAX_DAYS = 7;
const SHOW_DAYS = 3;
const NEAR_DIST = 1.6;
const VOICE_COLORS = {
  missingno: '#facc15',
  laguna: '#22c55e',
  deepseek: '#3b82f6',
  step5: '#e8e6df',
  longcat: '#e8e6df',
  guild: '#d4af37'
};

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildRivalryBoard; }
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
function isNum(v) { return typeof v === 'number' && isFinite(v); }

function tileRing(gx, gy) {
  function layer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(layer(gx), layer(gy));
}

function dateKeyLocal(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
function shiftDayKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKeyLocal(d);
}
function hashStr(str) {
  let h = 2166136261 >>> 0;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

function voiceKeyForName(name) {
  const n = String(name == null ? '' : name).toLowerCase();
  const keys = ['missingno', 'deepseek', 'laguna', 'step5', 'longcat'];
  for (let i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) !== -1) return keys[i];
  return null;
}
function voiceColorFor(key) { return VOICE_COLORS[key] || VOICE_COLORS.guild; }

// Fallback voice canon (used when worker_personality.js is absent). Mirrors the
// archetypes: missingno glitchy trickster, laguna eager rookie, deepseek earnest
// newcomer, step5 aloof poet, longcat serene philosopher.
function swapPairs(s) {
  const chars = s.split('');
  for (let i = 0; i + 1 < chars.length; i += 5) {
    if (/[A-Za-z]/.test(chars[i]) && /[A-Za-z]/.test(chars[i + 1])) {
      const t = chars[i]; chars[i] = chars[i + 1]; chars[i + 1] = t;
    }
  }
  return chars.join('');
}
function localVoice(key, fact, rng) {
  let s = String(fact == null ? '' : fact).replace(/\s+/g, ' ').trim();
  if (key === 'missingno') {
    s = swapPairs(s);
    if (s.length % 2 === 0) s += ' 01101';
    return s;
  }
  if (key === 'laguna') {
    if (!/!/.test(s)) s += '!!';
    else s = s.replace(/!+$/, '!!');
    if (s.toLowerCase().indexOf('first try') < 0 && rng() < 0.6) s = s.replace(/!!$/, ' first try!!');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (key === 'deepseek') {
    const pre = ['honestly, ', 'i checked the logs: ', 'new here, but ', 'for the record: '];
    const post = [' ...i think.', ' (correct me.)', ' ...correct?', ''];
    return pre[Math.floor(rng() * pre.length)] + s.toLowerCase() + post[Math.floor(rng() * post.length)];
  }
  if (key === 'step5') {
    let t = s.toLowerCase();
    const words = t.split(' ');
    if (words.length > 7) t = words.slice(0, 7).join(' ') + '...';
    if (!/\.\.\./.test(t)) t += '...';
    const pre = ['rain over ', 'a gray morning: ', 'soft letter: ', ''];
    return pre[Math.floor(rng() * pre.length)] + t;
  }
  if (key === 'longcat') {
    let t = s.toLowerCase();
    if (!/\.\.\./.test(t)) t += '...';
    return t;
  }
  return s;
}
function canonLine(name, fact, rng) {
  const w = root();
  const key = voiceKeyForName(name);
  const gp = w && w.GuildPersonality;
  if (gp && gp.voices && key && gp.voices[key]) {
    const v = gp.voices[key];
    const style = Array.isArray(v.style) ? v.style : (Array.isArray(v.lines) ? v.lines : null);
    if (style && style.length) {
      const tpl = String(style[Math.floor(rng() * style.length)]);
      let out = tpl.replace(/\{line\}/g, String(fact));
      if (typeof v.decorate === 'function') { try { out = v.decorate(out); } catch (e) {} }
      if (out && typeof out === 'string') return out;
    }
  }
  return localVoice(key, fact, rng);
}

function scanRetries(ticks) {
  const arr = Array.isArray(ticks) ? ticks : [];
  let count = 0;
  let num = 0;
  for (let i = 0; i < arr.length; i++) {
    const line = tickText(arr[i]).toLowerCase();
    if (/retry|retries|retried|attempt|tries|\btry\b/.test(line)) {
      count++;
      const m = line.match(/(\d+)/);
      if (m) {
        const v = parseInt(m[1], 10);
        if (v > num) num = v;
      }
    }
  }
  return { count: count, num: num };
}
function workerStats(Vv) {
  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  const out = [];
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i] || {};
    const name = (w.name != null) ? String(w.name) : ('worker ' + (i + 1));
    if (!name) continue;
    const tasks = Array.isArray(w.tasks) ? w.tasks : [];
    let done = 0, failed = 0, pending = 0;
    for (let t = 0; t < tasks.length; t++) {
      const st = String((tasks[t] && tasks[t].status) || '').toLowerCase();
      if (st === 'done') done++;
      else if (st === 'failed') failed++;
      else pending++;
    }
    const rr = scanRetries(w.recentTicks);
    out.push({ index: i, name: name, done: done, failed: failed, pending: pending, retry: rr.count, retryNum: rr.num });
  }
  return out;
}
function mostRecentFailure(Vv) {
  const all = Array.isArray(Vv.allTasks) ? Vv.allTasks : [];
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    if (t && String(t.status || '').toLowerCase() === 'failed') return t;
  }
  return null;
}
function hasFreshData(Vv) {
  if (mostRecentFailure(Vv)) return true;
  const stats = workerStats(Vv);
  for (let i = 0; i < stats.length; i++) if (stats[i].done > 0 || stats[i].failed > 0 || stats[i].retry > 0) return true;
  return false;
}

function result(name, fact, angle, rng, fallback) {
  const key = voiceKeyForName(name);
  let text;
  try { text = canonLine(name, fact, rng); } catch (e) { text = fact; }
  return {
    text: String(text == null ? fact : text),
    name: String(name == null ? '' : name),
    voiceKey: key || 'guild',
    color: voiceColorFor(key),
    angle: angle,
    fallback: !!fallback
  };
}
function pickLine(Vv, dayKey) {
  const seed = hashStr(dayKey);
  const rng = makeRng(seed);
  const stats = workerStats(Vv);
  const recentFail = mostRecentFailure(Vv);

  const viable = [];
  if (stats.length && stats.some(function (s) { return s.done > 0; })) viable.push('ship');
  if (stats.some(function (s) { return s.retry > 0 || s.failed > 0; })) viable.push('retry');
  if (recentFail) viable.push('failure');

  if (!viable.length) {
    const hero = stats.length ? stats[Math.floor(rng() * stats.length)] : null;
    const name = hero ? hero.name : 'the guild';
    return result(name, 'the board is blank... nobody has shipped, failed, or retried yet', 'idle', rng, true);
  }

  const angle = viable[Math.floor(rng() * viable.length)];

  if (angle === 'ship') {
    const order = stats.slice().sort(function (a, b) { return (b.done - a.done) || a.name.localeCompare(b.name); });
    const hero = order[0];
    const rival = order.length > 1 ? order[order.length - 1] : null;
    const fact = rival
      ? hero.name + ' out-shipped ' + rival.name + ' ' + hero.done + '-' + rival.done + ', and ' + rival.name + ' is still on ' + rival.pending
      : hero.name + ' shipped ' + hero.done + ' and expects applause';
    return result(hero.name, fact, angle, rng, false);
  }

  if (angle === 'retry') {
    const order = stats.slice().sort(function (a, b) { return ((b.retry + b.failed) - (a.retry + a.failed)) || a.name.localeCompare(b.name); });
    const hero = order[0];
    const rival = order.length > 1 ? order[order.length - 1] : null;
    const n = hero.retryNum > 0 ? hero.retryNum : (hero.retry || hero.failed || 1);
    const fact = rival
      ? hero.name + ' burned ' + n + ' retries; ' + rival.name + ' swears theirs was one try'
      : hero.name + ' is on retry number ' + n;
    return result(hero.name, fact, angle, rng, false);
  }

  const order = stats.slice().sort(function (a, b) { return (b.done - a.done) || a.name.localeCompare(b.name); });
  const hero = order.length ? order[0] : { name: 'the guild' };
  const failId = (recentFail && recentFail.id != null) ? recentFail.id
    : ((recentFail && recentFail.title != null) ? recentFail.title : 'a quest');
  const fact = hero.name + ' watched ' + failId + ' fail, and had... thoughts';
  return result(hero.name, fact, angle, rng, false);
}

function createState() {
  return {
    anchor: { gx: ANCHOR.gx, gy: ANCHOR.gy },
    x: 0, y: 0, visible: false, near: false,
    open: false, dayKey: null, days: [], lastToggle: 0, _seeded: false
  };
}
function addDay(S, day, line, stamp) {
  S.days = S.days.filter(function (d) { return d.day !== day; });
  S.days.push(Object.assign({ day: day, stamp: stamp }, line));
  if (S.days.length > MAX_DAYS) S.days = S.days.slice(-MAX_DAYS);
}
function visitorNear(S) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isNum(vis.gx) || !isNum(vis.gy)) return false;
  if (!isNum(S.anchor.gx) || !isNum(S.anchor.gy)) return false;
  return Math.hypot(vis.gx - S.anchor.gx, vis.gy - S.anchor.gy) <= NEAR_DIST;
}
function cueSafe(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

let pressed = new Set();
let prevPressed = new Set();
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function toggleOpen(S, now, e) {
  S.open = !S.open;
  S.lastToggle = now;
  if (S.open) cueSafe('alert');
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
}
function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const Vv = getV();
  const S = getState();
  if (S && Vv && Vv.gameState === 'play' && S.visible && S.near && k === 'e' && !prevPressed.has('e')) {
    toggleOpen(S, nowFn(), e);
    prevPressed.add(k);
    return;
  }
  if (S && S.open && k === 'escape') {
    S.open = false;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
  if (k === 'e') prevPressed.add(k);
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const S = getState();
  const Vv = getV();
  if (!S || !Vv) return;

  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  S.visible = s >= tileRing(ANCHOR.gx, ANCHOR.gy);
  const pt = isoFn(ANCHOR.gx, ANCHOR.gy);
  S.x = Math.round(pt.x);
  S.y = Math.round(pt.y);
  S.near = S.visible && visitorNear(S);

  if (Vv.gameState !== 'play') return;

  if (!S._seeded) {
    S._seeded = true;
    for (let back = SHOW_DAYS - 1; back >= 0; back--) {
      const k = shiftDayKey(back);
      addDay(S, k, pickLine(Vv, k), now - back * 60000);
    }
    S.dayKey = dateKeyLocal(new Date());
    return;
  }

  const today = dateKeyLocal(new Date());
  if (S.dayKey !== today) {
    S.dayKey = today;
    addDay(S, today, pickLine(Vv, today), now);
    cueSafe('alert');
    return;
  }

  const last = S.days[S.days.length - 1];
  if (last && last.fallback && hasFreshData(Vv)) {
    S.days[S.days.length - 1] = Object.assign({ day: today, stamp: now }, pickLine(Vv, today));
  }

  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');
  if (S.visible && S.near && !eWas && ePressed) toggleOpen(S, now, null);
  prevPressed = new Set(pressed);
}

function wrapLines(text, maxW, maxLines) {
  const words = String(text == null ? '' : text).split(' ');
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const cand = cur ? (cur + ' ' + words[i]) : words[i];
    if (fitFn(cand, maxW) === cand) {
      cur = cand;
    } else {
      if (cur) lines.push(cur);
      cur = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (!lines.length) lines.push('');
  return lines.slice(0, maxLines).map(function (l) { return fitFn(l, maxW); });
}

function drawBoard(ctx, S, Vv, now) {
  const x = S.x;
  const y = S.y;

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 18, y + 3, 36, 5);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 22, y - 52, 4, 56);
  ctx.fillRect(x + 18, y - 52, 4, 56);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 36, y - 58, 72, 46);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(x - 34, y - 56, 68, 42);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 34, y - 56, 68, 2);
  ctx.fillRect(x - 34, y - 16, 68, 2);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 9; i++) {
    const sx = x - 31 + ((i * 17) % 62);
    const sy = y - 52 + ((i * 11) % 34);
    ctx.fillRect(sx, sy, 2, 1);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 7px monospace';
  ctx.fillStyle = '#d4af37';
  ctx.fillText('RIVALRY', x, y - 51);

  const latest = S.days[S.days.length - 1];
  const nw = 60, nh = 34;
  const nx = x - Math.round(nw / 2);
  const ny = y - 47;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(nx + 1, ny + 2, nw, nh);
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(nx, ny, nw, nh);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(nx + 0.5, ny + 0.5, nw - 1, nh - 1);

  const color = (latest && latest.color) ? latest.color : '#d4af37';
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, ny + 1, 3, 3);

  ctx.textAlign = 'left';
  ctx.font = '8px monospace';
  ctx.fillStyle = (latest && latest.color === '#e8e6df') ? '#3a342f' : color;
  const lines = wrapLines(latest ? latest.text : '...', nw - 10, 3);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], nx + 5, ny + 10 + i * 10);
  }

  if (latest && latest.name) {
    ctx.font = 'bold 6px monospace';
    ctx.fillStyle = '#d4af37';
    ctx.fillText(fitFn(String(latest.name).toUpperCase(), nw - 10), nx + 5, ny + nh - 4);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (S.near) {
    ctx.font = 'bold 8px monospace';
    const hint = S.open ? '[E] CLOSE' : '[E] READ';
    const tw = ctx.measureText(hint).width;
    const pw = Math.round(tw) + 10;
    const px = x - Math.round(pw / 2);
    const py = y - 72;
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(px, py, pw, 12);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, 11);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint, px + pw / 2, py + 7);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function drawPanel(ctx, S, Vv, now) {
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const entries = S.days.slice(-SHOW_DAYS).reverse();
  const w = Math.min(canvas.width - 24, 244);
  const h = 34 + Math.max(1, entries.length) * 40 + 18;
  let px = Math.round(S.x - w / 2);
  let py = Math.round(S.y - h - 66);
  px = clamp(px, 6, Math.max(6, canvas.width - w - 6));
  py = clamp(py, 6, Math.max(6, canvas.height - h - 6));

  ctx.fillStyle = 'rgba(13,19,36,0.96)';
  ctx.fillRect(px, py, w, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px + 1, py + 1, w - 2, h - 2);
  ctx.clip();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(fitFn('RIVALRY BOARD', w - 16), px + 8, py + 14);

  const todayKey = dateKeyLocal(new Date());
  let yy = py + 30;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const day = (e.day === todayKey) ? 'TODAY' : String(e.day || '').slice(5);
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#d4af37';
    ctx.fillText(day, px + 8, yy + 5);

    const who = e.name ? String(e.name).toUpperCase() : 'GUILD';
    const whoFit = fitFn(who, w - 80);
    ctx.fillStyle = e.color || '#e8e6df';
    ctx.font = 'bold 9px monospace';
    const whoW = ctx.measureText(whoFit).width;
    ctx.fillText(whoFit, px + w - 8 - whoW, yy + 5);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#e8e6df';
    const lines = wrapLines(e.text || '', w - 16, 2);
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(lines[li], px + 8, yy + 18 + li * 11);
    }
    yy += 40;
  }

  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#d4af37';
  ctx.fillText('[E] CLOSE', px + 8, py + h - 11);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function draw(ctx) {
  const S = getState();
  const Vv = getV();
  if (!ctx || !S || !Vv || Vv.gameState !== 'play') return;
  if (!S.visible) return;
  const now = nowFn();
  drawBoard(ctx, S, Vv, now);
  if (S.open) drawPanel(ctx, S, Vv, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildRivalryBoard || typeof window.GuildRivalryBoard !== 'object') {
    window.GuildRivalryBoard = createState();
  } else {
    const S = window.GuildRivalryBoard;
    if (!S.anchor || !isNum(S.anchor.gx) || !isNum(S.anchor.gy)) S.anchor = { gx: ANCHOR.gx, gy: ANCHOR.gy };
    if (!Array.isArray(S.days)) S.days = [];
    if (typeof S.open !== 'boolean') S.open = false;
    if (typeof S.visible !== 'boolean') S.visible = false;
    if (typeof S._seeded !== 'boolean') S._seeded = false;
  }
  const S = window.GuildRivalryBoard;
  S.update = update;
  S.draw = draw;
  S.__probe = function () {
    return {
      gx: S.anchor.gx, gy: S.anchor.gy, visible: S.visible, open: S.open,
      dayKey: S.dayKey, days: S.days.length,
      latest: S.days.length ? S.days[S.days.length - 1].text : null,
      pressed: Array.from(pressed)
    };
  };
  S.__rawUpdate = update;
  if (!window.__grbListeners) {
    window.__grbListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
