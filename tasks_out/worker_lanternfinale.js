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
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function getState() { const w = root(); return w && w.GuildFinale; }

// SW market row anchor: offset 2+ tiles from the wishing booth / greeter props.
var COUNTER_GX = -2.4;
var COUNTER_GY = 2.6;
var ZONE_CENTER_GX = -1.6;
var ZONE_CENTER_GY = 1.8;
var ZONE_RADIUS = 2.6;
var CHEER_GOAL = 50;
var DWELL_INTERVAL = 4;
var DWELL_CAP = 10;
var COIN_CHEER = 5;
var FINALE_DURATION = 15;
var LIFT_DURATION = 8;

function createState() {
  return {
    cheer: 0,
    finaleDone: false,
    finaleActive: false,
    finaleStart: 0,
    dwellAccum: 0,
    dwellEarned: 0,
    lastCoins: null,
    nightKey: '',
    lanterns: [],
    lifted: [],
    lastTime: null
  };
}

function nightKeyOf(Vv) {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function isNight(Vv) {
  return typeof Vv.daylight === 'number' && Vv.daylight < 0.3;
}

function visitorInZone(Vv) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || typeof vis.gx !== 'number' || typeof vis.gy !== 'number') return false;
  const dx = vis.gx - ZONE_CENTER_GX;
  const dy = vis.gy - ZONE_CENTER_GY;
  return Math.hypot(dx, dy) <= ZONE_RADIUS;
}

function pollCoins(st) {
  const w = root();
  const booth = w && w.GuildWishBooth;
  if (!booth || typeof booth.coins !== 'number' || !isFinite(booth.coins)) return 0;
  const c = Math.max(0, Math.floor(booth.coins));
  if (st.lastCoins === null) { st.lastCoins = c; return 0; }
  if (c > st.lastCoins) {
    const gained = c - st.lastCoins;
    st.lastCoins = c;
    return gained;
  }
  if (c < st.lastCoins) st.lastCoins = c;
  return 0;
}

function collectAnchorPoints() {
  const w = root();
  const pts = [];
  const booth = w && w.GuildWishBooth;
  if (booth && typeof booth.gx === 'number' && typeof booth.gy === 'number') {
    pts.push({ gx: booth.gx, gy: booth.gy });
  }
  const greeter = w && w.GuildLanternGreeter;
  if (greeter && typeof greeter.gx === 'number' && typeof greeter.gy === 'number') {
    pts.push({ gx: greeter.gx, gy: greeter.gy });
  }
  return pts;
}

function rowLanternSpots() {
  // our own lanterns along the SW market row, offset from other props
  return [
    { gx: -2.1, gy: 1.2 },
    { gx: -1.4, gy: 2.2 },
    { gx: -2.6, gy: 2.1 },
    { gx: -0.9, gy: 1.5 }
  ];
}

function startFinale(st, now) {
  st.finaleActive = true;
  st.finaleStart = now;
  st.finaleDone = true;
  st.cheer = 0;
  st.lifted = [];
  const spots = rowLanternSpots().slice();
  const anchors = collectAnchorPoints();
  for (let i = 0; i < anchors.length; i++) spots.push(anchors[i]);
  for (let i = 0; i < spots.length; i++) {
    const wave = i % 3; // three staggered waves
    st.lifted.push({
      gx: spots[i].gx,
      gy: spots[i].gy,
      wave: wave,
      phase: (i * 1.7) % (Math.PI * 2),
      seed: i
    });
  }
  cue('levelup');
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { st && (st.lastTime = now); return; }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  // reset per-night state when a new night begins
  const key = nightKeyOf(Vv);
  if (key !== st.nightKey) {
    st.nightKey = key;
    st.finaleDone = false;
    st.cheer = 0;
    st.dwellEarned = 0;
    st.dwellAccum = 0;
    st.lastCoins = null;
  }

  // finale flight animation
  if (st.finaleActive) {
    const elapsed = (now - st.finaleStart) / 1000;
    if (elapsed >= FINALE_DURATION) {
      st.finaleActive = false;
      st.lifted = [];
    }
    return;
  }

  if (!isNight(Vv) || st.finaleDone) return;

  // dwell cheer: +1 every 4s visitor stays in market zone after dusk (cap 10/night)
  if (visitorInZone(Vv)) {
    st.dwellAccum += dt;
    while (st.dwellAccum >= DWELL_INTERVAL && st.dwellEarned < DWELL_CAP) {
      st.dwellAccum -= DWELL_INTERVAL;
      st.dwellEarned += 1;
      st.cheer += 1;
    }
    if (st.dwellEarned >= DWELL_CAP) st.dwellAccum = 0;
  } else {
    st.dwellAccum = 0;
  }

  // coin cheer: +5 per new wish-booth coin
  const newCoins = pollCoins(st);
  if (newCoins > 0) st.cheer += COIN_CHEER * newCoins;

  if (st.cheer >= CHEER_GOAL) startFinale(st, now);
}

function drawLantern(ctx, x, y, alpha, glow) {
  ctx.globalAlpha = alpha;
  // paper body
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x - 4, y - 6, 8, 10);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 5, y - 7, 10, 2);
  ctx.fillRect(x - 5, y + 4, 10, 2);
  // gold light core
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 2, y - 4, 4, 6);
  ctx.fillStyle = '#f3d37a';
  ctx.fillRect(x - 1, y - 3, 2, 4);
  if (glow > 0) {
    ctx.globalAlpha = alpha * glow * 0.35;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 9, y - 11, 18, 20);
  }
  ctx.globalAlpha = 1;
}

