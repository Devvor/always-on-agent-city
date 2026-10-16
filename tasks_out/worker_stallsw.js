// =====================================================================
// SNACK STALL SATELLITE (SW MARKET ROW) :: window.GuildStallSW
// ---------------------------------------------------------------------
// A small wooden snack stall with a striped awning, a snack tray and a
// coin bowl, planted in the SW market zone (anchor ~ grid (1,5)). Pure
// prop/FX: no stall economy, no collision, never writes to V or to any
// worker position. Idle life: the awning sways and a coin glints every
// few seconds whenever the visitor or any worker stands nearby.
// Conventions copied from tasks_out/worker_visitor.js: self-installing
// ES module, no imports, no top-level DOM access (typeof guards), state
// on a window global exposing update(now)/draw(ctx)/__probe(). Bails
// silently when V or iso are missing. Palette: wood browns + gold
// #d4af37 + stone greys (existing colours only).
// =====================================================================

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildStallSW; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try {
      const p = w.iso(gx, gy);
      if (p && isFinite(p.x) && isFinite(p.y)) return p;
    } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g && isFinite(g.originX) && isFinite(g.originY) && isFinite(g.tileW) && isFinite(g.tileH)) {
    return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  }
  return null;
}

function hasIso(Vv) {
  const w = root();
  if (w && typeof w.iso === 'function') return true;
  return !!(Vv && Vv.grid && isFinite(Vv.grid.originX) && isFinite(Vv.grid.tileW));
}

// ---- palette (existing colours only) --------------------------------
const GOLD = '#d4af37';
const GOLD_SOFT = '#f3d37a';
const TAN = '#e8e6df';
const WOOD_DARK = '#4a3423';
const WOOD_MID = '#6b4a2d';
const WOOD_LIGHT = '#8b643f';
const BUN = '#c9a46c';
const STONE = '#78716c';
const STONE_DARK = '#57534e';

// ---- zone + placement ------------------------------------------------
const MIN_PROP_TILES = 2;         // ZONE RULE: 2+ tiles from every prop
const PROXIMITY_TILES = 2.5;      // visitor/worker this close wakes the stall
const GLINT_INTERVAL = 3.0;       // seconds between coin glints while occupied
const GLINT_DURATION = 0.55;      // seconds a glint lasts

function zoneAnchor() {
  const w = root();
  const zones = w && w.GuildZones;
  const z = zones && (zones.SW_MARKET || zones.SW_MARKET_ROW);
  if (z && isFinite(z.gx) && isFinite(z.gy)) return { gx: z.gx, gy: z.gy };
  return { gx: 1, gy: 5 };   // SW market row anchor (grid around (1,5))
}
const ANCHOR = zoneAnchor();

// Documented existing props the lot must clear (SW market row + nearby
// S-rim tide cluster + the lantern-greeter loop).
const PROP_TILES = [
  [-1.6, 4.2], [0.5, 4.0],
  [-1, 5], [0, 5], [1, 5], [2, 5],
  [0.5, 5.3], [0.0, 5.4], [-0.4, 4.9], [-0.5, 5.2],
  [-2.5, 4.8], [-1.0, 5.2], [0.8, 4.5], [-3, 3], [-2, 2],
  [1.8, 4.2], [3.0, 4.2], [3.0, 5.6], [1.8, 5.6],
  [1, 6], [2, 7], [3, 6], [1.5, 6.8], [4.5, 7.2], [4.5, 7.5]
];

function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

function clears(gx, gy) {
  for (let i = 0; i < PROP_TILES.length; i++) {
    if (cheb(gx, gy, PROP_TILES[i][0], PROP_TILES[i][1]) < MIN_PROP_TILES) return false;
  }
  return true;
}

// Nearest integer tile to the anchor that stands 2+ tiles off every prop
// (the SW row itself is saturated, so the lot takes the closest clear one).
function nearestClear() {
  let best = null;
  for (let dy = -8; dy <= 10; dy++) {
    for (let dx = -8; dx <= 12; dx++) {
      const gx = ANCHOR.gx + dx;
      const gy = ANCHOR.gy + dy;
      if (!clears(gx, gy)) continue;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.d) best = { gx: gx, gy: gy, d: d };
    }
  }
  if (best) return { gx: best.gx, gy: best.gy };
  return { gx: ANCHOR.gx, gy: ANCHOR.gy };
}

// ---- state -----------------------------------------------------------
function createState() {
  const spot = nearestClear();
  return {
    gx: spot.gx,
    gy: spot.gy,
    anchorGx: ANCHOR.gx,
    anchorGy: ANCHOR.gy,
    az: 0,
    glintTimer: GLINT_INTERVAL,
    glint: false,
    glintAge: 0,
    glints: 0,
    near: false,
    lastNow: null
  };
}

// ---- proximity -------------------------------------------------------
function tileDistance(sx, sy, wx, wy, g) {
  if (!g || !isFinite(g.tileW) || !isFinite(g.tileH) || !g.tileW || !g.tileH) return Infinity;
  const dx = sx - wx;
  const dy = sy - wy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function anyoneNear(Vv, st) {
  const p = isoFn(st.gx, st.gy);
  if (!p) return false;
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    if (Math.hypot(vis.gx - st.gx, vis.gy - st.gy) <= PROXIMITY_TILES) return true;
  }
  const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  for (let i = 0; i < ws.length; i++) {
    const wk = ws[i];
    if (!wk || !isFinite(wk.x) || !isFinite(wk.y)) continue;
    if (tileDistance(p.x, p.y, wk.x, wk.y, Vv.grid) <= PROXIMITY_TILES) return true;
  }
  return false;
}

