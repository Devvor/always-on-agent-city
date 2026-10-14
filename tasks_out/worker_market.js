const BOARD_GX = 2.0;
const BOARD_GY = 6.5;
const STALL_GX = 2.5;
const STALL_GY = 6.0;
const QUEST_BOARD = { gx: -1.6, gy: 4.2 };
const ARCADE_SIGN = { gx: 4.5, gy: 6.0 };
const WINDOW_BUY = 1.6;
const BASE_PRICE = 2;
const MAX_PRICE = 6;
const MIN_PRICE = 1;
const PRICE_STEP = 1;
const COOLDOWN_NO_BUY = 90;
const WINDOW_MS = 5 * 60 * 1000;
const FLASH_MS = 1000;
const BOARD_W = 132;
const BOARD_H = 120;
const FRAME_PAD = 4;
const TITLE_H = 18;
const PRICE_H = 26;
const LINE_H = 12;
const HINT_H = 12;
const FONT_TITLE = 'bold 11px monospace';
const FONT_PRICE = 'bold 15px monospace';
const FONT_LINE = '9px monospace';
const FONT_HINT = '9px monospace';
const COL_BOARD = '#2b2b2b';
const COL_FRAME = '#8b5a2b';
const COL_TEXT = '#f5f5f5';
const COL_GOLD = '#d4af37';
const COL_FLASH = '#ffd54f';
const COL_HINT = '#c8b89a';

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
function getEconomy() { const w = root(); return w && w.GuildEconomy; }
function getSnackRun() { const w = root(); return w && w.GuildSnackRun; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getMarket() { const w = root(); return w && w.GuildMarket; }

function clampCoord(v, s) {
  const minC = -2 - s;
  const maxC = 1 + s;
  if (v < minC) return minC;
  if (v > maxC) return maxC;
  return v;
}

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function clampOnIsland(gx, gy, s) {
  const ring = tileRing(gx, gy);
  if (ring <= s) return { gx: gx, gy: gy };
  const minC = -2 - s;
  const maxC = 1 + s;
  let bx = Math.round(gx);
  let by = Math.round(gy);
  if (bx < minC) bx = minC;
  if (bx > maxC) bx = maxC;
  if (by < minC) by = minC;
  if (by > maxC) by = maxC;
  if (tileRing(bx, by) > s) {
    let best = null;
    let bestRing = Infinity;
    for (let dgx = -1; dgx <= 1; dgx++) {
      for (let dgy = -1; dgy <= 1; dgy++) {
        const tx = bx + dgx;
        const ty = by + dgy;
        if (tx < minC || tx > maxC || ty < minC || ty > maxC) continue;
        const r = tileRing(tx, ty);
        if (r <= s && r < bestRing) { bestRing = r; best = { gx: tx, gy: ty }; }
      }
    }
    if (best) return best;
  }
  return { gx: bx, gy: by };
}

function distToTile(px, py, gx, gy) {
  const pt = isoFn(gx, gy);
  return Math.hypot(px - pt.x, py - pt.y);
}

function isClearOf(pt, other, minDist) {
  const o = isoFn(other.gx, other.gy);
  return Math.hypot(pt.x - o.x, pt.y - o.y) >= minDist;
}

function resolveBoardPos(s) {
  const clamped = clampOnIsland(BOARD_GX, BOARD_GY, s);
  let cand = clamped;
  const questPt = isoFn(QUEST_BOARD.gx, QUEST_BOARD.gy);
  const arcadePt = isoFn(ARCADE_SIGN.gx, ARCADE_SIGN.gy);
  const minDist = 26;
  if (!isClearOf(cand, QUEST_BOARD, minDist) || !isClearOf(cand, ARCADE_SIGN, minDist)) {
    const offsets = [
      { dx: 0.4, dy: 0.4 }, { dx: -0.4, dy: 0.4 }, { dx: 0.4, dy: -0.4 }, { dx: -0.4, dy: -0.4 },
      { dx: 0.6, dy: 0.6 }, { dx: -0.6, dy: 0.6 }, { dx: 0.6, dy: -0.6 }, { dx: -0.6, dy: -0.6 },
      { dx: 0.8, dy: 0.8 }, { dx: -0.8, dy: 0.8 }, { dx: 0.8, dy: -0.8 }, { dx: -0.8, dy: -0.8 }
    ];
    for (let i = 0; i < offsets.length; i++) {
      const o = offsets[i];
      const c = clampOnIsland(BOARD_GX + o.dx, BOARD_GY + o.dy, s);
      const cp = isoFn(c.gx, c.gy);
      if (Math.hypot(cp.x - questPt.x, cp.y - questPt.y) >= minDist && Math.hypot(cp.x - arcadePt.x, cp.y - arcadePt.y) >= minDist) {
        cand = c;
        break;
      }
    }
  }
  return isoFn(cand.gx, cand.gy);
}

function snapshotPurses(econ) {
  if (!econ || !Array.isArray(econ.purses)) return null;
  const snap = [];
  for (let i = 0; i < econ.purses.length; i++) {
    const p = econ.purses[i];
    if (p == null) { snap.push(null); continue; }
    const count = (typeof p.count === 'number') ? p.count : (typeof p === 'number' ? p : 0);
    snap.push(count);
  }
  return snap;
}

function diffPurses(prev, curr) {
  if (!Array.isArray(prev) || !Array.isArray(curr)) return 0;
  let drops = 0;
  const len = Math.min(prev.length, curr.length);
  for (let i = 0; i < len; i++) {
    const a = prev[i];
    const b = curr[i];
    if (typeof a === 'number' && typeof b === 'number' && b < a) drops++;
  }
  return drops;
}

function moodWord(buys) {
  if (buys >= 4) return 'BUSY!';
  if (buys >= 1) return 'steady';
  return 'quiet...';
}

function createState() {
  return {
    price: BASE_PRICE,
    buys: [],
    demandLine: [],
    lastPurseSnap: null,
    lastSnackPhase: null,
    lastNoBuyTime: null,
    priceFlash: 0,
    boardPos: null
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getMarket();
  if (!st) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  st.boardPos = resolveBoardPos(s);

  const econ = getEconomy();
  const snack = getSnackRun();
  let newBuys = 0;

  const snap = snapshotPurses(econ);
  if (snap) {
    if (st.lastPurseSnap) {
      newBuys += diffPurses(st.lastPurseSnap, snap);
    }
    st.lastPurseSnap = snap;
  } else {
    st.lastPurseSnap = null;
  }

  if (snack && typeof snack.phase === 'string') {
    if (st.lastSnackPhase !== null && snack.phase === 'held' && st.lastSnackPhase !== 'held') {
      newBuys += 1;
    }
    st.lastSnackPhase = snack.phase;
  }

  if (newBuys > 0) {
    for (let i = 0; i < newBuys; i++) st.buys.push(now);
    if (st.price < MAX_PRICE) {
      st.price += PRICE_STEP;
      if (st.price > MAX_PRICE) st.price = MAX_PRICE;
      st.priceFlash = FLASH_MS;
    }
    st.lastNoBuyTime = null;
  } else {
    if (st.lastNoBuyTime == null) st.lastNoBuyTime = now;
    const idleMs = now - st.lastNoBuyTime;
    if (idleMs >= COOLDOWN_NO_BUY * 1000 && st.price > MIN_PRICE) {
      st.price -= PRICE_STEP;
      if (st.price < MIN_PRICE) st.price = MIN_PRICE;
      st.priceFlash = FLASH_MS;
      st.lastNoBuyTime = now;
    }
  }

  const cutoff = now - WINDOW_MS;
  while (st.buys.length > 0 && st.buys[0] < cutoff) st.buys.shift();
  st.demandLine = st.buys.slice();

  if (st.priceFlash > 0) {
    st.priceFlash -= (now - (st._lastNow || now));
    if (st.priceFlash < 0) st.priceFlash = 0;
  }
  st._lastNow = now;
}

function drawBoard(ctx, st, Vv, now) {
  if (!ctx || !st || !st.boardPos) return;
  const pt = st.boardPos;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const bx = x - Math.round(BOARD_W * 0.5);
  const by = y - BOARD_H + 6;

  ctx.save();
  ctx.beginPath();
  ctx.rect(bx - FRAME_PAD, by - FRAME_PAD, BOARD_W + FRAME_PAD * 2, BOARD_H + FRAME_PAD * 2);
  ctx.clip();

  ctx.fillStyle = COL_BOARD;
  ctx.fillRect(bx, by, BOARD_W, BOARD_H);
  ctx.strokeStyle = COL_FRAME;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, BOARD_W, BOARD_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = COL_TEXT;
  ctx.font = FONT_TITLE;
  ctx.fillText('SNACKS', bx + BOARD_W * 0.5, by + TITLE_H * 0.5);

  const flashAlpha = Math.max(0, Math.min(1, st.priceFlash / FLASH_MS));
  const priceCol = flashAlpha > 0 ? COL_FLASH : COL_GOLD;
  ctx.fillStyle = priceCol;
  ctx.font = FONT_PRICE;
  ctx.fillText(st.price + ' GC', bx + BOARD_W * 0.5, by + TITLE_H + PRICE_H * 0.5);

  ctx.fillStyle = COL_TEXT;
  ctx.font = FONT_LINE;
  ctx.fillText('buys(5m): ' + st.buys.length, bx + BOARD_W * 0.5, by + TITLE_H + PRICE_H + LINE_H * 0.5);
  ctx.fillText(moodWord(st.buys.length), bx + BOARD_W * 0.5, by + TITLE_H + PRICE_H + LINE_H + LINE_H * 0.5);

  const vis = getVisitor();
  let near = false;
  if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') {
    const vpt = isoFn(vis.gx, vis.gy);
    near = distToTile(vpt.x, vpt.y, BOARD_GX, BOARD_GY) <= WINDOW_BUY;
  }
  if (near) {
    ctx.fillStyle = COL_HINT;
    ctx.font = FONT_HINT;
    ctx.fillText('[E-board next door] buy a snack', bx + BOARD_W * 0.5, by + BOARD_H - HINT_H * 0.5);
  }

  ctx.restore();
}

function draw(ctx) {
  const st = getMarket();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  drawBoard(ctx, st, Vv, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildMarket) window.GuildMarket = createState();
  window.GuildMarket.update = update;
  window.GuildMarket.draw = draw;
  window.GuildMarket.__probe = function () {
    const st = getMarket();
    if (!st) return { price: BASE_PRICE, buys: 0 };
    return { price: st.price, buys: st.buys.length };
  };
}

export {};
