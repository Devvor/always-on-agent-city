const POOL = { gx: -3.0, gy: -5.2, rx: 1.05, ry: 0.68 };
const RIPPLE_RANGE = 2.3;
const REFLECT_RANGE = 3.4;
const MAX_RIPPLES = 4;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildIceMirror; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function seeded(seed) { const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453; return x - Math.floor(x); }

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
function pathEllipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  const a = Math.max(0.5, rx);
  const b = Math.max(0.5, ry);
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(a, b);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
  }
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function countDone() {
  const w = root();
  const list = (w && Array.isArray(w.allTasks))
    ? w.allTasks
    : (w && w.V && Array.isArray(w.V.allTasks) ? w.V.allTasks : []);
  let n = 0;
  for (let i = 0; i < list.length; i++) if (list[i] && list[i].status === 'done') n++;
  return n;
}

function firstNum() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (typeof v === 'number' && isFinite(v)) return v;
  }
  return NaN;
}
function stateStr(o) {
  if (!o || typeof o !== 'object') return '';
  const s = (o.state != null) ? o.state : (o.mode != null ? o.mode : (o.status != null ? o.status : ''));
  return String(s);
}
function isAirborne(o) {
  if (!o || typeof o !== 'object') return false;
  if (o.flying === true || o.airborne === true || o.inAir === true) return true;
  const s = stateStr(o).toLowerCase();
  if (!s) return false;
  return /air|fly|fling|soar|glid|leav|arriv|depart|return|journey|hover|migrat|wing/.test(s);
}
function considerObject(obj, out, seen, depth) {
  if (!obj || typeof obj !== 'object' || depth > 2) return;
  if (seen.has(obj)) return;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length && i < 32; i++) considerObject(obj[i], out, seen, depth + 1);
    return;
  }
  const gx = firstNum(obj.gx, obj.gridX, obj.tileX);
  const gy = firstNum(obj.gy, obj.gridY, obj.tileY);
  if (isFinite(gx) && isFinite(gy) && isAirborne(obj)) {
    out.push({ gx: gx, gy: gy, state: stateStr(obj) });
  }
  const kids = ['bird', 'pigeon', 'owl', 'dove', 'gull', 'flock', 'birds', 'flyers', 'creatures'];
  for (let i = 0; i < kids.length; i++) {
    const c = obj[kids[i]];
    if (c) considerObject(c, out, seen, depth + 1);
  }
}
function collectBirds() {
  const w = root();
  const out = [];
  if (!w) return out;
  const seen = new Set();
  let keys = [];
  try { keys = Object.keys(w); } catch (e) { keys = []; }
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.indexOf('Guild') !== 0) continue;
    const lk = k.toLowerCase();
    if (!(lk.indexOf('bird') !== -1 || lk.indexOf('aviary') !== -1 || lk.indexOf('fauna') !== -1 ||
          lk.indexOf('owl') !== -1 || lk.indexOf('pigeon') !== -1 || lk.indexOf('roost') !== -1 ||
          lk.indexOf('wing') !== -1 || lk.indexOf('flock') !== -1 || lk.indexOf('gull') !== -1 ||
          lk.indexOf('dove') !== -1 || lk.indexOf('duck') !== -1)) continue;
    const mod = w[k];
    if (!mod || typeof mod !== 'object') continue;
    considerObject(mod, out, seen, 0);
    try {
      if (typeof mod.__probe === 'function') considerObject(mod.__probe(), out, seen, 1);
    } catch (e) {}
    if (out.length >= 16) break;
  }
  return out.slice(0, 16);
}

function visitorProximity() {
  const vis = getVisitor();
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    return Math.hypot(vis.gx - POOL.gx, vis.gy - POOL.gy) <= RIPPLE_RANGE;
  }
  return null;
}

function createState() {
  return {
    lastTime: null,
    pressed: new Set(),
    prev: new Set(),
    ripples: [],
    birds: [],
    done: 0,
    lastRipple: 0
  };
}

