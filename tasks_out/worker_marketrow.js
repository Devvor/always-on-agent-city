function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  try {
    const w = root();
    if (w && typeof w.iso === 'function') return w.iso(gx, gy);
    const Vv = getV();
    const g = Vv && Vv.grid;
    if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  } catch (e) {}
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildMarketRow; }

function baseStalls() {
  return [
    { id: 0, baseGx: 0.4, baseGy: 5.0, gx: 0.4, gy: 5.0, kind: 'jar' },
    { id: 1, baseGx: 1.6, baseGy: 5.2, gx: 1.6, gy: 5.2, kind: 'bread' }
  ];
}

function createState() {
  return { stalls: baseStalls(), wisps: 0, puffs: [], nextWisp: 20 + Math.random() * 15, lastTime: null };
}

function clampOnIsland(stall, Vv) {
  if (!stall || !Vv) return;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  stall.gx = Math.max(minC, Math.min(maxC, stall.baseGx));
  stall.gy = Math.max(minC, Math.min(maxC, stall.baseGy));
}

function update(now) {
  try {
    if (typeof now !== 'number') now = nowFn();
    let state = getState();
    if (!state) return;
    if (!Array.isArray(state.stalls) || state.stalls.length !== 2) state.stalls = baseStalls();
    if (!Array.isArray(state.puffs)) state.puffs = [];
    if (typeof state.wisps !== 'number') state.wisps = 0;
    if (typeof state.nextWisp !== 'number') state.nextWisp = 20 + Math.random() * 15;
    if (state.lastTime === null) state.lastTime = now;

    const Vv = getV();
    for (let i = 0; i < state.stalls.length; i++) clampOnIsland(state.stalls[i], Vv);

    if (!Vv || Vv.gameState !== 'play') {
      state.lastTime = now;
      return;
    }

    let dt = (now - state.lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    state.lastTime = now;

    state.nextWisp -= dt;
    if (state.nextWisp <= 0) {
      state.nextWisp = 20 + Math.random() * 15;
      const stall = state.stalls[Math.floor(Math.random() * state.stalls.length)];
      const count = 2 + Math.floor(Math.random() * 2);
      const pt = isoFn(stall.gx, stall.gy);
      for (let i = 0; i < count; i++) {
        state.puffs.push({
          x: pt.x + (Math.random() - 0.5) * 10,
          y: pt.y - 8 - Math.random() * 6,
          vx: (Math.random() - 0.5) * 8,
          vy: -16 - Math.random() * 12,
          life: 1.5,
          age: 0,
          size: 2 + Math.random() * 2,
          alpha: 0.75 + Math.random() * 0.2
        });
      }
      const w = root();
      if (w && typeof w.cue === 'function') {
        try { w.cue('wisp'); } catch (e) {}
      }
    }

    const next = [];
    for (let i = 0; i < state.puffs.length; i++) {
      const p = state.puffs[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy -= 1.5 * dt;
      next.push(p);
    }
    state.puffs = next;
    state.wisps = next.length;
  } catch (e) {}
}

function drawStall(ctx, stall, now) {
  const pt = isoFn(stall.gx, stall.gy);
  const cx = Math.round(pt.x);
  const cy = Math.round(pt.y);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(cx - 18, cy + 10, 36, 4);

  ctx.fillStyle = '#4a3423';
  ctx.fillRect(cx - 16, cy - 2, 32, 10);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(cx - 16, cy - 8, 32, 6);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(cx - 16, cy - 8, 32, 2);
  ctx.fillRect(cx - 16, cy + 6, 32, 2);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(cx - 15, cy - 18, 2, 10);
  ctx.fillRect(cx + 13, cy - 18, 2, 10);

  const awningY = cy - 28;
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(cx - 20, awningY, 40, 12);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = (i % 2 === 0) ? '#e8e6df' : '#4a3423';
    ctx.fillRect(cx - 20 + i * 10, awningY, 10, 12);
  }
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(cx - 20, awningY + 10, 40, 2);

  if (stall.kind === 'jar') {
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(cx - 6, cy - 14, 12, 8);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(cx - 5, cy - 15, 10, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - 4, cy - 12, 4, 3);
  } else {
    ctx.fillStyle = '#e8d3a3';
    ctx.fillRect(cx - 8, cy - 13, 16, 7);
    ctx.fillStyle = '#c9a46c';
    ctx.fillRect(cx - 8, cy - 11, 16, 2);
    ctx.fillStyle = '#8b643f';
    ctx.fillRect(cx - 6, cy - 9, 12, 2);
  }
}

function draw(ctx) {
  try {
    const state = getState();
    const Vv = getV();
    if (!state || !ctx || !Vv || Vv.gameState !== 'play') return;

    for (let i = 0; i < state.stalls.length; i++) clampOnIsland(state.stalls[i], Vv);

    const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
    for (let i = 0; i < state.stalls.length; i++) {
      const stall = state.stalls[i];
      if (dl < 0.35) {
        const pt = isoFn(stall.gx, stall.gy);
        const lx = Math.round(pt.x);
        const ly = Math.round(pt.y - 8);
        const factor = 1 - (dl / 0.35);
        const alpha = 0.10 + factor * 0.10;
        const radius = 18 + factor * 8;
        const grad = ctx.createRadialGradient(lx, ly, 2, lx, ly, radius);
        grad.addColorStop(0, 'rgba(255,190,110,' + alpha + ')');
        grad.addColorStop(1, 'rgba(255,130,50,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      drawStall(ctx, stall, (typeof performance !== 'undefined') ? performance.now() : Date.now());
    }

    const pt0 = isoFn(state.stalls[0].gx, state.stalls[0].gy);
    const pt1 = isoFn(state.stalls[1].gx, state.stalls[1].gy);
    const sx = Math.round((pt0.x + pt1.x) * 0.5);
    const sy = Math.round((pt0.y + pt1.y) * 0.5) - 28;

    ctx.fillStyle = '#6b4a2d';
    ctx.fillRect(sx, sy - 8, 1, 8);
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(sx - 34, sy, 68, 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx - 34, sy, 68, 16);
    ctx.clip();
    ctx.fillStyle = '#e8e6df';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn('MARKET ROW', 64), sx, sy + 8);
    ctx.restore();
    ctx.textAlign = 'left';

    ctx.save();
    for (let i = 0; i < state.puffs.length; i++) {
      const p = state.puffs[i];
      const ratio = Math.max(0, 1 - (p.age / p.life));
      ctx.globalAlpha = ratio * p.alpha;
      ctx.fillStyle = '#e8f2ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, p.size * (1 + p.age * 0.2)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } catch (e) {}
}

function probe() {
  try {
    const s = getState();
    return {
      stalls: (s && Array.isArray(s.stalls)) ? s.stalls.length : 2,
      wisps: (s && typeof s.wisps === 'number') ? s.wisps : 0
    };
  } catch (e) {
    return { stalls: 2, wisps: 0 };
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildMarketRow) window.GuildMarketRow = createState();
  else {
    if (!Array.isArray(window.GuildMarketRow.stalls) || window.GuildMarketRow.stalls.length !== 2) {
      window.GuildMarketRow.stalls = baseStalls();
    }
    if (!Array.isArray(window.GuildMarketRow.puffs)) window.GuildMarketRow.puffs = [];
    if (typeof window.GuildMarketRow.wisps !== 'number') window.GuildMarketRow.wisps = 0;
    if (typeof window.GuildMarketRow.nextWisp !== 'number') window.GuildMarketRow.nextWisp = 20 + Math.random() * 15;
    if (window.GuildMarketRow.lastTime === undefined) window.GuildMarketRow.lastTime = null;
  }
  window.GuildMarketRow.update = update;
  window.GuildMarketRow.draw = draw;
  window.GuildMarketRow.__probe = probe;
}

export {};
