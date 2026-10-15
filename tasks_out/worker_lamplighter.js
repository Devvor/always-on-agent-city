const LAMPS = [
  { gx: 1, gy: -2, lit: false },
  { gx: 1, gy: 1, lit: false },
  { gx: -2, gy: 1, lit: false },
  { gx: -2, gy: -2, lit: false }
];

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return {
    gx: LAMPS[0].gx,
    gy: LAMPS[0].gy,
    facing: 'down',
    moving: false,
    walkFrame: 0,
    walkTimer: 0,
    active: false,
    complete: false,
    targetIndex: 0,
    lamps: LAMPS
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
function getState() { const w = root(); return w && w.GuildLamplighter; }

function isDawn(Vv) {
  const h = (Vv && typeof Vv.dayHour === 'number') ? Vv.dayHour : 0;
  return h >= 5 && h < 7;
}
function isDusk(Vv) {
  const h = (Vv && typeof Vv.dayHour === 'number') ? Vv.dayHour : 0;
  return h >= 17 && h < 19;
}
function isDeepNight(Vv) {
  const h = (Vv && typeof Vv.dayHour === 'number') ? Vv.dayHour : 0;
  return h >= 19 || h < 5;
}

function allLampsLit(value) {
  for (let i = 0; i < LAMPS.length; i++) LAMPS[i].lit = value;
}

function drawLamp(ctx, lamp, Vv, now) {
  const pt = isoFn(lamp.gx, lamp.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const ly = y - 20;

  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(x - 5, y + 1, 10, 3);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 2, y - 18, 4, 18);

  ctx.fillStyle = lamp.lit ? '#ffc27a' : '#262633';
  ctx.fillRect(x - 4, ly - 4, 8, 8);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 5, ly - 7, 10, 4);

  if (lamp.lit) {
    const prev = ctx.globalCompositeOperation;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const radius = 28;
    const g = ctx.createRadialGradient(x, ly - 1, 1, x, ly - 1, radius);
    g.addColorStop(0, 'rgba(255,194,122,0.34)');
    g.addColorStop(0.45, 'rgba(255,140,26,0.16)');
    g.addColorStop(1, 'rgba(255,140,26,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, ly - 1, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = prev;
  }
}

function drawNPC(ctx, st, Vv, now) {
  if (!st || !(st.active || st.complete)) return;
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const moving = st.moving;
  const bob = moving ? (st.walkFrame % 2 === 0 ? 0 : 1) : Math.round(Math.sin(now * 0.0022) * 1.0);
  const Y = y + bob;

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 4, y + 17, 20, 4);

  let leftY = Y + 10, rightY = Y + 10, leftH = 8, rightH = 8;
  const frame = moving ? (st.walkFrame % 4) : 0;
  if (frame === 1) { leftY = Y + 9; rightY = Y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = Y + 11; rightY = Y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = Y + 12; rightY = Y + 9; leftH = 5; rightH = 8; }

  ctx.fillStyle = '#26323f';
  if (st.facing === 'left') {
    ctx.fillRect(x + 10, leftY, 4, leftH);
    ctx.fillRect(x + 2, rightY, 4, rightH);
  } else if (st.facing === 'right') {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  } else {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  }

  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x + 1, Y - 2, 14, 12);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 3, Y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, Y - 8, 2, 2);
  ctx.fillRect(x + 9, Y - 8, 2, 2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 4, Y - 12, 8, 2);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 9, Y - 4, 8, 5);
  ctx.fillStyle = '#ffc27a';
  ctx.fillRect(x + 10, Y - 3, 6, 3);

  const tagW = 88;
  const tagH = 12;
  const tagX = x + 7 - Math.round(tagW * 0.5);
  const tagY = Y - 35;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('LAMPLIGHTER', tagW - 8), tagX + tagW * 0.5, tagY + tagH * 0.5 + 1);
  ctx.textAlign = 'left';
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

  if (isDawn(Vv) || !(isDusk(Vv) || isDeepNight(Vv))) {
    allLampsLit(false);
    st.active = false;
    st.complete = false;
    st.targetIndex = 0;
    return;
  }

  if (isDusk(Vv)) {
    st.complete = false;
    st.active = true;
    allLampsLit(false);
  } else if (isDeepNight(Vv) && !st.complete) {
    st.active = true;
  }

  if (st.complete) {
    allLampsLit(true);
    return;
  }

  if (!st.active) return;

  const target = LAMPS[st.targetIndex];
  const dx = target.gx - st.gx;
  const dy = target.gy - st.gy;
  const dist = Math.hypot(dx, dy);

  if (dist > 0.08) {
    const speed = 0.8;
    const step = speed * dt;
    if (step >= dist) {
      st.gx = target.gx;
      st.gy = target.gy;
    } else {
      st.gx += (dx / dist) * step;
      st.gy += (dy / dist) * step;
    }
    st.moving = true;
    if (Math.abs(dx) > Math.abs(dy)) st.facing = (dx > 0) ? 'right' : 'left';
    else st.facing = (dy > 0) ? 'down' : 'up';
    st.walkTimer += dt;
    while (st.walkTimer >= 0.15) {
      st.walkFrame = (st.walkFrame + 1) % 4;
      st.walkTimer -= 0.15;
    }
  } else {
    st.gx = target.gx;
    st.gy = target.gy;
    LAMPS[st.targetIndex].lit = true;
    st.moving = false;
    st.walkFrame = 0;
    st.walkTimer = 0;
    st.targetIndex++;
    if (st.targetIndex >= LAMPS.length) {
      st.targetIndex = 0;
      st.active = false;
      st.complete = true;
    }
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !ctx) return;
  for (let i = 0; i < LAMPS.length; i++) drawLamp(ctx, LAMPS[i], Vv, nowFn());
  drawNPC(ctx, st, Vv, nowFn());
}

if (typeof window !== 'undefined') {
  if (!window.GuildLamplighter) window.GuildLamplighter = createState();
  window.GuildLamplighter.update = update;
  window.GuildLamplighter.draw = draw;
  window.GuildLamplighter.lamps = LAMPS;
}

export {};
