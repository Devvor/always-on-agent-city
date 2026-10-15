const CEREMONY_MS = 6000;
const POLE_RISE_MS = 700;
const POLE_H = 34;
const POLE_HALF = 34;
const SPOT_START = 300;
const SPOT_MS = 2000;
const BANNER_START = 900;
const BANNER_MS = 1200;
const BANNER_W = 176;
const BANNER_H = 26;
const BUBBLE_AT = 1500;
const BUBBLE_MS = 3200;
const BURST_TIMES = [1100, 2300, 3500];
const HEART_MS = 1400;
const THANKS_MS = 2600;
const CONGRAT_TILES = 2.5;
const HEARTH = { gx: 0, gy: -1 };
const MIN_PROP_TILES = 2;
const ARCHETYPES = ['glitch', 'poet', 'rookie', 'philosopher'];
const PROP_TILES = [
  { gx: -8, gy: 2.5 }, { gx: -7.5, gy: -5 }, { gx: 7.5, gy: 0.5 }, { gx: -4.5, gy: 6 },
  { gx: -1, gy: -1 }, { gx: 2.5, gy: -2.5 }, { gx: -2, gy: 2 }, { gx: 1, gy: 1 }
];
const SPOKEN = {
  glitch: ['01101 \u2014 the name is real (probably)', 'ha! swapped the honor, kept the glitch', 'i am legal now. frightening.'],
  poet: ['the fire remembers every borrowed name.', 'i will fold this night into a line.', 'gold is only light that stayed to listen.'],
  rookie: ['FIRST TRY!! i got a name!!', 'look \u2014 that banner says ME!!', 'best day!! wait till the others see!!'],
  philosopher: ['a name is a campfire others can find.', 'to be named is to be expected of.', 'the quiet keeps what the loud forgets.']
};
const THANKS = {
  glitch: 'th4nk y0u \u2014 01101',
  poet: 'thank you for the light.',
  rookie: 'THANK YOU!! so much!!',
  philosopher: 'thank you. the fire heard.'
};

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildNamingDay; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

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
function cueSafe(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}

function firstWord(name) {
  const parts = String(name == null ? '' : name).trim().split(/\s+/);
  return parts[0] || 'someone';
}
function archetypeFor(index, name) {
  const n = String(name == null ? '' : name).toLowerCase();
  if (n.indexOf('missingno') !== -1) return 'glitch';
  if (n.indexOf('laguna') !== -1) return 'rookie';
  if (n.indexOf('step') !== -1) return 'poet';
  if (n.indexOf('longcat') !== -1) return 'philosopher';
  return ARCHETYPES[index % ARCHETYPES.length];
}
function bannerFor(archetype, name) {
  if (archetype === 'glitch') return name + ', the Glitch of Honor';
  if (archetype === 'poet') return firstWord(name) + ' unfolds like a quiet verse';
  if (archetype === 'rookie') return 'FIRST TRY!! ' + name.toUpperCase() + "'S NAMING DAY!!";
  return name + ', who keeps the fire\u2019s patience';
}
function nextSpoken(st, archetype) {
  const lines = SPOKEN[archetype] || SPOKEN.philosopher;
  if (!st.cursor || typeof st.cursor !== 'object') st.cursor = {};
  let i = st.cursor[archetype];
  if (typeof i !== 'number' || !isFinite(i)) i = 0;
  const line = lines[i % lines.length];
  st.cursor[archetype] = (i + 1) % lines.length;
  return line;
}

function propClearance(ax, ay) {
  let min = Infinity;
  for (let i = 0; i < PROP_TILES.length; i++) {
    const p = PROP_TILES[i];
    const d = Math.hypot(ax - p.gx, ay - p.gy);
    if (d < min) min = d;
  }
  return min;
}
function hearthAnchor() {
  let best = null;
  let bestScore = -Infinity;
  for (let sx = -3; sx <= 2; sx++) {
    for (let sy = -4; sy <= 1; sy++) {
      const ax = sx + 0.5;
      const ay = sy + 0.5;
      const dh = Math.hypot(ax - HEARTH.gx, ay - HEARTH.gy);
      if (dh > 2.4) continue;
      const c = propClearance(ax, ay);
      const score = (c >= MIN_PROP_TILES ? 1000 : 0) + c * 4 - dh;
      if (score > bestScore) { bestScore = score; best = { gx: ax, gy: ay }; }
    }
  }
  return best || { gx: HEARTH.gx, gy: HEARTH.gy };
}

