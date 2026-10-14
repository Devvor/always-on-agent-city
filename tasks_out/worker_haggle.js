let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return { coins: 0, buys: 0, deal: null };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try {
      const r = w.iso(gx, gy);
      if (r && isFinite(r.x) && isFinite(r.y)) return r;
    } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return null;
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildHaggle; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function anchorTile() {
  const Vv = getV();
  if (!Vv) return null;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  let gx = clamp(1.0, minC, maxC);
  let gy = clamp(5.1, minC, maxC);
  const stallX = -0.6;
  const stallY = 4.4;
  const dx = gx - stallX;
  const dy = gy - stallY;
  const dist = Math.hypot(dx, dy);
  if (dist > 0 && dist < 1.5) {
    const scale = 1.5 / dist;
    gx = stallX + dx * scale;
    gy = stallY + dy * scale;
    gx = clamp(gx, minC, maxC);
    gy = clamp(gy, minC, maxC);
  }
  return { gx: gx, gy: gy };
}

function priceFn() {
  const w = root();
  const m = w && w.GuildMarket;
  let p = 2;
  if (m && m.price != null && isFinite(m.price)) p = Number(m.price);
  if (!isFinite(p)) p = 2;
  return p;
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const h = getState();
  const w = root();
  const Vv = getV();
  if (!h) {
    prevPressed = new Set(pressed);
    lastTime = now;
    return;
  }

  const isoAvailable = !!(w && (typeof w.iso === 'function' || (Vv && Vv.grid)));
  const bPressed = pressed.has('b');
  const bWas = prevPressed.has('b');

  if (!Vv || Vv.gameState !== 'play' || !isoAvailable) {
    lastTime = now;
    prevPressed = new Set(pressed);
    return;
  }

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const av = anchorTile();
  const visitor = w && w.GuildVisitor;
  let near = false;
  if (av && visitor && typeof visitor.gx === 'number' && typeof visitor.gy === 'number') {
    near = Math.hypot(visitor.gx - av.gx, visitor.gy - av.gy) <= 1.6;
  }

  if (h.deal === null && near && bPressed && !bWas) {
    h.deal = {
      active: true,
      start: now,
      duration: 3000,
      price: priceFn()
    };
  }

  if (h.deal && h.deal.active === true) {
    const start = (typeof h.deal.start === 'number') ? h.deal.start : now;
    const duration = (typeof h.deal.duration === 'number') ? h.deal.duration : 3000;
    if (now - start >= duration) {
      const price = (typeof h.deal.price === 'number') ? h.deal.price : priceFn();
      try {
        const eco = w && w.GuildEconomy;
        const purses = eco && eco.purses;
        if (Array.isArray(purses)) {
          const tips = w && w.GuildTips;
          if (tips && typeof tips.coins === 'number' && tips.coins >= price) {
            tips.coins -= price;
          }
        } else {
          h.coins = (typeof h.coins === 'number' ? h.coins : 0) + price;
        }
      } catch (e) {}
      h.buys = (typeof h.buys === 'number' ? h.buys : 0) + 1;
      h.soldUntil = now + 1500;
      try {
        if (typeof w.cue === 'function') w.cue('done');
      } catch (e) {}
      h.deal = null;
    }
  }

  prevPressed = new Set(pressed);
}

function draw(ctx) {
  const h = getState();
  if (!h) return;
  const Vv = getV();
  const w = root();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  if (!(w && (typeof w.iso === 'function' || (Vv && Vv.grid)))) return;

  const now = nowFn();
  const av = anchorTile();
  if (!av) return;
  const pt = isoFn(av.gx, av.gy);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;

  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 1, y - 24, 2, 24);

  const bw = 34;
  const bh = 16;
  const bx = x - Math.round(bw * 0.5);
  const by = y - 40;
  ctx.fillStyle = '#0d1324';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('DEAL', bw - 6), x, by + bh * 0.5 + 1);

  const chipText = 'Buys: ' + (typeof h.buys === 'number' ? h.buys : 0);
  ctx.font = 'bold 9px monospace';
  const chipW = Math.round(ctx.measureText(chipText).width) + 8;
  const chipH = 12;
  const chipX = x - Math.round(chipW * 0.5);
  const chipY = y + 2;
  ctx.fillStyle = '#0d1324';
  ctx.fillRect(chipX, chipY, chipW, chipH);
  ctx.strokeStyle = '#d4af37';
  ctx.strokeRect(chipX, chipY, chipW, chipH);
  ctx.fillStyle = '#d4af37';
  ctx.fillText(fitFn(chipText, chipW - 6), x, chipY + chipH * 0.5 + 1);

  if (h.deal && h.deal.active === true) {
    const start = (typeof h.deal.start === 'number') ? h.deal.start : now;
    const duration = (typeof h.deal.duration === 'number') ? h.deal.duration : 3000;
    const elapsed = Math.max(0, now - start);
    const t = Math.max(0, Math.min(1, elapsed / duration));
    const markerValue = ((typeof h.deal.price === 'number') ? h.deal.price : priceFn()) - t;
    const floatY = -Math.round(t * 34);

    const px = x - 6;
    const py = y - 18 + floatY;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(px, py, 12, 10);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(px + 2, py + 2, 8, 2);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(px + 4, py + 3, 4, 2);

    ctx.globalAlpha = Math.max(0.25, 1 - t * 0.6);
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.fillText((markerValue >= 0 ? markerValue.toFixed(1) : '0.0') + ' GC', x, y - 24 + floatY);
    ctx.globalAlpha = Math.max(0.35, 1 - t * 0.5);
    ctx.fillStyle = '#d4af37';
    ctx.fillText('-1 GC', x, y - 34 + floatY);
    ctx.globalAlpha = 1;
  }

  if (typeof h.soldUntil === 'number' && now < h.soldUntil) {
    const life = Math.max(0, Math.min(1, (h.soldUntil - now) / 1500));
    ctx.globalAlpha = life;
    const tagW = 46;
    const tagH = 14;
    const tagX = x - Math.round(tagW * 0.5);
    const tagY = y - 56;
    ctx.fillStyle = '#0d1324';
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOLD!', x, tagY + tagH * 0.5 + 1);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

if (typeof window !== 'undefined') {
  if (!window.GuildHaggle) window.GuildHaggle = createState();
  const state = window.GuildHaggle;
  if (typeof state.coins !== 'number') state.coins = 0;
  if (typeof state.buys !== 'number') state.buys = 0;
  if (!(state.deal === null || (state.deal && typeof state.deal === 'object'))) state.deal = null;

  state.update = update;
  state.draw = draw;
  state.__keys = pressed;
  state.__rawUpdate = update;
  state.__probe = function () {
    return {
      pressed: Array.from(pressed),
      prev: Array.from(prevPressed),
      state: { coins: state.coins, buys: state.buys, deal: state.deal },
      soldUntil: state.soldUntil || null
    };
  };

  if (!window.__ghListeners) {
    window.__ghListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
