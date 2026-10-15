function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { return w.iso(gx, gy); } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
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
function getState() { const w = root(); return w && w.GuildFerry; }
function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function easeOut(p) { const t = clamp(p, 0, 1); return 1 - (1 - t) * (1 - t); }
function easeIn(p) { const t = clamp(p, 0, 1); return t * t; }

const DOCK_GX = 0.5;
const ARRIVE_DUR = 6;
const DEPART_DUR = 5;
const PLANK_SPEED = 1.2;
const STROLL_SPEED = 1.7;
const HEARTH_PAUSE = 3.5;
const INTERVAL_MIN = 180000;
const INTERVAL_SPAN = 80000;
const FIRST_MIN = 30000;
const FIRST_SPAN = 30000;
const WAVE_RANGE = 1.5;

function islandBounds(Vv) {
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  return { minC: -2 - s, maxC: 1 + s };
}
function anchor(Vv) {
  const b = islandBounds(Vv);
  const gx = clamp(DOCK_GX, b.minC + 0.5, b.maxC - 0.5);
  const gy = b.maxC;
  return {
    inGx: gx, inGy: gy,
    outGx: gx + 1.3, outGy: gy + 1.3,
    farGx: gx + 5.5, farGy: gy + 5.5,
    wps: [
      { gx: gx + 1.6, gy: gy - 0.5 },
      { gx: gx + 0.9, gy: gy - 1.4 },
      { gx: gx - 0.2, gy: gy - 0.9 }
    ]
  };
}

function ensureState(st) {
  if (!st) return;
  if (typeof st.ferries !== 'number') st.ferries = 0;
  if (typeof st.visitors !== 'number') st.visitors = 0;
  if (typeof st.phase !== 'string') st.phase = 'away';
  if (!st.sprite || typeof st.sprite !== 'object') {
    st.sprite = { gx: 0, gy: 0, facing: 'down', moving: false, walkFrame: 0, walkTimer: 0, visible: false, wave: 0 };
  } else {
    if (typeof st.sprite.wave !== 'number') st.sprite.wave = 0;
    if (typeof st.sprite.visible !== 'boolean') st.sprite.visible = false;
    if (typeof st.sprite.walkFrame !== 'number') st.sprite.walkFrame = 0;
    if (typeof st.sprite.walkTimer !== 'number') st.sprite.walkTimer = 0;
    if (typeof st.sprite.facing !== 'string') st.sprite.facing = 'down';
    if (typeof st.sprite.moving !== 'boolean') st.sprite.moving = false;
  }
  if (!Array.isArray(st.path)) st.path = [];
  if (typeof st.pathIndex !== 'number') st.pathIndex = 0;
  if (typeof st.pause !== 'number') st.pause = 0;
  if (typeof st.waveDone !== 'boolean') st.waveDone = false;
  if (typeof st.returning !== 'boolean') st.returning = false;
  if (typeof st.boatGx !== 'number') st.boatGx = 0;
  if (typeof st.boatGy !== 'number') st.boatGy = 0;
  if (typeof st.t !== 'number') st.t = 0;
  if (st.nextAt === undefined) st.nextAt = null;
  if (st.lastTime === undefined) st.lastTime = null;
}

function followPath(st, dt, speed) {
  const sp = st.sprite;
  if (!Array.isArray(st.path) || st.pathIndex >= st.path.length) { sp.moving = false; return false; }
  const target = st.path[st.pathIndex];
  const dx = target.gx - sp.gx;
  const dy = target.gy - sp.gy;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= 0.0001) {
    st.pathIndex++;
  } else {
    const r = Math.min(1, step / dist);
    sp.gx += dx * r;
    sp.gy += dy * r;
    if (Math.abs(dx) > Math.abs(dy)) sp.facing = (dx > 0) ? 'right' : 'left';
    else sp.facing = (dy > 0) ? 'down' : 'up';
    if (r >= 1) st.pathIndex++;
    sp.walkTimer += dt;
    while (sp.walkTimer >= 0.16) { sp.walkFrame = (sp.walkFrame + 1) % 4; sp.walkTimer -= 0.16; }
  }
  if (st.pathIndex >= st.path.length) { sp.moving = false; sp.walkFrame = 0; return false; }
  sp.moving = true;
  return true;
}

function checkWave(st) {
  if (st.waveDone) return;
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis) return;
  const vx = Number(vis.gx), vy = Number(vis.gy);
  if (!isFinite(vx) || !isFinite(vy)) return;
  const d = Math.hypot(vx - st.sprite.gx, vy - st.sprite.gy);
  if (d <= WAVE_RANGE) { st.waveDone = true; st.sprite.wave = 1.6; }
}

