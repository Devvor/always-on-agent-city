const GOODS = [
  { id: 'grain', name: 'Grain', base: 12, flavor: 'Fresh sacks from the outer fields.', accent: '#22c55e' },
  { id: 'iron', name: 'Iron', base: 19, flavor: 'Still warm from the guild anvils.', accent: '#3b82f6' },
  { id: 'herbs', name: 'Herbs', base: 9, flavor: 'Bitter cuts for wise travelers.', accent: '#22c55e' },
  { id: 'gems', name: 'Gems', base: 34, flavor: 'Starlit shards in small pouches.', accent: '#facc15' }
];

const ZONE = { minGx: -1, maxGx: 2, minGy: 4, maxGy: 6 };
const STALL_TILES = [{ gx: -1, gy: 5 }, { gx: 0, gy: 5 }, { gx: 1, gy: 5 }, { gx: 2, gy: 5 }];

let _prices = [12, 19, 9, 34];
let _prevPrices = [12, 19, 9, 34];
let _hoveredIndex = -1;
let _inspect = false;
let _hitboxes = [];
let _lastMouseScreen = null;

function root() { return (typeof window !== 'undefined') ? window : null; }

function getV() {
  const w = root();
  return w && w.V ? w.V : null;
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
  text = (text == null ? '' : String(text));
  if (!isFinite(maxW) || maxW <= 0) return '';
  return text;
}

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

function clamp(v, a, b) {
  if (!isFinite(v)) return a;
  return v < a ? a : (v > b ? b : v);
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function getNumberFromV(Vv, keys) {
  if (!Vv || typeof Vv !== 'object') return 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (Object.prototype.hasOwnProperty.call(Vv, k)) {
      const n = Number(Vv[k]);
      if (isFinite(n)) return n;
    }
  }
  const w = root();
  if (w && Array.isArray(w.allTasks)) {
    if (keys.indexOf('done') !== -1 || keys.indexOf('quest') !== -1 || keys.indexOf('doneCount') !== -1) {
      let done = 0;
      for (let i = 0; i < w.allTasks.length; i++) {
        const t = w.allTasks[i];
        if (t && t.status === 'done') done++;
      }
      if (done > 0) return done;
    }
  }
  return 0;
}

function getQuestsDone(Vv) {
  return Math.max(0, Math.floor(getNumberFromV(Vv, ['totalDone', 'questsDone', 'quests_done', 'doneCount', 'tasksDone', 'completed'])));
}

function getTreasury(Vv) {
  return Math.max(0, Math.floor(getNumberFromV(Vv, ['treasury', 'treasuryCount', 'treasury_count', 'coins', 'gold', 'goldCount', 'banked', 'funds'])));
}

function computePrices(Vv, now) {
  const quests = getQuestsDone(Vv);
  const treasury = getTreasury(Vv);
  const tick = Math.floor((Number(now) || 0) / 7000);
  const pressure = quests + treasury;
  const next = [];
  for (let i = 0; i < GOODS.length; i++) {
    const osc = (((tick + i * 3 + pressure) % 5) + 5) % 5 - 2;
    const drift = Math.floor(pressure / 5);
    next.push(Math.max(1, GOODS[i].base + osc + drift));
  }
  _prevPrices = _prices.slice();
  _prices = next;
  return _prices.slice();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv) return;
  computePrices(Vv, now);
  updateHover();
}

