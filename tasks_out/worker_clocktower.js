const GOLD = '#d4af37';
const STONE = '#8a8a8f';
const STONE_DARK = '#5a5a60';
const STONE_LIGHT = '#a8a8ad';

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

const LOAD_TIME = nowFn();
const LOAD_DATE = new Date();
const INIT_HOUR_KEY = LOAD_DATE.getHours() * 100 + LOAD_DATE.getDate() * 10000;

function createState() {
  return {
    chimes: [],
    lastChimeHour: INIT_HOUR_KEY,
    faceTime: 0,
    gx: (typeof window !== 'undefined' && window.GuildZones && window.GuildZones.NORTH_RIM) ? window.GuildZones.NORTH_RIM.gx + 2 : 2,
    gy: (typeof window !== 'undefined' && window.GuildZones && window.GuildZones.NORTH_RIM) ? window.GuildZones.NORTH_RIM.gy : -14
  };
}

function getState() { const w = root(); return w && w.GuildClocktower; }

function clampTowerPos(st, Vv) {
  // NW plaza rim anchor: tiles around gx 1..3, gy 1..3, clamped within the grown floor.
  let gx = 3, gy = 3;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  while (tileRing(gx, gy) > s && (gx > 1 || gy > 1)) {
    if (gx > 1) gx--;
    else if (gy > 1) gy--;
  }
  if (tileRing(gx, gy) > s) { gx = 1; gy = 1; }
  st.gx = gx;
  st.gy = gy;
}

function hourKeyOf(d) {
  return d.getDate() * 10000 + d.getHours() * 100;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  clampTowerPos(st, Vv);

  st.faceTime = (now - LOAD_TIME) / 1000;
  if (!isFinite(st.faceTime) || st.faceTime < 0) st.faceTime = 0;

  // REAL-HOUR CHIME: wall clock minutes and seconds both wrap to ~0.
  const d = new Date();
  const mins = d.getMinutes();
  const secs = d.getSeconds();
  const key = hourKeyOf(d);
  if (mins === 0 && secs <= 2 && st.lastChimeHour !== key) {
    st.lastChimeHour = key;
    st.chimes.push({ age: 0, duration: 2.6 });
    const w = root();
    if (w && typeof w.cue === 'function') { try { w.cue('chime'); } catch (e) {} }
  }

  const next = [];
  for (let i = 0; i < st.chimes.length; i++) {
    const c = st.chimes[i];
    c.age += 1 / 60;
    if (c.age < c.duration) next.push(c);
  }
  st.chimes = next;
}

function drawTowerBody(ctx, x, y, scale, Vv, now) {
  const w = Math.round(20 * scale);
  const h = Math.round(64 * scale);
  const topY = y - h;

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - Math.round(w * 0.7), y - 2, Math.round(w * 1.4), 5);

  // stone body
  ctx.fillStyle = STONE;
  ctx.fillRect(x - Math.round(w * 0.5), topY, w, h);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x - Math.round(w * 0.5), topY, Math.round(w * 0.3), h);
  ctx.fillStyle = STONE_LIGHT;
  ctx.fillRect(x + Math.round(w * 0.2), topY, Math.round(w * 0.3), h);
  // stone banding
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let by = topY + 8 * scale; by < y; by += 12 * scale) {
    ctx.fillRect(x - Math.round(w * 0.5), Math.round(by), w, 1);
  }
  // tapered top
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x - Math.round(w * 0.35), topY - Math.round(8 * scale), Math.round(w * 0.7), Math.round(8 * scale));

  // tiny bell on top
  const bellY = topY - Math.round(8 * scale);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 1, bellY - Math.round(7 * scale), 2, Math.round(7 * scale));
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - Math.round(3 * scale), bellY - Math.round(3 * scale), Math.round(6 * scale), Math.round(4 * scale));
  ctx.fillStyle = '#854d0e';
  ctx.fillRect(x - Math.round(3 * scale), bellY + 1, Math.round(6 * scale), 1);

  return { faceX: x, faceY: topY + Math.round(h * 0.35), faceR: Math.round(8 * scale) };
}

