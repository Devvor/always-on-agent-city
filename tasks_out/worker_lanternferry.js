const DOCK_A = { gx: 1.8, gy: 9.0 };
const DOCK_B = { gx: 7.8, gy: 9.0 };
const CROSS_DUR = 9.0;
const PAUSE_DUR = 3.2;
const NIGHT_RATE = 1.4;
const PASSENGER_NAMES = ['LANTERN KEEPER', 'NIGHTFARER', 'LATE GUEST', 'TIDE WALKER'];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') { try { return w.iso(gx, gy); } catch (e) {} }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') { try { return w.fitText(text, maxW); } catch (e) {} }
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function createState() {
  return {
    s: 0,
    dir: 1,
    phase: 'moored',
    pauseT: 0,
    lit: 0,
    wake: [],
    wakeTimer: 0.2,
    crossings: 0,
    lastTime: null
  };
}

function getState() { const w = root(); return w && w.GuildLanternFerry; }

function nightAmount() {
  const Vv = getV();
  if (Vv && typeof Vv.nightFactor === 'number' && isFinite(Vv.nightFactor)) return clamp(Vv.nightFactor, 0, 1);
  if (Vv && typeof Vv.daylight === 'number' && isFinite(Vv.daylight)) return clamp(1 - Vv.daylight, 0, 1);
  let h = 12;
  try { h = new Date().getHours(); } catch (e) {}
  return (h >= 19 || h <= 5) ? 1 : 0;
}

function posAt(s) {
  return {
    gx: DOCK_A.gx + (DOCK_B.gx - DOCK_A.gx) * s,
    gy: DOCK_A.gy + (DOCK_B.gy - DOCK_A.gy) * s
  };
}

function passengerName(st) {
  const Vv = getV();
  const workers = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  const n = workers.length;
  const k = (st && st.crossings) ? st.crossings : 0;
  if (n > 0) {
    const meta = workers[k % n];
    const name = (meta && meta.name != null) ? String(meta.name).trim() : '';
    if (name) return name;
  }
  return PASSENGER_NAMES[k % PASSENGER_NAMES.length];
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') { st.lastTime = now; return; }
  if (st.lastTime === null || !isFinite(st.lastTime)) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const target = nightAmount();
  if (st.lit < target) st.lit = Math.min(target, st.lit + NIGHT_RATE * dt);
  else st.lit = Math.max(target, st.lit - NIGHT_RATE * dt);

  const running = target >= 0.5;

  if (running) {
    if (st.phase === 'moored') {
      st.dir = (st.s <= 0.0001) ? 1 : ((st.s >= 0.9999) ? -1 : (st.dir || 1));
      st.phase = 'crossing';
    }
    if (st.phase === 'crossing') {
      st.s += st.dir * (dt / CROSS_DUR);
      if (st.s >= 1) { st.s = 1; st.phase = 'pausing'; st.pauseT = 0; }
      else if (st.s <= 0) { st.s = 0; st.phase = 'pausing'; st.pauseT = 0; }
    } else if (st.phase === 'pausing') {
      st.pauseT += dt;
      if (st.pauseT >= PAUSE_DUR) {
        st.dir = -st.dir;
        st.phase = 'crossing';
        st.crossings += 1;
        cueFn('alert');
      }
    }
  } else {
    if (st.phase === 'crossing') {
      st.s += st.dir * (dt / CROSS_DUR);
      if (st.s >= 1) { st.s = 1; st.phase = 'moored'; }
      else if (st.s <= 0) { st.s = 0; st.phase = 'moored'; }
    } else if (st.phase === 'pausing') {
      st.phase = 'moored';
    }
  }

  if (running && st.phase === 'crossing') {
    st.wakeTimer -= dt;
    if (st.wakeTimer <= 0) {
      const p = posAt(st.s);
      const pt = isoFn(p.gx, p.gy);
      st.wake.push({ x: pt.x, y: pt.y + 5, t: 0, life: 1.7, r: 2 });
      st.wakeTimer = 0.32 + Math.random() * 0.22;
    }
  }
  const next = [];
  for (let i = 0; i < st.wake.length; i++) {
    const w = st.wake[i];
    w.t += dt;
    if (w.t < w.life) next.push(w);
  }
  st.wake = next;
}

function ellipseRing(ctx, x, y, rx, ry) {
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDock(ctx, dock, lit) {
  const p = isoFn(dock.gx, dock.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 7, y - 1, 15, 5);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 7, y - 4, 14, 4);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 7, y - 1, 14, 1);
  ctx.fillRect(x + 4, y - 12, 2, 12);
  ctx.fillRect(x - 6, y - 8, 2, 6);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 4, y - 13, 2, 2);

  if (lit > 0.05) {
    const g = ctx.createRadialGradient(x + 5, y - 12, 1, x + 5, y - 12, 13);
    g.addColorStop(0, 'rgba(212,175,55,' + (0.30 * lit) + ')');
    g.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 8, y - 25, 26, 26);
  }
}

