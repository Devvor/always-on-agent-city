const DOCK_GX = 2;
const DOCK_GY = 1;

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return {
    gx: DOCK_GX,
    gy: DOCK_GY,
    phase: 'idle',
    castAt: 0,
    biteAt: 0,
    biteStart: 0,
    deadline: 0,
    resultAt: 0,
    delay: 0,
    bobber: { gx: DOCK_GX + 0.22, gy: DOCK_GY - 0.08, yOff: 0, dip: 0 },
    ripples: [],
    rippleAccum: 0,
    fishCount: 0,
    bestHaul: 0,
    near: false,
    message: '',
    msgUntil: 0
  };
}

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
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildFishing; }

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function tryPayOneGc() {
  const w = root();
  if (!w) return;
  const gt = w.GuildTips;
  if (gt && typeof gt === 'object') {
    const preferred = ['pay', 'award', 'add', 'grant', 'give', 'tip', 'earn', 'reward', 'credit', 'collect', 'addCoins', 'addGc', 'addGC'];
    for (let i = 0; i < preferred.length; i++) {
      const key = preferred[i];
      if (typeof gt[key] === 'function') {
        try { gt[key](1); return; } catch (e) {}
      }
    }
    for (const key in gt) {
      if (!Object.prototype.hasOwnProperty.call(gt, key)) continue;
      if (typeof gt[key] !== 'function') continue;
      if (!/(pay|award|add|grant|give|tip|earn|reward|credit|coin|gc)/i.test(key)) continue;
      try { gt[key](1); return; } catch (e) {}
    }
  }
  if (typeof w.cue === 'function') {
    try { w.cue('tip'); } catch (e) {}
  }
}

function startCast(st, now) {
  st.phase = 'cast';
  st.castAt = now;
  st.delay = 2000 + Math.random() * 4000;
  st.biteAt = now + st.delay;
  st.bobber.gx = st.gx + 0.22;
  st.bobber.gy = st.gy - 0.08;
  st.bobber.dip = 0;
  st.bobber.yOff = 0;
  st.ripples = [];
  st.rippleAccum = 0;
  st.message = 'Casting...';
  st.msgUntil = now + st.delay;
}

function catchFish(st, now) {
  st.phase = 'caught';
  st.resultAt = now + 1400;
  st.fishCount = (st.fishCount || 0) + 1;
  if ((st.bestHaul || 0) < st.fishCount) st.bestHaul = st.fishCount;
  st.message = 'Caught! +1 GC';
  st.msgUntil = now + 1400;
  tryPayOneGc();
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue('catch'); } catch (e) {} }
}

function escapeFish(st, now) {
  if (st.phase === 'escaped') return;
  st.phase = 'escaped';
  st.resultAt = now + 1000;
  st.message = 'Escaped';
  st.msgUntil = now + 1000;
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue('escape'); } catch (e) {} }
}