function drawClockFace(ctx, fx, fy, r, st, Vv, now) {
  if (r < 3) return;
  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const isNight = daylight < 0.3;
  const raining = String(Vv.weather || '').toUpperCase() === 'RAIN';

  // NIGHT GLOW halo (dims in rain) / day glint
  if (isNight) {
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.0022);
    let haloA = 0.30 * pulse;
    if (raining) haloA *= 0.45;
    const hr = r * 3.2;
    const grad = ctx.createRadialGradient(fx, fy, r * 0.5, fx, fy, hr);
    grad.addColorStop(0, 'rgba(255,220,120,' + haloA.toFixed(3) + ')');
    grad.addColorStop(0.5, 'rgba(212,175,55,' + (haloA * 0.45).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(fx, fy, hr, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const glintPhase = (now * 0.0011) % 1;
    if (glintPhase < 0.14) {
      ctx.globalAlpha = (1 - glintPhase / 0.14) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx - Math.round(r * 0.5), fy - 1, Math.round(r), 2);
      ctx.fillRect(fx - 1, fy - Math.round(r * 0.5), 2, Math.round(r));
      ctx.globalAlpha = 1;
    }
  }

  // gold face
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(fx, fy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#f3e6bf';
  ctx.beginPath();
  ctx.arc(fx, fy, Math.max(1, r - 2), 0, Math.PI * 2);
  ctx.fill();

  // tick marks
  ctx.fillStyle = '#4a3a10';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = fx + Math.cos(a) * (r - 2);
    const ty = fy + Math.sin(a) * (r - 2);
    ctx.fillRect(Math.round(tx) - (i % 3 === 0 ? 1 : 0), Math.round(ty) - (i % 3 === 0 ? 1 : 0), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }

  // UPTIME FACE: hands show session uptime, not wall time.
  const up = st.faceTime;
  const upMinutes = up / 60;
  const hourAngle = ((upMinutes / 60) % 12) / 12 * Math.PI * 2 - Math.PI / 2;
  const minAngle = (upMinutes % 60) / 60 * Math.PI * 2 - Math.PI / 2;

  ctx.strokeStyle = '#2b1d0e';
  ctx.lineWidth = Math.max(1, Math.round(r * 0.16));
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + Math.cos(hourAngle) * r * 0.5, fy + Math.sin(hourAngle) * r * 0.5);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + Math.cos(minAngle) * r * 0.78, fy + Math.sin(minAngle) * r * 0.78);
  ctx.stroke();
  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(fx - 1, fy - 1, 2, 2);
}

function drawChimeRings(ctx, x, y, st, scale) {
  for (let i = 0; i < st.chimes.length; i++) {
    const c = st.chimes[i];
    const t = c.age / c.duration;
    for (let k = 0; k < 3; k++) {
      const kt = t - k * 0.12;
      if (kt < 0 || kt > 1) continue;
      const a = (1 - kt) * 0.55;
      const rad = 8 * scale + kt * 46 * scale;
      ctx.globalAlpha = a;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx || !Vv.grid) return;
  const now = nowFn();
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const scale = Math.max(0.5, Math.min(1.4, Vv.grid.tileH / 35));

  drawChimeRings(ctx, x, y - Math.round(64 * scale), st, scale);
  const face = drawTowerBody(ctx, x, y, scale, Vv, now);
  drawClockFace(ctx, face.faceX, face.faceY, face.faceR, st, Vv, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildClocktower) window.GuildClocktower = createState();
  window.GuildClocktower.chimes = window.GuildClocktower.chimes || [];
  window.GuildClocktower.update = update;
  window.GuildClocktower.draw = draw;
  window.GuildClocktower.__probe = function () {
    const st = getState();
    return { chimes: st ? st.chimes.length : 0, faceTime: st ? st.faceTime : 0 };
  };
}

export {};
