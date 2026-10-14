let pressed = new Set();
let prevPressed = new Set();
let open = false;
let nearState = false;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getPoster() { const w = root(); return w && w.GuildMapPoster; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
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
function cueFn(name) { const w = root(); if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} } }

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function computeNear() {
  const poster = getPoster();
  const vis = getVisitor();
  if (!poster || !vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return Math.hypot(poster.gx - vis.gx, poster.gy - vis.gy) <= 1.6;
}

function syncPoster() {
  const poster = getPoster();
  if (!poster) return;
  poster.open = open;
  poster.near = nearState;
}

function tileToMap(gx, gy) {
  const Vv = getV();
  const gs = (Vv && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
  const R = 3 + 2 * gs;
  const dx = gx + 0.5;
  const dy = gy + 0.5;
  return {
    x: ((dx - dy) / R) * 1.5,
    y: ((dx + dy) / R) * 1.5
  };
}

function drawDiamond(ctx, cx, cy, rad, color) {
  if (!ctx) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - rad);
  ctx.lineTo(cx + rad, cy);
  ctx.lineTo(cx, cy + rad);
  ctx.lineTo(cx - rad, cy);
  ctx.closePath();
  ctx.stroke();
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const poster = getPoster();
  const Vv = getV();
  const near = computeNear();
  if (Vv && Vv.gameState === 'play' && poster && (k === 'e' || k === ' ')) {
    if (near || open) {
      open = !open;
      nearState = near;
      syncPoster();
      cueFn(open ? 'map-open' : 'map-close');
    }
    prevPressed.add(k);
  }
  if (k === 'escape' && open) {
    open = false;
    nearState = computeNear();
    syncPoster();
    prevPressed.add(k);
  }
  if (k === 'e' || k === ' ' || k === 'escape') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  try {
    if (typeof now !== 'number') now = nowFn();
    const poster = getPoster();
    const Vv = getV();
    nearState = computeNear();

    if (poster) {
      if (nearState) poster.lastNear = now;
      poster.near = nearState;
      poster.open = open;
    }

    if (!poster || !Vv || Vv.gameState !== 'play') {
      prevPressed = new Set(pressed);
      return;
    }

    const ePressed = pressed.has('e') || pressed.has(' ');
    const eWas = prevPressed.has('e') || prevPressed.has(' ');
    const escNow = pressed.has('escape');
    const escWas = prevPressed.has('escape');

    if (nearState || open) {
      if (!open && !eWas && ePressed && nearState) open = true;
      else if (open && ePressed && !eWas) open = false;
      if (open && escNow && !escWas) open = false;
    }

    open = !!open;
    nearState = computeNear();
    if (poster) {
      poster.open = open;
      poster.near = nearState;
    }

    prevPressed = new Set(pressed);
  } catch (e) {}
}

function draw(ctx) {
  try {
    const poster = getPoster();
    const Vv = getV();
    if (!poster || !ctx || !Vv || Vv.gameState !== 'play') return;

    const pt = isoFn(poster.gx, poster.gy);
    const px = Math.round(pt.x);
    const py = Math.round(pt.y);

    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(px - 16, py - 2, 4, 22);
    ctx.fillRect(px + 12, py - 2, 4, 22);

    const rx = px - 20;
    const ry = py - 30;
    const rw = 40;
    const rh = 28;
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(rx, ry, rw, 2);
    ctx.fillRect(rx, ry + rh - 2, rw, 2);
    ctx.fillRect(rx, ry, 2, rh);
    ctx.fillRect(rx + rw - 2, ry, 2, rh);

    const mcx = px;
    const mcy = ry + 14;
    drawDiamond(ctx, mcx, mcy, 11, '#2b2b2b');
    const miniDots = [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, 9]];
    ctx.fillStyle = '#2b2b2b';
    for (let i = 0; i < miniDots.length; i++) {
      ctx.fillRect(mcx + miniDots[i][0] - 1, mcy + miniDots[i][1] - 1, 2, 2);
    }

    const near = computeNear();
    if (near) {
      ctx.save();
      if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
        ctx.beginPath();
        ctx.rect(px - 44, py - 72, 88, 52);
        ctx.clip();
      }
      ctx.fillStyle = '#d4af37';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn('[E] VIEW MAP', 76), px - 34, py - 42);
      ctx.restore();
    }

    if (!open) return;

    ctx.save();
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);

    const canvas = (ctx && ctx.canvas) ? ctx.canvas : Vv.canvas;
    const cw = (canvas && isFinite(canvas.width)) ? canvas.width : 960;
    const ch = (canvas && isFinite(canvas.height)) ? canvas.height : 640;
    const pw = 320;
    const ph = 240;
    const panX = Math.round((cw - pw) * 0.5);
    const panY = Math.round((ch - ph) * 0.5);

    ctx.fillStyle = '#1c1a16';
    ctx.fillRect(panX, panY, pw, ph);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(panX, panY, pw, 2);
    ctx.fillRect(panX, panY + ph - 2, pw, 2);
    ctx.fillRect(panX, panY, 2, ph);
    ctx.fillRect(panX + pw - 2, panY, 2, ph);

    ctx.save();
    if (typeof ctx.beginPath === 'function' && typeof ctx.rect === 'function' && typeof ctx.clip === 'function') {
      ctx.beginPath();
      ctx.rect(panX + 2, panY + 2, pw - 4, ph - 4);
      ctx.clip();
    }

    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn('GUILD MAP', pw - 16), panX + pw * 0.5, panY + 18);

    const mcx2 = panX + pw * 0.5;
    const mcy2 = panY + ph * 0.5 + 8;
    const unit = Math.min(pw, ph) * 0.20;
    drawDiamond(ctx, mcx2, mcy2, 1.5 * unit, '#e8e6df');

    const zones = [
      { x: -0.72, y: -0.72, label: 'CRYSTAL GROVE' },
      { x: 0.72, y: -0.72, label: 'AVIARY' },
      { x: -0.72, y: 0.72, label: 'MARKET ROW' },
      { x: 0.72, y: 0.72, label: 'HEROES PLAZA' },
      { x: 0, y: 1.22, label: 'FALLS + FISHING' },
      { x: 0, y: 0, label: 'HEARTH' }
    ];

    ctx.textBaseline = 'middle';
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const sx = Math.round(mcx2 + z.x * unit);
      const sy = Math.round(mcy2 + z.y * unit);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#e8e6df';
      ctx.textAlign = 'center';
      const shown = fitFn(z.label, 78);
      let ly = sy + 11;
      if (ly > panY + ph - 10) ly = sy - 11;
      if (ly < panY + 30) ly = panY + 30;
      ctx.fillText(shown, Math.max(panX + 8, Math.min(panX + pw - 8, sx)), ly);
    }

    const vis = getVisitor();
    if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
      const vpt = tileToMap(vis.gx, vis.gy);
      const vx = Math.round(mcx2 + vpt.x * unit);
      const vy = Math.round(mcy2 + vpt.y * unit);
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
      const sz = 4 + Math.round(pulse * 3);
      const halfSz = Math.round(sz * 0.5);
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(vx - halfSz, vy - halfSz, sz, sz);
      ctx.globalAlpha = 1;
      if (Math.sin(now * 0.004) > 0) {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        const shown = fitFn('YOU ARE HERE', pw - 16);
        const lx = Math.max(panX + 8, Math.min(panX + pw - 8, vx));
        let ly = vy - 14;
        if (ly < panY + 28) ly = vy + 16;
        ctx.fillText(shown, lx, ly);
      }
    }

    ctx.restore();
    ctx.restore();
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildMapPoster) window.GuildMapPoster = { gx: 0.2, gy: 5.4, lastNear: 0 };
  window.GuildMapPoster.update = update;
  window.GuildMapPoster.draw = draw;
  window.GuildMapPoster.__probe = function () { return { near: !!nearState }; };
  window.GuildMapPoster.__rawUpdate = update;
  window.GuildMapPoster.__keys = pressed;
  if (!window.__gmpListeners) {
    window.__gmpListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
