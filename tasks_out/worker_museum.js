let lastTime = null;
let lastNowTime = null;
let lastAllTasksLength = -1;
let lastGrowthStep = null;

function createState() {
  return { pedestals: [] };
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
function getState() { const w = root(); return w && w.GuildMuseum; }

const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function allTasksList(Vv) {
  try { if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks; } catch (e) {}
  return [];
}

function isBuilding(gx, gy) {
  for (let i = 0; i < BUILDINGS.length; i++) {
    if (Math.round(gx) === BUILDINGS[i].gx && Math.round(gy) === BUILDINGS[i].gy) return true;
  }
  return false;
}

function isWalkableTile(gx, gy, Vv) {
  try {
    if (!Vv || !Vv.grid) return false;
    const rx = Math.round(gx);
    const ry = Math.round(gy);
    const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
    const minC = -2 - s;
    const maxC = 1 + s;
    if (rx < minC || rx > maxC || ry < minC || ry > maxC) return false;
    if (tileRing(rx, ry) > s) return false;
    if (isBuilding(rx, ry)) return false;
    return true;
  } catch (e) { return false; }
}

function candidateEdgeTiles(Vv) {
  const base = [
    { gx: -13, gy: 10 }, { gx: -11.3, gy: 10 }, { gx: -9.6, gy: 10 }, { gx: -7.9, gy: 10 },
    { gx: -13, gy: 11.6 }, { gx: -11.3, gy: 11.6 }, { gx: -9.6, gy: 11.6 }, { gx: -7.9, gy: 11.6 }
  ];
  const out = [];
  try {
    for (let i = 0; i < base.length; i++) {
      if (isWalkableTile(base[i].gx, base[i].gy, Vv)) out.push(base[i]);
    }
  } catch (e) {}
  return out.length ? out : base;
}

function sortQuests(tasks) {
  try {
    const src = Array.isArray(tasks) ? tasks.slice().reverse() : [];
    const done = [];
    const rest = [];
    for (let i = 0; i < src.length; i++) {
      const t = src[i];
      if (t && String(t.status || '').toLowerCase() === 'done') done.push(t);
      else rest.push(t);
    }
    return done.concat(rest);
  } catch (e) { return []; }
}

function pluginColor(status) {
  const s = String(status == null ? '' : status).toLowerCase();
  if (s === 'done') return '#d4af37';
  if (s === 'failed') return '#ef4444';
  return '#f59e0b';
}

function statusWord(status) {
  const s = String(status == null ? '' : status).toLowerCase();
  if (s === 'done') return 'DONE';
  if (s === 'failed') return 'FAILED';
  if (s === 'in_progress') return 'IN PROGRESS';
  if (s === 'pending') return 'PENDING';
  return String(status == null ? 'PENDING' : status).toUpperCase();
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function ensureState() {
  if (typeof window === 'undefined') return null;
  if (!window.GuildMuseum) window.GuildMuseum = createState();
  return window.GuildMuseum;
}

function buildPedestals(Vv) {
  try {
    const st = ensureState();
    if (!st) return;
    const tiles = candidateEdgeTiles(Vv);
    const quests = sortQuests(allTasksList(Vv));
    const limit = Math.min(8, quests.length, tiles.length);
    const out = [];
    for (let i = 0; i < limit; i++) {
      const q = quests[i] || {};
      out.push({
        gx: tiles[i].gx,
        gy: tiles[i].gy,
        id: (q.id != null ? q.id : ('task_' + i)),
        title: (q.title != null ? q.title : (q.name != null ? q.name : ('Task ' + (i + 1)))),
        status: (q.status != null ? q.status : 'pending'),
        labelAlpha: 0,
        labelTarget: 0
      });
    }
    st.pedestals = out;
  } catch (e) {}
}

function refreshPedestalQuests(Vv) {
  try {
    const st = ensureState();
    if (!st || !Array.isArray(st.pedestals)) return;
    const tasks = allTasksList(Vv);
    for (let i = 0; i < st.pedestals.length; i++) {
      const p = st.pedestals[i];
      if (!p) continue;
      let found = null;
      for (let j = 0; j < tasks.length; j++) {
        if (tasks[j] && String(tasks[j].id) === String(p.id)) { found = tasks[j]; break; }
      }
      if (found) {
        if (found.title != null) p.title = found.title;
        if (found.status != null) p.status = found.status;
        if (found.id != null) p.id = found.id;
      }
    }
  } catch (e) {}
}

function ensureBuilt(Vv) {
  try {
    const st = ensureState();
    if (!st) return;
    if (!Array.isArray(st.pedestals)) st.pedestals = [];
    const len = allTasksList(Vv).length;
    const growth = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
    if (len !== lastAllTasksLength || growth !== lastGrowthStep) {
      lastAllTasksLength = len;
      lastGrowthStep = growth;
      buildPedestals(Vv);
    } else {
      refreshPedestalQuests(Vv);
    }
  } catch (e) {}
}

function update(now) {
  try {
    if (typeof now !== 'number') now = nowFn();
    if (lastTime === null) lastTime = now;
    let dt = (now - lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    lastTime = now;
    lastNowTime = now;

    const Vv = getV();
    if (!Vv || Vv.gameState !== 'play') return;

    ensureBuilt(Vv);
    refreshPedestalQuests(Vv);

    const st = getState();
    if (!st || !Array.isArray(st.pedestals)) return;

    const vis = root() && root().GuildVisitor;
    let vgx = null, vgy = null;
    if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') {
      vgx = vis.gx;
      vgy = vis.gy;
    }

    for (let i = 0; i < st.pedestals.length; i++) {
      const p = st.pedestals[i];
      if (!p) continue;
      let near = false;
      if (vgx != null && vgy != null) {
        near = Math.hypot(p.gx - vgx, p.gy - vgy) <= 1.8;
      }
      p.labelTarget = near ? 1 : 0;
      const step = (dt / 0.3);
      if (p.labelAlpha < p.labelTarget) {
        p.labelAlpha = clamp(p.labelAlpha + step, 0, 1);
      } else if (p.labelAlpha > p.labelTarget) {
        p.labelAlpha = clamp(p.labelAlpha - step, 0, 1);
      }
    }
  } catch (e) {}
}

function drawPedestal(ctx, p, Vv) {
  try {
    const pt = isoFn(p.gx, p.gy);
    const gx = Math.round(pt.x);
    const gy = Math.round(pt.y);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(gx - 9, gy + 3, 18, 4);

    ctx.fillStyle = '#55524e';
    ctx.fillRect(gx - 10, gy - 2, 20, 5);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(gx - 10, gy - 2, 20, 1);

    const pillarH = 14;
    ctx.fillStyle = '#55524e';
    ctx.fillRect(gx - 5, gy - 2 - pillarH, 10, pillarH);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(gx - 5, gy - 2 - pillarH, 3, pillarH);

    const topH = 3;
    const topY = gy - 2 - pillarH - topH;
    ctx.fillStyle = '#55524e';
    ctx.fillRect(gx - 11, topY, 22, topH);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(gx - 11, topY, 22, 1);
    ctx.fillRect(gx - 11, gy - 2 - pillarH, 22, 1);

    const gcolor = pluginColor(p.status);
    const plaqueW = 16;
    const plaqueH = 9;
    const plaqueX = gx - 8;
    const plaqueY = gy - 11;
    ctx.fillStyle = gcolor;
    ctx.fillRect(plaqueX, plaqueY, plaqueW, plaqueH);
    ctx.strokeStyle = '#1a1510';
    ctx.lineWidth = 1;
    ctx.strokeRect(plaqueX, plaqueY, plaqueW, plaqueH);

    ctx.fillStyle = '#55524e';
    ctx.fillRect(plaqueX + 1, plaqueY + 1, plaqueW - 2, 1);

    const s = String(p.status || '').toLowerCase();
    const topGlyphY = topY - 8;
    if (s === 'done') {
      ctx.fillStyle = '#f4e8c1';
      ctx.fillRect(gx - 6, topGlyphY, 12, 7);
      ctx.fillStyle = '#b08968';
      ctx.fillRect(gx - 5, topGlyphY + 2, 10, 1);
      ctx.fillRect(gx - 5, topGlyphY + 4, 10, 1);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(gx - 7, topGlyphY + 1, 1, 5);
      ctx.fillRect(gx + 6, topGlyphY + 1, 1, 5);
    } else if (s === 'failed') {
      ctx.strokeStyle = '#1f1f23';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx - 5, topGlyphY + 1);
      ctx.lineTo(gx - 1, topGlyphY + 6);
      ctx.lineTo(gx + 2, topGlyphY + 3);
      ctx.lineTo(gx + 6, topGlyphY + 7);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', gx, topGlyphY + 4);
    }

    ctx.fillStyle = '#0f0f10';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shownId = fitFn(String(p.id == null ? '' : p.id), plaqueW - 2);
    ctx.fillText(shownId, plaqueX + plaqueW * 0.5, plaqueY + plaqueH * 0.5 + 1);
  } catch (e) {}
}

function drawLabel(ctx, p, now) {
  try {
    const alpha = (typeof p.labelAlpha === 'number') ? p.labelAlpha : 0;
    if (alpha <= 0.01) return;
    const pt = isoFn(p.gx, p.gy);
    const gx = Math.round(pt.x);
    const gy = Math.round(pt.y);
    const title = fitFn(String(p.title == null ? p.id : p.title), 160);
    const word = statusWord(p.status);

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.font = '10px monospace';
    const titleW = ctx.measureText(title).width;
    ctx.font = 'bold 9px monospace';
    const wordW = ctx.measureText(word).width;
    const bw = clamp(Math.max(titleW, wordW) + 20, 90, 184);
    const bh = 34;
    const pillarH = 14, topH = 3;
    const topY = gy - 2 - pillarH - topH;
    const x = Math.round(gx - bw * 0.5);
    const y = Math.round(topY - bh - 6);

    ctx.fillStyle = '#f3e6bf';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x, y, bw, 2);
    ctx.fillRect(x, y + bh - 2, bw, 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, bw - 4, bh - 4);
    ctx.clip();

    ctx.fillStyle = '#2b1d0e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + bw * 0.5, y + bh * 0.5 - 4);

    ctx.fillStyle = pluginColor(p.status);
    ctx.font = 'bold 9px monospace';
    ctx.fillText(word, x + bw * 0.5, y + bh * 0.5 + 9);
    ctx.restore();
    ctx.restore();
  } catch (e) {}
}

