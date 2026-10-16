// GuildTideCombs - T168: S-rim driftwood tide-combs that sift coins or a real board-history line.
const REACH = 1.5;
const COOLDOWN = 60000;
const SIFT_DUR = 2000;
const SCRAP_LIFE = 6000;
const MIN_SEP = 2.0;

const ANCHORS = [
  { gx: 1.5, gy: 6.8 },
  { gx: 4.5, gy: 7.2 }
];

let eHeld = false;
let lastNow = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildTideCombs; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') { try { return w.iso(gx, gy); } catch (e) { return null; } }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') { try { return w.fitText(text, maxW); } catch (e) {} }
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

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function createState() {
  return { combs: [], sifting: null, lastSift: 0, loot: [] };
}

function islandBounds() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Math.floor(Vv.growthStep) : 0;
  return { s: s, min: -2 - s, max: 1 + s };
}

// Zone clearance: named S-rim neighbours the combs must stand 2+ tiles from.
function propPoints() {
  const w = root();
  const b = islandBounds();
  const list = [];
  list.push({ gx: 4.5, gy: 7.5 });
  const fh = w && w.GuildFishhut;
  if (fh && fh.hut && isFinite(fh.hut.gx) && isFinite(fh.hut.gy)) list.push({ gx: fh.hut.gx, gy: fh.hut.gy });
  else list.push({ gx: 3.2, gy: 5.2 });
  list.push({ gx: 3.0, gy: 5.5 });
  const tp = w && w.GuildTidepools;
  if (tp && Array.isArray(tp.pools) && tp.pools.length) {
    for (let i = 0; i < tp.pools.length; i++) {
      const p = tp.pools[i];
      if (p && isFinite(p.gx) && isFinite(p.gy)) list.push({ gx: p.gx, gy: p.gy });
    }
  } else {
    list.push({ gx: 1, gy: 6 });
    list.push({ gx: 2, gy: 7 });
    list.push({ gx: 3, gy: 6 });
  }
  list.push({ gx: clamp(3, b.min, b.max), gy: b.max });
  return list;
}

function resolveCombs() {
  const b = islandBounds();
  const avoid = propPoints();
  const out = [];
  for (let c = 0; c < ANCHORS.length; c++) {
    const a = ANCHORS[c];
    const gy = clamp(a.gy, b.min + 0.5, b.max - 0.5);
    const startGx = clamp(a.gx, b.min, b.max);
    let placed = null;
    for (let step = 0; step <= 48 && !placed; step++) {
      const dirs = (step === 0) ? [0] : [step, -step];
      for (let d = 0; d < dirs.length && !placed; d++) {
        const gx = clamp(startGx + dirs[d] * 0.5, b.min, b.max);
        if (tileRing(Math.floor(gx), Math.floor(gy)) > b.s) continue;
        let ok = true;
        for (let i = 0; i < avoid.length && ok; i++) {
          if (Math.hypot(avoid[i].gx - gx, avoid[i].gy - gy) < MIN_SEP) ok = false;
        }
        for (let j = 0; j < out.length && ok; j++) {
          if (Math.hypot(out[j].gx - gx, out[j].gy - gy) < MIN_SEP) ok = false;
        }
        if (ok) placed = { gx: gx, gy: gy };
      }
    }
    if (!placed) placed = { gx: startGx, gy: gy };
    out.push(placed);
  }
  return out;
}

function syncCombs(st) {
  const pos = resolveCombs();
  if (!Array.isArray(st.combs)) st.combs = [];
  while (st.combs.length < pos.length) st.combs.push({ id: st.combs.length, gx: pos[st.combs.length].gx, gy: pos[st.combs.length].gy, lastSift: 0 });
  if (st.combs.length > pos.length) st.combs.length = pos.length;
  for (let i = 0; i < st.combs.length; i++) {
    const comb = st.combs[i];
    comb.gx = pos[i].gx;
    comb.gy = pos[i].gy;
    comb.id = i;
    if (typeof comb.lastSift !== 'number') comb.lastSift = 0;
  }
}

