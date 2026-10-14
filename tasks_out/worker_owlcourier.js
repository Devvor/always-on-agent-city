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
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getOwl() { const w = root(); return w && w.GuildOwlCourier; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function createState() { return { gx: -2.5, gy: -5.0, state: 'perched', deliveries: 0 }; }
function worldToTile(px, py, Vv) {
  const g = Vv && Vv.grid;
  if (!g) return { gx: 0, gy: 0 };
  const a = (px - g.originX) / (g.tileW * 0.5);
  const b = (py - g.originY) / (g.tileH * 0.5);
  return { gx: (a + b) * 0.5, gy: (b - a) * 0.5 };
}
function easeOutCubic(t) { t = clamp(t == null ? 0 : t, 0, 1); return 1 - Math.pow(1 - t, 3); }

const HOME_GX = -2.5;
const HOME_GY = -5.0;
let lastTime = null;
let pressed = new Set();
let prevPressed = new Set();
let cooldownUntil = 0;
let flightMode = null;
let flightStart = 0;
let flightDuration = 0;
let flightFrom = { gx: HOME_GX, gy: HOME_GY };
let flightTo = { gx: HOME_GX, gy: HOME_GY };
let targetIndex = -1;
let delivered = false;
let arrivalAt = 0;
let scrollBubbleWorker = -1;
let scrollBubbleUntil = 0;
let landingPuffed = true;

function getWorkingPool(Vv) {
  const workers = Array.isArray(Vv && Vv.workers) ? Vv.workers : [];
  const states = Array.isArray(Vv && Vv.workerStates) ? Vv.workerStates : [];
  const active = [];
  const working = [];
  for (let i = 0; i < workers.length; i++) {
    const meta = workers[i] || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : [];
    const hasActive = tasks.some(function (t) { return !!t && (t.status === 'pending' || t.status === 'in_progress'); });
    let isWorking = hasActive;
    if (!isWorking && states[i] && states[i].workerState === 'WORKING') isWorking = true;
    if (!isWorking && tasks.length > 0 && tasks.some(function (t) { return !!t && t.status !== 'done'; })) isWorking = true;
    if (hasActive) active.push(i);
    else if (isWorking) working.push(i);
  }
  return active.length ? active : working;
}

function puffAt(gx, gy) {
  try {
    const Vv = getV();
    if (!Vv || !Array.isArray(Vv.particles)) return;
    if (typeof Vv.particleId !== 'number') Vv.particleId = 0;
    const pt = isoFn(gx, gy);
    for (let i = 0; i < 6; i++) {
      Vv.particles.push({
        id: Vv.particleId++,
        kind: 'puff',
        x: pt.x + (Math.random() - 0.5) * 10,
        y: pt.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20,
        vy: -8 - Math.random() * 12,
        phase: Math.random() * Math.PI * 2,
        life: 0.6 + Math.random() * 0.4,
        age: 0,
        size: 3,
        color: 'rgba(235,230,220,0.9)'
      });
    }
  } catch (e) {}
}

function attemptSend(now) {
  if (typeof now !== 'number') now = nowFn();
  try {
    const owl = getOwl();
    const Vv = getV();
    const vis = getVisitor();
    if (!owl || !Vv || Vv.gameState !== 'play') return;
    if (owl.state !== 'perched') return;
    if (now < cooldownUntil) return;
    if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return;
    if (Math.hypot(owl.gx - vis.gx, owl.gy - vis.gy) > 1.5) return;
    const pool = getWorkingPool(Vv);
    if (!pool.length) return;
    const ri = pool[Math.floor(Math.random() * pool.length)];
    const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
    const w = states[ri];
    if (!w || !isFinite(w.x) || !isFinite(w.y)) return;
    const target = worldToTile(w.x + 8, w.y - 4, Vv);
    targetIndex = ri;
    flightMode = 'toWorker';
    flightFrom = { gx: owl.gx, gy: owl.gy };
    flightTo = target;
    const dx = flightTo.gx - flightFrom.gx;
    const dy = flightTo.gy - flightFrom.gy;
    flightDuration = Math.max(400, (Math.hypot(dx, dy) / 4) * 1000);
    flightStart = now;
    delivered = false;
    arrivalAt = 0;
    scrollBubbleWorker = -1;
    scrollBubbleUntil = 0;
    owl.state = 'flying';
    owl.gx = flightFrom.gx;
    owl.gy = flightFrom.gy;
    cooldownUntil = now + 10000;
    landingPuffed = false;
    puffAt(owl.gx, owl.gy);
  } catch (e) {}
}

function updateFlight(now, owl) {
  if (!owl || owl.state !== 'flying') return;
  try {
    let guard = 0;
    while (guard++ < 8 && owl.state === 'flying') {
      let progressed = false;
      if (flightMode === 'toWorker') {
        const progress = clamp((now - flightStart) / Math.max(1, flightDuration), 0, 1);
        const e = easeOutCubic(progress);
        owl.gx = flightFrom.gx + (flightTo.gx - flightFrom.gx) * e;
        owl.gy = flightFrom.gy + (flightTo.gy - flightFrom.gy) * e;
        if (progress >= 1 && !delivered) {
          delivered = true;
          arrivalAt = flightStart + flightDuration;
          scrollBubbleWorker = targetIndex;
          scrollBubbleUntil = arrivalAt + 3000;
          try {
            const r = root();
            if (r && typeof r.cue === 'function') r.cue('done');
          } catch (e) {}
          owl.deliveries = (typeof owl.deliveries === 'number' ? owl.deliveries : 0) + 1;
          progressed = true;
        }
        if (delivered) {
          owl.gx = flightTo.gx;
          owl.gy = flightTo.gy;
          if (now >= arrivalAt + 3000) {
            flightMode = 'toHome';
            flightFrom = { gx: flightTo.gx, gy: flightTo.gy };
            flightTo = { gx: HOME_GX, gy: HOME_GY };
            const dx = flightTo.gx - flightFrom.gx;
            const dy = flightTo.gy - flightFrom.gy;
            flightDuration = Math.max(400, (Math.hypot(dx, dy) / 4) * 1000);
            flightStart = arrivalAt + 3000;
            progressed = true;
          }
        }
      } else if (flightMode === 'toHome') {
        const progress = clamp((now - flightStart) / Math.max(1, flightDuration), 0, 1);
        const e = easeOutCubic(progress);
        owl.gx = flightFrom.gx + (flightTo.gx - flightFrom.gx) * e;
        owl.gy = flightFrom.gy + (flightTo.gy - flightFrom.gy) * e;
        if (progress >= 1) {
          owl.gx = HOME_GX;
          owl.gy = HOME_GY;
          owl.state = 'perched';
          if (!landingPuffed) {
            puffAt(owl.gx, owl.gy);
            landingPuffed = true;
          }
          flightMode = null;
          targetIndex = -1;
          delivered = false;
          progressed = true;
        }
      } else {
        owl.state = 'perched';
        progressed = true;
      }
      if (!progressed) break;
    }
  } catch (e) {}
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  if (k === 'e') {
    pressed.add('e');
    prevPressed.add('e');
    try { attemptSend(nowFn()); } catch (e2) {}
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  if (k === 'e') {
    pressed.delete('e');
    prevPressed.delete('e');
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  try {
    if (lastTime === null) lastTime = now;
    let dt = (now - lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    lastTime = now;

    const owl = getOwl();
    const Vv = getV();
    if (!owl || !Vv || Vv.gameState !== 'play') return;
    if (typeof owl.gx !== 'number') owl.gx = HOME_GX;
    if (typeof owl.gy !== 'number') owl.gy = HOME_GY;
    if (typeof owl.state !== 'string') owl.state = 'perched';
    if (typeof owl.deliveries !== 'number') owl.deliveries = 0;

    const ePressed = pressed.has('e');
    const eEdge = ePressed && !prevPressed.has('e');
    if (eEdge) attemptSend(now);
    prevPressed = new Set(pressed);

    updateFlight(now, owl, Vv);
  } catch (e) {}
}

function draw(ctx) {
  try {
    const owl = getOwl();
    const Vv = getV();
    if (!ctx || !owl || !Vv || Vv.gameState !== 'play') return;
    const n = nowFn();

    const homePt = isoFn(HOME_GX, HOME_GY);
    const hx = Math.round(homePt.x);
    const hy = Math.round(homePt.y);
    ctx.fillStyle = '#5b4025';
    ctx.fillRect(hx - 2, hy - 24, 4, 24);
    ctx.fillStyle = '#7a5330';
    ctx.fillRect(hx - 8, hy, 16, 4);
    ctx.fillStyle = '#4b3620';
    ctx.fillRect(hx - 2, hy - 24, 4, 4);

    const pt = isoFn(owl.gx, owl.gy);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    ctx.fillStyle = '#7a4f24';
    ctx.fillRect(x - 6, y - 6, 12, 10);
    ctx.fillRect(x - 5, y - 8, 10, 12);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x - 4, y - 3, 8, 6);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x - 6, y - 14, 12, 9);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 5, y - 12, 4, 4);
    ctx.fillRect(x + 1, y - 12, 4, 4);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x - 3, y - 11, 2, 2);
    ctx.fillRect(x + 2, y - 11, 2, 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x - 1, y - 9, 2, 2);
    if (owl.state !== 'perched') {
      const flap = Math.round(Math.sin(n * 0.015) * 3);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(x - 11, y - 8 + flap, 5, 7);
      ctx.fillRect(x + 6, y - 8 - flap, 5, 7);
    }
    ctx.fillStyle = '#3f2f1f';
    ctx.fillRect(x - 3, y + 3, 2, 3);
    ctx.fillRect(x + 1, y + 3, 2, 3);

    if (scrollBubbleWorker >= 0 && n < scrollBubbleUntil) {
      const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
      const w = states[scrollBubbleWorker];
      if (w && isFinite(w.x) && isFinite(w.y)) {
        const bx = Math.round(w.x + 4);
        const by = Math.round(w.y - 24);
        ctx.fillStyle = 'rgba(10,10,12,0.88)';
        ctx.fillRect(bx, by, 12, 12);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, 12, 12);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', bx + 6, by + 6);
        ctx.textAlign = 'left';
      }
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildOwlCourier) window.GuildOwlCourier = createState();
  const owl = window.GuildOwlCourier;
  if (typeof owl.gx !== 'number') owl.gx = HOME_GX;
  if (typeof owl.gy !== 'number') owl.gy = HOME_GY;
  if (typeof owl.state !== 'string') owl.state = 'perched';
  if (typeof owl.deliveries !== 'number') owl.deliveries = 0;
  owl.update = update;
  owl.draw = draw;
  owl.__probe = function () { return { state: owl.state, deliveries: owl.deliveries }; };
  owl.__keys = pressed;
  if (!window.__owlCourierListeners) {
    window.__owlCourierListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
