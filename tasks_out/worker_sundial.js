function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildSundial; }
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') { try { return w.iso(gx, gy); } catch (e) {} }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return null;
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') { try { return w.fitText(text, maxW); } catch (e) {} }
  return String(text == null ? '' : text);
}

const DIAL_GX = -5.5;
const DIAL_GY = -5.5;
const NIGHT_ANGLE = Math.PI * 1.25;
const ANCHORS = [
  { gx: -12.0, gy: -7.0 },
  { gx: -2.5, gy: -5.0 },
  { gx: 6.0, gy: 14.75 },
  { gx: 12.0, gy: -6.0 }
];

function createState() {
  return {
    gx: DIAL_GX,
    gy: DIAL_GY,
    daylight: 0.5,
    night: false,
    shadowAngle: NIGHT_ANGLE,
    shadowLen: 0.5,
    shadowAlpha: 0.2,
    lastTime: null
  };
}

function dialPos(Vv) {
  const S = getState();
  const s = (Vv && isNum(Vv.growthStep)) ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  const gx = (S && isNum(S.gx)) ? S.gx : DIAL_GX;
  const gy = (S && isNum(S.gy)) ? S.gy : DIAL_GY;
  return { gx: clamp(gx, minC, maxC), gy: clamp(gy, minC, maxC) };
}

function computeShadow(Vv, S) {
  const dl = clamp(isNum(Vv.daylight) ? Vv.daylight : 0.5, 0, 1);
  const night = dl < 0.12;
  S.daylight = dl;
  S.night = night;
  if (night) {
    S.shadowAngle = NIGHT_ANGLE;
    S.shadowLen = 0.55;
    S.shadowAlpha = 0.14;
    return S;
  }
  let phase;
  if (isNum(Vv.dayPhase)) phase = Vv.dayPhase;
  else if (isNum(Vv.dayHour)) phase = Vv.dayHour / 24;
  else phase = 0.25 + 0.5 * (1 - dl);
  phase = ((phase % 1) + 1) % 1;
  S.shadowAngle = phase * Math.PI * 2 + Math.PI;
  S.shadowLen = 0.32 + 0.9 * (1 - dl);
  S.shadowAlpha = 0.34;
  return S;
}

function update(now) {
  if (!isNum(now)) now = nowFn();
  const S = getState();
  if (!S) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') { S.lastTime = now; return; }
  if (!isNum(S.lastTime)) S.lastTime = now;
  let dt = (now - S.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  S.lastTime = now;
  computeShadow(Vv, S);
}

function drawArm(ctx, cx, cy, dx, dy, len, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(cx), Math.round(cy));
  ctx.lineTo(Math.round(cx + dx * len), Math.round(cy + dy * len));
  ctx.stroke();
}

function drawLetters(ctx, cx, cy, rl, night, now, sc) {
  const color = night ? '#d4af37' : '#9ca3af';
  const alpha = night ? (0.30 + 0.40 * (0.5 + 0.5 * Math.sin(now * 0.0022))) : 0.92;
  const size = Math.max(7, Math.round(8 * sc));
  ctx.save();
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillText(fitFn('N', size + 2), cx, Math.round(cy - rl));
  ctx.fillText(fitFn('E', size + 2), Math.round(cx + rl), cy);
  ctx.fillText(fitFn('S', size + 2), cx, Math.round(cy + rl));
  ctx.fillText(fitFn('W', size + 2), Math.round(cx - rl), cy);
  ctx.restore();
}

