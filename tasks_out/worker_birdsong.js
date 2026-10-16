const ROOSTS = [
  { gx: -5, gy: -11 },
  { gx: -7, gy: -13 }
];
const PENTATONIC = ['song_do', 'song_re', 'song_mi', 'song_sol', 'song_la'];
const COOLDOWN_MS = 4000;
const RANGE_TILES = 2;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildAviary; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

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
function cueFn(type) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(type); } catch (e) {}
  }
}
function randFn() {
  return Math.random();
}

function createState() {
  return {
    roosts: ROOSTS.map(function (r) {
      return { gx: r.gx, gy: r.gy, lastSong: -Infinity, hopStart: null, notes: [] };
    }),
    pressed: new Set(),
    prevPressed: new Set(),
    lastTime: null
  };
}

function visitorPos() {
  const vis = getVisitor();
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) return { gx: vis.gx, gy: vis.gy };
  return null;
}

function roostInRange(roost, vp) {
  if (!vp) return false;
  const d = Math.hypot(roost.gx - vp.gx, roost.gy - vp.gy);
  return d <= RANGE_TILES;
}

function trySong(st, now) {
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const vp = visitorPos();
  if (!vp) return;
  for (let i = 0; i < st.roosts.length; i++) {
    const r = st.roosts[i];
    if (now - r.lastSong < COOLDOWN_MS) continue;
    if (!roostInRange(r, vp)) continue;
    r.lastSong = now;
    r.hopStart = now;
    r.notes = [];
    for (let k = 0; k < 3; k++) {
      const type = PENTATONIC[Math.floor(randFn() * PENTATONIC.length)];
      cueFn(type);
      r.notes.push({ type: type, start: now + k * 160, y: 0 });
    }
    return;
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
  const st = getState();
  if (st) st.pressed.add(k);
  const Vv = getV();
  if (st && Vv && Vv.gameState === 'play' && k === 'e') {
    trySong(st, nowFn());
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  const st = getState();
  if (st) st.pressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    st.lastTime = now;
    return;
  }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const ePressed = st.pressed.has('e');
  const eWas = st.prevPressed.has('e');
  if (ePressed && !eWas) trySong(st, now);

  for (let i = 0; i < st.roosts.length; i++) {
    const r = st.roosts[i];
    const next = [];
    for (let j = 0; j < r.notes.length; j++) {
      const n = r.notes[j];
      const age = (now - n.start) / 1000;
      if (age < 0 || age > 1.4) continue;
      n.y = age * 26;
      next.push(n);
    }
    r.notes = next;
    if (r.hopStart !== null && now - r.hopStart > 700) r.hopStart = null;
  }
  st.prevPressed = new Set(st.pressed);
}

function drawRoost(ctx, r, now, inRange) {
  const pt = isoFn(r.gx, r.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const cooling = (now - r.lastSong) < COOLDOWN_MS;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 10, y - 2, 24, 4);

  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 2, y - 34, 4, 34);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 8, y - 34, 16, 3);

  let hop = 0;
  if (r.hopStart !== null) {
    const t = (now - r.hopStart) / 700;
    if (t >= 0 && t < 1) hop = Math.round(Math.abs(Math.sin(t * Math.PI * 2)) * 6);
  }
  const by = y - 36 - hop;

  ctx.fillStyle = '#b45309';
  ctx.fillRect(x - 4, by - 6, 9, 6);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(x - 3, by - 10, 7, 5);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 1, by - 9, 2, 2);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x + 3, by - 7, 3, 2);

  for (let j = 0; j < r.notes.length; j++) {
    const n = r.notes[j];
    const age = (now - n.start) / 1000;
    if (age < 0 || age > 1.4) continue;
    const a = Math.max(0, 1 - age / 1.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u266A', x + 6 + Math.sin(age * 6 + j) * 4, by - 16 - n.y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  if (inRange) {
    const label = cooling ? '...' : 'E: song';
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText(label).width;
    const pw = Math.round(tw) + 8;
    const px = x + 2 - Math.round(pw * 0.5);
    const py = by - 30;
    ctx.fillStyle = 'rgba(10,10,12,0.85)';
    ctx.fillRect(px, py, pw, 12);
    ctx.strokeStyle = cooling ? '#6b7280' : '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, 12);
    ctx.fillStyle = cooling ? '#9ca3af' : '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(label, pw - 4), px + pw * 0.5, py + 7);
    ctx.textAlign = 'left';
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;
  const now = nowFn();
  const vp = visitorPos();
  for (let i = 0; i < st.roosts.length; i++) {
    drawRoost(ctx, st.roosts[i], now, roostInRange(st.roosts[i], vp));
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildAviary) window.GuildAviary = createState();
  window.GuildAviary.update = update;
  window.GuildAviary.draw = draw;
  window.GuildAviary.__probe = function () {
    const st = getState();
    return {
      roosts: st.roosts.map(function (r) { return { gx: r.gx, gy: r.gy, cooling: (nowFn() - r.lastSong) < COOLDOWN_MS, notes: r.notes.length }; }),
      pressed: Array.from(st.pressed)
    };
  };
  window.GuildAviary.__trySong = function () { trySong(getState(), nowFn()); };
  if (!window.__gaListeners) {
    window.__gaListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