function drawLantern(ctx, lx, railY, lit, now, phase) {
  const lampY = railY + 3;
  ctx.strokeStyle = '#2b1d0e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx, railY);
  ctx.lineTo(lx, lampY);
  ctx.stroke();

  const flick = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(now * 0.006 + phase * 3));
  if (lit > 0.04) {
    const r = 9 + 4 * lit;
    const g = ctx.createRadialGradient(lx, lampY + 3, 1, lx, lampY + 3, r);
    g.addColorStop(0, 'rgba(212,175,55,' + (0.55 * lit * flick) + ')');
    g.addColorStop(0.5, 'rgba(212,175,55,' + (0.20 * lit) + ')');
    g.addColorStop(1, 'rgba(212,175,55,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - r, lampY + 3 - r, r * 2, r * 2);
  }

  ctx.fillStyle = '#854d0e';
  ctx.fillRect(lx - 2, lampY, 4, 6);
  ctx.fillStyle = lit > 0.3 ? '#fde68a' : '#6b4a2f';
  ctx.fillRect(lx - 1, lampY + 1, 2, 4);
  ctx.fillStyle = lit > 0.5 ? '#facc15' : '#4a3423';
  ctx.fillRect(lx - 1, lampY + 2, 2, 2);
}

function drawPassenger(ctx, px, py, lit) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px - 3, py - 1, 7, 2);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(px - 2, py - 4, 2, 4);
  ctx.fillRect(px + 1, py - 4, 2, 4);
  ctx.fillRect(px - 3, py - 10, 7, 6);
  ctx.fillRect(px - 2, py - 14, 5, 5);
  if (lit > 0.2) {
    ctx.globalAlpha = 0.45 * lit;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(px + 2, py - 13, 1, 4);
    ctx.globalAlpha = 1;
  }
}

function drawNameplate(ctx, cx, cy, name) {
  ctx.save();
  ctx.font = 'bold 9px monospace';
  const label = fitFn(name, 74);
  const tw = ctx.measureText(label).width;
  const pw = Math.round(tw) + 8;
  const ph = 12;
  const px = Math.round(cx - pw * 0.5);
  const py = Math.round(cy - ph);

  ctx.fillStyle = 'rgba(10,10,12,0.86)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);

  ctx.beginPath();
  ctx.moveTo(cx - 4, py + ph);
  ctx.lineTo(cx + 4, py + ph);
  ctx.lineTo(cx, py + ph + 5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,12,0.86)';
  ctx.fill();

  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.restore();
}

function drawFerry(ctx, x, y, st, now) {
  const lit = st.lit;
  const flip = st.dir >= 0 ? 1 : -1;

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 17, y + 4, 34, 4);

  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(x - 17, y + 1, 34, 4);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 16, y - 3, 32, 6);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 15, y - 4, 30, 2);

  ctx.fillStyle = '#6b4a2f';
  if (flip > 0) ctx.fillRect(x + 16, y - 2, 5, 4);
  else ctx.fillRect(x - 21, y - 2, 5, 4);

  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 16, y - 13, 2, 10);
  ctx.fillRect(x + 14, y - 13, 2, 10);

  const railY = y - 13;
  ctx.strokeStyle = '#2b1d0e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 15, railY);
  ctx.lineTo(x + 15, railY);
  ctx.stroke();

  drawLantern(ctx, x - 11, railY, lit, now, 0.4);
  drawLantern(ctx, x + 11, railY, lit, now, 2.1);
  drawLantern(ctx, flip > 0 ? x + 17 : x - 19, railY + 2, lit, now, 4.3);

  if (lit > 0.1) {
    ctx.globalAlpha = 0.18 * lit;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 9, y + 5, 18, 2);
    ctx.globalAlpha = 1;
  }

  drawPassenger(ctx, x, y - 3, lit);
  drawNameplate(ctx, x, y - 20, passengerName(st));
}

function drawWake(ctx, st) {
  if (!st.wake || !st.wake.length) return;
  for (let i = 0; i < st.wake.length; i++) {
    const w = st.wake[i];
    const prog = clamp(w.t / w.life, 0, 1);
    const a = (1 - prog) * 0.30;
    if (a <= 0.01) continue;
    const rx = w.r + prog * 13;
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1;
    ellipseRing(ctx, w.x, w.y, rx, rx * 0.5);
  }
  ctx.globalAlpha = 1;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();

  drawDock(ctx, DOCK_A, st.lit);
  drawDock(ctx, DOCK_B, st.lit);
  drawWake(ctx, st);

  const p = posAt(st.s);
  const pt = isoFn(p.gx, p.gy);
  const running = st.phase !== 'moored';
  const bobAmp = (st.phase === 'pausing' ? 1.7 : 0.7) * st.lit;
  const bob = running ? Math.sin(now * 0.0022) * bobAmp : 0;
  drawFerry(ctx, Math.round(pt.x), Math.round(pt.y + bob), st, now);

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

if (typeof window !== 'undefined') {
  if (!window.GuildLanternFerry) window.GuildLanternFerry = createState();
  window.GuildLanternFerry.update = update;
  window.GuildLanternFerry.draw = draw;
  window.GuildLanternFerry.__probe = function () {
    const st = getState();
    if (!st) return { s: 0, phase: 'moored', lit: 0, crossings: 0, wake: 0 };
    return { s: st.s, phase: st.phase, lit: st.lit, crossings: st.crossings, wake: st.wake.length };
  };
  window.GuildLanternFerry.__rawUpdate = update;
}

export {};