function drawSundial(ctx, S, Vv, now) {
  const dp = dialPos(Vv);
  const pt = isoFn(dp.gx, dp.gy);
  if (!pt || !isNum(pt.x) || !isNum(pt.y)) return;
  const g = Vv.grid || {};
  const tw = isNum(g.tileW) ? g.tileW : 70;
  const th = isNum(g.tileH) ? g.tileH : 35;
  const sc = clamp(tw / 70, 0.55, 1.8);
  const R = Math.max(12, Math.round(18 * sc));
  const tileLen = Math.max(12, Math.round(Math.hypot(tw * 0.5, th * 0.5)));
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const cy = y - Math.round(3 * sc);

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + Math.round(4 * sc), Math.round(R * 1.15), Math.round(R * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - Math.round(R * 1.1), y + Math.round(2 * sc), Math.round(R * 2.2), Math.round(4 * sc));
  }

  ctx.fillStyle = '#6b6b73';
  ctx.beginPath();
  ctx.arc(x, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4b4b52';
  ctx.lineWidth = Math.max(1, Math.round(2 * sc));
  ctx.stroke();
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, cy, Math.max(3, R - Math.round(4 * sc)), 0, Math.PI * 2);
  ctx.stroke();

  const shadowLen = (isNum(S.shadowLen) ? S.shadowLen : 0.5) * R;
  const sa = isNum(S.shadowAngle) ? S.shadowAngle : NIGHT_ANGLE;
  const sAlpha = isNum(S.shadowAlpha) ? S.shadowAlpha : 0.2;
  ctx.strokeStyle = 'rgba(20,20,25,' + sAlpha + ')';
  ctx.lineWidth = Math.max(1, Math.round(2 * sc));
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(Math.round(x + Math.cos(sa) * shadowLen), Math.round(cy + Math.sin(sa) * shadowLen));
  ctx.stroke();

  const armLen = Math.max(5, R - Math.round(11 * sc));
  const diag = armLen * 0.66;
  const r2 = Math.SQRT1_2;
  drawArm(ctx, x, cy, 0, -1, armLen, '#8a8a92', Math.max(1, Math.round(2 * sc)));
  drawArm(ctx, x, cy, 1, 0, armLen, '#8a8a92', Math.max(1, Math.round(2 * sc)));
  drawArm(ctx, x, cy, 0, 1, armLen, '#8a8a92', Math.max(1, Math.round(2 * sc)));
  drawArm(ctx, x, cy, -1, 0, armLen, '#8a8a92', Math.max(1, Math.round(2 * sc)));
  drawArm(ctx, x, cy, r2, -r2, diag, '#6b6b73', 1);
  drawArm(ctx, x, cy, r2, r2, diag, '#6b6b73', 1);
  drawArm(ctx, x, cy, -r2, r2, diag, '#6b6b73', 1);
  drawArm(ctx, x, cy, -r2, -r2, diag, '#6b6b73', 1);

  ctx.fillStyle = '#4b4b52';
  ctx.beginPath();
  ctx.arc(x, cy, Math.max(2, Math.round(2.5 * sc)), 0, Math.PI * 2);
  ctx.fill();

  drawLetters(ctx, x, cy, Math.max(6, R - Math.round(5 * sc)), S.night === true, now, sc);

  for (let i = 0; i < ANCHORS.length; i++) {
    const ap = isoFn(ANCHORS[i].gx, ANCHORS[i].gy);
    if (!ap || !isNum(ap.x) || !isNum(ap.y)) continue;
    let dx = ap.x - x;
    let dy = ap.y - cy;
    const d = Math.hypot(dx, dy);
    if (!isFinite(d) || d < 1) continue;
    dx /= d;
    dy /= d;
    const r0 = R + Math.round(2 * sc);
    const r1 = r0 + tileLen;
    ctx.strokeStyle = 'rgba(212,175,55,0.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x + dx * r0), Math.round(cy + dy * r0));
    ctx.lineTo(Math.round(x + dx * r1), Math.round(cy + dy * r1));
    ctx.stroke();
  }

  ctx.strokeStyle = '#6b6b73';
  ctx.lineWidth = Math.max(1, Math.round(2 * sc));
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x, cy - Math.round(10 * sc));
  ctx.stroke();
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 1, cy - Math.round(11 * sc), 2, 2);

  ctx.restore();
}

function draw(ctx) {
  const S = getState();
  const Vv = getV();
  if (!ctx || !S || !Vv || Vv.gameState !== 'play') return;
  try {
    computeShadow(Vv, S);
    drawSundial(ctx, S, Vv, nowFn());
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildSundial) window.GuildSundial = createState();
  else {
    const S = window.GuildSundial;
    if (!isNum(S.gx)) S.gx = DIAL_GX;
    if (!isNum(S.gy)) S.gy = DIAL_GY;
  }
  window.GuildSundial.update = update;
  window.GuildSundial.draw = draw;
  window.GuildSundial.__probe = function () {
    const S = getState();
    if (!S) return null;
    return {
      gx: S.gx,
      gy: S.gy,
      daylight: S.daylight,
      night: !!S.night,
      shadowAngle: S.shadowAngle,
      shadowLen: S.shadowLen,
      anchors: ANCHORS.length
    };
  };
  window.GuildSundial.__rawUpdate = update;
}

export {};
