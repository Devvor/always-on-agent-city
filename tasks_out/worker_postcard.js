const STAND_GX = 0.0;
const STAND_GY = 5.4;
const SEND_DURATION = 1500;

let pressed = new Set();
let prevPressed = new Set();

function createState() {
  return {
    posted: 0,
    draft: null,
    sending: false,
    sendStart: 0,
    sendText: null
  };
}

function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function getV() {
  const w = root();
  return w && w.V ? w.V : null;
}

function getState() {
  const w = root();
  return w && w.GuildPostcard ? w.GuildPostcard : null;
}

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

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function isNear(vis) {
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return Math.hypot(vis.gx - STAND_GX, vis.gy - STAND_GY) <= 1.6;
}

function composeDraft(Vv) {
  let totalDone = 0;
  if (Vv && typeof Vv.totalDone === 'number') totalDone = Vv.totalDone;

  const allTasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  const doneTasks = allTasks.filter(function (t) { return t && t.status === 'done'; });
  const newest = doneTasks.length ? doneTasks[doneTasks.length - 1] : null;

  let newestPart = 'none';
  if (newest) {
    const id = (newest.id != null) ? String(newest.id) : '(quest)';
    const title = (newest.title != null) ? String(newest.title) : '(untitled)';
    newestPart = id + ' - ' + title;
  }

  const weather = (Vv && Vv.weather != null) ? String(Vv.weather) : 'CLEAR';

  return 'GUILD POST\n' +
    'Done: ' + totalDone + '\n' +
    'Newest done: ' + newestPart + '\n' +
    'Weather: ' + weather;
}

function advanceState(pc, now) {
  if (!pc || !pc.sending) return;
  const progress = (now - pc.sendStart) / SEND_DURATION;
  if (progress >= 1) {
    pc.sending = false;
    pc.draft = null;
    pc.sendText = null;
    pc.sendStart = 0;
  }
}

function handleE(pc, Vv, now) {
  if (!pc || !Vv) return;
  const vis = root() && root().GuildVisitor;
  if (!isNear(vis)) return;
  if (pc.sending) return;

  if (!pc.draft) {
    pc.draft = composeDraft(Vv);
  } else {
    pc.sending = true;
    pc.sendStart = now;
    pc.sendText = pc.draft;
    pc.posted = (Number(pc.posted) || 0) + 1;
    try {
      const cueFn = root() && root().cue;
      if (typeof cueFn === 'function') cueFn('grow');
    } catch (e) {}
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const pc = getState();
  const Vv = getV();
  if (!pc || !Vv || Vv.gameState !== 'play') {
    prevPressed = new Set(pressed);
    return;
  }

  advanceState(pc, now);

  const ePressed = pressed.has('e') || pressed.has(' ');
  const eWas = prevPressed.has('e') || prevPressed.has(' ');

  const vis = root() && root().GuildVisitor;
  if (isNear(vis) && !eWas && ePressed) {
    handleE(pc, Vv, now);
  }

  prevPressed = new Set(pressed);
}

function drawStand(ctx, x, y, pc) {
  ctx.fillStyle = '#5a4028';
  ctx.fillRect(x - 14, y - 18, 4, 26);
  ctx.fillRect(x + 14, y - 18, 4, 26);

  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(x - 16, y - 2, 36, 4);

  ctx.fillStyle = '#6b4f32';
  ctx.fillRect(x - 18, y + 8, 40, 5);

  const cardDefs = [
    { dx: -12, doodle: false },
    { dx: -2, doodle: false },
    { dx: 8, doodle: true }
  ];

  for (let i = 0; i < cardDefs.length; i++) {
    const cd = cardDefs[i];
    const cx = x + cd.dx;
    const cy = y - 16;
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(cx, cy, 10, 14);
    ctx.strokeStyle = '#b9b5a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, 10, 14);

    if (cd.doodle) {
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(cx + 1, cy + 9, 8, 3);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(cx + 2, cy + 7, 6, 3);
    }
  }

  ctx.fillStyle = '#2b1d0e';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POSTED ' + (Number(pc.posted) || 0), x, y - 26);
}

function drawHint(ctx, x, y) {
  const text = '[E] SEND A POSTCARD';
  ctx.font = 'bold 10px monospace';
  const tw = Math.round(ctx.measureText(text).width) + 10;
  const hx = Math.round(x - tw * 0.5);
  const hy = y - 40;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(hx, hy, tw, 14);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(hx, hy, tw, 14);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, hx + tw * 0.5, hy + 7);
}

function drawCard(ctx, x, y, pc, now) {
  const Vv = getV();
  const canvas = Vv && Vv.canvas;
  let cardX = x + 6;
  let cardY = y - 92;
  let alpha = 1;

  if (pc.sending) {
    const p = Math.max(0, Math.min(1, (now - pc.sendStart) / SEND_DURATION));
    const ease = 1 - Math.pow(1 - p, 3);
    const screenH = (canvas && isFinite(canvas.height)) ? canvas.height : 640;
    cardY = (y - 92) - (ease * (screenH + 240));
    alpha = Math.max(0.35, 1 - p * 0.65);
  }

  const cardW = 132;
  const cardH = 92;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = '#f3e6bf';
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = '#8b6b3f';
  ctx.lineWidth = 1;
  ctx.strokeRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = '#b8860b';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUILD POST', cardX + cardW * 0.5, cardY + 15);

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cardX + cardW - 20, cardY + 8, 14, 14);
  ctx.strokeStyle = '#fca5a5';
  ctx.strokeRect(cardX + cardW - 20, cardY + 8, 14, 14);

  const textSource = (pc.draft != null) ? pc.draft : (pc.sendText != null ? pc.sendText : '');
  const lines = String(textSource).split('\n');

  ctx.save();
  ctx.beginPath();
  ctx.rect(cardX + 9, cardY + 26, cardW - 18, cardH - 34);
  ctx.clip();

  ctx.fillStyle = '#2b1d0e';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let lineY = cardY + 38;
  for (let i = 0; i < lines.length; i++) {
    const shown = fitFn(lines[i], cardW - 18);
    ctx.fillText(shown, cardX + 9, lineY);
    lineY += 13;
  }
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.restore();
}

function draw(ctx) {
  const now = nowFn();
  const pc = getState();
  const Vv = getV();
  if (!pc || !ctx || !Vv || Vv.gameState !== 'play') return;

  advanceState(pc, now);

  const pt = isoFn(STAND_GX, STAND_GY);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.save();
  drawStand(ctx, x, y, pc);

  const vis = root() && root().GuildVisitor;
  if (isNear(vis)) drawHint(ctx, x, y);

  if (pc.draft || pc.sending) {
    drawCard(ctx, x, y, pc, now);
  }
  ctx.restore();
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  if (k === 'e' || k === ' ') pressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

if (typeof window !== 'undefined') {
  if (!window.GuildPostcard) window.GuildPostcard = createState();
  const pc = window.GuildPostcard;
  pc.update = update;
  pc.draw = draw;
  pc.__probe = function () {
    const s = getState() || pc;
    return {
      posted: Number(s.posted) || 0,
      draft: (s.draft == null) ? null : String(s.draft)
    };
  };

  if (!window.__gpcListeners) {
    window.__gpcListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
