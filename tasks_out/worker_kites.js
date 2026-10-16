const KITE_DEFS = [
  { gx: -2.5, gy: -6.0, color: '#ff5a1f', trim: '#f3d37a', tail: '#bfdbfe', period: 10.5, phase: 0.0 },
  { gx: -0.5, gy: -5.0, color: '#3b82f6', trim: '#dbeafe', tail: '#bfdbfe', period: 12.0, phase: 2.1 }
];

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildKites; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function floorStep() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
  return s < 0 ? 0 : s;
}

function anchored(gx, gy) {
  const s = floorStep();
  const minC = -2 - s;
  const maxC = 1 + s;
  return { gx: clamp(gx, minC, maxC), gy: clamp(gy, minC, maxC) };
}

function windStrength() {
  const Vv = getV();
  if (Vv && typeof Vv.wind === 'number' && isFinite(Vv.wind)) return Math.max(0, Vv.wind);
  const wx = Vv && Vv.weather;
  if (wx === 'RAIN') return 0.9;
  if (wx === 'SNOW') return 0.4;
  return 0.2;
}

function daylightValue() {
  const Vv = getV();
  return (Vv && typeof Vv.daylight === 'number' && isFinite(Vv.daylight)) ? Vv.daylight : 1;
}

function buildKites() {
  const out = [];
  for (let i = 0; i < KITE_DEFS.length; i++) {
    const d = KITE_DEFS[i];
    const a = anchored(d.gx, d.gy);
    out.push({
      gx: a.gx, gy: a.gy,
      color: d.color, trim: d.trim, tail: d.tail,
      period: d.period, phase: d.phase,
      land: 0
    });
  }
  return out;
}

function ensureKites(st) {
  if (!st) return;
  const s = floorStep();
  if (Array.isArray(st.kites) && st.kites.length === KITE_DEFS.length && st.builtStep === s) return;
  const prev = Array.isArray(st.kites) ? st.kites : [];
  const kites = buildKites();
  for (let i = 0; i < kites.length; i++) {
    if (prev[i] && typeof prev[i].land === 'number') kites[i].land = prev[i].land;
  }
  st.kites = kites;
  st.builtStep = s;
}

function createState() {
  return { kites: [], builtStep: null, t: 0 };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const st = getState();
  if (!Vv || !st || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  st.t = (st.t || 0) + dt;
  ensureKites(st);

  const target = (daylightValue() < 0.15) ? 1 : 0;
  const kites = Array.isArray(st.kites) ? st.kites : [];
  const step = Math.min(1, dt * 3);
  for (let i = 0; i < kites.length; i++) {
    const k = kites[i];
    const cur = (typeof k.land === 'number') ? k.land : 0;
    k.land = cur + (target - cur) * step;
    if (k.land < 0.0005) k.land = 0;
    if (k.land > 0.9995) k.land = 1;
  }
}

function shadowEllipse(ctx, x, y, rx, ry) {
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillRect(Math.round(x - rx), Math.round(y - ry), Math.round(rx * 2), Math.round(ry * 2));
}

function drawPeg(ctx, px, py, k) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  shadowEllipse(ctx, px, py + 1, 5, 2.4);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(px - 1, py - 8, 2, 9);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(px - 1, py - 8, 1, 9);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(px - 2, py - 9, 4, 2);
  ctx.fillStyle = k.trim;
  ctx.fillRect(px - 1, py - 8, 2, 1);
}

