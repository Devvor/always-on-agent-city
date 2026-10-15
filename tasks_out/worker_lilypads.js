const PAD_DEFS = [
  { gx: -2.4, gy: -2.1 },
  { gx: -2.1, gy: -2.4 },
  { gx: -1.8, gy: -2.1 },
  { gx: -2.1, gy: -1.8 }
];

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return (w && w.V) ? w.V : null; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildLilyPads; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function createState() {
  const now = nowFn();
  const pads = PAD_DEFS.map(function (p, i) {
    return { id: i, gx: p.gx, gy: p.gy, phase: i * 0.9 };
  });
  const first = isoFn(pads[0].gx, pads[0].gy);
  return {
    pads: pads,
    fishingSpot: { gx: 1, gy: 0 },
    frog: {
      padIndex: 0,
      fromPad: 0,
      toPad: 0,
      hopping: false,
      hopStart: now,
      hopDuration: 0.4,
      nextHopAt: now + 900 + Math.random() * 1200,
      arc: 0,
      x: first.x,
      y: first.y
    },
    ripples: [],
    ready: true
  };
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

  const frog = st.frog;
  const pads = st.pads;
  if (!frog.hopping && now >= frog.nextHopAt && pads.length > 1) {
    let target = frog.padIndex;
    while (target === frog.padIndex) target = Math.floor(Math.random() * pads.length);
    frog.fromPad = frog.padIndex;
    frog.toPad = target;
    frog.hopStart = now;
    frog.hopDuration = 0.26 + Math.random() * 0.22;
    frog.arc = 9 + Math.random() * 4;
    frog.hopping = true;

    if (Math.random() < 0.30) {
      const w = root();
      const cueFn = w && w.cue;
      if (typeof cueFn === 'function') {
        try { cueFn('croak'); } catch (e) {}
      }
    }
  }

  if (frog.hopping) {
    const progress = clamp((now - frog.hopStart) / (frog.hopDuration * 1000), 0, 1);
    const a = isoFn(pads[frog.fromPad].gx, pads[frog.fromPad].gy);
    const b = isoFn(pads[frog.toPad].gx, pads[frog.toPad].gy);
    frog.x = a.x + (b.x - a.x) * progress;
    frog.y = a.y + (b.y - a.y) * progress - frog.arc * Math.sin(progress * Math.PI);

    if (progress >= 1) {
      frog.hopping = false;
      frog.padIndex = frog.toPad;
      const land = isoFn(pads[frog.padIndex].gx, pads[frog.padIndex].gy);
      frog.x = land.x;
      frog.y = land.y;
      st.ripples.push({ x: land.x, y: land.y, start: now, duration: 0.65 });
      frog.nextHopAt = now + 800 + Math.random() * 1600;
    }
  } else {
    const idle = isoFn(pads[frog.padIndex].gx, pads[frog.padIndex].gy);
    frog.x = idle.x;
    frog.y = idle.y + Math.sin(now * 0.004 + frog.padIndex) * 0.8;
  }

  const nextRipples = [];
  for (let i = 0; i < st.ripples.length; i++) {
    const r = st.ripples[i];
    const age = (now - r.start) / 1000;
    if (age >= 0 && age < r.duration) nextRipples.push(r);
  }
  st.ripples = nextRipples;
}

function drawPad(ctx, pad, now) {
  const pt = isoFn(pad.gx, pad.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y + Math.sin(now * 0.0025 + pad.phase) * 0.6);
  ctx.fillStyle = '#065f46';
  ctx.fillRect(x - 8, y - 2, 16, 6);
  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(x - 6, y - 3, 12, 3);
  ctx.fillStyle = '#34d399';
  ctx.fillRect(x - 1, y - 3, 2, 1);
}

function drawFrog(ctx, st, now) {
  const x = Math.round(st.frog.x);
  const y = Math.round(st.frog.y);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(x - 2, y - 2, 4, 3);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(x - 1, y - 4, 3, 2);
  ctx.fillStyle = '#d1fae5';
  ctx.fillRect(x + 1, y - 4, 1, 1);
}

function drawRipple(ctx, ripple, now) {
  const age = (now - ripple.start) / 1000;
  if (age < 0) return;
  const progress = clamp(age / ripple.duration, 0, 1);
  const radius = 3 + progress * 10;
  const alpha = 0.45 * (1 - progress);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();

  for (let i = 0; i < st.ripples.length; i++) drawRipple(ctx, st.ripples[i], now);
  for (let i = 0; i < st.pads.length; i++) drawPad(ctx, st.pads[i], now);
  drawFrog(ctx, st, now);
}

if (typeof window !== 'undefined') {
  const hasContract = !!window.V && (typeof window.iso === 'function') && (typeof window.fitText === 'function');
  if (hasContract) {
    if (!window.GuildLilyPads) window.GuildLilyPads = createState();
    window.GuildLilyPads.update = update;
    window.GuildLilyPads.draw = draw;
    if (!window.GuildLilyPads.fishingSpot) window.GuildLilyPads.fishingSpot = { gx: 1, gy: 0 };
  }
}

export {};