// ---- update ----------------------------------------------------------
function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) return;          // bail silently
  if (!hasIso(Vv)) return;         // bail silently
  if (st.lastNow === null) st.lastNow = now;
  let dt = (now - st.lastNow) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastNow = now;
  if (Vv.gameState !== 'play') return;

  st.az += dt;

  const near = anyoneNear(Vv, st);
  st.near = near;
  if (near) {
    if (!st.glint) {
      st.glintTimer -= dt;
      if (st.glintTimer <= 0) {
        st.glint = true;
        st.glintAge = 0;
        st.glints += 1;
        st.glintTimer = GLINT_INTERVAL;
      }
    }
  } else if (!st.glint) {
    st.glintTimer = 0.7;   // brief beat before the first glint when someone arrives
  }

  if (st.glint) {
    st.glintAge += dt;
    if (st.glintAge >= GLINT_DURATION) {
      st.glint = false;
      st.glintAge = 0;
    }
  }
}

// ---- drawing ---------------------------------------------------------
function drawCoinGlint(ctx, x, y, a) {
  const r = 2 + Math.round(a * 2);
  ctx.save();
  ctx.globalAlpha = 0.85 * a;
  ctx.fillStyle = GOLD_SOFT;
  ctx.fillRect(x - 1, y - r, 2, r * 2 + 1);
  ctx.fillRect(x - r, y - 1, r * 2 + 1, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) return;          // bail silently
  if (!hasIso(Vv)) return;         // bail silently
  if (Vv.gameState !== 'play') return;
  const p = isoFn(st.gx, st.gy);
  if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 17, y + 6, 34, 4);

  // wooden posts
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x - 15, y - 16, 2, 18);
  ctx.fillRect(x + 13, y - 16, 2, 18);

  // counter
  ctx.fillStyle = WOOD_MID;
  ctx.fillRect(x - 16, y - 7, 32, 10);
  ctx.fillStyle = WOOD_LIGHT;
  ctx.fillRect(x - 17, y - 10, 34, 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 17, y - 3, 34, 1);

  // snack tray (left of the counter)
  ctx.fillStyle = WOOD_LIGHT;
  ctx.fillRect(x - 13, y - 14, 14, 4);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x - 13, y - 14, 14, 1);
  ctx.fillStyle = BUN;
  ctx.fillRect(x - 11, y - 16, 4, 3);
  ctx.fillRect(x - 6, y - 16, 4, 3);
  ctx.fillStyle = WOOD_LIGHT;
  ctx.fillRect(x - 11, y - 16, 4, 1);
  ctx.fillRect(x - 6, y - 16, 4, 1);

  // coin bowl (right of the counter)
  ctx.fillStyle = STONE;
  ctx.fillRect(x + 3, y - 13, 11, 5);
  ctx.fillStyle = STONE_DARK;
  ctx.fillRect(x + 3, y - 13, 11, 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x + 5, y - 15, 3, 2);
  ctx.fillRect(x + 8, y - 14, 3, 2);

  // striped awning, swaying gently
  const sway = Math.round(Math.sin(st.az * 1.6) * 1.4);
  const awX = x - 20 + sway;
  const awY = y - 26;
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(awX, awY - 1, 41, 2);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = (i % 2 === 0) ? TAN : WOOD_MID;
    ctx.fillRect(awX + i * 5, awY, 5, 11);
  }
  ctx.fillStyle = GOLD;
  ctx.fillRect(awX, awY + 11, 40, 1);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = (i % 2 === 0) ? TAN : WOOD_MID;
    ctx.fillRect(awX + i * 5, awY + 12, 5, 2);
  }

  // coin glint when the market is attended
  if (st.glint) {
    const t = st.glintAge / GLINT_DURATION;
    const a = 1 - Math.abs(t * 2 - 1);
    drawCoinGlint(ctx, x + 9, y - 16, a);
  }
}

// ---- test hook -------------------------------------------------------
function __probe() {
  const st = getState();
  if (!st) {
    return { gx: ANCHOR.gx, gy: ANCHOR.gy, anchor: { gx: ANCHOR.gx, gy: ANCHOR.gy }, glints: 0, near: false, glinting: false };
  }
  return {
    gx: st.gx,
    gy: st.gy,
    anchor: { gx: st.anchorGx, gy: st.anchorGy },
    glints: (typeof st.glints === 'number') ? st.glints : 0,
    near: !!st.near,
    glinting: !!st.glint
  };
}

// ---- self-install ----------------------------------------------------
if (typeof window !== 'undefined') {
  if (!window.GuildStallSW || typeof window.GuildStallSW !== 'object') {
    window.GuildStallSW = createState();
  }
  const st = window.GuildStallSW;
  if (!isFinite(st.gx) || !isFinite(st.gy)) {
    const spot = nearestClear();
    st.gx = spot.gx;
    st.gy = spot.gy;
  }
  if (!isFinite(st.anchorGx)) st.anchorGx = ANCHOR.gx;
  if (!isFinite(st.anchorGy)) st.anchorGy = ANCHOR.gy;
  if (typeof st.az !== 'number') st.az = 0;
  if (typeof st.glintTimer !== 'number') st.glintTimer = GLINT_INTERVAL;
  if (typeof st.glint !== 'boolean') st.glint = false;
  if (typeof st.glintAge !== 'number') st.glintAge = 0;
  if (typeof st.glints !== 'number') st.glints = 0;
  if (typeof st.near !== 'boolean') st.near = false;
  if (st.lastNow === undefined) st.lastNow = null;
  st.update = update;
  st.draw = draw;
  st.__probe = __probe;
  st.__rawUpdate = update;
}

export {};
