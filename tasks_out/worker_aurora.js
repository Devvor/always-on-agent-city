const BAND_BLUEPRINTS = [
  { color: '#34d399', baseAlpha: 0.08, yFactor: 0.10, amp: 26, freq: 0.011, phase0: 0.2, ripple: Math.PI * 2 / 8, width: 30, driftSpeed: 12 },
  { color: '#a78bfa', baseAlpha: 0.10, yFactor: 0.18, amp: 20, freq: 0.014, phase0: 1.8, ripple: Math.PI * 2 / 8, width: 24, driftSpeed: -10 },
  { color: '#34d399', baseAlpha: 0.07, yFactor: 0.14, amp: 30, freq: 0.009, phase0: 3.6, ripple: Math.PI * 2 / 8, width: 34, driftSpeed: 16 }
];

function cloneBands() {
  const out = [];
  for (let i = 0; i < BAND_BLUEPRINTS.length; i++) {
    const b = BAND_BLUEPRINTS[i];
    const o = {};
    for (const k in b) o[k] = b[k];
    o.id = i;
    o.phase = b.phase0;
    o.drift = 0;
    o.opacity = b.baseAlpha;
    out.push(o);
  }
  return out;
}

let bands = cloneBands();
let lastTime = null;
let fadeStart = null;
let fadeFrom = 0;
let fadeTo = 0;
let prevNight = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildAurora; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function clamp(v, a, b) {
  if (v < a) return a;
  if (v > b) return b;
  return v;
}

function probeNight() {
  const Vv = getV();
  return (Vv && typeof Vv.daylight === 'number' && Vv.daylight < 0.22) ? 1 : 0;
}

function getFade(now, Vv) {
  const night = !!(Vv && typeof Vv.daylight === 'number' && Vv.daylight < 0.22);
  if (prevNight === null) {
    prevNight = night;
    fadeFrom = night ? 1 : 0;
    fadeTo = fadeFrom;
    fadeStart = now;
  } else if (night !== prevNight) {
    const elapsed = now - (fadeStart == null ? now : fadeStart);
    const prog = clamp(elapsed / 2000, 0, 1);
    fadeFrom = fadeFrom + (fadeTo - fadeFrom) * prog;
    fadeTo = night ? 1 : 0;
    fadeStart = now;
    prevNight = night;
  }
  if (fadeStart == null) fadeStart = now;
  const prog = clamp((now - fadeStart) / 2000, 0, 1);
  return fadeFrom + (fadeTo - fadeFrom) * prog;
}

function refresh(now, Vv, st) {
  const fade = getFade(now, Vv);
  const rain = !!(Vv && Vv.weather === 'RAIN');
  const rainMul = rain ? 0.5 : 1;
  const globalMul = clamp(fade * rainMul, 0, 1);
  const sec = now / 1000;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    b.phase = b.phase0 + sec * b.ripple;
    b.drift = sec * b.driftSpeed;
    b.opacity = clamp(b.baseAlpha * globalMul, 0, 1);
  }
  if (st) {
    st.bands = bands;
    st.fade = globalMul;
  }
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
  refresh(now, Vv, st);
}

function draw(ctx) {
  // Regular draw intentionally does nothing.
}

function drawBackdrop(ctx, now) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) return;
  if (typeof now !== 'number') now = nowFn();
  const c = Vv.canvas;
  if (!c || !c.width || !c.height) return;

  refresh(now, Vv, st);
  const globalMul = (typeof st.fade === 'number') ? st.fade : 0;
  if (globalMul <= 0.001) return;

  const w = c.width;
  const h = c.height;
  const steps = Math.max(32, Math.round(w / 8));

  ctx.save();
  for (let bi = 0; bi < bands.length; bi++) {
    const b = bands[bi];
    if (b.opacity <= 0.001) continue;

    const baseY = Math.round(h * b.yFactor);
    function topAt(x) {
      return baseY + Math.sin((x + b.drift) * b.freq + b.phase) * b.amp;
    }
    function bottomAt(x) {
      return topAt(x) + b.width;
    }

    ctx.globalAlpha = b.opacity;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const y = topAt(x);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const x = (i / steps) * w;
      const y = bottomAt(x);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = b.opacity * 0.55;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * w;
      const y = (topAt(x) + bottomAt(x)) * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildAurora) window.GuildAurora = { bands: cloneBands() };
  const g = window.GuildAurora;
  if (!Array.isArray(g.bands)) g.bands = cloneBands();
  if (g.bands.length === 0) g.bands = cloneBands();
  bands = g.bands;
  g.update = update;
  g.draw = draw;
  g.drawBackdrop = drawBackdrop;
  g.__probe = function () { return { bands: bands, night: probeNight() }; };
  g.__rawUpdate = update;
}

export {};
