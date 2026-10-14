function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return (w && w.GuildGarden) ? w.GuildGarden : null; }

function createState() {
  return { plots: [], bornAt: 0 };
}

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function tileDistance(sx, sy, vx, vy, g) {
  if (!g || !isFinite(sx) || !isFinite(sy) || !isFinite(vx) || !isFinite(vy)) return Infinity;
  const tileW = isFinite(g.tileW) && g.tileW ? g.tileW : 1;
  const tileH = isFinite(g.tileH) && g.tileH ? g.tileH : 1;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / tileW + dy / tileH;
  const dgy = dy / tileH - dx / tileW;
  return Math.hypot(dgx, dgy);
}

function isIdleWorker(w) {
  if (!w || typeof w !== 'object') return false;
  const vals = [w.workerState, w.state, w.status, w.mode, w.worker_status, w.activity];
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i] == null ? '' : vals[i]).toUpperCase() === 'IDLE') return true;
  }
  return false;
}

function workerPixel(w, Vv) {
  if (!w || typeof w !== 'object') return null;
  if (typeof w.x === 'number' && typeof w.y === 'number') return { x: w.x, y: w.y };
  if (typeof w.gx === 'number' && typeof w.gy === 'number') return isoFn(w.gx, w.gy);
  if (typeof w.tileX === 'number' && typeof w.tileY === 'number') return isoFn(w.tileX, w.tileY);
  if (w.pos && typeof w.pos.x === 'number' && typeof w.pos.y === 'number') return { x: w.pos.x, y: w.pos.y };
  return null;
}

function readTile(p) {
  if (!p || typeof p !== 'object') return null;
  const sources = [p];
  if (p.tile && typeof p.tile === 'object') sources.push(p.tile);
  if (p.position && typeof p.position === 'object') sources.push(p.position);
  if (p.pos && typeof p.pos === 'object') sources.push(p.pos);
  let gx = null;
  let gy = null;
  const xKeys = ['gx', 'gridX', 'tileX', 'x'];
  const yKeys = ['gy', 'gridY', 'tileY', 'y'];
  for (let i = 0; i < sources.length && (gx == null || gy == null); i++) {
    const s = sources[i];
    if (gx == null) {
      for (let k = 0; k < xKeys.length; k++) {
        if (s[xKeys[k]] != null && isFinite(Number(s[xKeys[k]]))) { gx = Number(s[xKeys[k]]); break; }
      }
    }
    if (gy == null) {
      for (let k = 0; k < yKeys.length; k++) {
        if (s[yKeys[k]] != null && isFinite(Number(s[yKeys[k]]))) { gy = Number(s[yKeys[k]]); break; }
      }
    }
  }
  if (gx == null || gy == null) return null;
  return { gx: gx, gy: gy };
}

function computeAnchor(Vv) {
  // Pinned to the EAST GARDEN district per LAYOUT.md (init-order bug stranded it at -9,-9).
  return { gx: 6, gy: 1 };
}

function ensurePlots() {
  const st = getState();
  if (!st) return;
  if (!Array.isArray(st.plots)) st.plots = [];
  if (st.plots.length) return;
  const Vv = getV();
  if (!Vv) return;
  const anchor = computeAnchor(Vv);
  st.anchor = anchor;
  const bornAt = (typeof st.bornAt === 'number') ? st.bornAt : nowFn();
  const globalIndex = Math.min(3, Math.max(0, Math.floor(((nowFn() - bornAt) || 0) / 90000)));
  for (let i = 0; i < 5; i++) {
    st.plots.push({
      gx: anchor.gx + i,
      gy: anchor.gy,
      stage: 0,
      cooldownUntil: 0,
      ripeSince: null,
      lastGrowthIndex: globalIndex,
      tendFx: null,
      harvestFx: null
    });
  }
}

