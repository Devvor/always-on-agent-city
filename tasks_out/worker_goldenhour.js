// worker_goldenhour.js — GuildGoldenHour: the dawn/dusk golden-hour sky grade.
// A backdrop-only module (screen space): the client paints it BEFORE the island,
// after its own sky. It never draws over the island and never writes to V.
//
// Conventions match worker_visitor.js: self-installing ES module, no imports,
// typeof guards, state on the window global, update(now) + __probe.

// Warm hues already in the client palette (gold #d4af37 family + the day-sky dusp/cream
// tones from drawSky): index 0 is the horizon gold, higher indices are lighter, higher up.
const GOLD_HUES = ['#d4af37', '#fde68a', '#f3d37a', '#ffe8bc'];

const BAND_LO = 0.35;         // lower edge of the dawn/dusk shoulder (V.daylight)
const BAND_HI = 0.62;         // upper edge of the dawn/dusk shoulder
const FEATHER = 0.16;         // how far outside the band the grade eases to zero
const RAMP_SECONDS = 60;      // eased ramp (tau = RAMP/3 -> ~95% of target in 60s)
const MAX_ALPHA = 0.18;       // per-strip cap; strips never overlap, so added alpha stays < 0.2

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildGoldenHour; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

function readDaylight(Vv) {
  const d = (Vv && typeof Vv.daylight === 'number' && isFinite(Vv.daylight)) ? Vv.daylight : 0;
  return clamp(d, 0, 1);
}

// t is the distance of V.daylight from the mid-day plateau (daylight == 1). The
// 0.35-0.62 daylight band is where the shoulders live, so the grade peaks there.
function shoulderTarget(dl) {
  if (dl >= BAND_LO && dl <= BAND_HI) return 1;
  const edge = (dl < BAND_LO) ? BAND_LO : BAND_HI;
  return smoothstep(1 - Math.abs(dl - edge) / FEATHER);
}

// Eased star alpha for the night side: 0 in full day, rising to 1 through the dusk
// shoulder (and back to 0 through the dawn shoulder). The sky module may read
// window.GuildGoldenHour.starAlpha instead of drawing its own night fade.
function starTarget(dl) {
  return smoothstep((BAND_HI - dl) / (BAND_HI - BAND_LO));
}

function step(now, Vv, st, dt) {
  const dl = readDaylight(Vv);
  const target = shoulderTarget(dl);
  const sTarget = starTarget(dl);

  if (!st.__initialized) {
    // first sight: snap to the current shoulder so we don't fake a ramp on load
    st.__initialized = true;
    st.grade = target;
    st.starAlpha = sTarget;
  } else {
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    const k = 1 - Math.exp(-dt / (RAMP_SECONDS / 3));   // 60s eased ramp
    st.grade += (target - st.grade) * k;
    st.starAlpha += (sTarget - st.starAlpha) * k;
    if (Math.abs(target - st.grade) < 0.0008) st.grade = target;
    if (Math.abs(sTarget - st.starAlpha) < 0.0008) st.starAlpha = sTarget;
  }
  st.grade = clamp(st.grade, 0, 1);
  st.starAlpha = clamp(st.starAlpha, 0, 1);

  if (target <= 0.0001) {
    st.phase = 'none';
  } else {
    const prev = (typeof st.__lastDl === 'number') ? st.__lastDl : dl;
    if (dl > prev + 1e-6) st.phase = 'dawn';
    else if (dl < prev - 1e-6) st.phase = 'dusk';
    else if (typeof Vv.dayHour === 'number') st.phase = (Vv.dayHour >= 12) ? 'dusk' : 'dawn';
    else if (st.phase !== 'dawn' && st.phase !== 'dusk') st.phase = 'none';
  }
  st.__lastDl = dl;
}

let lastTime = null;
let lastStepNow = null;

function ensureStep(now, Vv, st) {
  if (lastStepNow === now) return;             // drawBackdrop + update share one frame
  let dt = 0;
  if (lastTime !== null) {
    dt = (now - lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
  }
  lastTime = now;
  lastStepNow = now;
  step(now, Vv, st, dt);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    lastStepNow = now;
    return;
  }
  ensureStep(now, Vv, st);
}

function draw() {
  // Backdrop-only module: all painting happens in drawBackdrop.
}

function drawBackdrop(ctx, now) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) return;
  const c = Vv.canvas;
  if (!c || !c.width || !c.height) return;
  if (typeof now !== 'number') now = nowFn();
  if (Vv.gameState === 'play') ensureStep(now, Vv, st);

  const grade = clamp(st.grade || 0, 0, 1);
  if (grade <= 0.001) return;

  const w = c.width;
  const h = c.height;
  const topY = 0;
  const horizonY = Math.round(h * 0.5);        // sky region = upper half; glow peaks at the horizon
  const span = Math.max(1, horizonY - topY);

  // Layered horizontal translucent bands. Bands are ADJACENT, never overlapping, so
  // the alpha added at any pixel is a single <= MAX_ALPHA value: the client's own
  // day/night tint is not doubled up and total added alpha stays under 0.2.
  const STRIPS = 16;
  ctx.save();
  for (let i = 0; i < STRIPS; i++) {
    const yA = topY + Math.round((span * i) / STRIPS);
    const yB = topY + Math.round((span * (i + 1)) / STRIPS);
    const bh = yB - yA;
    if (bh <= 0) continue;
    const mid = (i + 0.5) / STRIPS;             // 0 at top -> 1 at the horizon line
    const weight = smoothstep(mid);             // strongest near the horizon, fades upward
    const alpha = MAX_ALPHA * grade * weight;
    if (alpha <= 0.002) continue;
    const ci = clamp(Math.floor((1 - weight) * GOLD_HUES.length), 0, GOLD_HUES.length - 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = GOLD_HUES[ci];
    ctx.fillRect(0, yA, w, bh);
  }
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildGoldenHour) window.GuildGoldenHour = { grade: 0, phase: 'none', starAlpha: 0 };
  const g = window.GuildGoldenHour;
  if (typeof g.grade !== 'number') g.grade = 0;
  if (typeof g.phase !== 'string') g.phase = 'none';
  if (typeof g.starAlpha !== 'number') g.starAlpha = 0;
  g.update = update;
  g.draw = draw;
  g.drawBackdrop = drawBackdrop;
  g.__probe = function () {
    const s = getState();
    return s ? { grade: s.grade, phase: s.phase, starAlpha: s.starAlpha }
             : { grade: 0, phase: 'none', starAlpha: 0 };
  };
  g.__rawUpdate = update;
}

export {};
