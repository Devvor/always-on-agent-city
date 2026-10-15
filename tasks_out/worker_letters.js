const GX = -4.6;
const GY = 3.4;
const REPLIES = [
  ['read it. filed it under chaos.', 'interesting exploit. noted.', 'glitch logged. chaos grows.'],
  ['a whisper caught in parchment.', 'ink remembers what voices forget.', 'the wind reads slower than you.'],
  ['got it! on it right away!', 'thanks! i\'ll try that!', 'cool note, copying now!'],
  ['words pass; understanding remains.', 'every note is a small lamp.', 'patience turns ink into insight.']
];
const GL = { gx: GX, gy: GY, open: false, letters: [], replies: [] };

let inputEl = null;
let nextReplyAt = null;
let idleCounts = [];
let lastPositions = [];
let variantCounters = [0, 0, 0, 0];
let reader = null;

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
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

function appendLetter(text, t) {
  GL.letters.push({ t0: (typeof t === 'number' ? t : nowFn()), text: String(text || ''), from: 'visitor' });
  if (GL.letters.length > 12) GL.letters.shift();
}

function ensureInput() {
  if (inputEl && (typeof document === 'undefined' || document.body.contains(inputEl))) return inputEl;
  if (typeof document === 'undefined') return null;
  inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.id = 'guild-letters-input';
  inputEl.className = 'guild-letters-hidden-input';
  inputEl.setAttribute('aria-hidden', 'true');
  inputEl.style.position = 'fixed';
  inputEl.style.left = '-9999px';
  inputEl.style.top = '0px';
  inputEl.style.width = '1px';
  inputEl.style.height = '1px';
  inputEl.style.opacity = '0';
  document.body.appendChild(inputEl);
  inputEl.addEventListener('keydown', function (e) {
    if (e && e.key === 'Enter') {
      const v = String(inputEl.value || '').trim();
      if (v) appendLetter(v, nowFn());
      inputEl.value = '';
    }
  });
  inputEl.addEventListener('blur', function () {
    if (inputEl) inputEl.value = '';
  });
  return inputEl;
}

function openPanel() {
  ensureInput();
  GL.open = true;
  if (inputEl) {
    inputEl.value = '';
    try { inputEl.focus(); } catch (e) {}
  }
}

function closePanel() {
  if (!GL.open) return;
  GL.open = false;
  if (inputEl) {
    try { inputEl.blur(); } catch (e) {}
    inputEl.value = '';
  }
}

function distToDesk() {
  const v = getVisitor();
  if (!v || !isFinite(v.gx) || !isFinite(v.gy)) return Infinity;
  return Math.hypot(v.gx - GL.gx, v.gy - GL.gy);
}

function handleKeydown(e) {
  const k = (e && e.key) ? String(e.key).toLowerCase() : '';
  if (k !== 'e') return;
  if (inputEl && (e.target === inputEl || (typeof document !== 'undefined' && document.activeElement === inputEl))) return;
  if (distToDesk() > 1.6) return;
  if (GL.open) closePanel();
  else openPanel();
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', handleKeydown);
}

function workerIsIdle(meta, w) {
  const tasks = (meta && Array.isArray(meta.tasks)) ? meta.tasks : ((w && Array.isArray(w.tasks)) ? w.tasks : []);
  return tasks.length === 0 || tasks.every(function (t) { return t && t.status === 'done'; });
}

function tryPostReply(ws, now) {
  if (!GL.letters.length) return;
  const Vv = getV();
  const metas = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  let candidate = -1;
  for (let i = 0; i < ws.length; i++) {
    if (!ws[i] || !isFinite(ws[i].x) || !isFinite(ws[i].y)) continue;
    if ((idleCounts[i] || 0) < 2) continue;
    if (workerIsIdle(metas[i], ws[i])) { candidate = i; break; }
  }
  if (candidate < 0) {
    for (let i = 0; i < ws.length; i++) {
      if (!ws[i]) continue;
      if ((idleCounts[i] || 0) >= 2) { candidate = i; break; }
    }
  }
  if (candidate < 0) return;
  const idx = candidate % 4;
  const variants = REPLIES[idx];
  const vi = variantCounters[idx] % variants.length;
  variantCounters[idx]++;
  const meta = metas[candidate] || {};
  const name = (meta.name != null) ? meta.name : ('WORKER ' + (candidate + 1));
  GL.replies.push({
    t0: now,
    text: variants[vi],
    from: name,
    workerIndex: candidate
  });
  if (GL.replies.length > 12) GL.replies.shift();
  reader = { workerIndex: candidate, start: now, duration: 2600 };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  if (nextReplyAt == null) nextReplyAt = now + 45000 + Math.random() * 30000;

  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  while (idleCounts.length < ws.length) {
    idleCounts.push(0);
    lastPositions.push(null);
  }
  if (idleCounts.length > ws.length) {
    idleCounts = idleCounts.slice(0, ws.length);
    lastPositions = lastPositions.slice(0, ws.length);
  }
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    let moved = false;
    if (w) {
      if (w.moving === true) moved = true;
      const lp = lastPositions[i];
      if (!moved && lp && (Math.abs(lp.x - w.x) > 0.5 || Math.abs(lp.y - w.y) > 0.5)) moved = true;
      if (moved) idleCounts[i] = 0;
      else idleCounts[i] = (idleCounts[i] || 0) + 1;
      lastPositions[i] = { x: w.x, y: w.y };
    } else {
      idleCounts[i] = 0;
      lastPositions[i] = null;
    }
  }

  if (GL.open && distToDesk() >= 3) closePanel();

  if (now >= nextReplyAt) {
    nextReplyAt = now + (45000 + Math.random() * 30000);
    tryPostReply(ws, now);
  }
}

