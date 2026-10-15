// tasks_out/worker_crystals.js
// NW crystal grove: 3 small chime crystals. Self-installing ES module, no imports.
// Placed 2+ tiles from every existing building prop in the NW zone.

const CRYSTALS = [
  { gx: -2, gy: -2, size: 1.0, hue: '#a78bfa' }, // existing accent color (violet)
  { gx: -3, gy: -2, size: 0.8, hue: '#facc15' }, // existing accent color (gold)
  { gx: -2, gy: -3, size: 0.6, hue: '#6ee7b7' }  // existing accent color (mint)
];

function createState() {
  return {
    glints: CRYSTALS.map(function () { return { t: -1, active: false }; }),
    chimeCooldown: CRYSTALS.map(function () { return 0; }),
    nightTimer: 0,
    lastTime: null
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildCrystals; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function visitorPos() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) return { gx: vis.gx, gy: vis.gy };
  return null;
}

function cueFn(type, pitch) {
  const w = root();
  if (!w || typeof w.cue !== 'function') return;
  try {
    if (typeof pitch === 'number' && w.cue.length > 1) w.cue(type, pitch);
    else w.cue(type);
  } catch (e) {}
}

function isNight() {
  const Vv = getV();
  if (!Vv || typeof Vv.daylight !== 'number') return false;
  return Vv.daylight < 0.25;
}

function triggerGlint(st, i) {
  st.glints[i].active = true;
  st.glints[i].t = 0;
}

function chime(i) {
  // pitch scaled by crystal size: bigger crystal -> lower pitch number passed through
  const size = CRYSTALS[i].size;
  cueFn('chime', Math.round(400 + 600 * size));
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { st.lastTime = now; return; }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const vp = visitorPos();

  for (let i = 0; i < CRYSTALS.length; i++) {
    const c = CRYSTALS[i];
    // glint animation progress
    if (st.glints[i].active) {
      st.glints[i].t += dt;
      if (st.glints[i].t >= 1.0) { st.glints[i].active = false; st.glints[i].t = -1; }
    }
    // chime cooldown
    if (st.chimeCooldown[i] > 0) st.chimeCooldown[i] = Math.max(0, st.chimeCooldown[i] - dt);
    // proximity chime: visitor within 1.5 tiles
    if (vp) {
      const d = Math.hypot(vp.gx - c.gx, vp.gy - c.gy);
      if (d <= 1.5 && st.chimeCooldown[i] <= 0) {
        chime(i);
        triggerGlint(st, i);
        st.chimeCooldown[i] = 2.5;
      }
    }
  }

  // gentle night glints, roughly every 15s
  st.nightTimer += dt;
  if (st.nightTimer >= 15 && isNight()) {
    st.nightTimer = 0;
    const i = Math.floor(Math.random() * CRYSTALS.length) % CRYSTALS.length;
    if (!st.glints[i].active) triggerGlint(st, i);
  }
  if (st.nightTimer > 30) st.nightTimer = 0;
}

function drawCrystal(ctx, c, glint, now) {
  const pt = isoFn(c.gx, c.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const s = c.size;
  const h = Math.round(26 * s);
  const w = Math.round(10 * s);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - Math.round(w * 0.7), y - 2, Math.round(w * 1.4), 4);

  // crystal body (diamond shard)
  ctx.fillStyle = c.hue;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w, y - Math.round(h * 0.35));
  ctx.lineTo(x, y);
  ctx.lineTo(x - w, y - Math.round(h * 0.35));
  ctx.closePath();
  ctx.fill();

  // inner facet
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + Math.round(w * 0.45), y - Math.round(h * 0.4));
  ctx.lineTo(x, y - Math.round(h * 0.15));
  ctx.closePath();
  ctx.fill();

  // base rock
  ctx.fillStyle = '#4b443d';
  ctx.fillRect(x - Math.round(w * 0.9), y - 2, Math.round(w * 1.8), 4);

  // glint sparkle
  if (glint.active) {
    const a = Math.max(0, 1 - glint.t);
    const gx = x + Math.round(w * 0.5);
    const gy = y - Math.round(h * 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 1, gy - 4, 2, 8);
    ctx.fillRect(gx - 4, gy - 1, 8, 2);
    ctx.globalAlpha = a * 0.5;
    ctx.fillRect(gx - 7, gy - 1, 14, 2);
    ctx.fillRect(gx - 1, gy - 7, 2, 14);
    ctx.globalAlpha = 1;
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !ctx) return;
  const now = nowFn();
  for (let i = 0; i < CRYSTALS.length; i++) {
    drawCrystal(ctx, CRYSTALS[i], st.glints[i], now);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildCrystals) window.GuildCrystals = createState();
  window.GuildCrystals.update = update;
  window.GuildCrystals.draw = draw;
  window.GuildCrystals.__probe = function () {
    const st = getState();
    return {
      crystals: CRYSTALS.map(function (c, i) {
        return { gx: c.gx, gy: c.gy, size: c.size, glinting: st.glints[i].active, cooldown: st.chimeCooldown[i] };
      }),
      nightTimer: st.nightTimer
    };
  };
}

export {};