function autoGrowth(st, now) {
  if (!st || !Array.isArray(st.plots)) return;
  const bornAt = (typeof st.bornAt === 'number') ? st.bornAt : now;
  const globalIndex = Math.min(3, Math.max(0, Math.floor((now - bornAt) / 90000)));
  for (let i = 0; i < st.plots.length; i++) {
    const plot = st.plots[i];
    if (!plot || typeof plot !== 'object') continue;
    if (typeof plot.lastGrowthIndex !== 'number') plot.lastGrowthIndex = globalIndex;
    const newly = globalIndex - plot.lastGrowthIndex;
    if (newly > 0) {
      plot.stage = Math.min(3, (plot.stage || 0) + newly);
      plot.lastGrowthIndex = globalIndex;
      if (plot.stage === 3 && plot.ripeSince == null) plot.ripeSince = now;
    }
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;
  if (!st._bornSet) {
    st.bornAt = now;
    st._bornSet = true;
  }
  ensurePlots();

  const Vv = getV();
  const plots = Array.isArray(st.plots) ? st.plots : [];

  autoGrowth(st, now);

  const workerStates = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
  for (let wi = 0; wi < workerStates.length; wi++) {
    const worker = workerStates[wi];
    if (!isIdleWorker(worker)) continue;
    const wp = workerPixel(worker, Vv);
    if (!wp) continue;
    for (let pi = 0; pi < plots.length; pi++) {
      const plot = plots[pi];
      if (!plot || typeof plot !== 'object') continue;
      if ((plot.stage || 0) >= 3) continue;
      if (typeof plot.cooldownUntil === 'number' && now < plot.cooldownUntil) continue;
      const pc = isoFn(plot.gx + 0.5, plot.gy + 0.5);
      const d = tileDistance(wp.x, wp.y, pc.x, pc.y, Vv && Vv.grid);
      if (d <= 1.5) {
        plot.stage = Math.min(3, (plot.stage || 0) + 1);
        plot.cooldownUntil = now + 2000;
        plot.tendFx = { start: now };
        if (plot.stage === 3) plot.ripeSince = now;
      }
    }
  }

  for (let i = 0; i < plots.length; i++) {
    const plot = plots[i];
    if (!plot || typeof plot !== 'object') continue;
    if ((plot.stage || 0) === 3) {
      if (plot.ripeSince == null) plot.ripeSince = now;
      if (isFinite(plot.ripeSince) && (now - plot.ripeSince) > 60000) {
        plot.stage = 0;
        plot.ripeSince = null;
        plot.lastGrowthIndex = Math.min(3, Math.max(0, Math.floor((now - st.bornAt) / 90000)));
        plot.harvestFx = { start: now };
      }
    } else {
      plot.ripeSince = null;
    }
  }
}

function drawPlotSoil(ctx, plot) {
  const tl = isoFn(plot.gx, plot.gy);
  const tr = isoFn(plot.gx + 1, plot.gy);
  const br = isoFn(plot.gx + 1, plot.gy + 1);
  const bl = isoFn(plot.gx, plot.gy + 1);
  ctx.fillStyle = '#4a3423';
  ctx.beginPath();
  ctx.moveTo(Math.round(tl.x), Math.round(tl.y));
  ctx.lineTo(Math.round(tr.x), Math.round(tr.y));
  ctx.lineTo(Math.round(br.x), Math.round(br.y));
  ctx.lineTo(Math.round(bl.x), Math.round(bl.y));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawStage(ctx, plot, now) {
  const p = isoFn(plot.gx + 0.5, plot.gy + 0.5);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const stage = plot.stage || 0;
  if (stage === 0) {
    ctx.fillStyle = '#3e2a1a';
    ctx.fillRect(x - 5, y - 2, 10, 4);
    ctx.fillStyle = '#5a3e28';
    ctx.fillRect(x - 3, y - 4, 6, 2);
  } else if (stage === 1) {
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x - 1, y - 7, 2, 7);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x - 3, y - 8, 2, 2);
    ctx.fillRect(x + 1, y - 8, 2, 2);
  } else if (stage === 2) {
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x - 1, y - 11, 2, 11);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x - 4, y - 13, 3, 4);
    ctx.fillRect(x + 1, y - 13, 3, 4);
    ctx.fillStyle = '#86efac';
    ctx.fillRect(x - 1, y - 9, 2, 2);
  } else {
    const sway = Math.sin((now || 0) * 0.005 + (plot.gx || 0) * 1.7 + (plot.gy || 0) * 2.3) * 2;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.round(sway), y - 15);
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(x + Math.round(sway) - 3, y - 17, 6, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x + Math.round(sway) - 2, y - 15, 4, 2);
  }
}

