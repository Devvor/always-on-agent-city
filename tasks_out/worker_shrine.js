const pressed = new Set();
const prevPressed = new Set();
const coinAnims = [];
let keyPending = false;
let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildShrine; }
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
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function shrinePos(Vv) {
  const S = getState();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  let gx = (S && typeof S.gx === 'number') ? S.gx : -5.0;
  let gy = (S && typeof S.gy === 'number') ? S.gy : -2.5;
  if (gx < minC) gx = minC;
  if (gx > maxC) gx = maxC;
  if (gy < minC) gy = minC;
  if (gy > maxC) gy = maxC;
  return { gx: gx, gy: gy };
}
function tryOffer(vis, Vv, S, now) {
  if (!vis || !Vv || !S || Vv.gameState !== 'play') return;
  const sp = shrinePos(Vv);
  const dx = vis.gx - sp.gx;
  const dy = vis.gy - sp.gy;
  if (Math.hypot(dx, dy) > 1.6) return;
  if (now - (typeof S.lastOffer === 'number' ? S.lastOffer : 0) <= 20000) return;
  S.lastOffer = now;
  S.coins = (typeof S.coins === 'number' ? S.coins : 0) + 1;
  S.buff = { t0: now, dur: 60000 };
  coinAnims.push({ start: now, dur: 600, from: { gx: vis.gx, gy: vis.gy }, to: { gx: sp.gx, gy: sp.gy } });
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue('grow'); } catch (e) {}
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  if (k === 'e') keyPending = true;
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const S = getState();
  const vis = getVisitor();
  const was = prevPressed.has('e');
  const isNow = pressed.has('e');
  const shouldTry = keyPending || (!was && isNow);
  keyPending = false;
  if (shouldTry && vis && Vv && Vv.gameState === 'play' && S) {
    tryOffer(vis, Vv, S, now);
  }
  prevPressed = new Set(pressed);
  if (!S || !Vv || Vv.gameState !== 'play') return;
  try {
    const nextCoins = [];
    for (let i = 0; i < coinAnims.length; i++) {
      const ca = coinAnims[i];
      if (now - ca.start < ca.dur) nextCoins.push(ca);
    }
    coinAnims.length = 0;
    for (let i = 0; i < nextCoins.length; i++) coinAnims.push(nextCoins[i]);
    if (S.buff && typeof S.buff.t0 === 'number' && now - S.buff.t0 >= S.buff.dur) S.buff = null;
  } catch (e) {}
}

function draw(ctx) {
  const S = getState();
  const Vv = getV();
  const vis = getVisitor();
  if (!ctx || !S || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  try {
    if (S.buff && typeof S.buff.t0 === 'number' && now - S.buff.t0 >= S.buff.dur) S.buff = null;
    const sp = shrinePos(Vv);
    const pt = isoFn(sp.gx, sp.gy);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);

    if (S.buff) {
      const age = now - S.buff.t0;
      const pulse = 0.4 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.006));
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 12, y - 10, 24, 6);
      ctx.strokeRect(x - 9, y - 13, 18, 12);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#6b6b73';
    ctx.fillRect(x - 7, y + 2, 14, 5);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 7, y + 2, 14, 1);
    ctx.fillRect(x - 7, y + 6, 14, 1);

    const glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.004));
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x - 4, y - 10, 2, 8);
    ctx.fillRect(x - 1, y - 13, 2, 11);
    ctx.fillRect(x + 3, y - 9, 2, 7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(x - 4, y - 10, 1, 1);
    ctx.fillRect(x - 1, y - 13, 1, 1);
    ctx.fillRect(x + 3, y - 9, 1, 1);

    for (let i = 0; i < coinAnims.length; i++) {
      const ca = coinAnims[i];
      let t = (now - ca.start) / ca.dur;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      const gx = ca.from.gx + (ca.to.gx - ca.from.gx) * t;
      const gy = ca.from.gy + (ca.to.gy - ca.from.gy) * t - Math.sin(t * Math.PI) * 1.6;
      const cpt = isoFn(gx, gy);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(Math.round(cpt.x), Math.round(cpt.y), 2, 2);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(Math.round(cpt.x) + 1, Math.round(cpt.y) + 1, 1, 1);
    }

    if (S.buff) {
      const age = now - S.buff.t0;
      if (age <= 3000 && vis) {
        const vpt = isoFn(vis.gx, vis.gy);
        const a = Math.max(0, 1 - age / 3000);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LUCK', Math.round(vpt.x + 7), Math.round(vpt.y) - 42);
        ctx.textAlign = 'left';
        ctx.restore();
      }
      if (Vv && Array.isArray(Vv.xpTexts)) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < Vv.xpTexts.length; i++) {
          const xp = Vv.xpTexts[i];
          if (!xp) continue;
          ctx.fillRect(Math.round(xp.x + 5), Math.round(xp.y - 6), 1, 1);
          ctx.fillRect(Math.round(xp.x - 2), Math.round(xp.y - 10), 1, 1);
        }
      }
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildShrine) {
    window.GuildShrine = { gx: -5.0, gy: -2.5, lastOffer: 0, buff: null, coins: 0 };
  } else {
    const S = window.GuildShrine;
    if (typeof S.gx !== 'number') S.gx = -5.0;
    if (typeof S.gy !== 'number') S.gy = -2.5;
    if (typeof S.lastOffer !== 'number') S.lastOffer = 0;
    if (typeof S.coins !== 'number') S.coins = 0;
  }
  const S = window.GuildShrine;
  S.update = update;
  S.draw = draw;
  S.__probe = function () { return { coins: (typeof S.coins === 'number' ? S.coins : 0), buff: !!S.buff }; };
  S.__keys = pressed;
  if (!window.__gsListeners) {
    window.__gsListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