function visitorGrid() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return null;
  return { gx: vis.gx, gy: vis.gy };
}
function visitorDistanceTo(anchor) {
  const v = visitorGrid();
  if (!v || !anchor) return Infinity;
  return Math.hypot(v.gx - anchor.gx, v.gy - anchor.gy);
}
function visitorScreen() {
  const v = visitorGrid();
  if (!v) return null;
  return isoFn(v.gx, v.gy);
}
function workerPos(Vv, index) {
  const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  const w = ws[index];
  if (!w) return null;
  if (!isFinite(w.x) || !isFinite(w.y)) return null;
  return { x: w.x, y: w.y };
}

function spawnBurst(st, x, y) {
  if (!Array.isArray(st.sparks)) st.sparks = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 22 + Math.random() * 44;
    st.sparks.push({
      x: x, y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 8,
      age: 0, life: 0.55 + Math.random() * 0.4,
      size: 2,
      color: Math.random() < 0.5 ? '#facc15' : '#ffe066'
    });
  }
}
function stepSparks(st, dt) {
  if (!Array.isArray(st.sparks)) { st.sparks = []; return; }
  const next = [];
  for (let i = 0; i < st.sparks.length; i++) {
    const p = st.sparks[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy = p.vy * 0.96 + 46 * dt;
    next.push(p);
  }
  st.sparks = next;
}

function startCeremony(st, Vv, now) {
  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  if (!workers.length) return false;
  const start = (typeof st.rotation === 'number') ? st.rotation : 0;
  let idx = -1;
  for (let n = 0; n < workers.length; n++) {
    const i = (start + n) % workers.length;
    const meta = workers[i];
    if (meta && meta.name != null && String(meta.name).trim()) { idx = i; break; }
  }
  if (idx < 0) return false;
  st.rotation = (idx + 1) % workers.length;
  const meta = workers[idx] || {};
  const name = String(meta.name != null ? meta.name : (idx === 0 ? 'MISSINGNO' : 'WORKER ' + (idx + 1)));
  const archetype = archetypeFor(idx, name);
  st.ceremonies = (st.ceremonies || 0) + 1;
  st.active = {
    workerIndex: idx,
    name: name,
    archetype: archetype,
    bannerText: bannerFor(archetype, name),
    bubbleText: nextSpoken(st, archetype),
    anchor: hearthAnchor(),
    start: now,
    duration: CEREMONY_MS,
    bubble: null,
    bubbleSpawned: false,
    bursts: 0,
    congratulated: false
  };
  cueSafe('levelup');
  return true;
}

function stepCeremony(st, now) {
  const a = st.active;
  if (!a) return;
  const age = now - a.start;
  if (!a.bubbleSpawned && age >= BUBBLE_AT) {
    a.bubbleSpawned = true;
    a.bubble = { text: a.bubbleText, start: now };
  }
  if (a.bubble && (now - a.bubble.start) >= BUBBLE_MS) a.bubble = null;
  while (a.bursts < BURST_TIMES.length && age >= BURST_TIMES[a.bursts]) {
    const pt = isoFn(a.anchor.gx, a.anchor.gy);
    spawnBurst(st, pt.x + (Math.random() - 0.5) * 44, pt.y - 32 - a.bursts * 8);
    a.bursts += 1;
  }
  if (age >= a.duration) st.active = null;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  stepSparks(st, dt);
  if (st.active) stepCeremony(st, now);

  if (typeof st.cool !== 'number' || !isFinite(st.cool)) st.cool = 0;
  st.cool -= dt;
  if (st.cool <= 0) {
    const started = startCeremony(st, Vv, now);
    st.cool = started ? (150 + Math.random() * 60) : (5 + Math.random() * 5);
  }
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  if (k !== 'e') return;
  const Vv = getV();
  const st = getState();
  if (!Vv || Vv.gameState !== 'play' || !st || !st.active) return;
  if (st.active.congratulated) return;
  if (visitorDistanceTo(st.active.anchor) > CONGRAT_TILES) return;
  st.active.congratulated = true;
  const now = nowFn();
  st.heart = { start: now, workerIndex: st.active.workerIndex };
  st.thanks = { start: now, text: THANKS[st.active.archetype] || 'thank you!', workerIndex: st.active.workerIndex };
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
}

function drawPole(ctx, x, baseY, h) {
  if (h <= 0) return;
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 1, baseY - h, 3, h);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - 2, baseY - h - 3, 5, 3);
}
function drawBunting(ctx, x1, y1, x2, y2, now) {
  const sag = 8;
  const midX = (x1 + x2) * 0.5;
  const midY = (y1 + y2) * 0.5 + sag;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, midY + sag, x2, y2);
  ctx.stroke();
  const n = 7;
  ctx.fillStyle = '#facc15';
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const mt = 1 - t;
    const px = mt * mt * x1 + 2 * mt * t * midX + t * t * x2;
    const py = mt * mt * y1 + 2 * mt * t * (midY + sag) + t * t * y2;
    const sway = Math.sin(now * 0.004 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 3, py);
    ctx.lineTo(px + 3, py);
    ctx.lineTo(px + sway, py + 6);
    ctx.closePath();
    ctx.fill();
  }
}
function drawWorkerSpot(ctx, Vv, a, age) {
  if (age < SPOT_START || age > SPOT_START + SPOT_MS) return;
  const p = workerPos(Vv, a.workerIndex);
  if (!p) return;
  const t = clamp((age - SPOT_START) / SPOT_MS, 0, 1);
  const alpha = Math.sin(t * Math.PI);
  if (alpha <= 0.02) return;
  const cx = Math.round(p.x) + 8;
  const baseY = Math.round(p.y) + 16;
  const topY = baseY - 104;
  const topHalf = 3;
  const botHalf = 22;
  const grad = ctx.createLinearGradient(0, topY, 0, baseY);
  grad.addColorStop(0, 'rgba(255,236,150,0)');
  grad.addColorStop(0.4, 'rgba(255,214,102,' + (0.22 * alpha).toFixed(3) + ')');
  grad.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - topHalf, topY);
  ctx.lineTo(cx + topHalf, topY);
  ctx.lineTo(cx + botHalf, baseY);
  ctx.lineTo(cx - botHalf, baseY);
  ctx.closePath();
  ctx.fill();
  if (ctx.ellipse) {
    ctx.globalAlpha = 0.20 * alpha;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawBanner(ctx, cx, topY, a, age) {
  const p = clamp((age - BANNER_START) / BANNER_MS, 0, 1);
  if (p <= 0) return;
  const e = easeOut(p);
  const h = Math.round(BANNER_H * e);
  if (h <= 1) return;
  const w = BANNER_W;
  const bx = Math.round(cx - w * 0.5);
  const by = Math.round(topY + 3);
  ctx.save();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx, by);
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,16,10,0.94)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, w, h);
  ctx.beginPath();
  ctx.rect(bx + 1, by + 1, w - 2, h - 2);
  ctx.clip();
  ctx.globalAlpha = e;
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(a.bannerText, w - 10), cx, by + h * 0.5 + 1);
  ctx.restore();
}
function drawBubble(ctx, wx, wy, text, alpha, yOff) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.font = '10px monospace';
  const shown = fitFn(text, 150);
  const tw = ctx.measureText(shown).width;
  const bw = Math.max(48, Math.round(tw + 12));
  const bh = 16;
  const x = Math.round(wx + 8 - bw * 0.5);
  const y = Math.round(wy - (yOff == null ? 78 : yOff));
  const tipX = Math.round(wx + 8);
  const tipY = Math.round(wy - 20);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.beginPath();
  ctx.moveTo(Math.round(x + bw * 0.5 - 3), y + bh);
  ctx.lineTo(Math.round(x + bw * 0.5 + 3), y + bh);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x + bw * 0.5 - 3), y + bh);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.round(x + bw * 0.5 + 3), y + bh);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.strokeRect(x, y, bw, bh);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, x + 6, y + bh * 0.5);
  ctx.restore();
}
function drawSparks(ctx, st) {
  if (!Array.isArray(st.sparks) || !st.sparks.length) return;
  for (let i = 0; i < st.sparks.length; i++) {
    const p = st.sparks[i];
    const a = Math.max(0, 1 - (p.age / p.life));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawHeart(ctx, Vv, st, now) {
  const h = st.heart;
  if (!h) return;
  const age = (now - h.start) / 1000;
  const dur = HEART_MS / 1000;
  if (!isFinite(age) || age < 0 || age >= dur) { st.heart = null; return; }
  const p = workerPos(Vv, h.workerIndex);
  if (!p) { st.heart = null; return; }
  const rise = age / dur;
  const x = Math.round(p.x) + 8;
  const y = Math.round(p.y) - 14 - Math.round(rise * 26);
  ctx.save();
  ctx.globalAlpha = 1 - rise;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - 3, y - 1, 2, 2);
  ctx.fillRect(x + 1, y - 1, 2, 2);
  ctx.fillRect(x - 2, y + 1, 6, 2);
  ctx.fillRect(x - 1, y + 3, 4, 2);
  ctx.fillRect(x, y + 5, 2, 2);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x - 2, y - 1, 1, 1);
  ctx.restore();
}
function drawThanks(ctx, Vv, st, now) {
  const t = st.thanks;
  if (!t) return;
  const age = (now - t.start) / 1000;
  const dur = THANKS_MS / 1000;
  if (!isFinite(age) || age < 0 || age >= dur) { st.thanks = null; return; }
  const p = workerPos(Vv, t.workerIndex);
  if (!p) { st.thanks = null; return; }
  const alpha = age <= dur - 0.8 ? 1 : Math.max(0, (dur - age) / 0.8);
  drawBubble(ctx, p.x, p.y, t.text, alpha, 62);
}
function drawHint(ctx, Vv, st, now) {
  const a = st.active;
  if (!a || a.congratulated) return;
  if (visitorDistanceTo(a.anchor) > CONGRAT_TILES) return;
  const vp = visitorScreen();
  if (!vp) return;
  const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.006));
  const text = '[E] CONGRATULATE';
  ctx.save();
  ctx.font = 'bold 9px monospace';
  const tw = ctx.measureText(text).width;
  const w = Math.round(tw) + 12;
  const h = 14;
  const x = Math.round(vp.x + 8 - w * 0.5);
  const y = Math.round(vp.y - 52);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w * 0.5, y + h * 0.5 + 1);
  ctx.restore();
}
function drawCeremony(ctx, Vv, st, now) {
  const a = st.active;
  const age = now - a.start;
  if (age < 0 || age > a.duration) return;
  const base = isoFn(a.anchor.gx, a.anchor.gy);
  const cx = Math.round(base.x);
  const groundY = Math.round(base.y) + 6;
  const poleH = Math.round(POLE_H * easeOut(clamp(age / POLE_RISE_MS, 0, 1)));
  const leftX = cx - POLE_HALF;
  const rightX = cx + POLE_HALF;
  drawPole(ctx, leftX, groundY, poleH);
  drawPole(ctx, rightX, groundY, poleH);
  if (poleH > 3) drawBunting(ctx, leftX, groundY - poleH, rightX, groundY - poleH, now);
  drawWorkerSpot(ctx, Vv, a, age);
  if (poleH > 6) drawBanner(ctx, cx, groundY - poleH, a, age);
  if (a.bubble) {
    const p = workerPos(Vv, a.workerIndex);
    if (p) {
      const bAge = (now - a.bubble.start) / 1000;
      const bDur = BUBBLE_MS / 1000;
      const alpha = bAge <= bDur - 1 ? 1 : Math.max(0, bDur - bAge);
      drawBubble(ctx, p.x, p.y, a.bubble.text, alpha, 80);
    }
  }
}
function draw(ctx) {
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const st = getState();
  if (!st) return;
  const now = nowFn();
  drawSparks(ctx, st);
  if (st.active) drawCeremony(ctx, Vv, st, now);
  drawHeart(ctx, Vv, st, now);
  drawThanks(ctx, Vv, st, now);
  drawHint(ctx, Vv, st, now);
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildNamingDay) window.GuildNamingDay = { ceremonies: 0, active: null, cool: 0 };
  const g = window.GuildNamingDay;
  if (typeof g.rotation !== 'number') g.rotation = 0;
  if (!Array.isArray(g.sparks)) g.sparks = [];
  if (!g.cursor || typeof g.cursor !== 'object') g.cursor = {};
  if (typeof g.cool !== 'number') g.cool = 0;
  g.update = update;
  g.draw = draw;
  g.__probe = function () { return { ceremonies: g.ceremonies || 0, activeName: g.active ? g.active.name : null }; };
  if (!window.__gndListeners) {
    window.__gndListeners = true;
    window.addEventListener('keydown', onKeydown, true);
  }
}

export {};
