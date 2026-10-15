const BASE_SPEED = 1.0;
const BOOST_SPEED = 3.8;
const BOOST_MS = 2000;
const ANCHOR = { gx: 2, gy: 3 };

let rotation = 0;
let lastTime = null;
let lastSignal = false;
let boostUntil = 0;

function root() { return (typeof window !== 'undefined') ? window : null; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = w && w.V;
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function guardsOk(w) {
  if (!w) return false;
  if (typeof w.V === 'undefined') return false;
  if (typeof w.iso !== 'function') return false;
  if (typeof w.fitText !== 'function') return false;
  if (!w.GuildVisitor) return false;
  if (typeof w.cue !== 'function') return false;
  if (!Array.isArray(w.allTasks)) return false;
  return true;
}

function hasSignal(w, Vv) {
  let found = false;
  if (Vv && typeof Vv === 'object') {
    const keys = ['shipSignal', 'guildShipSignal', 'ship', 'beacon', 'signal', 'lighthouseSignal'];
    for (let i = 0; i < keys.length; i++) {
      const v = Vv[keys[i]];
      if (v === true || (typeof v === 'number' && v > 0)) found = true;
    }
    if (Vv.guildShip && (Vv.guildShip.signal === true || Vv.guildShip.active === true)) found = true;
    if (Vv.ship && (Vv.ship.signal === true || Vv.ship.active === true)) found = true;
  }
  for (const key in w) {
    if (key.indexOf('Guild') !== 0 || key === 'GuildLighthouse') continue;
    const m = w[key];
    if (!m || typeof m !== 'object') continue;
    if (m.shipSignal === true || m.signal === true || m.beacon === true) found = true;
    if (m.guildShip && (m.guildShip.signal === true || m.guildShip.active === true)) found = true;
    if (m.ship && (m.ship.signal === true || m.ship.active === true)) found = true;
  }
  return found;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  if (!guardsOk(w)) return;
  const Vv = w.V;
  if (!Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const signaled = hasSignal(w, Vv);
  if (signaled && !lastSignal) boostUntil = now + BOOST_MS;
  if (signaled) boostUntil = Math.max(boostUntil, now + 900);
  lastSignal = signaled;

  const boosted = signaled || now < boostUntil;
  const rate = boosted ? BOOST_SPEED : BASE_SPEED;
  rotation += rate * dt;

  if (w.GuildLighthouse) {
    w.GuildLighthouse.rotation = rotation;
    w.GuildLighthouse.boosted = boosted;
  }
}

function draw(ctx) {
  const w = root();
  if (!ctx || !guardsOk(w)) return;
  const Vv = w.V;
  if (!Vv || Vv.gameState !== 'play') return;

  const p = isoFn(ANCHOR.gx, ANCHOR.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 7, y + 14, 22, 5);

  const h = 56;
  const topY = y - h;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#d4af37' : '#f3f4f6';
    ctx.fillRect(x - 6, topY + i * 9, 12, 9);
  }
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, topY, 12, h);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 8, topY - 9, 16, 10);
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x - 4, topY - 6, 8, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, topY - 4, 4, 2);

  const lampX = x;
  const lampY = topY - 2;
  ctx.save();
  ctx.translate(lampX, lampY);
  ctx.rotate(rotation);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(104, -20);
  ctx.lineTo(104, 20);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(88, -9);
  ctx.lineTo(88, 9);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildLighthouse) {
    window.GuildLighthouse = { gx: ANCHOR.gx, gy: ANCHOR.gy, rotation: rotation, boosted: false, update: update, draw: draw };
  }
  window.GuildLighthouse.gx = ANCHOR.gx;
  window.GuildLighthouse.gy = ANCHOR.gy;
  window.GuildLighthouse.rotation = rotation;
  window.GuildLighthouse.update = update;
  window.GuildLighthouse.draw = draw;
  window.GuildLighthouse.__probe = function () { return { rotation: rotation, anchor: ANCHOR }; };
}

export {};
