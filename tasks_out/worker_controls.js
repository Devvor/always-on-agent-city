let fadeStart = null;
let opacity = 1;
let keydownCount = 0;
let clickCount = 0;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildControls; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function fitFn(text, maxW, ctxArg) {
  text = (text == null ? '' : String(text));
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) { }
  }
  const Vv = getV();
  const c = ctxArg || (Vv && Vv.ctx);
  if (!c || !isFinite(maxW) || maxW <= 0) return (maxW <= 0 ? '' : text);
  if (c.measureText(text).width <= maxW) return text;
  const ell = '\u2026';
  for (let i = text.length; i > 0; i--) {
    const cand = text.slice(0, i) + ell;
    if (c.measureText(cand).width <= maxW) return cand;
  }
  return c.measureText(ell).width <= maxW ? ell : '';
}

function dismiss(state, now) {
  if (!state || state.dismissed) return;
  state.dismissed = true;
  state.visible = true;
  fadeStart = (typeof now === 'number') ? now : nowFn();
  opacity = 1;
}

function onKeydown(e) {
  keydownCount += 1;
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;
  if (state.dismissed || !state.visible) return;
  dismiss(state, nowFn());
}

function onClick(e) {
  clickCount += 1;
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;
  if (state.dismissed || !state.visible) return;
  dismiss(state, nowFn());
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;

  if (state.dismissed) {
    if (fadeStart != null) {
      const elapsed = (now - fadeStart) / 1000;
      opacity = clamp(1 - elapsed / 0.3, 0, 1);
      if (elapsed >= 0.3) {
        opacity = 0;
        fadeStart = null;
        state.visible = false;
      } else {
        state.visible = true;
      }
    } else {
      opacity = 0;
      state.visible = false;
    }
    return;
  }

  state.dismissed = false;
  state.visible = true;
  opacity = 1;
  fadeStart = null;
}

function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  const Vv = getV();
  if (!state || !Vv || Vv.gameState !== 'play') return;
  if (!state.visible) return;

  const now = nowFn();
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : Vv.canvas;
  if (!canvas) return;
  const cw = canvas.width;
  const ch = canvas.height;

  const cardW = 340;
  const cardH = 150;
  const x = Math.round((cw - cardW) * 0.5);
  const y = Math.round(ch - cardH - 18);
  const alpha = clamp(opacity, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1c1a16';
  ctx.fillRect(x, y, cardW, cardH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, cardW - 2, cardH - 2);

  ctx.beginPath();
  ctx.rect(x, y, cardW, cardH);
  ctx.clip();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(fitFn('GUILD ORIENTATION', cardW - 24, ctx), x + cardW * 0.5, y + 17);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 18, y + 27, cardW - 36, 1);

  const lines = [
    'WASD / arrows — walk',
    'E — talk, pet, endorse, read',
    'drag — pan camera, wheel — zoom',
    '1-4 — emotes',
    'P — patron license'
  ];

  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  const bodyX = x + 16;
  let bodyY = y + 40;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(fitFn(lines[i], cardW - 32, ctx), bodyX, bodyY);
    bodyY += 15;
  }

  const blinkOn = Math.floor(now / 500) % 2 === 0;
  if (blinkOn) {
    ctx.fillStyle = '#d4af37';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(fitFn('[ press any key ]', cardW - 32, ctx), bodyX, y + cardH - 16);
  }

  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildControls || typeof window.GuildControls !== 'object') {
    window.GuildControls = { dismissed: false, visible: true };
  }
  const gc = window.GuildControls;
  if (typeof gc.dismissed !== 'boolean') gc.dismissed = false;
  if (typeof gc.visible !== 'boolean') gc.visible = true;

  gc.update = update;
  gc.draw = draw;
  gc.__probe = function () {
    return {
      dismissed: !!gc.dismissed,
      visible: !!gc.visible,
      opacity: opacity,
      fadeStart: fadeStart,
      keydownCount: keydownCount,
      clickCount: clickCount
    };
  };

  if (!window.__gcListeners) {
    window.__gcListeners = true;
    window.addEventListener('keydown', onKeydown, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
  }
}

export {};