function drawTendFx(ctx, plot, now) {
  const fx = plot && plot.tendFx;
  if (!fx || typeof fx.start !== 'number') return;
  const age = now - fx.start;
  if (age < 0 || age > 450) {
    if (age > 450) plot.tendFx = null;
    return;
  }
  const p = isoFn(plot.gx + 0.5, plot.gy + 0.5);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const alpha = Math.max(0, 1 - (age / 450));
  ctx.globalAlpha = alpha * 0.72;
  ctx.fillStyle = '#6b4f2a';
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * Math.PI * 2;
    const r = 3 + age * 0.025;
    ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y + 2 + Math.sin(ang) * r * 0.45), 3, 2);
  }
  ctx.globalAlpha = 1;
  const sparkleAge = age;
  if (sparkleAge < 320) {
    const sa = Math.max(0, 1 - (sparkleAge / 320));
    ctx.globalAlpha = sa;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(x - 1, y - 16, 2, 2);
    ctx.fillRect(x - 3, y - 14, 2, 2);
    ctx.fillRect(x + 1, y - 14, 2, 2);
    ctx.fillRect(x - 1, y - 12, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function drawHarvestFx(ctx, plot, now) {
  const fx = plot && plot.harvestFx;
  if (!fx || typeof fx.start !== 'number') return;
  const age = now - fx.start;
  if (age < 0 || age > 650) {
    if (age > 650) plot.harvestFx = null;
    return;
  }
  const p = isoFn(plot.gx + 0.5, plot.gy + 0.5);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const alpha = Math.max(0, 1 - (age / 650));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#facc15';
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    const r = 3 + age * 0.09;
    ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y - 4 + Math.sin(ang) * r * 0.55), 2, 2);
  }
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x - 1, y - 8, 2, 2);
  ctx.globalAlpha = 1;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  let now = nowFn();
  if (typeof ctx === 'object' && ctx && typeof arguments[1] === 'number') now = arguments[1];
  if (!Array.isArray(st.plots) || !st.plots.length) ensurePlots();
  const plots = Array.isArray(st.plots) ? st.plots : [];
  for (let i = 0; i < plots.length; i++) {
    const plot = plots[i];
    if (!plot || typeof plot !== 'object') continue;
    drawPlotSoil(ctx, plot);
    drawStage(ctx, plot, now);
    drawTendFx(ctx, plot, now);
    drawHarvestFx(ctx, plot, now);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildGarden) window.GuildGarden = createState();
  window.GuildGarden.update = update;
  window.GuildGarden.draw = draw;
  window.GuildGarden.__rawUpdate = update;
  window.GuildGarden.__probe = function () {
    const st = getState() || { plots: [], bornAt: 0 };
    const plots = Array.isArray(st.plots) ? st.plots : [];
    return {
      bornAt: (typeof st.bornAt === 'number') ? st.bornAt : 0,
      anchor: st.anchor || null,
      plotCount: plots.length,
      plots: plots.map(function (plot) {
        return {
          gx: plot.gx,
          gy: plot.gy,
          stage: (typeof plot.stage === 'number') ? plot.stage : 0,
          cooldownUntil: (typeof plot.cooldownUntil === 'number') ? plot.cooldownUntil : 0,
          ripeSince: (typeof plot.ripeSince === 'number') ? plot.ripeSince : null,
          lastGrowthIndex: (typeof plot.lastGrowthIndex === 'number') ? plot.lastGrowthIndex : 0
        };
      })
    };
  };
}

export {};