function update(now) {
  try {
    if (typeof now !== 'number') now = nowFn();
    const st = getState();
    const Vv = getV();
    if (!st) return;
    ensureState(st);
    if (!Vv || Vv.gameState !== 'play') { st.lastTime = now; return; }
    if (st.lastTime === null || !isFinite(st.lastTime)) st.lastTime = now;
    let dt = (now - st.lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    st.lastTime = now;

    if (st.sprite.wave > 0) st.sprite.wave = Math.max(0, st.sprite.wave - dt);

    const A = anchor(Vv);

    if (st.nextAt === null || st.nextAt === undefined || !isFinite(st.nextAt)) {
      st.nextAt = now + (FIRST_MIN + Math.random() * FIRST_SPAN);
    }

    if (st.phase === 'away') {
      if (now >= st.nextAt) {
        st.phase = 'arriving';
        st.t = 0;
        st.boatGx = A.farGx;
        st.boatGy = A.farGy;
        st.waveDone = false;
        st.returning = false;
        st.sprite.visible = false;
        st.sprite.wave = 0;
        st.path = [];
        st.pathIndex = 0;
        st.pause = 0;
      }
      return;
    }

    if (st.phase === 'arriving') {
      st.t += dt;
      const p = Math.min(1, st.t / ARRIVE_DUR);
      const e = easeOut(p);
      st.boatGx = A.farGx + (A.outGx - A.farGx) * e;
      st.boatGy = A.farGy + (A.outGy - A.farGy) * e;
      if (p >= 1) {
        st.phase = 'docked';
        st.t = 0;
        cue('coin');
        st.sprite.visible = true;
        st.sprite.gx = A.outGx;
        st.sprite.gy = A.outGy;
        st.sprite.facing = 'up';
        st.sprite.moving = false;
        st.path = [{ gx: A.inGx, gy: A.inGy }];
        st.pathIndex = 0;
      }
      return;
    }

    if (st.phase === 'docked') {
      const moving = followPath(st, dt, PLANK_SPEED);
      checkWave(st);
      if (!moving) {
        st.visitors = (st.visitors || 0) + 1;
        st.phase = 'strolling';
        st.path = A.wps.slice();
        st.pathIndex = 0;
        st.pause = 0;
        st.returning = false;
      }
      return;
    }

    if (st.phase === 'strolling') {
      if (st.pause > 0) {
        st.pause -= dt;
        st.sprite.moving = false;
        st.sprite.walkFrame = 0;
        if (st.pause <= 0) {
          st.pause = 0;
          st.path = [{ gx: A.inGx, gy: A.inGy }, { gx: A.outGx, gy: A.outGy }];
          st.pathIndex = 0;
          st.returning = true;
        }
      } else {
        const moving = followPath(st, dt, STROLL_SPEED);
        if (!moving) {
          if (!st.returning) {
            st.pause = HEARTH_PAUSE;
          } else {
            st.phase = 'departing';
            st.t = 0;
            st.sprite.visible = false;
          }
        }
      }
      checkWave(st);
      return;
    }

    if (st.phase === 'departing') {
      st.t += dt;
      const p = Math.min(1, st.t / DEPART_DUR);
      const e = easeIn(p);
      st.boatGx = A.outGx + (A.farGx - A.outGx) * e;
      st.boatGy = A.outGy + (A.farGy - A.outGy) * e;
      if (p >= 1) {
        st.ferries = (st.ferries || 0) + 1;
        st.phase = 'away';
        st.t = 0;
        st.sprite.visible = false;
        st.nextAt = now + (INTERVAL_MIN + Math.random() * INTERVAL_SPAN);
      }
      return;
    }
  } catch (e) {}
}

function drawDock(ctx, A, Vv, now) {
  const pIn = isoFn(A.inGx, A.inGy);
  const pOut = isoFn(A.outGx, A.outGy);
  const x = Math.round(pIn.x);
  const y1 = Math.round(pIn.y);
  const y2 = Math.round(pOut.y);
  const len = Math.max(2, y2 - y1);

  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(x - 4, y1, 9, len + 3);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 3, y1, 6, len);
  ctx.fillStyle = '#4a3423';
  for (let yy = y1 + 3; yy < y2; yy += 4) ctx.fillRect(x - 3, yy, 6, 1);

  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 5, y2 - 9, 3, 9);
  ctx.fillRect(x + 2, y2 - 9, 3, 9);

  const sw = 44;
  const sh = 12;
  const sx = x + 7;
  const sy = y1 - sh - 6;
  ctx.fillStyle = 'rgba(10,10,12,0.82)';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.fillStyle = '#f3d37a';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('FERRY', sw - 6), sx + sw * 0.5, sy + sh * 0.5 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  void now;
  void Vv;
}

