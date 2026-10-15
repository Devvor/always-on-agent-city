function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return (w && w.GuildVane) ? w.GuildVane : null; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

let lastTime = null;

function createState() {
  return { gx: 5.2, gy: 1.8, dir: 0 };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const vane = getState();
  const Vv = getV();
  if (!vane || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (typeof vane.dir !== 'number' || !isFinite(vane.dir)) vane.dir = 0;

  const weather = String(Vv.weather == null ? 'CLEAR' : Vv.weather).toUpperCase();
  let weatherFactor;
  if (typeof Vv.weatherFactor === 'number' && isFinite(Vv.weatherFactor)) weatherFactor = Vv.weatherFactor;
  else if (weather === 'RAIN') weatherFactor = 0.72;
  else if (weather === 'SNOW') weatherFactor = 0.28;
  else weatherFactor = 0;

  let baseWind;
  if (typeof Vv.wind === 'number' && isFinite(Vv.wind)) baseWind = Vv.wind;
  else baseWind = Math.sin(typeof Vv.dayPhase === 'number' ? Vv.dayPhase : 0) + weatherFactor;

  let duration = 2;
  if (weather === 'RAIN') duration = 0.35;
  else if (weather === 'SNOW') duration = 4;

  let target = baseWind;
  if (weather === 'RAIN') {
    target += Math.sin(now * 0.023) * 0.20 + Math.sin(now * 0.057) * 0.08;
  } else if (weather === 'SNOW') {
    target += Math.sin(now * 0.004) * 0.03;
  } else {
    target += Math.sin(now * 0.0027 + (typeof Vv.dayPhase === 'number' ? Vv.dayPhase : 0)) * 0.08;
  }

  const k = Math.min(1, Math.max(0, dt / duration));
  vane.dir += (target - vane.dir) * k;
  vane.target = target;

  const sharp = vane.prevTarget !== null && Math.abs(target - vane.prevTarget) >= 0.5;
  if (sharp) {
    const cooldownOk = vane.lastCreak == null || now - vane.lastCreak >= 20000;
    if (cooldownOk) {
      try {
        const w = root();
        if (w && typeof w.cue === 'function') w.cue('alert');
      } catch (e) { }
      vane.lastCreak = now;
    }
  }
  vane.prevTarget = target;
}

function draw(ctx) {
  const vane = getState();
  const Vv = getV();
  if (!ctx || !vane || !Vv || Vv.gameState !== 'play') return;
  if (typeof vane.gx !== 'number' || !isFinite(vane.gx)) vane.gx = 5.2;
  if (typeof vane.gy !== 'number' || !isFinite(vane.gy)) vane.gy = 1.8;
  if (typeof vane.dir !== 'number' || !isFinite(vane.dir)) vane.dir = 0;

  const pos = isoFn(vane.gx, vane.gy);
  if (!pos || !isFinite(pos.x) || !isFinite(pos.y)) return;
  const x = Math.round(pos.x);
  const y = Math.round(pos.y);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 6, y, 12, 4);
  }
  ctx.restore();

  ctx.fillStyle = '#3a342f';
  ctx.fillRect(x - 1, y - 24, 2, 24);
  ctx.fillRect(x - 4, y - 27, 8, 3);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 4, y - 34, 8, 6);
  ctx.fillRect(x - 2, y - 38, 4, 4);
  ctx.fillRect(x + 2, y - 38, 3, 2);
  ctx.fillRect(x - 5, y - 33, 2, 4);
  ctx.fillRect(x - 1, y - 30, 2, 2);

  ctx.save();
  ctx.translate(x, y - 22);
  ctx.rotate(vane.dir);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-2, -1, 12, 2);
  ctx.fillRect(10, -3, 2, 6);
  ctx.fillRect(12, -1, 4, 2);
  ctx.fillRect(-6, -4, 3, 1);
  ctx.fillRect(-6, 3, 3, 1);
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildVane) window.GuildVane = createState();
  else {
    if (typeof window.GuildVane.gx !== 'number' || !isFinite(window.GuildVane.gx)) window.GuildVane.gx = 5.2;
    if (typeof window.GuildVane.gy !== 'number' || !isFinite(window.GuildVane.gy)) window.GuildVane.gy = 1.8;
    if (typeof window.GuildVane.dir !== 'number' || !isFinite(window.GuildVane.dir)) window.GuildVane.dir = 0;
  }
  window.GuildVane.update = update;
  window.GuildVane.draw = draw;
  window.GuildVane.__probe = function () {
    const s = getState();
    if (!s) return null;
    return { gx: s.gx, gy: s.gy, dir: s.dir, target: s.target, prevTarget: s.prevTarget, lastCreak: s.lastCreak, lastTime: lastTime };
  };
  window.GuildVane.__rawUpdate = update;
}

export {};
