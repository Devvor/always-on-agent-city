function createState() {
  return {
    anchorGx: 3,
    anchorGy: 6,
    dipPeriod: 8000,
    dipDuration: 1400,
    rippleDuration: 1800,
    lastDipAt: null,
    dipActive: false,
    dipStart: 0,
    ripples: []
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  return null;
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildBobber; }

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!isoFn(st.anchorGx, st.anchorGy)) return;

  if (st.lastDipAt === null) st.lastDipAt = now;
  if (!st.dipActive && now - st.lastDipAt >= st.dipPeriod) {
    st.dipActive = true;
    st.dipStart = now;
    st.ripples.push({ start: now, delay: 0 });
    st.ripples.push({ start: now, delay: 350 });
    if (typeof root().cue === 'function') {
      try { root().cue('bobber'); } catch (e) {}
    }
  }
  if (st.dipActive && now - st.dipStart >= st.dipDuration) {
    st.dipActive = false;
    st.lastDipAt = now;
  }
  const next = [];
  for (let i = 0; i < st.ripples.length; i++) {
    const r = st.ripples[i];
    if (now - r.start - r.delay < st.rippleDuration) next.push(r);
  }
  st.ripples = next;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;
  const pt = isoFn(st.anchorGx, st.anchorGy);
  if (!pt) return;
  const now = nowFn();

  const t = now * 0.001;
  let bob = Math.sin(t * 2.2) * 2;
  let sink = 0;
  if (st.dipActive) {
    const dp = Math.min(1, (now - st.dipStart) / st.dipDuration);
    const env = Math.sin(dp * Math.PI);
    sink = env * 7;
    bob = Math.sin(t * 9) * 1.2 * env;
  }
  const x = Math.round(pt.x);
  const y = Math.round(pt.y + bob + sink);

  // ripple rings (blues only)
  for (let i = 0; i < st.ripples.length; i++) {
    const r = st.ripples[i];
    const age = now - r.start - r.delay;
    if (age < 0) continue;
    const p = age / st.rippleDuration;
    if (p >= 1) continue;
    const alpha = (1 - p) * 0.55;
    const rx = 4 + p * 22;
    const ry = 2 + p * 10;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(x, Math.round(pt.y) + 2, rx, ry, 0, 0, Math.PI * 2);
    else ctx.arc(x, Math.round(pt.y) + 2, (rx + ry) * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // water shadow
  ctx.fillStyle = 'rgba(59,130,246,0.35)';
  ctx.beginPath();
  if (ctx.ellipse) ctx.ellipse(x, Math.round(pt.y) + 2, 7, 3, 0, 0, Math.PI * 2);
  else ctx.arc(x, Math.round(pt.y) + 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // red-and-white bobber
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(x, y - 4, 4, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3f4f6';
  ctx.beginPath();
  ctx.arc(x, y - 4, 4, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y - 4, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x - 1, y - 12, 2, 5);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 1, y - 14, 2, 2);
}

if (typeof window !== 'undefined') {
  if (!window.GuildBobber) window.GuildBobber = createState();
  window.GuildBobber.update = update;
  window.GuildBobber.draw = draw;
  window.GuildBobber.__probe = function () {
    const st = window.GuildBobber;
    return {
      anchor: { gx: st.anchorGx, gy: st.anchorGy },
      dipActive: st.dipActive,
      lastDipAt: st.lastDipAt,
      rippleCount: st.ripples.length
    };
  };
}

export {};
