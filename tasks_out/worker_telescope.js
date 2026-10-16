let lastTime = null;

function createState() {
  return { gx: 0.5, gy: -7.0, looking: false, lookStart: 0, vignette: 0, chimeCooldown: 0 };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildVisitor; }
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

const SKY_CAPTIONS = ['a drifting isle...', 'waterfall into cloud', 'someone lives up there'];

function drawTelescope(ctx, pt) {
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 2, y - 22, 4, 22);
  ctx.fillRect(x - 7, y - 2, 14, 4);
  ctx.fillRect(x - 9, y + 2, 5, 6);
  ctx.fillRect(x + 4, y + 2, 5, 6);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 26, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillRect(x - 3, y - 32, 6, 10);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 1, y - 34, 2, 4);
}

function drawPrompt(ctx, x, y, now) {
  const r = 3 + Math.sin(now * 0.006) * 1.5;
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(x, y - 26, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawVignette(ctx, cx, cy, kind) {
  if (kind === 0) {
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx - 10, cy - 4, 20, 5);
    ctx.fillStyle = '#2f4a2f';
    ctx.fillRect(cx - 8, cy - 9, 16, 5);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(cx - 2, cy - 12, 4, 2);
  } else if (kind === 1) {
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 6, cy - 10, 4, 14);
    ctx.fillStyle = '#3b82f6';
    for (let k = 0; k < 3; k++) ctx.fillRect(cx - 4 + k * 3, cy - 4, 2, 8);
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(cx - 3, cy + 4, 6, 2);
  } else {
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(cx - 7, cy - 6, 14, 8);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(cx - 2, cy + 2, 2, 3);
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 6);
    ctx.lineTo(cx, cy - 14);
    ctx.lineTo(cx + 9, cy - 6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBubble(ctx, vis, st, now) {
  const vp = isoFn(vis.gx, vis.gy);
  const x = Math.round(vp.x);
  const y = Math.round(vp.y);
  const bx = x - 56;
  const by = y - 72;
  const bw = 112;
  const bh = 52;
  ctx.fillStyle = '#e8e6df';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);
  ctx.beginPath();
  ctx.moveTo(x, by + bh);
  ctx.lineTo(x - 7, by + bh + 9);
  ctx.lineTo(x + 7, by + bh + 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const cx = x + Math.sin(now * 0.0012 + st.lookStart * 0.001) * 5;
  const cy = by + bh * 0.34;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 6, by + 6, bw - 12, bh - 18);
  ctx.clip();
  drawVignette(ctx, cx, cy, st.vignette);
  ctx.restore();
  ctx.fillStyle = '#1f2937';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(SKY_CAPTIONS[st.vignette] || '', bw - 16), x, by + bh - 11);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const st = getState();
  const Vv = getV();
  const vis = w && w.GuildVisitor;
  if (!st || !vis || !Vv || Vv.gameState !== 'play') { lastTime = now; if (st) st.looking = false; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const dist = Math.hypot(vis.gx - st.gx, vis.gy - st.gy);
  const inRange = dist <= 1.5;

  if (st.chimeCooldown > 0) st.chimeCooldown = Math.max(0, st.chimeCooldown - dt);

  if (inRange) {
    if (!st.looking) {
      st.looking = true;
      st.lookStart = now;
      st.vignette = 0;
      if (st.chimeCooldown <= 0) { cue('chime'); st.chimeCooldown = 8.0; }
    }
    st.vignette = Math.floor((now - st.lookStart) / 4000) % 3;
  } else {
    st.looking = false;
  }
}

function draw(ctx) {
  const w = root();
  const st = getState();
  const Vv = getV();
  const vis = w && w.GuildVisitor;
  const now = nowFn();
  if (!ctx || !st || !vis || !Vv || Vv.gameState !== 'play') return;
  const tp = isoFn(st.gx, st.gy);
  drawTelescope(ctx, tp);
  const dist = Math.hypot(vis.gx - st.gx, vis.gy - st.gy);
  const vp = isoFn(vis.gx, vis.gy);
  const x = Math.round(vp.x);
  const y = Math.round(vp.y);
  if (dist <= 1.5) drawPrompt(ctx, x, y, now);
  if (st.looking) drawBubble(ctx, vis, st, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildTelescope) window.GuildTelescope = createState();
  window.GuildTelescope.update = update;
  window.GuildTelescope.draw = draw;
  window.GuildTelescope.__rawUpdate = update;
  window.GuildTelescope.__probe = function () {
    const st = window.GuildTelescope;
    const w = root();
    const vis = w && w.GuildVisitor;
    let dist = null;
    if (vis) {
      const tp = isoFn(st.gx, st.gy);
      const vp = isoFn(vis.gx, vis.gy);
      dist = Math.hypot(vp.x - tp.x, vp.y - tp.y);
    }
    return { gx: st.gx, gy: st.gy, looking: !!st.looking, vignette: st.vignette, chimeCooldown: st.chimeCooldown, dist: dist };
  };
}

export {};
