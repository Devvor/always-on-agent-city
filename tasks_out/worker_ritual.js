let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function getState() { const w = root(); return w && w.GuildRitual; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function finite(v) { return typeof v === 'number' && isFinite(v); }

function pendingTasks(Vv) {
  if (!Vv || !Array.isArray(Vv.allTasks)) return [];
  const out = [];
  for (let i = 0; i < Vv.allTasks.length; i++) {
    const t = Vv.allTasks[i];
    if (t && t.status === 'pending') out.push(t);
  }
  return out;
}

function workerNameColor(Vv, index, meta, st) {
  const sources = [meta, st];
  if (Vv && Array.isArray(Vv.workers) && Vv.workers[index]) sources.push(Vv.workers[index]);
  const keys = ['color', 'nameColor', 'nameplateColor', 'plateColor', 'accent', 'accentColor'];
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s];
    if (!src || typeof src !== 'object') continue;
    for (let k = 0; k < keys.length; k++) {
      const val = src[keys[k]];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  const name = String((meta && meta.name != null) ? meta.name : ((index === 0) ? 'MISSINGNO' : 'STEP5')).toLowerCase();
  if (index === 1 || name.indexOf('step') !== -1) return '#a78bfa';
  if (index >= 0) return '#facc15';
  return '#d4af37';
}

function pickWorker(Vv, task) {
  const workers = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
  if (!workers.length) return -1;
  const text = String((task && (task.title != null ? task.title : task.id)) == null ? '' : (task.title != null ? task.title : task.id)).toLowerCase();
  for (let i = 0; i < workers.length; i++) {
    const name = String(workers[i] && workers[i].name != null ? workers[i].name : '').trim().toLowerCase();
    if (name && text.indexOf(name) !== -1) return i;
  }
  const R = getState();
  const rr = R ? (R.rr || 0) : 0;
  const idx = rr % workers.length;
  if (R) R.rr = rr + 1;
  return idx;
}

function workerPixel(Vv, index) {
  const st = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates[index] : null;
  if (st && typeof st === 'object') {
    if (finite(st.gx) && finite(st.gy)) return isoFn(st.gx, st.gy);
    if (finite(st.x) && finite(st.y)) return { x: st.x, y: st.y };
  }
  const meta = (Vv && Array.isArray(Vv.workers)) ? Vv.workers[index] : null;
  if (meta && typeof meta === 'object') {
    if (finite(meta.gx) && finite(meta.gy)) return isoFn(meta.gx, meta.gy);
    if (finite(meta.gridX) && finite(meta.gridY)) return isoFn(meta.gridX, meta.gridY);
    if (finite(meta.tileX) && finite(meta.tileY)) return isoFn(meta.tileX, meta.tileY);
  }
  return isoFn(0, 0);
}

function triggerCeremony(now, Vv, task) {
  const R = getState();
  if (!R) return;
  const wi = pickWorker(Vv, task);
  const pt = workerPixel(Vv, wi);
  const meta = (Vv && Array.isArray(Vv.workers)) ? Vv.workers[wi] : null;
  const st = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates[wi] : null;
  const name = (meta && meta.name != null) ? meta.name : ((wi === 0) ? 'MISSINGNO' : 'STEP5');
  const color = workerNameColor(Vv, wi, meta, st);
  const baseX = pt.x + 8;
  const baseY = pt.y - 4;
  const sparkles = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    sparkles.push({
      x: baseX - 1,
      y: baseY - 4,
      vx: Math.cos(angle) * 30,
      vy: Math.sin(angle) * 30 - 12,
      age: 0
    });
  }
  R.fx.push({
    start: now,
    duration: 3000,
    baseX: baseX,
    baseY: baseY,
    workerIndex: wi,
    name: name,
    color: color,
    sparkles: sparkles
  });
  try {
    const w = root();
    if (w && typeof w.cue === 'function') w.cue('grow');
  } catch (e) {}
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const R = getState();
  const Vv = getV();
  if (!R) {
    lastTime = now;
    return;
  }
  if (!Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const currentPending = pendingTasks(Vv);
  const count = currentPending.length;
  if (R.lastPending === null) {
    R.lastPending = count;
  } else if (count > R.lastPending) {
    const newest = currentPending.length ? currentPending[currentPending.length - 1] : null;
    triggerCeremony(now, Vv, newest);
    R.lastPending = count;
  } else {
    R.lastPending = count;
  }

  const nextFx = [];
  for (let i = 0; i < R.fx.length; i++) {
    const fx = R.fx[i];
    if (!fx) continue;
    const age = now - fx.start;
    if (age >= fx.duration) continue;
    const sparkles = fx.sparkles || [];
    for (let j = 0; j < sparkles.length; j++) {
      const p = sparkles[j];
      if (!p) continue;
      p.age += dt * 1000;
      if (p.age < 1500) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 70 * dt;
      }
    }
    nextFx.push(fx);
  }
  R.fx = nextFx;
}

function draw(ctx) {
  const R = getState();
  const Vv = getV();
  if (!R || !ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  for (let i = 0; i < R.fx.length; i++) {
    const fx = R.fx[i];
    if (!fx) continue;
    const age = now - fx.start;
    if (age < 0 || age >= fx.duration) continue;

    const tScroll = clamp(age / 500, 0, 1);
    const scrollW = Math.round(4 + 26 * tScroll);
    const scrollH = 6;
    const x = Math.round(fx.baseX - scrollW / 2);
    const y = Math.round(fx.baseY - scrollH);

    ctx.fillStyle = '#e8d5a3';
    ctx.fillRect(x, y, scrollW, scrollH);
    ctx.strokeStyle = '#8b6f47';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, scrollW, scrollH);
    ctx.fillStyle = '#8b6f47';
    ctx.fillRect(x - 1, y - 1, 2, scrollH + 2);
    ctx.fillRect(x + scrollW - 1, y - 1, 2, scrollH + 2);

    ctx.font = 'bold 9px monospace';
    const tagText = 'ACCEPTED!';
    const tagW = Math.max(18, Math.round(ctx.measureText(tagText).width) + 8);
    const tagH = 13;
    const tagX = Math.round(fx.baseX - tagW / 2);
    const floatBob = Math.round(Math.sin(age / 220) * 1.5);
    const tagY = y - tagH - 8 + floatBob;
    ctx.fillStyle = 'rgba(10, 10, 12, 0.88)';
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.strokeStyle = fx.color || '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = fx.color || '#d4af37';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, tagX + tagW / 2, tagY + tagH / 2 + 1);
    ctx.textAlign = 'left';

    const sparkles = fx.sparkles || [];
    for (let j = 0; j < sparkles.length; j++) {
      const p = sparkles[j];
      if (!p || p.age >= 1500) continue;
      const alpha = Math.max(0, 1 - (p.age / 1500));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildRitual) window.GuildRitual = { lastPending: null, fx: [], rr: 0 };
  const R = window.GuildRitual;
  if (R.lastPending === undefined) R.lastPending = null;
  if (!Array.isArray(R.fx)) R.fx = [];
  if (typeof R.rr !== 'number') R.rr = 0;
  R.update = update;
  R.draw = draw;
  R.__probe = function () { return { fx: Array.isArray(R.fx) ? R.fx.length : 0, lastPending: R.lastPending }; };
}

export {};
