const ANCHOR_GX = -5;
const ANCHOR_GY = 4;
const ROTATE_MS = 90000;

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
function getState() { const w = root(); return w && w.GuildExhibit; }

let lastRotate = null;
const seenDone = new Set();
const everNonDone = new Set();
const firstTryIds = new Set();
let firstTryStreak = 0;
let latestFirstTryId = '';

function updateFirstTryTracking(all) {
  if (!Array.isArray(all)) return;
  for (let i = 0; i < all.length; i++) {
    const t = all[i];
    if (!t) continue;
    const id = String(t.id != null ? t.id : i);
    const st = String(t.status || '').toLowerCase();
    if (st === 'pending' || st === 'in_progress' || st === 'failed') everNonDone.add(id);
  }
  for (let i = 0; i < all.length; i++) {
    const t = all[i];
    if (!t || String(t.status || '').toLowerCase() !== 'done') continue;
    const id = String(t.id != null ? t.id : i);
    if (seenDone.has(id)) continue;
    seenDone.add(id);
    if (!everNonDone.has(id)) {
      firstTryIds.add(id);
      firstTryStreak += 1;
      latestFirstTryId = id;
    }
  }
}

function gcTotal() {
  const w = root();
  if (!w) return null;
  const econ = w.GuildEconomy;
  if (!econ || typeof econ !== 'object') return null;
  const methods = ['getTotalMinted', 'totalMinted', 'getGC', 'getTotalGC', 'getMinted'];
  for (let i = 0; i < methods.length; i++) {
    try {
      if (typeof econ[methods[i]] === 'function') {
        const v = econ[methods[i]]();
        if (typeof v === 'number' && isFinite(v)) return v;
      }
    } catch (e) {}
  }
  const keys = ['totalMinted', 'totalGC', 'gcMinted', 'mintedGC', 'minted', 'gcTotal', 'total', 'gold', 'goldMinted', 'balance', 'amount', 'value', 'sum'];
  for (let i = 0; i < keys.length; i++) {
    const v = econ[keys[i]];
    if (typeof v === 'number' && isFinite(v)) return v;
  }
  for (const k in econ) {
    if (Object.prototype.hasOwnProperty.call(econ, k)) {
      const v = econ[k];
      if (typeof v === 'number' && isFinite(v) && /mint|gc|gold/i.test(k)) return v;
    }
  }
  for (const k in econ) {
    if (Object.prototype.hasOwnProperty.call(econ, k)) {
      const v = econ[k];
      if (v && typeof v === 'object') {
        for (const kk in v) {
          if (Object.prototype.hasOwnProperty.call(v, kk)) {
            const vv = v[kk];
            if (typeof vv === 'number' && isFinite(vv) && /mint|gc|gold/i.test(kk)) return vv;
          }
        }
      }
    }
  }
  return null;
}

function generateExhibits(Vv) {
  const out = [];
  const all = Array.isArray(Vv && Vv.allTasks) ? Vv.allTasks : [];
  const done = all.filter(function (t) { return t && t.status === 'done'; });
  updateFirstTryTracking(all);

  if (done.length) {
    const oldest = done[0];
    out.push({
      milestone: 0,
      titleLine: String(oldest.title != null ? oldest.title : oldest.id),
      bodyLine: done.length + ' done',
      sourceId: String(oldest.id != null ? oldest.id : '')
    });
  }

  let streakSource = latestFirstTryId;
  if (!streakSource && done.length) streakSource = String(done[done.length - 1].id != null ? done[done.length - 1].id : '');
  out.push({
    milestone: 1,
    titleLine: 'First-try streak',
    bodyLine: firstTryStreak + ' done first-try',
    sourceId: String(streakSource || '')
  });

  const gc = gcTotal();
  if (gc != null) {
    let gcSource = '';
    if (done.length) gcSource = String(done[done.length - 1].id != null ? done[done.length - 1].id : '');
    if (!gcSource && latestFirstTryId) gcSource = latestFirstTryId;
    out.push({
      milestone: 2,
      titleLine: 'Total GC minted',
      bodyLine: gc + ' GC',
      sourceId: gcSource
    });
  }
  return out;
}

