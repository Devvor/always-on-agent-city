const TARGET = { gx: 2.5, gy: -6.5 };
const NEAR_PROMPT = 1.5;
const DWELL_RADIUS = 1.0;
const DWELL_TIME = 1.5;
const SEALED_COOLDOWN = 3.0;
const SEALED_SHOW = 1.8;
const LABEL_W = 140;

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getState() { const w = root(); return w && w.GuildCapsulehollow; }

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

function softCue(name) {
  const w = root();
  if (!w || typeof w.cue !== 'function') return false;
  try { w.cue(name); return true; } catch (e) { return false; }
}

function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

function growthValue() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  return (isFinite(s) && s > 0) ? s : 0;
}

function anchorPos() {
  const s = growthValue();
  const minC = -2 - s;
  const maxC = 1 + s;
  let gx = TARGET.gx;
  let gy = TARGET.gy;
  if (gx < minC) gx = minC; else if (gx > maxC) gx = maxC;
  if (gy < minC) gy = minC; else if (gy > maxC) gy = maxC;
  return { gx: gx, gy: gy };
}

function memoryTitle() {
  const Vv = getV();
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  let chosen = null;
  for (let i = tasks.length - 1; i >= 0; i--) {
    const t = tasks[i];
    if (t && t.status === 'done') { chosen = t; break; }
  }
  if (!chosen && tasks.length) chosen = tasks[tasks.length - 1];
  if (!chosen || typeof chosen !== 'object') return 'A day worth keeping';
  const raw = (chosen.title != null) ? chosen.title
    : (chosen.name != null) ? chosen.name
    : (chosen.id != null) ? chosen.id : '';
  const text = String(raw).trim();
  return text || 'A day worth keeping';
}

function createState() {
  return {
    buried: false,
    memory: null,
    near: false,
    dwell: 0,
    sealedUntil: 0,
    sealedReadyAt: 0,
    digGlowUntil: 0
  };
}

function buryMemory(st, now) {
  if (!st || st.buried) return;
  st.memory = fitFn(memoryTitle(), LABEL_W - 14);
  st.buried = true;
  st.digGlowUntil = now + 900;
  st.sealedReadyAt = now + SEALED_COOLDOWN * 1000;
  if (!softCue('dig')) softCue('chime');
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const st = getState();
  if (!Vv || !st || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const vis = getVisitor();
  const hasVis = !!(vis && isFinite(vis.gx) && isFinite(vis.gy));
  const a = anchorPos();
  const d = hasVis ? Math.hypot(vis.gx - a.gx, vis.gy - a.gy) : Infinity;
  st.near = hasVis && d <= NEAR_PROMPT;

  if (hasVis && d <= DWELL_RADIUS) st.dwell += dt;
  else st.dwell = 0;

  if (st.dwell >= DWELL_TIME) {
    st.dwell = 0;
    if (!st.buried) {
      buryMemory(st, now);
    } else if (now >= st.sealedReadyAt) {
      st.sealedUntil = now + SEALED_SHOW * 1000;
      st.sealedReadyAt = now + SEALED_COOLDOWN * 1000;
    }
  }
}

function drawHollow(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 17, y - 5, 34, 15);
  }
  ctx.fillStyle = '#2f2823';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 15, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 14, y - 6, 28, 13);
  }
  ctx.fillStyle = '#25201d';
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 7, y, 14, 5);
  }
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const jx = Math.round((seeded(i * 13 + 3) - 0.5) * 3);
    const jy = Math.round((seeded(i * 29 + 7) - 0.5) * 2);
    const sx = Math.round(x + Math.cos(ang) * 16) + jx;
    const sy = Math.round(y + 1 + Math.sin(ang) * 8) + jy;
    ctx.fillStyle = (i % 2 === 0) ? '#9ca3af' : '#6b7280';
    ctx.fillRect(sx - 1, sy - 1, 3 + (i % 2), 3);
  }
}

function drawPost(ctx, x, y, st) {
  const px = x + 16;
  const base = y + 3;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px - 3, base, 7, 3);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(px - 2, base - 21, 4, 21);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(px - 1, base - 21, 2, 21);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(px - 6, base - 25, 12, 7);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(px - 6, base - 25, 12, 1);
  ctx.fillRect(px - 6, base - 19, 12, 1);
  if (st && st.buried) {
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(px - 6, base - 20, 12, 2);
    ctx.fillRect(px - 8, base - 24, 4, 3);
    ctx.fillRect(px + 4, base - 24, 4, 3);
    ctx.fillRect(px - 1, base - 18, 2, 7);
  }
}

