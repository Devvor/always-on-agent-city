const RING_LIFE = 0.9;
const RING_COOLDOWN = 1000;
const REACT_DURATION = 2.0;
const NEAR_TILES = 3;
const RING_MAX = 6;
const ACCENT = '#d4af37';
const ACCENT_SOFT = '#f3d37a';
const ACCENT_BRIGHT = '#facc15';
const ACCENT_PALE = '#fde68a';

const LABELS = { wave: 'WAVE', cheer: 'CHEER', sit: 'SIT', point: 'POINT' };
const KEY_KINDS = { '1': 'wave', '2': 'cheer', '3': 'sit', '4': 'point' };
const KINDS = { wave: 1, cheer: 1, sit: 1, point: 1 };

let lastTime = null;
let lastEmoteId = null;
let lastRingAt = -Infinity;
let ownKey = null;
let rings = [];
let reactions = [];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getGE() { const w = root(); return w && w.GuildEmotes; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildEmoteRing; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

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
  try { const w = root(); if (w && typeof w.cue === 'function') w.cue(name); } catch (e) {}
}

function kindFromKey(key) {
  if (key == null) return null;
  const k = String(key);
  if (KEY_KINDS[k]) return KEY_KINDS[k];
  const lower = k.toLowerCase();
  if (KINDS[lower]) return lower;
  return null;
}
function validKind(kind) { return typeof kind === 'string' && !!KINDS[kind]; }

function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function faceDir(w, vp) {
  const dx = vp.x - w.x;
  const dy = vp.y - w.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

function activeTaskCount() {
  const Vv = getV();
  const w = root();
  const all = (Vv && Vv.allTasks) || (w && w.allTasks);
  if (!Array.isArray(all)) return 0;
  let n = 0;
  for (let i = 0; i < all.length; i++) {
    const st = all[i] && all[i].status;
    if (st === 'pending' || st === 'in_progress') n++;
  }
  return n;
}

function reactWorkers(kind, now) {
  const Vv = getV();
  const vis = getVisitor();
  if (!Vv || !vis) return;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  if (!ws.length) return;
  const g = Vv.grid;
  const vp = isoFn(vis.gx, vis.gy);
  const until = now + REACT_DURATION * 1000;
  const busy = activeTaskCount() > 0;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w || !isFinite(w.x) || !isFinite(w.y)) continue;
    let near = false;
    if (g) near = tileDistance(w.x, w.y, vp.x, vp.y, g) <= NEAR_TILES;
    else near = Math.hypot(w.x - vp.x, w.y - vp.y) <= 96;
    if (!near) continue;
    const dir = faceDir(w, vp);
    let replaced = false;
    for (let r = 0; r < reactions.length; r++) {
      if (reactions[r].index === i) {
        reactions[r].kind = kind;
        reactions[r].dir = dir;
        reactions[r].start = now;
        reactions[r].until = until;
        reactions[r].busy = busy;
        replaced = true;
        break;
      }
    }
    if (!replaced) reactions.push({ index: i, kind: kind, dir: dir, start: now, until: until, busy: busy });
    if (!w.moving) w.facing = dir;
  }
}

function trigger(kind, now) {
  if (!validKind(kind)) return;
  const vis = getVisitor();
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
  if (now - lastRingAt < RING_COOLDOWN) return;
  lastRingAt = now;
  const pt = isoFn(vis.gx, vis.gy);
  rings.push({ x: pt.x, y: pt.y + 17, born: now, kind: kind });
  while (rings.length > RING_MAX) rings.shift();
  reactWorkers(kind, now);
  if (kind === 'cheer' && !getGE()) cueSafe('done');
}

