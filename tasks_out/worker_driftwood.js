const ANCHOR_GX = 3;
const ANCHOR_GY = 5.5;

const states = (typeof WeakMap !== 'undefined') ? null : null;

function createState() {
  return {
    gx: ANCHOR_GX,
    gy: ANCHOR_GY,
    now: (typeof performance !== 'undefined') ? performance.now() : Date.now(),
    lastNow: null,
    gustActive: false,
    gustStart: 0,
    gustDuration: 2500,
    nextGustAt: null,
    gustSway: 0,
    lastChimeAt: -1000000,
    pathActive: false,
    pathStart: 0,
    pathEnd: 0,
    nextPathAt: null
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { return w.iso(gx, gy); } catch (e) { return null; }
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildDriftwood; }

function isNight(Vv) {
  if (!Vv) return false;
  if (typeof Vv.nightFactor === 'number') return Vv.nightFactor > 0.55;
  if (typeof Vv.daylight === 'number') return Vv.daylight < 0.3;
  return false;
}

function lanternLitNow() {
  return isNight(getV());
}

function pathActiveAllowed(Vv) {
  if (!Vv) return false;
  if (Vv.weather !== 'CLEAR') return false;
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 0.5;
  return dl > 0.25;
}

function scheduleInitial(st, now) {
  if (st.lastNow == null) {
    st.lastNow = now;
    st.nextGustAt = now + 15000 + Math.random() * 25000;
    st.nextPathAt = now + 8000 + Math.random() * 16000;
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;
  const Vv = getV();
  st.now = now;

  if (!Vv || Vv.gameState !== 'play') {
    st.lastNow = now;
    return;
  }

  scheduleInitial(st, now);

  let dt = (now - st.lastNow) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastNow = now;

  if (st.nextGustAt == null) st.nextGustAt = now + 15000 + Math.random() * 25000;
  if (st.nextPathAt == null) st.nextPathAt = now + 8000 + Math.random() * 16000;

  if (now >= st.nextGustAt) {
    st.gustActive = true;
    st.gustStart = now;
    st.gustDuration = 2200 + Math.random() * 1800;
    st.nextGustAt = now + 15000 + Math.random() * 25000;

    if (now - st.lastChimeAt >= 6000) {
      const w = root();
      if (w && typeof w.cue === 'function') {
        try { w.cue('chime'); } catch (e) {}
      }
      st.lastChimeAt = now;
    }
  }

  if (st.gustActive) {
    const t = (now - st.gustStart) / st.gustDuration;
    if (t >= 1) {
      st.gustActive = false;
      st.gustSway = 0;
    } else {
      const fade = 1 - t;
      st.gustSway = fade * fade;
    }
  } else {
    st.gustSway = 0;
  }

  if (st.pathActive && now >= st.pathEnd) st.pathActive = false;
  if (!st.pathActive && pathActiveAllowed(Vv) && now >= st.nextPathAt) {
    st.pathActive = true;
    st.pathStart = now;
    st.pathEnd = now + 4000 + Math.random() * 4000;
    st.nextPathAt = now + 25000 + Math.random() * 60000;
  }
}

function drawChimes(ctx, x, y, now, st) {
  if (!ctx) return;
  const gust = st ? st.gustSway : 0;
  const postH = 24;
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 16, y - 26, 2, postH);
  ctx.fillRect(x + 14, y - 26, 2, postH);

  ctx.strokeStyle = '#a89f95';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 15, y - 26);
  ctx.lineTo(x + 15, y - 26);
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const sx = x - 10 + i * 5;
    const phase = now * 0.0014 + i * 0.9;
    const swing = Math.sin(phase) * (1.3 + gust * 4.8) + gust * Math.sin(now * 0.021 + i) * 1.6;
    const sy = y - 18 + swing;
    ctx.fillStyle = '#f4e8c1';
    ctx.fillRect(Math.round(sx - 2), Math.round(sy), 4, 5);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(Math.round(sx), Math.round(sy + 1), 1, 1);
  }
}

function drawBench(ctx, x, y) {
  if (!ctx) return;
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 13, y - 8, 3, 10);
  ctx.fillRect(x + 10, y - 8, 3, 10);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 16, y - 10, 32, 6);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 14, y - 9, 28, 2);
}

function drawStoneAndCups(ctx, x, y) {
  if (!ctx) return;
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x + 12, y - 4, 16, 6);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 13, y - 4, 14, 2);
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(x + 16, y - 7, 3, 3);
  ctx.fillRect(x + 22, y - 7, 3, 3);
  ctx.fillStyle = '#b9b5a8';
  ctx.fillRect(x + 16, y - 4, 3, 1);
  ctx.fillRect(x + 22, y - 4, 3, 1);
}

function drawLantern(ctx, x, y) {
  if (!ctx) return;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(212,175,55,0.35)';
  ctx.fillRect(x - 8, y - 18, 16, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 2, y - 12, 4, 4);
  ctx.fillStyle = '#f3d37a';
  ctx.fillRect(x - 1, y - 11, 2, 2);
}

function drawFootpath(ctx, st, fromPt, toPt, now) {
  if (!ctx || !st || !st.pathActive) return;
  if (!fromPt || !toPt) return;
  const age = (now - st.pathStart) / 1000;
  const dur = (st.pathEnd - st.pathStart) / 1000;
  const fade = (dur > 0) ? Math.max(0, 1 - (age / dur)) : 0;
  if (fade <= 0) return;

  const fx = fromPt.x + 12;
  const fy = fromPt.y + 22;
  const tx = toPt.x;
  const ty = toPt.y;
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.hypot(dx, dy);
  if (!isFinite(len) || len <= 1) return;
  const steps = Math.max(8, Math.round(len / 5));

  ctx.save();
  ctx.globalAlpha = 0.18 * fade;
  ctx.fillStyle = '#d4af37';
  for (let i = 0; i <= steps; i++) {
    if (i % 2 !== 0) continue;
    const t = i / steps;
    const px = fx + dx * t;
    const py = fy + dy * t;
    ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
  }
  ctx.restore();
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const now = (typeof st.now === 'number') ? st.now : nowFn();
  const pt = isoFn(ANCHOR_GX, ANCHOR_GY);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;

  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  drawFootpath(ctx, st, isoFn(0, -1), pt, now);

  drawBench(ctx, x, y);
  drawStoneAndCups(ctx, x, y);
  drawChimes(ctx, x, y, now, st);

  if (lanternLitNow()) {
    drawLantern(ctx, x - 5, y - 6);
  }
}

function probe() {
  const st = getState();
  return {
    gustSway: (st && typeof st.gustSway === 'number') ? st.gustSway : 0,
    lanternLit: lanternLitNow()
  };
}

if (typeof window !== 'undefined') {
  if (!window.GuildDriftwood) window.GuildDriftwood = createState();
  const s = window.GuildDriftwood;
  s.update = update;
  s.draw = draw;
  s.__probe = probe;
}

export {};