function drawBoat(ctx, x, y, Vv, now) {
  const dl = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 16, y + 2, 32, 4);

  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 16, y - 4, 32, 9);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 15, y - 5, 30, 3);
  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(x - 18, y - 2, 3, 5);
  ctx.fillRect(x + 15, y - 2, 3, 5);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 6, y - 16, 12, 11);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 7, y - 18, 14, 3);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x + 9, y - 24, 1, 20);

  const glow = (dl < 0.5) ? (0.5 - dl) / 0.5 : 0;
  if (glow > 0.02) {
    const g = ctx.createRadialGradient(x + 10, y - 26, 1, x + 10, y - 26, 16);
    g.addColorStop(0, 'rgba(212,175,55,' + (0.30 + 0.45 * glow) + ')');
    g.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + 10, y - 26, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 9, y - 28, 3, 3);
  ctx.fillRect(x + 10, y - 24, 4, 2);

  void now;
}

function drawSprite(ctx, st, now) {
  const sp = st.sprite;
  const pt = isoFn(sp.gx, sp.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const bob = sp.moving ? ((sp.walkFrame % 2 === 0) ? 0 : 1) : 0;
  const Y = y + bob;
  const facing = sp.facing;
  const frame = sp.moving ? (sp.walkFrame % 4) : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 5, y + 16, 18, 4);

  let lY = Y + 9;
  let rY = Y + 9;
  let lH = 7;
  let rH = 7;
  if (frame === 1) { lY = Y + 8; rY = Y + 11; rH = 4; }
  else if (frame === 2) { lY = Y + 9; rY = Y + 9; lH = 6; rH = 6; }
  else if (frame === 3) { lY = Y + 11; rY = Y + 8; lH = 4; }
  ctx.fillStyle = '#3b2a18';
  ctx.fillRect(x + 2, lY, 4, lH);
  ctx.fillRect(x + 9, rY, 4, rH);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x + 15, Y + 3, 6, 7);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 17, Y + 5, 2, 3);

  ctx.fillStyle = '#8b1a22';
  ctx.fillRect(x + 1, Y - 2, 13, 12);
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x + 6, Y - 2, 3, 12);

  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 3, Y - 10, 9, 8);

  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(x + 1, Y - 12, 13, 2);
  ctx.fillRect(x + 4, Y - 15, 7, 4);

  if (facing !== 'up') {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + 4, Y - 8, 2, 2);
    ctx.fillRect(x + 9, Y - 8, 2, 2);
  }

  const waving = sp.wave > 0 && ((Math.floor(sp.wave / 0.25) % 2) === 0);
  if (waving) {
    ctx.fillStyle = '#8b1a22';
    ctx.fillRect(x + 13, Y - 4, 3, 5);
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 13, Y - 8, 3, 3);
  } else {
    ctx.fillStyle = '#8b1a22';
    ctx.fillRect(x + 0, Y + 2, 2, 6);
    ctx.fillRect(x + 13, Y + 2, 2, 6);
  }

  void now;
}

function draw(ctx) {
  try {
    const st = getState();
    const Vv = getV();
    if (!st || !ctx || !Vv || Vv.gameState !== 'play') return;
    ensureState(st);
    const A = anchor(Vv);
    const now = nowFn();
    drawDock(ctx, A, Vv, now);
    if (st.phase !== 'away') {
      const bob = Math.sin(now * 0.004) * 1.5;
      const pt = isoFn(st.boatGx, st.boatGy);
      drawBoat(ctx, Math.round(pt.x), Math.round(pt.y + bob), Vv, now);
    }
    if (st.sprite.visible && (st.phase === 'docked' || st.phase === 'strolling')) {
      drawSprite(ctx, st, now);
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildFerry) {
    window.GuildFerry = { ferries: 0, visitors: 0, phase: 'away' };
  }
  ensureState(window.GuildFerry);
  window.GuildFerry.update = update;
  window.GuildFerry.draw = draw;
  window.GuildFerry.__probe = function () {
    const s = getState();
    return {
      ferries: (s && typeof s.ferries === 'number') ? s.ferries : 0,
      visitors: (s && typeof s.visitors === 'number') ? s.visitors : 0,
      phase: (s && typeof s.phase === 'string') ? s.phase : 'away'
    };
  };
}

export {};