function distToVisitor(comb) {
  const vis = getVisitor();
  if (!comb || !vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return Infinity;
  return Math.hypot(vis.gx - comb.gx, vis.gy - comb.gy);
}
function nearestComb() {
  const st = getState();
  if (!st || !Array.isArray(st.combs) || !st.combs.length) return null;
  let best = null;
  let bd = Infinity;
  for (let i = 0; i < st.combs.length; i++) {
    const d = distToVisitor(st.combs[i]);
    if (d <= REACH && d < bd) { bd = d; best = st.combs[i]; }
  }
  return best;
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
function taskId(t) {
  if (!t) return '';
  if (t.id != null) return String(t.id);
  if (t.key != null) return String(t.key);
  return '';
}
function taskTitle(t) {
  if (!t) return '';
  if (t.title != null) return String(t.title);
  if (t.name != null) return String(t.name);
  if (t.id != null) return String(t.id);
  return '';
}
function doneTasks() {
  const w = root();
  const Vv = getV();
  const lists = [];
  if (Vv && Array.isArray(Vv.allTasks)) lists.push(Vv.allTasks);
  if (w && Array.isArray(w.allTasks)) lists.push(w.allTasks);
  let list = [];
  for (let i = 0; i < lists.length; i++) {
    if (lists[i] && lists[i].length) { list = lists[i]; break; }
  }
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (t && isDone(rawStatus(t)) && (t.id != null || t.title != null || t.name != null)) out.push(t);
  }
  return out;
}

function startSift(comb, now) {
  const st = getState();
  if (!st || !comb || st.sifting) return;
  const last = (typeof comb.lastSift === 'number') ? comb.lastSift : 0;
  if (now - last < COOLDOWN) return;
  comb.lastSift = now;
  st.lastSift = now;
  const grains = [];
  for (let i = 0; i < 3; i++) {
    grains.push({
      vx: (i - 1) * 13 + (Math.random() - 0.5) * 8,
      vy: -16 - Math.random() * 10,
      delay: i * 0.18
    });
  }
  st.sifting = { t0: now, dur: SIFT_DUR, comb: comb, grains: grains };
  cueFn('coin');
}

function finishSift(now) {
  const st = getState();
  if (!st || !st.sifting) return;
  const s = st.sifting;
  const comb = s.comb || (st.combs[0] || null);
  const pool = doneTasks();
  if (comb && pool.length && Math.random() < 0.4) {
    const t = pool[Math.floor(Math.random() * pool.length)];
    const id = taskId(t);
    const title = taskTitle(t);
    st.loot.push({ kind: 'scrap', gx: comb.gx, gy: comb.gy, text: (id ? id + '  ' : '') + title, start: now, life: SCRAP_LIFE });
    cueFn('done');
  } else {
    const base = comb ? isoFn(comb.gx, comb.gy) : { x: 0, y: 0 };
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      st.loot.push({
        kind: 'coin',
        x: base.x + (Math.random() - 0.5) * 8,
        y: base.y - 2,
        vx: (Math.random() - 0.5) * 14,
        rise: 16 + Math.random() * 12,
        start: now + i * 90,
        life: 1000 + Math.random() * 400
      });
    }
    cueFn('gold');
  }
  st.sifting = null;
}

function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') { lastNow = now; return; }
  lastNow = now;

  syncCombs(st);

  if (st.sifting && now - st.sifting.t0 >= st.sifting.dur) finishSift(now);

  if (!Array.isArray(st.loot)) st.loot = [];
  const kept = [];
  for (let i = 0; i < st.loot.length; i++) {
    const l = st.loot[i];
    if (typeof l.start !== 'number') l.start = now;
    if (now - l.start < l.life) kept.push(l);
  }
  st.loot = kept;
}

function drawComb(ctx, comb, now, sifting) {
  const p = isoFn(comb.gx, comb.gy);
  if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
  let jig = 0;
  if (sifting && sifting.comb === comb) {
    const t = clamp((now - sifting.t0) / sifting.dur, 0, 1);
    jig = Math.sin(t * Math.PI * 6) * 1.6 * (1 - t);
  }
  const x = Math.round(p.x + jig);
  const y = Math.round(p.y);

  ctx.fillStyle = 'rgba(148,163,184,0.16)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(x - 10, y + 2, 22, 3);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 9, y - 4, 18, 5);
  ctx.fillStyle = '#5a3f25';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 8 + i * 5, y + 1, 2, 5);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 9, y - 4, 18, 1);

  const glint = 0.5 + 0.5 * Math.sin(now * 0.002 + comb.id * 1.7);
  if (glint > 0.86) {
    ctx.fillStyle = '#f3d37a';
    ctx.fillRect(x - 8 + Math.round(((glint - 0.86) / 0.14) * 14), y - 4, 2, 1);
  }
}