function drawDigGlow(ctx, x, y, now, st) {
  if (!st || now >= st.digGlowUntil) return;
  const p = 1 - (st.digGlowUntil - now) / 900;
  if (!isFinite(p) || p < 0 || p > 1) return;
  const alpha = Math.max(0, 1 - p);
  const rx = 10 + p * 16;
  const ry = 5 + p * 8;
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  if (typeof ctx.ellipse === 'function') {
    ctx.beginPath();
    ctx.ellipse(x, y + 1, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(Math.round(x - rx), Math.round(y + 1 - ry), Math.round(rx * 2), Math.round(ry * 2));
  }
  ctx.restore();
}

function drawPrompt(ctx, x, y, st, now) {
  if (!st || !st.near) return;
  const bob = Math.sin(now * 0.0032) * 1.5;
  const px = x + 16;
  const py = y - 34 + bob;
  ctx.save();
  ctx.globalAlpha = st.buried ? 0.55 : 0.9;
  ctx.strokeStyle = st.buried ? '#9ca3af' : '#d4af37';
  ctx.lineWidth = 1;
  if (typeof ctx.beginPath === 'function') {
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = st.buried ? '#d1d5db' : '#f3d37a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', px, py + 1);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawMemoryLabel(ctx, x, y, st) {
  if (!st || !st.buried || !st.memory) return;
  const shown = fitFn(st.memory, LABEL_W - 14);
  if (!shown) return;
  ctx.font = 'bold 9px monospace';
  const tw = (typeof ctx.measureText === 'function') ? ctx.measureText(shown).width : shown.length * 6;
  const bw = Math.max(58, Math.round(tw + 16));
  const bh = 14;
  const bx = Math.round(x + 16 - bw * 0.5);
  const by = y - 58;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, bx + bw * 0.5, by + bh * 0.5 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawSealed(ctx, x, y, now, st) {
  if (!st || st.sealedUntil <= now) return;
  const remaining = st.sealedUntil - now;
  const alpha = Math.max(0, Math.min(1, remaining / 400));
  ctx.save();
  ctx.globalAlpha = 0.75 * alpha;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('sealed', x + 16, y - 68);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function draw(ctx) {
  const w = root();
  if (!ctx || !w) return;
  const Vv = getV();
  const st = getState();
  if (!Vv || !st || Vv.gameState !== 'play') return;
  const now = nowFn();
  const a = anchorPos();
  const p = isoFn(a.gx, a.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  drawHollow(ctx, x, y);
  drawPost(ctx, x, y, st);
  drawDigGlow(ctx, x, y, now, st);
  drawPrompt(ctx, x, y, st, now);
  drawMemoryLabel(ctx, x, y, st);
  drawSealed(ctx, x, y, now, st);
}

if (typeof window !== 'undefined') {
  if (!window.GuildCapsulehollow || typeof window.GuildCapsulehollow !== 'object') {
    window.GuildCapsulehollow = createState();
  }
  const st = window.GuildCapsulehollow;
  if (typeof st.buried !== 'boolean') st.buried = false;
  if (st.memory === undefined) st.memory = null;
  if (typeof st.near !== 'boolean') st.near = false;
  if (typeof st.dwell !== 'number') st.dwell = 0;
  if (typeof st.sealedUntil !== 'number') st.sealedUntil = 0;
  if (typeof st.sealedReadyAt !== 'number') st.sealedReadyAt = 0;
  if (typeof st.digGlowUntil !== 'number') st.digGlowUntil = 0;
  st.update = update;
  st.draw = draw;
  st.__rawUpdate = update;
  st.__probe = function () {
    const s = getState();
    const a = anchorPos();
    return {
      buried: !!(s && s.buried),
      memory: (s && s.memory != null) ? String(s.memory) : null,
      near: !!(s && s.near),
      sealed: !!(s && s.sealedUntil > nowFn()),
      anchor: { gx: a.gx, gy: a.gy }
    };
  };
}

export {};
