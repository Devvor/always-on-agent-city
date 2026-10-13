const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

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
function getState() { const w = root(); return w && w.GuildCarver; }

function buildMilestones(Vv) {
  const list = [];
  const tasks = Array.isArray(Vv && Vv.allTasks) ? Vv.allTasks : [];
  let doneCount = 0;
  let failedCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t) continue;
    if (t.status === 'done') doneCount++;
    else if (t.status === 'failed') failedCount++;
  }
  const growthStep = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const mapLevel = (typeof Vv.mapLevel === 'number') ? Vv.mapLevel : (growthStep + 1);
  const econ = root() && root().GuildEconomy;
  const minted = (econ && typeof econ.minted === 'number') ? econ.minted : 0;

  list.push({ id: 'FIRST_FIVE', label: 'FIRST FIVE', earned: doneCount >= 5 });
  list.push({ id: 'DOUBLE_DIGITS', label: 'DOUBLE DIGITS', earned: doneCount >= 10 });
  list.push({ id: 'FIFTEEN_SHIPPED', label: 'FIFTEEN SHIPPED', earned: doneCount >= 15 });
  list.push({ id: 'FLAWLESS', label: 'FLAWLESS', earned: doneCount >= 10 && failedCount === 0 });
  list.push({ id: 'ISLAND_EXPANDED', label: 'ISLAND EXPANDED', earned: growthStep >= 4 });
  list.push({ id: 'FIRST_HUNDRED_GC', label: 'FIRST HUNDRED GC', earned: minted >= 100 });
  return list;
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

function visitorNear(carver, vis) {
  if (!carver || !vis) return false;
  const dx = carver.gx - vis.gx;
  const dy = carver.gy - vis.gy;
  return Math.hypot(dx, dy) <= 1.6;
}

function drawStoneCarver(ctx, pt) {
  if (!ctx) return;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = '#55524e';
  ctx.fillRect(x - 10, y - 18, 20, 20);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 10, y - 18, 20, 20);
  ctx.fillStyle = '#55524e';
  ctx.fillRect(x - 3, y - 22, 6, 4);
  ctx.fillRect(x - 14, y - 14, 4, 10);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 12, y - 16, 2, 2);
  ctx.fillRect(x - 14, y - 10, 4, 2);
  ctx.fillStyle = '#55524e';
  ctx.fillRect(x - 10, y - 2, 20, 10);
  ctx.strokeStyle = '#d4af37';
  ctx.strokeRect(x - 10, y - 2, 20, 10);
  ctx.fillStyle = '#44413e';
  ctx.fillRect(x - 8, y, 16, 6);
  ctx.strokeStyle = '#d4af37';
  ctx.strokeRect(x - 8, y, 16, 6);
}