function drawKiteBody(ctx, k, bodyX, bodyY, tilt, scale, night) {
  const hw = 9 * scale;
  const hh = 13 * scale;
  ctx.save();
  ctx.translate(bodyX, bodyY);
  ctx.rotate(tilt);

  ctx.fillStyle = k.color;
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.lineTo(0, hh);
  ctx.lineTo(-hw, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.lineTo(0, hh);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = k.trim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(0, hh);
  ctx.moveTo(-hw, 0);
  ctx.lineTo(hw, 0);
  ctx.stroke();

  if (night) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = '#e8e6df';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -hh - 1.5);
    ctx.lineTo(hw + 1.5, 0);
    ctx.lineTo(0, hh + 1.5);
    ctx.lineTo(-hw - 1.5, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawKite(ctx, k, now) {
  const dl = daylightValue();
  const night = dl < 0.15;
  const wind = windStrength();
  const peg = isoFn(k.gx, k.gy);
  const px = Math.round(peg.x);
  const py = Math.round(peg.y);

  const land = (typeof k.land === 'number') ? clamp(k.land, 0, 1) : (night ? 1 : 0);
  const fly = 1 - land;

  const effPeriod = k.period / (1 + wind * 0.35);
  const u = ((now / 1000) / effPeriod) * Math.PI * 2 + k.phase;
  const sinU = Math.sin(u);
  const cosU = Math.cos(u);
  const denom = 1 + sinU * sinU;
  const breathe = 1 + 0.14 * Math.sin(now * 0.0007 + k.phase);
  const ampX = (20 + wind * 16) * fly * breathe;
  const ampY = (10 + wind * 8) * fly * breathe;
  const lx = ampX * (cosU / denom);
  const ly = ampY * (sinU * cosU / denom);
  const hoverFly = 46 + wind * 12;
  const hoverRest = 8;
  const hover = hoverRest + (hoverFly - hoverRest) * fly;
  const flap = fly * 1.4 * Math.sin(u * 2);
  const bodyX = px + lx;
  const bodyY = py - hover + ly + flap;

  ctx.strokeStyle = 'rgba(156,163,175,0.80)';
  ctx.lineWidth = 1;
  const sag = (5 + wind * 4) * fly;
  ctx.beginPath();
  ctx.moveTo(px, py - 7);
  ctx.quadraticCurveTo((px + bodyX) * 0.5, (py - 7 + bodyY) * 0.5 + sag, bodyX, bodyY + 12);
  ctx.stroke();

  drawPeg(ctx, px, py, k);

  const shAlpha = 0.22 * (1 - clamp(hover / 70, 0, 0.8));
  if (shAlpha > 0.02) {
    ctx.fillStyle = 'rgba(0,0,0,' + shAlpha.toFixed(3) + ')';
    shadowEllipse(ctx, px + lx * 0.5, py + 1, 6 + ampX * 0.1, 3);
  }

  const tilt = sinU * 0.16 + wind * 0.05;

  ctx.save();
  ctx.translate(bodyX, bodyY);
  ctx.rotate(tilt);
  const tailLen = 16 + wind * 6;
  const wob = Math.sin(u * 2 + 0.7) * 4 * fly + land * 5;
  ctx.strokeStyle = k.tail;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 13);
  ctx.quadraticCurveTo(wob * 0.5, 13 + tailLen * 0.5, wob, 13 + tailLen);
  ctx.stroke();
  ctx.restore();

  drawKiteBody(ctx, k, bodyX, bodyY, tilt, 1 - land * 0.15, night);
}

function draw(ctx) {
  if (!ctx) return;
  const w = root();
  if (!w) return;
  const Vv = getV();
  const st = getState();
  if (!Vv || !st || Vv.gameState !== 'play') return;
  ensureKites(st);
  const kites = Array.isArray(st.kites) ? st.kites : [];
  if (!kites.length) return;
  const now = nowFn();
  ctx.save();
  for (let i = 0; i < kites.length; i++) drawKite(ctx, kites[i], now);
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildKites || typeof window.GuildKites !== 'object') window.GuildKites = createState();
  if (!Array.isArray(window.GuildKites.kites)) window.GuildKites.kites = [];
  ensureKites(window.GuildKites);
  window.GuildKites.update = update;
  window.GuildKites.draw = draw;
  window.GuildKites.__rawUpdate = update;
  window.GuildKites.__probe = function () {
    const st = window.GuildKites;
    ensureKites(st);
    return { kites: (st && Array.isArray(st.kites)) ? st.kites.length : 0 };
  };
}

export {};