function isVisitorNear() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || typeof vis.gx !== 'number' || typeof vis.gy !== 'number') return false;
  const dx = ANCHOR_GX - vis.gx;
  const dy = ANCHOR_GY - vis.gy;
  return Math.hypot(dx, dy) <= 1.5;
}

function createState() {
  return {
    gx: ANCHOR_GX,
    gy: ANCHOR_GY,
    moving: false,
    facing: 'up',
    exhibitIndex: 0,
    exhibits: [],
    near: false
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const s = getState();
  const Vv = getV();
  if (!s || !Vv || Vv.gameState !== 'play') {
    if (lastRotate === null) lastRotate = now;
    return;
  }
  if (lastRotate === null) lastRotate = now;
  const exhibits = generateExhibits(Vv);
  s.exhibits = exhibits;
  s.gx = ANCHOR_GX;
  s.gy = ANCHOR_GY;
  if (exhibits.length === 0) {
    s.exhibitIndex = 0;
  } else if (s.exhibitIndex >= exhibits.length) {
    s.exhibitIndex = 0;
  }
  if (exhibits.length > 0 && (now - lastRotate) >= ROTATE_MS) {
    lastRotate = now;
    s.exhibitIndex = (s.exhibitIndex + 1) % exhibits.length;
  }
  s.near = isVisitorNear();
}

function draw(ctx) {
  const s = getState();
  const Vv = getV();
  if (!ctx || !s || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const pt = isoFn(s.gx, s.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  if (s.near) {
    const pulse = 0.16 + 0.16 * (0.5 + 0.5 * Math.sin(now * 0.009));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 18, y - 20, 36, 36);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(x - 11, y + 11, 22, 4);
  ctx.fillStyle = '#6b6b6b';
  ctx.fillRect(x - 9, y - 4, 18, 14);
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(x - 9, y - 4, 5, 14);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(x - 2, y + 2, 4, 4);

  const exhibits = Array.isArray(s.exhibits) ? s.exhibits : [];
  const current = exhibits.length ? exhibits[s.exhibitIndex % exhibits.length] : null;
  const maxW = 88;
  const line1 = current ? fitFn(current.titleLine, maxW) : fitFn('No exhibits', maxW);
  const line2 = current ? fitFn(current.bodyLine, maxW) : fitFn('', maxW);
  const third = (s.near && current) ? fitFn('source: ' + current.sourceId, maxW) : '';

  const pw = 96;
  const ph = third ? 44 : 32;
  const px = x - Math.round(pw * 0.5);
  const py = y - 38;
  ctx.fillStyle = 'rgba(20,16,10,0.92)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);

  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3d37a';
  ctx.fillText(line1, x, py + 11);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#e8e6df';
  ctx.fillText(line2, x, py + 24);
  if (third) {
    ctx.fillStyle = '#f3d37a';
    ctx.fillText(third, x, py + 36);
  }
  ctx.textAlign = 'left';
}

function __probe() {
  const s = getState();
  return {
    exhibitIndex: (s && typeof s.exhibitIndex === 'number') ? s.exhibitIndex : 0,
    exhibits: (s && Array.isArray(s.exhibits)) ? s.exhibits.length : 0
  };
}

if (typeof window !== 'undefined') {
  if (!window.GuildExhibit) window.GuildExhibit = createState();
  const g = window.GuildExhibit;
  g.gx = ANCHOR_GX;
  g.gy = ANCHOR_GY;
  g.moving = false;
  g.facing = 'up';
  g.update = update;
  g.draw = draw;
  g.__probe = __probe;
  g.__rawUpdate = update;
}

export {};
