// =====================================================================
// FISHHUT :: window.GuildFishhut
// ---------------------------------------------------------------------
// A wooden fishing hut with smoke wisps, a catch pennant and drying
// racks, planted in the PONDSIDE district (LAYOUT.md town plan) — the
// southeast fishing corner by the pond and dock. The district anchor is
// read from window.GuildZones.PONDSIDE when available, falling back to
// the literal { gx: 14, gy: 15 }; the hut stands two tiles off the anchor
// so it stays within ~3 tiles of the district centre while keeping 2+
// tiles clear of the lighthouse and other props already there. Pure FX /
// prop layer: no collision, never writes to V or worker state.
// Conventions copied from tasks_out/worker_visitor.js: self-installing
// ES module, no imports, no top-level DOM access (typeof guards), state
// on window.GuildFishhut exposing update(now) / draw(ctx) / __probe().
// Bails silently if V or iso are missing. Palette: wood browns + slate
// greys + pale fish tones.
// =====================================================================

// PONDSIDE district anchor (LAYOUT.md / window.GuildZones). The hut is
// offset two tiles from the anchor to avoid clumping with the lighthouse.
const Z = (typeof window !== 'undefined' && window.GuildZones && window.GuildZones.PONDSIDE) || { gx: 14, gy: 15 };
const HUT_ANCHOR = { gx: Z.gx - 2, gy: Z.gy + 2 };

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
function getState() { const w = root(); return w && w.GuildFishhut; }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function clampHut(v, a, b) { return v < a ? a : (v > b ? b : v); }

// Clamp the hut position on-island using growthStep floor math, keeping it
// in the PONDSIDE district (southeast pond corner) once the island is large
// enough, clear of the waterfall zone (north rim) and the market row.
function hutPos(Vv) {
  const s = (typeof Vv.growthStep === 'number') ? Math.floor(Vv.growthStep) : 0;
  const maxC = 1 + s;
  let gx = HUT_ANCHOR.gx;
  let gy = HUT_ANCHOR.gy;
  gx = clampHut(gx, -1.5, maxC - 0.8);
  gy = clampHut(gy, 0.5, maxC - 0.8);
  if (tileRing(Math.floor(gx), Math.floor(gy)) > s) {
    gx = clampHut(gx, -1.5, 1);
    gy = clampHut(gy, 0.5, 1);
  }
  return { gx: gx, gy: gy };
}

let lastTime = null;
let smokeTimer = 3;
let lastCatchStamp = null;

function catchStampFrom(F) {
  if (!F) return null;
  let p = null;
  try { p = (typeof F.__probe === 'function') ? F.__probe() : null; } catch (e) { p = null; }
  if (!p || typeof p !== 'object') return null;
  const keys = ['lastCatch', 'caught', 'lastCatchAt', 'catchTime', 'catch', 'lastCatchId', 'catches'];
  for (let i = 0; i < keys.length; i++) {
    const v = p[keys[i]];
    if (v == null) continue;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  }
  for (const k in p) {
    if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
    const lk = String(k).toLowerCase();
    if (lk.indexOf('catch') !== -1 || lk.indexOf('caught') !== -1) {
      const v = p[k];
      if (v == null) continue;
      if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
      return String(v);
    }
  }
  return null;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) { lastTime = now; return; }
  if (!Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const pos = hutPos(Vv);
  st.hut.gx = pos.gx;
  st.hut.gy = pos.gy;

  // smoke wisps
  smokeTimer -= dt;
  if (smokeTimer <= 0) {
    smokeTimer = 8 + Math.random() * 6;
    const pt = isoFn(pos.gx, pos.gy);
    for (let i = 0; i < 3; i++) {
      st.smoke.push({ x: pt.x + 2, y: pt.y - 34, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 8, age: -i * 0.18, life: 1.6, size: 3 + i });
    }
  }
  const next = [];
  for (let i = 0; i < st.smoke.length; i++) {
    const p = st.smoke[i];
    p.age += dt;
    if (p.age < 0) { next.push(p); continue; }
    if (p.age >= p.life) continue;
    p.x += (p.vx + Math.sin(p.age * 3 + i) * 4) * dt;
    p.y += p.vy * dt;
    next.push(p);
  }
  st.smoke = next;

  // catch flag
  const w = root();
  const F = w && w.GuildFishing;
  const stamp = catchStampFrom(F);
  if (stamp != null && lastCatchStamp != null && stamp !== lastCatchStamp) {
    st.flag = 5;
    if (w && typeof w.cue === 'function') { try { w.cue('catch'); } catch (e) {} }
  }
  if (stamp != null) lastCatchStamp = stamp;
  if (st.flag > 0) st.flag = Math.max(0, st.flag - dt);
}