function drawDeskProp(ctx, x, y, now, inRange) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 18, y - 1, 36, 6);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 18, y - 8, 36, 16);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 18, y - 10, 36, 2);
  ctx.fillRect(x - 18, y + 8, 36, 2);
  ctx.fillRect(x - 20, y - 8, 2, 16);
  ctx.fillRect(x + 18, y - 8, 2, 16);

  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(x - 14, y - 4, 12, 8);

  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 7, y - 6, 7, 6);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x + 8, y - 7, 5, 1);

  const bob = inRange ? Math.round(Math.sin(now * 0.008) * 2) : 0;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x - 8, y - 14 + bob, 2, 10);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 8, y - 4 + bob, 2, 2);

  if (inRange) {
    ctx.fillStyle = '#facc15';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fitFn('[E] WRITE A NOTE', 220), x, y - 18);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function draw (ctx) {
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const pt = isoFn(GL.gx, GL.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const inRange = distToDesk() <= 1.6;

  drawDeskProp(ctx, x, y, now, inRange);

  const boardW = 56;
  const boardH = 52;
  const bx = x - Math.round(boardW * 0.5);
  const by = y - 88;
  ctx.save();
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(bx, by, boardW, boardH);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(bx + 2, by + 2, boardW - 4, boardH - 4);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(bx + 8, by - 6, boardW - 16, 6);

  let slot = 0;
  for (let i = 0; i < GL.letters.length; i++) {
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const nx = bx + 4 + col * 26;
    const ny = by + 6 + row * 17;
    if (ny + 12 > by + boardH - 2) break;
    ctx.fillStyle = '#f4e8c1';
    ctx.fillRect(nx, ny, 24, 12);
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1;
    ctx.strokeRect(nx, ny, 24, 12);
    ctx.fillStyle = '#3a2a15';
    ctx.font = '7px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(GL.letters[i].text, 18), nx + 2, ny + 6);
    slot++;
  }

  const replyY = y - 12;
  for (let i = 0; i < GL.replies.length && i < 8; i++) {
    const nx = bx + 6;
    const ny = replyY + i * 10;
    ctx.fillStyle = '#efe6ff';
    ctx.fillRect(nx, ny, boardW - 12, 8);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1;
    ctx.strokeRect(nx, ny, boardW - 12, 8);
    ctx.fillStyle = '#5b21b6';
    ctx.font = '7px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(GL.replies[i].text, boardW - 16), nx + 2, ny + 4);
  }
  ctx.restore();

  if (GL.open) {
    const pw = 250;
    const ph = 86;
    const px = x - Math.round(pw * 0.5);
    const py = y - 132;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.fillStyle = 'rgba(244,232,193,0.97)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = '#6b4a2f';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn('WRITE A NOTE', pw - 16), px + pw * 0.5, py + 13);

    const ix = px + 12;
    const iy = py + 30;
    const iw = pw - 24;
    const ih = 20;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix, iy, iw, ih);

    let shown = '';
    if (inputEl) shown = fitFn(String(inputEl.value || ''), iw - 8);
    ctx.fillStyle = '#1f2937';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(shown, ix + 4, iy + 10);

    ctx.fillStyle = '#6b4a2f';
    ctx.font = '9px monospace';
    ctx.fillText(fitFn('Enter to pin     E to close', pw - 16), px + 8, py + ph - 10);
    ctx.restore();
  }
}

GL.update = update;
GL.draw = draw;
GL.__probe = function () { return { letters: GL.letters.length, replies: GL.replies.length, open: GL.open }; };

if (typeof window !== 'undefined') {
  window.GuildLetters = GL;
}