function handleF(st, now, vis) {
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  let near = st.near;
  if (vis && typeof vis.gx === 'number' && !near) {
    st.message = 'Move closer to the dock';
    st.msgUntil = now + 900;
    return;
  }
  if (st.phase === 'idle') {
    startCast(st, now);
  } else if (st.phase === 'bite') {
    if (now <= st.deadline) catchFish(st, now);
    else escapeFish(st, now);
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (k !== 'f') return;
  pressed.add(k);
  const w = root();
  const st = getState();
  const vis = w && w.GuildVisitor;
  if (st) handleF(st, nowFn(), vis);
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (!Array.isArray(st.ripples)) st.ripples = [];
  st.rippleAccum = (st.rippleAccum || 0) + dt;
  const rippleBase = isoFn(st.gx + 0.15, st.gy + 0.5);
  while (st.rippleAccum > 0.75) {
    st.ripples.push({
      x: rippleBase.x + (Math.random() - 0.5) * 28,
      y: rippleBase.y + (Math.random() - 0.5) * 8,
      r: 2 + Math.random() * 2,
      life: 1 + Math.random() * 0.5
    });
    st.rippleAccum -= 0.75;
  }
  const nextRipples = [];
  for (let i = 0; i < st.ripples.length; i++) {
    const rp = st.ripples[i];
    rp.r = (rp.r || 2) + dt * 14;
    rp.life = (rp.life || 1) - dt * 0.45;
    if (rp.life > 0) nextRipples.push(rp);
  }
  st.ripples = nextRipples;

  const w = root();
  const vis = w && w.GuildVisitor;
  let near = true;
  if (vis && typeof vis.gx === 'number') {
    const vp = isoFn(vis.gx, vis.gy);
    const dp = isoFn(st.gx, st.gy);
    near = Math.hypot(vp.x - dp.x, vp.y - dp.y) <= 62;
  }
  st.near = near;

  const fNow = pressed.has('f');
  const fEdge = fNow && !prevPressed.has('f');
  if (fEdge) handleF(st, now, vis);

  if (st.phase === 'cast' && now >= st.biteAt) {
    st.phase = 'bite';
    st.biteStart = now;
    st.deadline = now + 1200;
    st.bobber.dip = 1;
    st.message = 'Bite! Press F';
    st.msgUntil = now + 1200;
    if (w && typeof w.cue === 'function') { try { w.cue('splash'); } catch (e) {} }
  }

  if (st.phase === 'bite' && now > st.deadline) {
    escapeFish(st, now);
  }

  if ((st.phase === 'caught' || st.phase === 'escaped') && now >= st.resultAt) {
    st.phase = 'idle';
    st.message = '';
  }

  prevPressed = new Set(pressed);
}

function drawPond(ctx, st, Vv, now) {
  const base = isoFn(st.gx + 0.12, st.gy + 0.55);
  const night = (Vv && typeof Vv.nightFactor === 'number') ? Vv.nightFactor : 0;
  ctx.save();
  ctx.fillStyle = night > 0.45 ? 'rgba(14,30,48,0.90)' : 'rgba(52,104,150,0.78)';
  ctx.beginPath();
  ctx.ellipse(base.x, base.y, 52, 24, -0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 1;
  for (let i = 0; i < (st.ripples || []).length; i++) {
    const rp = st.ripples[i];
    const a = Math.max(0, Math.min(1, (rp.life || 0) / 1.2));
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = night > 0.45 ? 'rgba(150,190,230,0.75)' : 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.38, -0.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDock(ctx, st, Vv, now) {
  const pt = isoFn(st.gx, st.gy);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(Math.round(pt.x - 24), Math.round(pt.y - 2), 48, 6);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(Math.round(pt.x - 20), Math.round(pt.y - 3), 6, 20);
  ctx.fillRect(Math.round(pt.x + 14), Math.round(pt.y - 3), 6, 20);

  ctx.fillStyle = '#8a6640';
  ctx.fillRect(Math.round(pt.x - 26), Math.round(pt.y - 11), 52, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(Math.round(pt.x - 22 + i * 12), Math.round(pt.y - 11), 2, 11);
  }

  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(Math.round(pt.x - 28), Math.round(pt.y - 13), 56, 2);
  ctx.restore();
}

function drawBobber(ctx, st, Vv, now) {
  const pt = isoFn(st.bobber.gx, st.bobber.gy);
  let y = pt.y;
  if (st.phase === 'cast') y += Math.sin((now - st.castAt) * 0.006) * 1.5;
  if (st.phase === 'bite') y += st.bobber.dip * 6;
  const x = Math.round(pt.x);
  const yy = Math.round(y);
  ctx.save();
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, yy - 8);
  ctx.lineTo(x, yy + 16);
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x - 3, yy - 5, 6, 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 3, yy - 7, 6, 2);
  ctx.fillStyle = '#111827';
  ctx.fillRect(x, yy - 5, 1, 1);

  if (st.phase === 'bite') {
    const age = Math.max(0, Math.min(1, (now - st.biteStart) / 220));
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(x - 10, yy + 8, 20, 2);
    ctx.fillRect(x - 6, yy + 11, 12, 1);
    ctx.globalAlpha = 1;
  }
  if (st.phase === 'caught') {
    const age = Math.max(0, Math.min(1, (now - st.resultAt + 1400) / 1400));
    ctx.globalAlpha = age;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x - 8, yy - 16, 16, 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawChip(ctx, st, Vv, now) {
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x + 30);
  const y = Math.round(pt.y - 38);
  const w = 168;
  const h = 26;
  ctx.save();
  ctx.fillStyle = 'rgba(12,14,18,0.90)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 11px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const text = fitFn('FISH ' + (st.fishCount || 0) + ' / BEST(haUL) ' + (st.bestHaul || 0), w - 12);
  ctx.fillText(text, x + 6, y + h * 0.5);
  ctx.restore();
}

function drawPrompt(ctx, st, Vv, now) {
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y - 56);
  let text = '';
  if (st.phase === 'idle') {
    text = st.near ? 'Press F to cast' : 'Move closer to fish';
  } else if (st.phase === 'cast') {
    text = 'Waiting for bite...';
  } else if (st.phase === 'bite') {
    text = 'Press F to catch!';
  } else if (st.phase === 'caught') {
    text = 'Caught!';
  } else if (st.phase === 'escaped') {
    text = 'Escaped...';
  }
  if (st.message && now < (st.msgUntil || 0)) text = st.message;
  if (!text) return;
  ctx.save();
  ctx.font = 'bold 10px monospace';
  const tw = ctx.measureText(text).width;
  const pw = Math.max(76, Math.round(tw) + 12);
  const px = x - Math.round(pw * 0.5);
  const py = y;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, 16);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, 16);
  ctx.fillStyle = '#f3f4f6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(text, pw - 8), px + pw * 0.5, py + 8);
  ctx.textAlign = 'left';
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  drawPond(ctx, st, Vv, now);
  drawDock(ctx, st, Vv, now);
  drawBobber(ctx, st, Vv, now);
  drawChip(ctx, st, Vv, now);
  drawPrompt(ctx, st, Vv, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildFishing) window.GuildFishing = createState();
  window.GuildFishing.update = update;
  window.GuildFishing.draw = draw;
  window.GuildFishing.__probe = function () {
    return { phase: (getState() || {}).phase, pressed: Array.from(pressed), prev: Array.from(prevPressed), near: (getState() || {}).near };
  };
  window.GuildFishing.__rawUpdate = update;
  window.GuildFishing.__keys = pressed;
  window.Fishing = window.GuildFishing;
  if (!window.__gfListeners) {
    window.__gfListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