function updateHover() {
  const Vv = getV();
  if (!_lastMouseScreen || !_hitboxes.length) {
    _hoveredIndex = -1;
    return;
  }
  const canvas = (Vv && Vv.canvas) || (root() && root().canvas) || null;
  if (!canvas) {
    _hoveredIndex = -1;
    return;
  }
  const cam = (Vv && Vv.camera) || { x: 0, y: 0, zoom: 1 };
  const z = (cam && isFinite(cam.zoom) && cam.zoom) ? cam.zoom : 1;
  const panX = cam.x || 0;
  const panY = cam.y || 0;
  const world = {
    x: (_lastMouseScreen.x - canvas.width * 0.5) / z + canvas.width * 0.5 - panX,
    y: (_lastMouseScreen.y - canvas.height * 0.5) / z + canvas.height * 0.5 - panY
  };
  let found = -1;
  for (let i = 0; i < _hitboxes.length; i++) {
    const h = _hitboxes[i];
    if (!h) continue;
    if (world.x >= h.x && world.x <= h.x + h.w && world.y >= h.y && world.y <= h.y + h.h) {
      found = h.index;
      break;
    }
  }
  _hoveredIndex = found;
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  if (!Vv) return;
  if (Vv.gameState != null && Vv.gameState !== 'play') return;
  const w = root();
  const visited = w && w.GuildVisitor;
  if (visited && typeof visited !== 'undefined') { /* guarded presence only */ }
  const cue = w && w.cue;
  if (cue && typeof cue !== 'function') { /* guarded presence only */ }
  const allTasks = (w && Array.isArray(w.allTasks)) ? w.allTasks : (Array.isArray(Vv.allTasks) ? Vv.allTasks : []);
  if (!Array.isArray(allTasks)) return;

  const now = nowFn();
  if (_prices.length !== GOODS.length) computePrices(Vv, now);
  _hitboxes = [];

  const canvas = (ctx.canvas) || (Vv.canvas) || null;
  const headerAnchor = isoFn(0.5, 4.0);
  const hx = Math.round(headerAnchor.x);
  const hy = Math.round(headerAnchor.y);

  ctx.save();
  ctx.font = 'bold 11px monospace';
  const headerText = fitFn('MARKET ROW PRICES', canvas ? Math.min(canvas.width - 20, 300) : 300);
  const hw = ctx.measureText(headerText).width;
  const headerW = Math.max(120, Math.ceil(hw + 16));
  const headerX = hx - Math.round(headerW * 0.5);
  const headerY = hy - 42;
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(headerX, headerY, headerW, 20);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1;
  ctx.strokeRect(headerX, headerY, headerW, 20);
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headerText, headerX + headerW * 0.5, headerY + 10);
  ctx.textAlign = 'left';

  for (let i = 0; i < GOODS.length; i++) {
    const good = GOODS[i];
    const price = _prices[i];
    const tile = STALL_TILES[i];
    const pos = isoFn(tile.gx, tile.gy);
    const x = Math.round(pos.x);
    const y = Math.round(pos.y);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x - 18, y - 2, 36, 4);
    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(x - 18, y - 28, 36, 20);
    ctx.strokeStyle = good.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 18, y - 28, 36, 20);
    ctx.fillStyle = good.accent;
    ctx.fillRect(x - 12, y - 23, 10, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y - 22, 6, 6);

    const plateW = 64;
    const plateH = 36;
    const px = x - Math.round(plateW * 0.5);
    const py = y - 74;
    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(px, py, plateW, plateH);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, plateW, plateH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = good.accent;
    ctx.fillText(fitFn(good.name, plateW - 8), px + plateW * 0.5, py + 10);

    let priceColor = '#facc15';
    if (_prevPrices.length === _prices.length) {
      if (price > _prevPrices[i]) priceColor = '#ef4444';
      else if (price < _prevPrices[i]) priceColor = '#22c55e';
    }
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = priceColor;
    ctx.fillText(fitFn(String(price), plateW - 8), px + plateW * 0.5, py + 25);
    ctx.textAlign = 'left';

    _hitboxes.push({ index: i, x: px, y: py, w: plateW, h: plateH + 30 });

    const showFlavor = _inspect || _hoveredIndex === i;
    if (showFlavor) {
      const maxW = canvas ? Math.min(170, canvas.width - 20) : 170;
      const shown = fitFn(good.flavor, maxW);
      const tw = ctx.measureText(shown).width;
      const fx = canvas ? clamp(px, 8, Math.max(8, canvas.width - tw - 8)) : px;
      const fy = py + plateH + 4;
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(shown, fx, fy);
      ctx.textBaseline = 'middle';
    }
  }

  ctx.restore();
  updateHover();
}

function onKeydown(e) {
  const k = normKey(e);
  if (k === 'e' || k === ' ') {
    _inspect = !_inspect;
  }
}

function onMouseMove(e) {
  if (!e) return;
  _lastMouseScreen = { x: e.clientX, y: e.clientY };
}

if (typeof window !== 'undefined') {
  if (!window.__gpbListeners) {
    window.__gpbListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('mousemove', onMouseMove);
  }
  const api = {
    update: update,
    draw: draw,
    ZONE: ZONE,
    STALL_TILES: STALL_TILES,
    GOODS: GOODS
  };
  Object.defineProperty(api, 'prices', {
    get: function () { return _prices.slice(); },
    set: function (v) {
      if (Array.isArray(v) && v.length === GOODS.length) _prices = v.slice();
    }
  });
  Object.defineProperty(api, 'hoveredIndex', {
    get: function () { return _hoveredIndex; },
    set: function (v) { if (isFinite(v)) _hoveredIndex = Math.floor(v); }
  });
  Object.defineProperty(api, 'inspect', {
    get: function () { return _inspect; },
    set: function (v) { _inspect = !!v; }
  });
  window.GuildPriceBoard = api;
}

export {};
