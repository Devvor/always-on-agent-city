// =====================================================================
// GLOWFISH :: window.GuildGlowfish
// ---------------------------------------------------------------------
// Night-time glowing fish that drift in slow orbits around the pond and
// scatter with a ripple cue when the visitor lingers close after dark.
// Relocated to the PONDSIDE district (LAYOUT.md town plan) — the
// southeast fishing corner. The district anchor is read from
// window.GuildZones.PONDSIDE when available, falling back to the literal
// { gx: 14, gy: 15 }; the pond stands two tiles off the anchor so it
// stays within ~3 tiles of the district centre while keeping 2+ tiles
// clear of the lighthouse, fishhut and other props already there.
// Conventions copied from tasks_out/worker_visitor.js: self-installing
// ES module, no imports, no top-level DOM access (typeof guards), state
// on window.GuildGlowfish exposing update(now) / draw(ctx) / __probe().
// Bails silently if V or iso are missing. Palette: cool cyan tones.
// =====================================================================

// PONDSIDE district anchor (LAYOUT.md / window.GuildZones). The pond is
// offset two tiles from the anchor to avoid clumping with the lighthouse.
const Z = (typeof window !== 'undefined' && window.GuildZones && window.GuildZones.PONDSIDE) || { gx: 14, gy: 15 };
const POND_ANCHOR = { gx: Z.gx + 2, gy: Z.gy + 2 };

const BUILDINGS = [];

function createState() {
  const fish = [];
  for (let i = 0; i < 6; i++) {
    fish.push({
      angle: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.12 + Math.random() * 0.18,
      radius: 16 + Math.random() * 12,
      verticalScale: 0.42 + Math.random() * 0.18,
      driftX: 0,
      driftY: 0,
      bubbles: []
    });
  }
  return {
    fish: fish,
    ripples: [],
    shy: false,
    fade: 0
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
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildGlowfish; }
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}

let lastTime = null;

function pondTile() { return { gx: POND_ANCHOR.gx, gy: POND_ANCHOR.gy }; }

function visitorNearPond(Vv) {
  const w = root();
  const vis = w && w.GuildVisitor;
  const pond = pondTile();
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  const dx = vis.gx - pond.gx;
  const dy = vis.gy - pond.gy;
  return Math.hypot(dx, dy) <= 1.8;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const night = Vv.daylight < 0.3;
  if (night) state.fade = 1;
  else state.fade = Math.max(0, state.fade - dt / 2);

  const near = night && visitorNearPond(Vv);
  if (night && near && !state.shy) {
    state.shy = true;
    for (let i = 0; i < state.fish.length; i++) {
      const f = state.fish[i];
      const bx = Math.cos(f.angle) * f.radius;
      const by = Math.sin(f.angle) * f.radius * f.verticalScale;
      const len = Math.hypot(bx, by) || 1;
      f.driftX += (bx / len) * 12;
      f.driftY += (by / len) * 12;
    }
    cueFn('ripple');
    const pond = pondTile();
    const center = isoFn(pond.gx, pond.gy);
    const hasActive = state.ripples.some(function (r) { return (now - r.start) / 1000 < r.duration; });
    if (!hasActive) {
      state.ripples.push({ start: now, duration: 1.2, x: center.x, y: center.y, maxRadius: 48 });
    }
  }
  if (!near) state.shy = false;

  for (let i = 0; i < state.fish.length; i++) {
    const f = state.fish[i];
    f.angle += f.speed * dt;
    f.driftX *= Math.max(0, 1 - 1.5 * dt);
    f.driftY *= Math.max(0, 1 - 1.5 * dt);

    const bx = Math.cos(f.angle) * f.radius;
    const by = Math.sin(f.angle) * f.radius * f.verticalScale;
    f.bubbles.unshift({ x: bx + f.driftX, y: by + f.driftY, life: 1 });
    if (f.bubbles.length > 5) f.bubbles.pop();
    for (let b = 0; b < f.bubbles.length; b++) {
      f.bubbles[b].life = Math.max(0, f.bubbles[b].life - dt * 1.3);
    }
  }

  const nextRipples = [];
  for (let i = 0; i < state.ripples.length; i++) {
    const r = state.ripples[i];
    if ((now - r.start) / 1000 < r.duration) nextRipples.push(r);
  }
  state.ripples = nextRipples;
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  if (!state || !ctx || !Vv || Vv.gameState !== 'play' || state.fade <= 0) return;

  const pond = pondTile();
  const center = isoFn(pond.gx, pond.gy);
  const fade = state.fade;

  for (let i = 0; i < state.ripples.length; i++) {
    const r = state.ripples[i];
    const prog = (nowFn() - r.start) / (r.duration * 1000);
    if (prog < 0 || prog >= 1) continue;
    const radius = 6 + prog * r.maxRadius;
    ctx.globalAlpha = (1 - prog) * 0.75 * fade;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (let i = 0; i < state.fish.length; i++) {
    const f = state.fish[i];

    for (let b = 0; b < f.bubbles.length; b++) {
      const bubble = f.bubbles[b];
      if (bubble.life <= 0) continue;
      ctx.globalAlpha = bubble.life * 0.45 * fade;
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(Math.round(center.x + bubble.x), Math.round(center.y + bubble.y), 1, 1);
    }

    const bx = Math.cos(f.angle) * f.radius + f.driftX;
    const by = Math.sin(f.angle) * f.radius * f.verticalScale + f.driftY;
    const x = Math.round(center.x + bx);
    const y = Math.round(center.y + by);

    ctx.globalAlpha = 0.14 * fade;
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(x - 5, y - 5, 13, 13);
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillRect(x - 3, y - 3, 9, 9);

    ctx.globalAlpha = fade;
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(x, y, 3, 2);
  }
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildGlowfish) window.GuildGlowfish = createState();
  window.GuildGlowfish.update = update;
  window.GuildGlowfish.draw = draw;
  window.GuildGlowfish.__rawUpdate = update;
  window.GuildGlowfish.__probe = function () {
    const st = getState();
    if (!st) return { fish: 0, shy: false };
    return { fish: st.fish.length, shy: !!st.shy };
  };
}

export {};