function drawEmptySockets(ctx, Vv) {
  try {
    const tiles = candidateEdgeTiles(Vv);
    const count = Math.min(3, tiles.length);
    for (let i = 0; i < count; i++) {
      const pt = isoFn(tiles[i].gx, tiles[i].gy);
      const gx = Math.round(pt.x);
      const gy = Math.round(pt.y);

      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(gx - 10, gy + 3, 20, 4);

      ctx.fillStyle = '#55524e';
      ctx.fillRect(gx - 10, gy - 3, 20, 6);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(gx - 10, gy - 3, 20, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(gx - 7, gy - 2, 14, 3);

      ctx.fillStyle = '#f3d37a';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('awaiting history', gx, gy - 12);
    }
    ctx.textAlign = 'left';
  } catch (e) {}
}

function draw(ctx) {
  try {
    const Vv = getV();
    if (!Vv || Vv.gameState !== 'play') return;
    if (typeof ctx.save === 'function') ctx.save();

    const now = (typeof lastNowTime === 'number') ? lastNowTime : nowFn();
    ensureBuilt(Vv);
    refreshPedestalQuests(Vv);

    const st = getState();
    if (!st) {
      if (typeof ctx.restore === 'function') ctx.restore();
      return;
    }
    if (!Array.isArray(st.pedestals)) st.pedestals = [];

    const tasks = allTasksList(Vv);
    if (tasks.length === 0) {
      drawEmptySockets(ctx, Vv);
    } else {
      for (let i = 0; i < st.pedestals.length; i++) {
        const p = st.pedestals[i];
        if (p) drawPedestal(ctx, p, Vv);
      }
      for (let i = 0; i < st.pedestals.length; i++) {
        const p = st.pedestals[i];
        if (p) drawLabel(ctx, p, now);
      }
    }

    if (typeof ctx.restore === 'function') ctx.restore();
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildMuseum) window.GuildMuseum = createState();
  window.GuildMuseum.update = update;
  window.GuildMuseum.draw = draw;
  window.GuildMuseum.__probe = function () {
    try {
      const st = window.GuildMuseum || {};
      return {
        pedestals: Array.isArray(st.pedestals) ? st.pedestals.slice() : [],
        lastAllTasksLength: lastAllTasksLength,
        lastGrowthStep: lastGrowthStep
      };
    } catch (e) {
      return { pedestals: [], lastAllTasksLength: lastAllTasksLength, lastGrowthStep: lastGrowthStep };
    }
  };
}

export {};