function drawHut(ctx, st, Vv, now) {
  const pt = isoFn(st.hut.gx, st.hut.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const wallH = 26;
  const wallW = 30;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 16, y - 2, 34, 5);

  // plank walls
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 15, y - wallH, wallW, wallH);
  ctx.strokeStyle = '#4a3423';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 15, y - wallH, wallW, wallH);
  ctx.fillStyle = '#4a3423';
  for (let py = y - wallH + 5; py < y - 3; py += 6) ctx.fillRect(x - 15, py, wallW, 1);

  // sloped roof
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(x, y - wallH - 9);
  ctx.lineTo(x + 18, y - wallH + 2);
  ctx.lineTo(x - 18, y - wallH + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // chimney
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x + 4, y - wallH - 14, 5, 8);

  // door
  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(x - 4, y - 10, 8, 10);
  ctx.strokeStyle = '#4a3423';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 10, 8, 10);

  // lantern glow at night
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  if (dl < 0.35) {
    const a = (0.35 - dl) / 0.35;
    ctx.globalAlpha = 0.5 * a;
    ctx.fillStyle = '#ffc27a';
    ctx.fillRect(x - 9, y - 14, 18, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffe7b8';
    ctx.fillRect(x - 3, y - 8, 6, 5);
  }

  // two fishing rods leaning on the wall
  for (let r = 0; r < 2; r++) {
    const rx = x - 12 + r * 4;
    ctx.strokeStyle = '#8b6b3f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, y - 1);
    ctx.lineTo(rx + 3, y - 20 - r * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,230,230,0.7)';
    ctx.beginPath();
    ctx.moveTo(rx + 3, y - 20 - r * 2);
    ctx.lineTo(rx + 1, y - 8);
    ctx.stroke();
  }

  // barrel
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x + 17, y - 12, 9, 12);
  ctx.strokeStyle = '#4a3423';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 17, y - 12, 9, 12);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x + 17, y - 9, 9, 1);
  ctx.fillRect(x + 17, y - 5, 9, 1);

  // two drying racks: poles with 3 hanging pale fish each
  for (let rk = 0; rk < 2; rk++) {
    const bx = x - 26 + rk * 14;
    const by = y + 4 + rk * 3;
    ctx.strokeStyle = '#5a3f25';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - 16);
    ctx.moveTo(bx - 6, by);
    ctx.lineTo(bx + 6, by);
    ctx.stroke();
    for (let f = 0; f < 3; f++) {
      const fx = bx - 4 + f * 4;
      const fy = by - 1;
      ctx.strokeStyle = 'rgba(220,220,220,0.6)';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + 3);
      ctx.stroke();
      ctx.fillStyle = '#d8d3c5';
      ctx.fillRect(fx - 1, fy + 3, 3, 4);
      ctx.fillStyle = '#a8a294';
      ctx.fillRect(fx, fy + 4, 1, 1);
    }
  }

  // catch pennant
  if (st.flag > 0) {
    const sway = Math.sin(now * 0.008) * 3;
    ctx.strokeStyle = '#5a3f25';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - wallH + 2);
    ctx.lineTo(x - 14, y - wallH - 12);
    ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(x - 14, y - wallH - 12);
    ctx.lineTo(x - 14 + 10 + sway, y - wallH - 9);
    ctx.lineTo(x - 14, y - wallH - 6);
    ctx.closePath();
    ctx.fill();
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) return;
  const n = nowFn();
  drawHut(ctx, st, Vv, n);

  // smoke wisps
  for (let i = 0; i < st.smoke.length; i++) {
    const p = st.smoke[i];
    if (p.age < 0) continue;
    const t = p.age / p.life;
    const a = (1 - t) * 0.35;
    const grow = 1 + t * 2.4;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#c9c4b8';
    const s = Math.round(p.size * grow);
    ctx.fillRect(Math.round(p.x - s * 0.5), Math.round(p.y - s * 0.5), s, s);
  }
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildFishhut) {
    window.GuildFishhut = { hut: { gx: HUT_ANCHOR.gx, gy: HUT_ANCHOR.gy }, smoke: [], flag: 0 };
  }
  window.GuildFishhut.update = update;
  window.GuildFishhut.draw = draw;
  window.GuildFishhut.__probe = function () {
    const st = getState();
    return { wisps: st ? st.smoke.length : 0, flag: st ? st.flag : 0 };
  };
}

export {};