function drawCounter(ctx, st, Vv, now) {
  const pt = isoFn(COUNTER_GX, COUNTER_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  // brass counter stand
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 14, y + 12, 28, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 10, y - 6, 20, 18);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 12, y - 10, 24, 6);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 12, y - 10, 24, 6);
  // plaque text
  const label = 'NIGHT-MARKET CHEER: ' + Math.min(CHEER_GOAL, Math.max(0, Math.floor(st.cheer))) + '/' + CHEER_GOAL;
  ctx.font = 'bold 9px monospace';
  const tw = ctx.measureText(label).width;
  const pw = Math.round(tw) + 10;
  const px = x - Math.round(pw * 0.5);
  const py = y - 30;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, 13);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, 13);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(label, pw - 6), px + pw * 0.5, py + 7);
  ctx.textAlign = 'left';
  // cheer progress ticks on the counter top
  const ratio = Math.max(0, Math.min(1, st.cheer / CHEER_GOAL));
  ctx.fillStyle = '#2a1f0c';
  ctx.fillRect(x - 10, y - 4, 20, 3);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 10, y - 4, Math.round(20 * ratio), 3);
}

function drawHalos(ctx, Vv, now) {
  const anchors = collectAnchorPoints();
  for (let i = 0; i < anchors.length; i++) {
    const pt = isoFn(anchors[i].gx, anchors[i].gy);
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.004 + i * 2.1));
    ctx.globalAlpha = 0.30 * pulse;
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(Math.round(pt.x), Math.round(pt.y) - 14, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawLantern(ctx, Math.round(pt.x), Math.round(pt.y) - 14, 0.9, pulse);
  }
}

function drawRowLanterns(ctx, st, Vv, now) {
  const spots = rowLanternSpots();
  for (let i = 0; i < spots.length; i++) {
    const pt = isoFn(spots[i].gx, spots[i].gy);
    const flick = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.005 + i * 1.3));
    drawLantern(ctx, Math.round(pt.x), Math.round(pt.y) - 10, 0.9, flick);
  }
}

function drawFinale(ctx, st, Vv, now) {
  const elapsed = (now - st.finaleStart) / 1000;
  const g = Vv.grid;
  const fadeStart = FINALE_DURATION - 5;
  const globalFade = elapsed >= fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / 5) : 1;
  for (let i = 0; i < st.lifted.length; i++) {
    const L = st.lifted[i];
    const liftDelay = L.wave * (LIFT_DURATION / 3); // three staggered waves across 8s
    const t = elapsed - liftDelay;
    if (t < 0) {
      // still resting on the row
      const pt = isoFn(L.gx, L.gy);
      drawLantern(ctx, Math.round(pt.x), Math.round(pt.y) - 10, globalFade, 0.8);
      continue;
    }
    const liftT = Math.min(1, t / LIFT_DURATION);
    const pt = isoFn(L.gx, L.gy);
    // drift up and south (south = +gy) on a gentle sine wind
    const rise = liftT * 190;
    const south = liftT * 2.2;
    const sway = Math.sin(t * 1.1 + L.phase) * (10 + liftT * 26);
    const lx = Math.round(pt.x + sway);
    const ly = Math.round(pt.y - 10 - rise);
    // fade before the tree line
    const treeY = (Vv.grid ? Vv.grid.originY : 0) - 60;
    const fade = Math.max(0, Math.min(1, (ly - treeY) / 80)) * globalFade;
    if (fade <= 0) continue;
    drawLantern(ctx, lx, ly, fade, 0.9);
    // trailing ember
    ctx.globalAlpha = fade * 0.5;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(lx - 1, ly + 8, 2, 2);
    ctx.globalAlpha = 1;
  }
  // banner during finale
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (canvas && elapsed < FINALE_DURATION - 1) {
    const a = Math.min(1, elapsed / 0.6) * Math.min(1, (FINALE_DURATION - 1 - elapsed) / 1.5);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    const label = 'THE NIGHT-MARKET LANTERN RELEASE';
    ctx.font = 'bold 16px monospace';
    const tw = ctx.measureText(label).width;
    const bx = Math.round((canvas.width - tw) * 0.5) - 14;
    const by = 64;
    ctx.fillStyle = 'rgba(10,10,12,0.85)';
    ctx.fillRect(bx, by, tw + 28, 26);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, tw + 28, 26);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + (tw + 28) * 0.5, by + 13);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx || !Vv.grid) return;
  const now = nowFn();
  if (st.finaleActive) {
    drawFinale(ctx, st, Vv, now);
    return;
  }
  if (isNight(Vv)) {
    drawRowLanterns(ctx, st, Vv, now);
    drawHalos(ctx, Vv, now);
    drawCounter(ctx, st, Vv, now);
  } else {
    // counter visible by day too, unlit lanterns
    drawCounter(ctx, st, Vv, now);
    const spots = rowLanternSpots();
    for (let i = 0; i < spots.length; i++) {
      const pt = isoFn(spots[i].gx, spots[i].gy);
      drawLantern(ctx, Math.round(pt.x), Math.round(pt.y) - 10, 0.55, 0);
    }
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildFinale) window.GuildFinale = createState();
  window.GuildFinale.update = update;
  window.GuildFinale.draw = draw;
  window.GuildFinale.__probe = function () {
    const st = window.GuildFinale;
    return { cheer: st.cheer, finaleDone: st.finaleDone };
  };
}

export {};
