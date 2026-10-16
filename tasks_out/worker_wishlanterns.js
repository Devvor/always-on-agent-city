function createState() {
  return {
    lanterns: [],
    dwellStart: null,
    lastTime: null,
    spawnCooldown: 0,
    anchor: null
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildGardenLanterns; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

// ZONE RULE: read the named GARDEN anchor from the town plan registry;
// fall back to the documented E-garden grid around (6,2) if absent.
function gardenAnchor() {
  const w = root();
  const zones = w && w.GuildZones;
  if (zones && zones.GARDEN && isFinite(zones.GARDEN.gx) && isFinite(zones.GARDEN.gy)) {
    return { gx: zones.GARDEN.gx, gy: zones.GARDEN.gy };
  }
  return { gx: 6, gy: 2 };
}

// Stand 2+ tiles offset from the anchor (and any props near it):
// lanterns rise from a spot offset from the claimed zone anchor.
function lanternSpot(anchor) {
  return { gx: anchor.gx + 2.5, gy: anchor.gy + 2.5 };
}

function tileDist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function spawnLantern(st, now) {
  const anchor = st.anchor || (st.anchor = gardenAnchor());
  const spot = lanternSpot(anchor);
  const pt = isoFn(spot.gx, spot.gy);
  st.lanterns.push({
    x: pt.x,
    y: pt.y,
    age: 0,
    duration: 6,
    riseSpeed: 14 + Math.random() * 6,
    swayPhase: Math.random() * Math.PI * 2,
    swayAmp: 3 + Math.random() * 3,
    born: now
  });
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue('grow'); } catch (e) {}
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    st.lastTime = now;
    return;
  }
  if (typeof window.iso !== 'function') return; // bail silently - contract missing
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  if (!st.anchor) st.anchor = gardenAnchor();
  const anchor = st.anchor;

  // advance existing lanterns
  const next = [];
  for (let i = 0; i < st.lanterns.length; i++) {
    const l = st.lanterns[i];
    l.age += dt;
    if (l.age >= l.duration) continue;
    l.y -= l.riseSpeed * dt;
    next.push(l);
  }
  st.lanterns = next;

  if (st.spawnCooldown > 0) st.spawnCooldown = Math.max(0, st.spawnCooldown - dt);

  // watch the visitor near the garden anchor
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    const d = tileDist(vis.gx, vis.gy, anchor.gx, anchor.gy);
    if (d <= 1.5) {
      if (st.dwellStart === null) st.dwellStart = now;
      if (now - st.dwellStart >= 2000 && st.lanterns.length < 3 && st.spawnCooldown <= 0) {
        spawnLantern(st, now);
        st.dwellStart = null;
        st.spawnCooldown = 1.0;
      }
    } else {
      st.dwellStart = null;
    }
  } else {
    st.dwellStart = null;
  }
}

function drawLantern(ctx, l, now) {
  const fade = Math.max(0, 1 - (l.age / l.duration));
  const flicker = 0.75 + 0.25 * Math.sin(now * 0.006 + l.swayPhase * 3);
  const sway = Math.sin(now * 0.0012 + l.swayPhase) * l.swayAmp;
  const x = Math.round(l.x + sway);
  const y = Math.round(l.y);

  // warm gold glow (existing palette only)
  const glowR = 16 + 8 * flicker;
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(x, y, 1, x, y, glowR);
  grad.addColorStop(0, 'rgba(255,220,120,' + (0.55 * fade * flicker).toFixed(3) + ')');
  grad.addColorStop(0.5, 'rgba(212,175,55,' + (0.22 * fade * flicker).toFixed(3) + ')');
  grad.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = prevComposite;

  // lantern body - stone grey frame, warm gold light
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 1, y - 12, 2, 4);       // hanging ring
  ctx.fillRect(x - 5, y - 8, 10, 2);       // top cap
  ctx.fillRect(x - 5, y + 4, 10, 2);       // bottom cap
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 4, y - 6, 8, 10);       // glowing pane
  ctx.fillStyle = '#f3d37a';
  ctx.fillRect(x - 2, y - 4, 4, 6);        // hot core
  ctx.globalAlpha = 1;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx || typeof window.iso !== 'function') return;
  const n = nowFn();
  for (let i = 0; i < st.lanterns.length; i++) {
    drawLantern(ctx, st.lanterns[i], n);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildGardenLanterns) window.GuildGardenLanterns = createState();
  window.GuildGardenLanterns.update = update;
  window.GuildGardenLanterns.draw = draw;
  window.GuildGardenLanterns.__probe = function () {
    const st = window.GuildGardenLanterns;
    return {
      lanterns: st.lanterns.length,
      dwellStart: st.dwellStart,
      anchor: st.anchor || gardenAnchor(),
      spawnCooldown: st.spawnCooldown
    };
  };
  window.GuildGardenLanterns.__rawUpdate = update;
}

export {};