function detectEmote() {
  const ge = getGE();
  if (ge && ge.current && typeof ge.current === 'object') {
    const c = ge.current;
    let kind = c.kind || c.type || c.name;
    if (!validKind(kind)) kind = kindFromKey(c.key != null ? c.key : c.id);
    if (validKind(kind)) {
      const id = (typeof c.start === 'number' ? c.start : '') + ':' + (c.key != null ? c.key : kind);
      return { id: id, kind: kind };
    }
  }
  const vis = getVisitor();
  if (vis && vis.emote) {
    const e = vis.emote;
    if (typeof e === 'object') {
      let kind = e.kind || e.type || e.name;
      if (!validKind(kind)) kind = kindFromKey(e.key != null ? e.key : e.id);
      if (validKind(kind)) {
        const id = (typeof e.start === 'number' ? e.start : '') + ':' + (e.key != null ? e.key : kind);
        return { id: id, kind: kind };
      }
    } else {
      const kind = kindFromKey(e);
      if (kind) return { id: String(e) + ':' + (vis.emoteAt || ''), kind: kind };
    }
  }
  return null;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const st = getState();
  if (!Vv || Vv.gameState !== 'play' || !st) { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const emote = detectEmote();
  if (emote) {
    if (emote.id !== lastEmoteId) {
      lastEmoteId = emote.id;
      trigger(emote.kind, now);
    }
  } else {
    lastEmoteId = null;
    if (ownKey != null) {
      const k = ownKey;
      ownKey = null;
      const kind = kindFromKey(k);
      if (kind) trigger(kind, now);
    }
  }

  if (rings.length) {
    const kept = [];
    for (let i = 0; i < rings.length; i++) {
      if (now - rings[i].born <= RING_LIFE * 1000) kept.push(rings[i]);
    }
    rings = kept;
  }

  if (reactions.length) {
    const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
    const kept = [];
    for (let i = 0; i < reactions.length; i++) {
      const r = reactions[i];
      if (now >= r.until) continue;
      const w = ws[r.index];
      if (w && !w.moving) w.facing = r.dir;
      kept.push(r);
    }
    reactions = kept;
  }

  st.rings = rings;
  st.reactions = reactions;
  st.lastRingAt = lastRingAt;
}

function strokeEllipse(ctx, x, y, rx, ry) {
  if (!(rx > 0) || !(ry > 0)) return;
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawChevron(ctx, x, y, dir) {
  ctx.fillStyle = ACCENT_SOFT;
  if (dir === 'right') {
    ctx.fillRect(x + 6, y - 4, 2, 2);
    ctx.fillRect(x + 8, y - 2, 2, 2);
    ctx.fillRect(x + 10, y, 2, 2);
    ctx.fillRect(x + 8, y + 2, 2, 2);
    ctx.fillRect(x + 6, y + 4, 2, 2);
  } else if (dir === 'left') {
    ctx.fillRect(x + 6, y - 4, 2, 2);
    ctx.fillRect(x + 4, y - 2, 2, 2);
    ctx.fillRect(x + 2, y, 2, 2);
    ctx.fillRect(x + 4, y + 2, 2, 2);
    ctx.fillRect(x + 6, y + 4, 2, 2);
  } else if (dir === 'up') {
    ctx.fillRect(x - 4, y - 6, 2, 2);
    ctx.fillRect(x - 2, y - 4, 2, 2);
    ctx.fillRect(x, y - 2, 2, 2);
    ctx.fillRect(x + 2, y - 4, 2, 2);
    ctx.fillRect(x + 4, y - 6, 2, 2);
  } else {
    ctx.fillRect(x - 4, y + 6, 2, 2);
    ctx.fillRect(x - 2, y + 4, 2, 2);
    ctx.fillRect(x, y + 2, 2, 2);
    ctx.fillRect(x + 2, y + 4, 2, 2);
    ctx.fillRect(x + 4, y + 6, 2, 2);
  }
}

function drawFlourish(ctx, r, w, now) {
  const phase = (now - r.start) / 1000;
  const cx = Math.round(w.x) + 8;
  const cy = Math.round(w.y);
  const a = clamp(1 - (now - r.start) / (REACT_DURATION * 1000), 0, 1);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * a;
  if (r.kind === 'wave') {
    const swing = Math.round(Math.sin(phase * 9) * 3);
    ctx.fillStyle = ACCENT_BRIGHT;
    ctx.fillRect(cx - 5 + swing, cy - 26, 2, 8);
    ctx.fillRect(cx + 3 - swing, cy - 28, 2, 9);
  } else if (r.kind === 'cheer') {
    const lift = Math.round(Math.abs(Math.sin(phase * 7)) * 2);
    ctx.fillStyle = ACCENT_PALE;
    ctx.fillRect(cx - 6, cy - 26 - lift, 2, 8);
    ctx.fillRect(cx + 4, cy - 26 - lift, 2, 8);
    ctx.fillStyle = r.busy ? ACCENT_BRIGHT : ACCENT_PALE;
    ctx.fillRect(cx - 7, cy - 29 - lift, 1, 1);
    ctx.fillRect(cx + 6, cy - 30 - lift, 1, 1);
  } else if (r.kind === 'sit') {
    ctx.fillStyle = ACCENT;
    ctx.fillRect(cx - 4, cy + 14, 8, 2);
    ctx.fillStyle = ACCENT_SOFT;
    ctx.fillRect(cx - 3, cy + 10, 6, 1);
  } else if (r.kind === 'point') {
    drawChevron(ctx, cx, cy - 20, r.dir);
  }
  ctx.restore();
}

function drawCaption(ctx, x, y, label, alpha) {
  if (!label) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 9px monospace';
  const text = fitFn(label, 56);
  const tw = ctx.measureText(text).width;
  const bw = Math.max(28, Math.round(tw) + 10);
  const bh = 12;
  const bx = Math.round(x - bw * 0.5);
  const by = Math.round(y);
  ctx.fillStyle = 'rgba(10,10,12,0.80)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 1, by + 1, bw - 2, bh - 2);
  ctx.clip();
  ctx.fillStyle = ACCENT_SOFT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + bw * 0.5, by + bh * 0.5 + 1);
  ctx.restore();
  ctx.restore();
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const g = Vv.grid || { tileW: 70, tileH: 35 };

  ctx.save();
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const age = (now - r.born) / 1000;
    if (age < 0 || age > RING_LIFE) continue;
    const p = age / RING_LIFE;
    const spread = 0.35 + p * 1.9;
    const rx = (g.tileW * 0.5) * spread;
    const ry = (g.tileH * 0.5) * spread;
    const a = (1 - p) * 0.55;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT_SOFT;
    strokeEllipse(ctx, r.x, r.y, rx, ry);
    ctx.globalAlpha = a * 0.6;
    ctx.lineWidth = 1;
    ctx.strokeStyle = ACCENT;
    strokeEllipse(ctx, r.x, r.y, rx * 0.66, ry * 0.66);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  for (let i = 0; i < reactions.length; i++) {
    const r = reactions[i];
    if (now >= r.until) continue;
    const w = ws[r.index];
    if (!w) continue;
    drawFlourish(ctx, r, w, now);
  }

  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const age = (now - r.born) / 1000;
    if (age < 0 || age > RING_LIFE) continue;
    const a = (1 - age / RING_LIFE) * 0.92;
    if (a <= 0) continue;
    drawCaption(ctx, r.x, r.y + 18, LABELS[r.kind] || '', a);
  }
}

function onKeydown(e) {
  const k = (e && e.key != null) ? String(e.key) : '';
  if (!KEY_KINDS[k]) return;
  if (getGE()) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  ownKey = k;
}

function createState() {
  return { rings: [], reactions: [], lastRingAt: -Infinity };
}

if (typeof window !== 'undefined') {
  if (!window.GuildEmoteRing || typeof window.GuildEmoteRing !== 'object') {
    window.GuildEmoteRing = createState();
  }
  const st = window.GuildEmoteRing;
  if (!Array.isArray(st.rings)) st.rings = [];
  if (!Array.isArray(st.reactions)) st.reactions = [];
  if (typeof st.lastRingAt !== 'number') st.lastRingAt = -Infinity;
  st.update = update;
  st.draw = draw;
  st.__probe = function () {
    return {
      rings: rings.length,
      reactions: reactions.length,
      lastRingAt: lastRingAt,
      lastEmoteId: lastEmoteId
    };
  };
  if (!window.__gerListeners) {
    window.__gerListeners = true;
    window.addEventListener('keydown', onKeydown);
  }
}

export {};