function drawSift(ctx, now) {
  const st = getState();
  if (!st || !st.sifting || !st.sifting.comb) return;
  const s = st.sifting;
  const p = isoFn(s.comb.gx, s.comb.gy) || { x: 0, y: 0 };
  for (let i = 0; i < s.grains.length; i++) {
    const g = s.grains[i];
    const age = (now - s.t0) / 1000 - g.delay;
    if (age <= 0) continue;
    const a = Math.max(0, 1 - age / 0.9);
    if (a <= 0) continue;
    const gx = p.x + g.vx * age;
    const gy = p.y - 3 + g.vy * age + 50 * age * age;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d8d3c5';
    ctx.fillRect(Math.round(gx), Math.round(gy), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawScrap(ctx, l, now) {
  const life = (typeof l.life === 'number') ? l.life : SCRAP_LIFE;
  const age = now - l.start;
  if (age < 0 || age > life) return;
  const p = isoFn(l.gx, l.gy);
  if (!p || !isFinite(p.x) || !isFinite(p.y)) return;

  let a = 1;
  if (age < 300) a = age / 300;
  else if (age > life - 600) a = Math.max(0, (life - age) / 600);

  ctx.font = '9px monospace';
  const label = fitFn(l.text, 150);
  const tw = ctx.measureText(label).width;
  const w = Math.round(Math.min(150, tw)) + 12;
  const h = 16;
  const x = Math.round(p.x - w * 0.5);
  const y = Math.round(p.y - 30);

  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f4e8c1';
  ctx.beginPath();
  ctx.moveTo(p.x - 3, y + h);
  ctx.lineTo(p.x + 3, y + h);
  ctx.lineTo(p.x, y + h + 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.fillStyle = '#4a2f16';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + h * 0.5 + 1);
  ctx.globalAlpha = 1;
}

function drawLoot(ctx, now) {
  const st = getState();
  if (!st || !Array.isArray(st.loot) || !st.loot.length) return;
  for (let i = 0; i < st.loot.length; i++) {
    const l = st.loot[i];
    if (l.kind === 'coin') {
      if (now < l.start) continue;
      const t = clamp((now - l.start) / l.life, 0, 1);
      const e = easeOutCubic(t);
      const x = Math.round(l.x + l.vx * e);
      const y = Math.round(l.y - l.rise * e);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (l.kind === 'scrap') {
      drawScrap(ctx, l, now);
    }
  }
}

function drawHint(ctx, now) {
  const st = getState();
  if (!st || st.sifting) return;
  const vis = getVisitor();
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
  const comb = nearestComb();
  if (!comb) return;
  const p = isoFn(comb.gx, comb.gy);
  if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
  const ready = (now - (comb.lastSift || 0)) >= COOLDOWN;
  const label = fitFn('[E] SIFT', 90);
  const bx = Math.round(p.x);
  const by = Math.round(p.y - 16 + Math.sin(now * 0.005) * 1);
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(10,10,12,0.75)';
  ctx.fillText(label, bx + 1, by + 1);
  ctx.fillStyle = ready ? '#d4af37' : 'rgba(212,175,55,0.55)';
  ctx.fillText(label, bx, by);
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  const now = (typeof lastNow === 'number' && isFinite(lastNow)) ? lastNow : nowFn();
  if (!Array.isArray(st.combs)) st.combs = [];
  for (let i = 0; i < st.combs.length; i++) drawComb(ctx, st.combs[i], now, st.sifting);
  drawSift(ctx, now);
  drawLoot(ctx, now);
  drawHint(ctx, now);
}

function onKeydown(e) {
  const k = normKey(e);
  if (k !== 'e') return;
  if (eHeld) return;
  eHeld = true;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const comb = nearestComb();
  if (comb) {
    startSift(comb, nowFn());
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}
function onKeyup(e) {
  const k = normKey(e);
  if (k !== 'e') return;
  eHeld = false;
}

if (typeof window !== 'undefined') {
  if (!window.GuildTideCombs || typeof window.GuildTideCombs !== 'object') window.GuildTideCombs = createState();
  const st = window.GuildTideCombs;
  if (!Array.isArray(st.combs)) st.combs = [];
  if (!Array.isArray(st.loot)) st.loot = [];
  if (st.sifting === undefined) st.sifting = null;
  if (typeof st.lastSift !== 'number') st.lastSift = 0;
  st.update = update;
  st.draw = draw;
  st.__probe = function () {
    const s = getState();
    let treasury = null;
    const w = root();
    if (w && w.GuildEconomy && typeof w.GuildEconomy === 'object') {
      const eco = w.GuildEconomy;
      if (typeof eco.treasury === 'number') treasury = eco.treasury;
      else if (typeof eco.coins === 'number') treasury = eco.coins;
    }
    return {
      combs: (s && Array.isArray(s.combs)) ? s.combs.length : 0,
      sifting: !!(s && s.sifting),
      loot: (s && Array.isArray(s.loot)) ? s.loot.length : 0,
      treasury: treasury
    };
  };
  if (!window.__gtcListeners) {
    window.__gtcListeners = true;
    try {
      window.addEventListener('keydown', onKeydown);
      window.addEventListener('keyup', onKeyup);
    } catch (e) {}
  }
}

export {};
