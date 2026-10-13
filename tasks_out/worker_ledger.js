const SCROLL_SPEED = 40;
let lastTime = null;

function createState() {
  return { scrollX: 0, lines: [] };
}

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
function getState() { const w = root(); return w && w.GuildLedger; }

function tickText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.msg === 'string') return value.msg;
    if (typeof value.line === 'string') return value.line;
    if (typeof value.event === 'string') return value.event;
    if (typeof value.status === 'string') return value.status;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value);
}

function chipColor(name) {
  const n = String(name == null ? '' : name).toLowerCase();
  if (n.indexOf('step') !== -1) return '#a78bfa';
  if (n.indexOf('laguna') !== -1 || n.indexOf('lag') !== -1) return '#34d399';
  return '#facc15';
}

function flattenLines(Vv) {
  try {
    const out = [];
    const workers = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i] || {};
      const ticks = Array.isArray(worker.recent_ticks) ? worker.recent_ticks : [];
      const name = (worker.name != null) ? worker.name : (i === 0 ? 'MISSINGNO' : (i === 1 ? 'STEP5' : (i === 2 ? 'LAGUNA' : ('WORKER ' + (i + 1)))));
      const color = chipColor(name);
      for (let j = ticks.length - 1; j >= 0; j--) {
        out.push({ name: String(name), color: color, text: tickText(ticks[j]) });
      }
    }
    if (!out.length) out.push({ name: '', color: '#d4af37', text: 'the ledger awaits its first entry...' });
    return out;
  } catch (e) {
    return [];
  }
}

function isPaused(Vv) {
  try {
    const w = root();
    const vis = w && w.GuildVisitor;
    if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
    const growth = (Vv && typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
    const minC = -2 - growth;
    const maxC = 1 + growth;
    const nearestX = (vis.gx < minC) ? minC : (vis.gx > maxC ? maxC : vis.gx);
    const dist = Math.hypot(vis.gx - nearestX, vis.gy - maxC);
    return dist <= 2;
  } catch (e) {
    return false;
  }
}

function bandRect(Vv) {
  try {
    const growth = (Vv && typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) ? Vv.growthStep : 0;
    const minC = -2 - growth;
    const maxC = 1 + growth;
    const left = isoFn(minC, maxC);
    const right = isoFn(maxC, maxC);
    const xs = [left.x, right.x];
    const ys = [left.y, right.y];
    const minX = Math.min(xs[0], xs[1]);
    const maxX = Math.max(xs[0], xs[1]);
    const maxY = Math.max(ys[0], ys[1]);
    return { x: Math.round(minX - 24), y: Math.round(maxY + 10), w: Math.max(120, Math.round(maxX - minX + 48)), h: 22 };
  } catch (e) {
    return { x: 0, y: 0, w: 120, h: 22 };
  }
}

function layoutLines(ctx, lines) {
  const blocks = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || {};
    const name = String(line.name == null ? '' : line.name);
    const color = line.color || '#facc15';
    const raw = String(line.text == null ? '' : line.text);
    const chipLabel = name ? ('[' + name + ']') : '';
    ctx.font = 'bold 10px monospace';
    const chipW = name ? (ctx.measureText(chipLabel).width + 8) : 0;
    ctx.font = '10px monospace';
    const fitted = fitFn(raw, 320);
    const textW = ctx.measureText(fitted).width;
    blocks.push({ name: name, color: color, fitted: fitted, chipLabel: chipLabel, chipW: chipW, textW: textW, x: cursor });
    cursor += (name ? chipW + 6 : 0) + textW + 28;
  }
  if (!cursor) cursor = 1;
  return { blocks: blocks, total: cursor };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const g = getState();
  const Vv = getV();
  if (!g) return;
  if (Vv) g.lines = flattenLines(Vv);
  else if (!Array.isArray(g.lines)) g.lines = [];

  if (!Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (isPaused(Vv)) return;
  g.scrollX += SCROLL_SPEED * dt;
}

function draw(ctx) {
  if (!ctx || typeof ctx.fillRect !== 'function') return;
  const g = getState();
  if (!g) return;
  const Vv = getV();
  if (Vv && (!Array.isArray(g.lines) || !g.lines.length)) {
    g.lines = flattenLines(Vv);
  }
  if (!Array.isArray(g.lines) || !g.lines.length) {
    g.lines = [{ name: '', color: '#d4af37', text: 'the ledger awaits its first entry...' }];
  }
  const lines = g.lines;
  const band = bandRect(Vv || {});

  ctx.save();
  ctx.beginPath();
  ctx.rect(band.x, band.y, band.w, band.h);
  ctx.clip();

  ctx.fillStyle = 'rgba(18, 14, 10, 0.94)';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.16)';
  ctx.fillRect(band.x, band.y, band.w, 2);
  ctx.fillRect(band.x, band.y + band.h - 2, band.w, 2);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(band.x + 1, band.y + 1, band.w - 2, band.h - 2);

  const layout = layoutLines(ctx, lines);
  const total = layout.total;
  let offset = g.scrollX % total;
  if (!isFinite(offset) || offset < 0) offset = 0;
  const textY = band.y + Math.round(band.h * 0.5) + 3;

  function drawSet(shift) {
    for (let i = 0; i < layout.blocks.length; i++) {
      const block = layout.blocks[i];
      const baseX = band.x + shift + block.x;
      if (baseX > band.x + band.w + 60) continue;
      if (baseX + block.chipW + block.textW + 6 < band.x - 60) continue;
      if (block.name) {
        ctx.fillStyle = block.color;
        ctx.fillRect(baseX, band.y + 4, block.chipW, band.h - 8);
        ctx.fillStyle = '#0b0b0f';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(block.chipLabel, baseX + 4, textY);
      }
      ctx.fillStyle = '#e8e6df';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(block.fitted, baseX + (block.name ? block.chipW + 6 : 0), textY);
    }
  }

  drawSet(-offset);
  drawSet(-offset + total);

  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildLedger) window.GuildLedger = createState();
  const g = window.GuildLedger;
  if (typeof g.scrollX !== 'number') g.scrollX = 0;
  if (!Array.isArray(g.lines)) g.lines = [];
  g.update = update;
  g.draw = draw;
  g.__probe = function () {
    const Vv = getV();
    return {
      scrollX: g.scrollX,
      paused: (Vv ? isPaused(Vv) : false),
      lines: g.lines.slice(),
      band: bandRect(Vv || {})
    };
  };
}

export {};
