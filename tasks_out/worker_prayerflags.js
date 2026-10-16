const FLAG_COUNT = 7;
const FLAG_GX0 = 3.5;
const FLAG_GX1 = 6.5;
const FLAG_GY = -1.5;
const ROPE_HEIGHT = 24;
const ROPE_SAG = 5;
const FLAG_DROP = 11;
const CHIME_COOLDOWN = 4;

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildPrayerflags; }

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

function buildFlags() {
  const s = floorStep();
  const minC = -2 - s;
  const maxC = 1 + s;
  const flags = [];
  for (let i = 0; i < FLAG_COUNT; i++) {
    const t = (FLAG_COUNT > 1) ? i / (FLAG_COUNT - 1) : 0;
    flags.push({
      gx: clamp(FLAG_GX0 + (FLAG_GX1 - FLAG_GX0) * t, minC, maxC),
      gy: clamp(FLAG_GY, minC, maxC),
      t: t,
      phase: i * 0.78
    });
  }
  return flags;
}

function ensureFlags(st) {
  if (!st) return;
  const s = floorStep();
  if (Array.isArray(st.flags) && st.flags.length === FLAG_COUNT && st.builtStep === s) return;
  st.flags = buildFlags();
  st.builtStep = s;
}

function softCue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

function createState() {
  return { flags: [], builtStep: null, t: 0, wasNear: false, chimeCooldown: 0 };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const Vv = getV();
  const st = getState();
  if (!w || !Vv || !st || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  st.t = (st.t || 0) + dt;
  ensureFlags(st);
  if (st.chimeCooldown > 0) st.chimeCooldown = Math.max(0, st.chimeCooldown - dt);

  const vis = w.GuildVisitor;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy) && Array.isArray(st.flags)) {
    let near = false;
    for (let i = 0; i < st.flags.length; i++) {
      const f = st.flags[i];
      if (Math.hypot(vis.gx - f.gx, vis.gy - f.gy) <= 2) { near = true; break; }
    }
    if (near && !st.wasNear && st.chimeCooldown <= 0) {
      softCue('chime');
      st.chimeCooldown = CHIME_COOLDOWN;
    }
    st.wasNear = near;
  }
}

function shadowEllipse(ctx, x, y, rx, ry) {
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (typeof ctx.arc === 'function') {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
  }
}

function draw(ctx) {
  const w = root();
  if (!ctx || !w) return;
  const Vv = getV();
  const st = getState();
  if (!Vv || !st || Vv.gameState !== 'play') return;
  ensureFlags(st);
  const flags = Array.isArray(st.flags) ? st.flags : [];
  if (!flags.length) return;
  const t = st.t || 0;
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const wind = (typeof Vv.wind === 'number' && isFinite(Vv.wind)) ? Vv.wind : 0;
  const amp = 2.0 + Math.max(0, wind) * 1.8;
  const night = dl < 0.25;

  const pts = [];
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i];
    const p = isoFn(f.gx, f.gy);
    const sag = ROPE_SAG * (1 - Math.pow(2 * f.t - 1, 2));
    pts.push({ x: p.x, y: p.y, rx: p.x, ry: p.y - ROPE_HEIGHT + sag, f: f });
  }

  ctx.save();

  if (night) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const ly = pts[i].ry + FLAG_DROP * 0.45;
      if (i === 0) ctx.moveTo(pts[i].rx, ly); else ctx.lineTo(pts[i].rx, ly);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].rx, pts[i].ry); else ctx.lineTo(pts[i].rx, pts[i].ry);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < pts.length; i++) {
    shadowEllipse(ctx, pts[i].x, pts[i].y + 2, 4, 1.6);
  }

  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const ripple = Math.sin(t * 1.6 + pt.f.phase) * 0.72 + Math.sin(t * 2.7 + pt.f.phase * 1.7) * 0.28;
    const sway = ripple * amp;
    const tipX = pt.rx + sway;
    const tipY = pt.ry + FLAG_DROP;
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(pt.rx - 3, pt.ry);
    ctx.lineTo(pt.rx + 3, pt.ry);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();
    if (night) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(tipX, tipY - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildPrayerflags) window.GuildPrayerflags = createState();
  if (!Array.isArray(window.GuildPrayerflags.flags)) window.GuildPrayerflags.flags = [];
  window.GuildPrayerflags.update = update;
  window.GuildPrayerflags.draw = draw;
  window.GuildPrayerflags.__probe = function () {
    const st = window.GuildPrayerflags;
    ensureFlags(st);
    return { flags: (st && Array.isArray(st.flags)) ? st.flags.length : 0 };
  };
}

export {};