function handleInteract(st, now) {
  const near = visitorProximity();
  if (near === false) return;
  const p = isoFn(POOL.gx, POOL.gy);
  st.ripples.push({ x: p.x, y: p.y, start: now, dur: 1.1 });
  if (st.ripples.length > MAX_RIPPLES) st.ripples.splice(0, st.ripples.length - MAX_RIPPLES);
  st.lastRipple = now;
  cueFn('pop');
}

function onKeydown(e) {
  const k = normKey(e);
  if (k !== 'e') return;
  const st = getState();
  if (!st || !st.pressed) return;
  st.pressed.add('e');
}
function onKeyup(e) {
  const k = normKey(e);
  if (k !== 'e') return;
  const st = getState();
  if (!st || !st.pressed) return;
  st.pressed.delete('e');
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') { st.lastTime = now; return; }
  if (st.lastTime === null || st.lastTime === undefined) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  if (!st.pressed) st.pressed = new Set();
  if (!st.prev) st.prev = new Set();
  const eNow = st.pressed.has('e');
  const ePrev = st.prev.has('e');
  if (eNow && !ePrev) handleInteract(st, now);
  st.prev = new Set(st.pressed);

  st.birds = collectBirds();
  st.done = countDone();

  const next = [];
  if (Array.isArray(st.ripples)) {
    for (let i = 0; i < st.ripples.length; i++) {
      const r = st.ripples[i];
      const age = (now - r.start) / 1000;
      if (age >= 0 && age < r.dur) next.push(r);
    }
  }
  st.ripples = next;
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const g = Vv.grid;
  if (!g) return;
  const now = nowFn();

  const p = isoFn(POOL.gx, POOL.gy);
  if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  const R = Math.hypot(POOL.rx, POOL.ry);
  const sx = Math.max(7, (g.tileW * 0.5) * R);
  const sy = Math.max(4, (g.tileH * 0.5) * R);

  const nf = (typeof Vv.nightFactor === 'number') ? clamp(Vv.nightFactor, 0, 1) : 0;
  const wf = (typeof Vv.weatherFactor === 'number') ? Vv.weatherFactor : 0;
  const done = st.done || 0;

  ctx.save();

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(30,41,59,0.55)';
  pathEllipse(ctx, cx, cy, sx + 3, sy + 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const grad = ctx.createRadialGradient(cx, cy - sy * 0.3, 1, cx, cy, sx);
  grad.addColorStop(0, 'rgba(219,234,254,0.92)');
  grad.addColorStop(0.6, 'rgba(191,219,254,0.86)');
  grad.addColorStop(1, 'rgba(147,197,253,0.74)');
  ctx.fillStyle = grad;
  pathEllipse(ctx, cx, cy, sx, sy);
  ctx.fill();

  pathEllipse(ctx, cx, cy, sx, sy);
  ctx.clip();

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  pathEllipse(ctx, cx - sx * 0.25, cy - sy * 0.38, sx * 0.5, sy * 0.4);
  ctx.fill();
  ctx.globalAlpha = 1;

  const crackCount = 4 + (done % 4);
  ctx.strokeStyle = 'rgba(232,230,223,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < crackCount; i++) {
    const a = seeded(i * 13.7 + 1.1) * Math.PI * 2;
    const j = (seeded(i * 3.3 + 5.5) - 0.5) * 0.5;
    const r0 = 0.15 + seeded(i * 7.3 + 2.7) * 0.3;
    const r1 = 0.55 + seeded(i * 5.1 + 3.9) * 0.5;
    const x0 = cx + Math.cos(a) * sx * r0;
    const y0 = cy + Math.sin(a) * sy * r0;
    const x1 = cx + Math.cos(a + j) * sx * r1;
    const y1 = cy + Math.sin(a + j) * sy * r1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  if (nf > 0.12) {
    const c = Vv.canvas;
    const moonX = c ? c.width * 0.72 : cx;
    const smearX = cx + clamp((moonX - cx) * 0.05, -sx * 0.3, sx * 0.3);
    const alpha = (0.10 + 0.30 * nf) * (1 - 0.4 * wf);
    ctx.save();
    ctx.translate(smearX, cy);
    ctx.scale(0.40, 1);
    const rg = ctx.createRadialGradient(0, 0, 1, 0, 0, sy * 1.6);
    rg.addColorStop(0, 'rgba(255,255,255,' + clamp(alpha * 1.1, 0, 0.6) + ')');
    rg.addColorStop(0.45, 'rgba(232,230,223,' + clamp(alpha * 0.8, 0, 0.5) + ')');
    rg.addColorStop(1, 'rgba(191,219,254,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, sy * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = clamp(alpha * 0.9, 0, 0.5);
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(Math.round(smearX) - 1, Math.round(cy - sy * 0.15), 2, 2);
    ctx.globalAlpha = 1;
  }

  const birds = Array.isArray(st.birds) ? st.birds : [];
  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    if (!b || !isFinite(b.gx) || !isFinite(b.gy)) continue;
    const tileD = Math.hypot(b.gx - POOL.gx, b.gy - POOL.gy);
    if (tileD > REFLECT_RANGE) continue;
    const bp = isoFn(b.gx, b.gy);
    const prox = clamp(1 - tileD / REFLECT_RANGE, 0, 1);
    const rx2 = cx + (bp.x - cx) * 0.5;
    const ry2 = cy + (bp.y - cy) * 0.14;
    const alpha = clamp((0.15 + 0.35 * prox) * (0.6 + 0.4 * nf), 0, 0.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#334155';
    const ix = Math.round(rx2);
    const iy = Math.round(ry2);
    ctx.fillRect(ix - 2, iy - 1, 4, 2);
    ctx.fillRect(ix - 4, iy - 2, 3, 1);
    ctx.fillRect(ix + 2, iy - 2, 3, 1);
    ctx.globalAlpha = 1;
  }

  const ripples = Array.isArray(st.ripples) ? st.ripples : [];
  for (let i = 0; i < ripples.length; i++) {
    const r = ripples[i];
    const age = (now - r.start) / 1000;
    if (age < 0 || age >= r.dur) continue;
    const t = age / r.dur;
    for (let k = 0; k < 2; k++) {
      const tt = clamp(t - k * 0.12, 0, 1);
      if (tt <= 0.001) continue;
      const rr = 0.25 + tt * 0.95;
      ctx.globalAlpha = clamp((1 - tt) * (0.35 - k * 0.12), 0, 0.4);
      ctx.strokeStyle = (k === 0) ? '#ffffff' : '#bfdbfe';
      ctx.lineWidth = 1;
      pathEllipse(ctx, r.x, r.y, sx * rr, sy * rr);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();

  if (visitorProximity() === true) {
    const text = fitFn('E: ripple the ice', 118);
    const boxW = 122;
    const boxH = 14;
    const bx = cx - Math.round(boxW * 0.5);
    const by = cy - sy - 22;
    ctx.fillStyle = 'rgba(10,10,12,0.85)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, by + boxH * 0.5 + 1);
    ctx.textAlign = 'left';
  }

  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildIceMirror) window.GuildIceMirror = createState();
  const st = window.GuildIceMirror;
  if (!(st.pressed instanceof Set)) st.pressed = new Set();
  if (!(st.prev instanceof Set)) st.prev = new Set();
  if (!Array.isArray(st.ripples)) st.ripples = [];
  if (!Array.isArray(st.birds)) st.birds = [];
  st.update = update;
  st.draw = draw;
  st.__rawUpdate = update;
  st.__keys = st.pressed;
  st.__probe = function () {
    const s = getState();
    return {
      birds: (s && Array.isArray(s.birds)) ? s.birds.length : 0,
      ripples: (s && Array.isArray(s.ripples)) ? s.ripples.length : 0,
      near: visitorProximity(),
      done: s ? s.done : 0
    };
  };
  if (!window.__gimListeners) {
    window.__gimListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