function drawPlaquePanel(ctx, Vv, carver, now) {
  if (!ctx || !Vv) return;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const panelW = 300;
  const panelH = 220;
  const px = Math.round(canvas.width * 0.5 - panelW * 0.5);
  const py = Math.round(canvas.height * 0.5 - panelH * 0.5);

  ctx.save();
  ctx.fillStyle = 'rgba(13,19,36,0.92)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUILD PLAQUES', px + panelW * 0.5, py + 20);
  ctx.textAlign = 'left';

  const milestones = buildMilestones(Vv);
  const tasks = Array.isArray(Vv.allTasks) ? Vv.allTasks : [];
  const noHistory = (!tasks || tasks.length === 0);

  if (noHistory) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('no history yet', px + panelW * 0.5, py + panelH * 0.5);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }

  const rowH = 26;
  const startX = px + 18;
  const startY = py + 42;
  const chipW = 26;
  const labelX = startX + chipW + 10;

  for (let i = 0; i < milestones.length; i++) {
    const ms = milestones[i];
    const rowY = startY + i * rowH;
    if (rowY + rowH > py + panelH - 12) break;

    if (ms.earned) {
      const seen = carver.engraved.indexOf(ms.id) !== -1;
      if (!seen) {
        carver.engraved.push(ms.id);
        try { if (typeof window !== 'undefined' && window.cue) window.cue('grow'); } catch (e) {}
      }
      const sparkle = !seen ? (0.4 + 0.6 * Math.abs(Math.sin(now * 0.01))) : 0;
      ctx.fillStyle = '#55524e';
      ctx.fillRect(startX, rowY, chipW, 16);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, rowY, chipW, 16);
      if (sparkle > 0) {
        ctx.globalAlpha = sparkle;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(startX + 4, rowY + 3, 3, 3);
        ctx.fillRect(startX + 16, rowY + 6, 2, 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn(ms.label, chipW - 4), startX + chipW * 0.5, rowY + 8);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8e6df';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      const label = fitFn(ms.label, panelW - labelX - 60);
      ctx.fillText(label, labelX, rowY + 8);
      const dateStr = todayKey();
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px monospace';
      ctx.fillText(dateStr, labelX + ctx.measureText(label).width + 8, rowY + 8);
    } else {
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(startX, rowY, chipW, 16);
      ctx.strokeStyle = '#333344';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, rowY, chipW, 16);
      ctx.fillStyle = '#6b7280';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', startX + chipW * 0.5, rowY + 8);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      const label = fitFn(ms.label, panelW - labelX - 60);
      ctx.fillText(label, labelX, rowY + 8);
    }
  }
  ctx.restore();
}

function drawHint(ctx, Vv, carver, near) {
  if (!ctx || !Vv || !near) return;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const pt = isoFn(carver.gx, carver.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.save();
  ctx.fillStyle = 'rgba(13,19,36,0.85)';
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  const text = '[E] CARVE A PLAQUE';
  ctx.font = '10px monospace';
  const tw = ctx.measureText(text).width;
  const ph = 14;
  const px = Math.round(x - tw * 0.5 - 4);
  const py = y - 30;
  ctx.fillRect(px, py, tw + 8, ph);
  ctx.strokeRect(px, py, tw + 8, ph);
  ctx.fillStyle = '#d4af37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px + (tw + 8) * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';
  ctx.restore();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const carver = getState();
  const Vv = getV();
  if (!carver || !Vv || Vv.gameState !== 'play') return;
  const vis = root() && root().GuildVisitor;
  const near = visitorNear(carver, vis);
  if (near && !carver.open) {
    drawHint(null, Vv, carver, near);
  }
}

function draw(ctx) {
  const carver = getState();
  const Vv = getV();
  if (!carver || !Vv || Vv.gameState !== 'play') return;
  const vis = root() && root().GuildVisitor;
  const near = visitorNear(carver, vis);
  const pt = isoFn(carver.gx, carver.gy);
  drawStoneCarver(ctx, pt);
  if (near) drawHint(ctx, Vv, carver, near);
  if (carver.open) drawPlaquePanel(ctx, Vv, carver, nowFn());
}

function onKeydown(e) {
  if (!e) return;
  const k = String(e.key || '').toLowerCase();
  if (k !== 'e') return;
  const carver = getState();
  const Vv = getV();
  if (!carver || !Vv || Vv.gameState !== 'play') return;
  const vis = root() && root().GuildVisitor;
  if (!visitorNear(carver, vis)) return;
  carver.open = !carver.open;
  try { if (typeof window !== 'undefined' && window.cue) window.cue('grow'); } catch (err) {}
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
}

if (typeof window !== 'undefined') {
  if (!window.GuildCarver) window.GuildCarver = { engraved: [], gx: 3.0, gy: 2.4, open: false };
  window.GuildCarver.update = update;
  window.GuildCarver.draw = draw;
  window.GuildCarver.__probe = function () {
    const c = getState();
    return c ? { engraved: c.engraved.length, open: !!c.open } : { engraved: 0, open: false };
  };
  if (!window.__gcKeyBound) {
    window.__gcKeyBound = true;
    window.addEventListener('keydown', onKeydown);
  }
}

export {};
