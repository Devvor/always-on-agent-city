function createState() {
  return {
    gx: -4.5, gy: -0.5,
    swingT: -1,
    swingDuration: 0.9,
    lastRing: -1e12,
    cooldown: 5000,
    dongT: -1,
    dongDuration: 1.4,
    secondNoteAt: 0,
    secondNotePending: false,
    rings: 0
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildBell; }
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

function visitorPos() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) return { gx: vis.gx, gy: vis.gy };
  return null;
}

function visitorDistance(st) {
  const vp = visitorPos();
  if (!vp) return Infinity;
  return Math.hypot(vp.gx - st.gx, vp.gy - st.gy);
}

let pressed = new Set();
let prevPressed = new Set();

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
}

function tryRing(st, now) {
  if (st.swingT >= 0) return;
  if (now - st.lastRing < st.cooldown) return;
  st.lastRing = now;
  st.swingT = 0;
  st.dongT = 0;
  st.rings++;
  st.secondNotePending = true;
  st.secondNoteAt = now + 280;
  cueFn('levelup');
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    prevPressed = new Set(pressed);
    return;
  }

  if (st.secondNotePending && now >= st.secondNoteAt) {
    st.secondNotePending = false;
    cueFn('done');
  }

  const ePressed = pressed.has('e');
  const eWas = prevPressed.has('e');
  if (ePressed && !eWas) {
    const d = visitorDistance(st);
    if (d <= 2) tryRing(st, now);
  }

  if (st.swingT >= 0) {
    st.swingT += 1 / 60;
    if (st.swingT >= st.swingDuration) st.swingT = -1;
  }
  if (st.dongT >= 0) {
    st.dongT += 1 / 60;
    if (st.dongT >= st.dongDuration) st.dongT = -1;
  }

  prevPressed = new Set(pressed);
}

function drawBellTower(ctx, st, now) {
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 12, y + 14, 24, 4);

  ctx.fillStyle = '#4b3320';
  ctx.fillRect(x - 2, y - 44, 4, 46);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 1, y - 44, 1, 46);

  ctx.fillStyle = '#4b3320';
  ctx.fillRect(x - 14, y - 46, 28, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 14, y - 46, 28, 1);

  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(x - 10, y - 42, 20, 2);

  let angle = 0;
  if (st.swingT >= 0) {
    const t = st.swingT / st.swingDuration;
    angle = Math.sin(t * Math.PI * 5) * 0.5 * (1 - t);
  }

  ctx.save();
  ctx.translate(x, y - 42);
  ctx.rotate(angle);
  ctx.fillStyle = '#8a6d2f';
  ctx.fillRect(-1, 0, 2, 4);
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(7, 4);
  ctx.lineTo(5, 14);
  ctx.lineTo(-5, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(-7, 4, 14, 2);
  ctx.fillStyle = '#854d0e';
  ctx.fillRect(-2, 14, 4, 3);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(-1, 8, 2, 2);
  ctx.restore();
}

function drawLabels(ctx, st, now) {
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  const d = visitorDistance(st);
  const ready = (now - st.lastRing >= st.cooldown);
  if (d <= 2) {
    const text = ready ? 'E: ring' : '...';
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText(text).width;
    const pw = Math.round(tw) + 8;
    const ph = 12;
    const px = x - Math.round(pw * 0.5);
    const py = y - 66;
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = ready ? '#d4af37' : '#6b7280';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = ready ? '#f3d37a' : '#9ca3af';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px + pw * 0.5, py + ph * 0.5 + 1);
    ctx.textAlign = 'left';
  }

  if (st.dongT >= 0) {
    const t = st.dongT / st.dongDuration;
    const alpha = Math.max(0, 1 - t);
    const rise = t * 26;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#facc15';
    ctx.fillText('DONG', x, y - 58 - rise);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  drawBellTower(ctx, st, n);
  drawLabels(ctx, st, n);
}

if (typeof window !== 'undefined') {
  if (!window.GuildBell) window.GuildBell = createState();
  window.GuildBell.update = update;
  window.GuildBell.draw = draw;
  window.GuildBell.__probe = function () {
    const st = getState();
    const now = nowFn();
    return {
      gx: st.gx,
      gy: st.gy,
      rings: st.rings,
      swinging: st.swingT >= 0,
      cooldownRemaining: Math.max(0, st.cooldown - (now - st.lastRing)),
      visitorDistance: visitorDistance(st),
      inRange: visitorDistance(st) <= 2,
      pressed: Array.from(pressed)
    };
  };
  window.GuildBell.__ring = function () { tryRing(getState(), nowFn()); };
  if (!window.__gbBellListeners) {
    window.__gbBellListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
