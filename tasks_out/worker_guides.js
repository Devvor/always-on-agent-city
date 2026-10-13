const BUILD = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getIso() { const w = root(); return (w && typeof w.iso === 'function') ? w.iso : null; }
function isoFn(gx, gy) {
  const w = root();
  const Vv = getV();
  const fn = getIso();
  if (fn) {
    try { return fn(gx, gy); } catch (e) {}
  }
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function num(v) {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return NaN;
}
function lastTimeState(s) {
  if (!s || typeof s.lastTime !== 'number') return null;
  return s.lastTime;
}

function ensureState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildGuides || typeof w.GuildGuides !== 'object') {
    w.GuildGuides = { chevrons: [], target: null, reachedAt: 0 };
  }
  const s = w.GuildGuides;
  if (!Array.isArray(s.chevrons)) s.chevrons = [];
  if (!Array.isArray(s.visited)) s.visited = [];
  if (typeof s.reachedAt !== 'number' || !isFinite(s.reachedAt)) s.reachedAt = 0;
  if (!(s.target === null) && !(s.target && typeof s.target === 'object')) s.target = null;
  if (typeof s.orbitAngle !== 'number' || !isFinite(s.orbitAngle)) s.orbitAngle = 0;
  if (typeof s.fading !== 'boolean') s.fading = false;
  if (typeof s.fadeStart !== 'number' || !isFinite(s.fadeStart)) s.fadeStart = 0;
  if (s.convergence && typeof s.convergence !== 'object') s.convergence = null;
  return s;
}

function worldToTile(x, y) {
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (!g) return { gx: x, gy: y };
  const dx = x - g.originX;
  const dy = y - g.originY;
  return { gx: dx / g.tileW + dy / g.tileH, gy: dy / g.tileH - dx / g.tileW };
}

function tileFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let gx = num(obj.gx);
  let gy = num(obj.gy);
  if (!isFinite(gx) && obj.tile && typeof obj.tile === 'object') { gx = num(obj.tile.gx); gy = num(obj.tile.gy); }
  if (!isFinite(gx) && obj.pos && typeof obj.pos === 'object') { gx = num(obj.pos.gx); gy = num(obj.pos.gy); }
  if (!isFinite(gx) && obj.position && typeof obj.position === 'object') { gx = num(obj.position.gx); gy = num(obj.position.gy); }
  if (!isFinite(gx) && isFinite(num(obj.x)) && isFinite(num(obj.y))) {
    gx = num(obj.x); gy = num(obj.y);
  }
  if (!isFinite(gx) || !isFinite(gy)) return null;
  return { gx: gx, gy: gy };
}

function museumPoi() {
  const w = root();
  const m = w && w.GuildMuseum;
  if (!m || typeof m !== 'object') return null;
  let ped = null;
  if (Array.isArray(m.pedestals) && m.pedestals.length) ped = m.pedestals[0];
  else if (Array.isArray(m.pedestalList) && m.pedestalList.length) ped = m.pedestalList[0];
  else if (m.firstPedestal && typeof m.firstPedestal === 'object') ped = m.firstPedestal;
  else if (m.pedestal && typeof m.pedestal === 'object') ped = m.pedestal;
  if (ped) {
    const t = tileFromObject(ped);
    if (t) return { id: 'museum', gx: t.gx, gy: t.gy };
  }
  const t2 = tileFromObject(m);
  if (t2) return { id: 'museum', gx: t2.gx, gy: t2.gy };
  return null;
}

function questBoardPoi() {
  const w = root();
  const qb = w && w.GuildQuestBoard;
  if (!qb || typeof qb !== 'object') return null;
  const t = tileFromObject(qb);
  if (!t) return null;
  return { id: 'questboard', gx: t.gx, gy: t.gy };
}

function catPoi() {
  const w = root();
  const cat = w && w.GuildCat;
  if (!cat || typeof cat !== 'object') return null;
  const t = tileFromObject(cat);
  if (!t) return null;
  return { id: 'cat', gx: t.gx, gy: t.gy };
}

function workingWorkerPoi() {
  const Vv = getV();
  if (!Vv || !Array.isArray(Vv.workerStates)) return null;
  for (let i = 0; i < Vv.workerStates.length; i++) {
    const st = Vv.workerStates[i];
    if (!st || typeof st !== 'object') continue;
    const meta = Array.isArray(Vv.workers) ? Vv.workers[i] : null;
    const tasks = (meta && Array.isArray(meta.tasks)) ? meta.tasks : (Array.isArray(st.tasks) ? st.tasks : []);
    let isWorking = false;
    if (st.workerState === 'WORKING') isWorking = true;
    else if (st.mode === 'in_progress' || st.mode === 'pending') isWorking = true;
    else {
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t];
        if (task && (task.status === 'pending' || task.status === 'in_progress')) { isWorking = true; break; }
      }
    }
    if (!isWorking) continue;
    let gx = NaN;
    let gy = NaN;
    if (isFinite(num(st.gx)) && isFinite(num(st.gy))) { gx = num(st.gx); gy = num(st.gy); }
    else if (st.tile && typeof st.tile === 'object' && isFinite(num(st.tile.gx)) && isFinite(num(st.tile.gy))) {
      gx = num(st.tile.gx); gy = num(st.tile.gy);
    } else if (isFinite(num(st.x)) && isFinite(num(st.y))) {
      const tt = worldToTile(num(st.x), num(st.y));
      gx = tt.gx; gy = tt.gy;
    }
    if (isFinite(gx) && isFinite(gy)) return { id: 'worker:' + i, gx: gx, gy: gy };
  }
  return null;
}

function buildPois() {
  const out = [];
  const q = questBoardPoi();
  if (q) out.push(q);
  const m = museumPoi();
  if (m) out.push(m);
  const wk = workingWorkerPoi();
  if (wk) out.push(wk);
  const c = catPoi();
  if (c) out.push(c);
  const dedup = [];
  const seen = {};
  for (let i = 0; i < out.length; i++) {
    const p = out[i];
    if (!p || !isFinite(num(p.gx)) || !isFinite(num(p.gy))) continue;
    if (seen[p.id]) continue;
    seen[p.id] = true;
    dedup.push(p);
  }
  return dedup;
}

function distTiles(a, b) {
  return Math.hypot(a.gx - b.gx, a.gy - b.gy);
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

function update(now) {
  try {
    if (typeof now !== 'number' || !isFinite(now)) {
      now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    }
    const s = ensureState();
    const Vv = getV();
    const vis = root() && root().GuildVisitor;
    if (!s || !Vv || Vv.gameState !== 'play' || !vis || !isFinite(num(vis.gx)) || !isFinite(num(vis.gy))) {
      s.chevrons = [];
      return;
    }

    const prev = (typeof s.lastTime === 'number' && isFinite(s.lastTime)) ? s.lastTime : now;
    let dt = (now - prev) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    s.lastTime = now;

    const pois = buildPois();
    s.poiList = pois;

    if (s.fading) {
      if (now - s.fadeStart >= 60000) {
        s.fading = false;
        s.fadeStart = 0;
        s.visited = [];
        s.target = null;
        s.reachedAt = 0;
        s.chevrons = [];
      }
    }

    if (s.convergence && now - s.convergence.start >= 500) {
      s.convergence = null;
    }

    if (!s.fading) {
      const validTarget = s.target && pois.some(function (p) {
        return p.id === s.target.id && s.visited.indexOf(p.id) === -1;
      });
      if (!validTarget) {
        const unvisited = pois.filter(function (p) { return s.visited.indexOf(p.id) === -1; });
        if (!unvisited.length) {
          if (pois.length > 0) {
            s.fading = true;
            s.fadeStart = now;
          }
          s.target = null;
        } else {
          let best = null;
          let bestD = Infinity;
          for (let i = 0; i < unvisited.length; i++) {
            const d = distTiles(vis, unvisited[i]);
            if (d < bestD) { bestD = d; best = unvisited[i]; }
          }
          s.target = best;
        }
      }
    }

    if (!s.fading && s.target && !s.convergence) {
      const d = distTiles(vis, s.target);
      if (isFinite(d) && d <= 1.8) {
        const oldTarget = s.target;
        if (s.visited.indexOf(oldTarget.id) === -1) s.visited.push(oldTarget.id);
        s.reachedAt = now;

        const oldPt = isoFn(oldTarget.gx, oldTarget.gy);
        const visPt = isoFn(vis.gx, vis.gy);
        s.convergence = {
          start: now,
          targetX: oldPt.x,
          targetY: oldPt.y,
          angle: Math.atan2(oldPt.y - visPt.y, oldPt.x - visPt.x)
        };

        const unvisited = pois.filter(function (p) { return s.visited.indexOf(p.id) === -1; });
        if (!unvisited.length) {
          if (pois.length > 0) {
            s.fading = true;
            s.fadeStart = now;
          }
          s.target = null;
        } else {
          let best = null;
          let bestD = Infinity;
          for (let i = 0; i < unvisited.length; i++) {
            const dd = distTiles(vis, unvisited[i]);
            if (dd < bestD) { bestD = dd; best = unvisited[i]; }
          }
          s.target = best;
        }
      }
    }

    s.orbitAngle += dt * 0.95;

    let alphaBase = 1;
    if (s.fading) {
      const elapsed = (now - s.fadeStart) / 1000;
      alphaBase = Math.max(0, 1 - elapsed / 60);
    }

    s.chevrons = [];
    if (pois.length === 0 || alphaBase <= 0.001) return;

    const visPt = isoFn(vis.gx, vis.gy);
    let targetPt = visPt;
    if (s.target) targetPt = isoFn(s.target.gx, s.target.gy);
    else if (s.convergence) targetPt = { x: s.convergence.targetX, y: s.convergence.targetY };
    const rotBase = Math.atan2(targetPt.y - visPt.y, targetPt.x - visPt.x);

    const radius = 30;
    const converging = !!s.convergence;
    const prog = converging ? clamp((now - s.convergence.start) / 500, 0, 1) : 0;
    const eased = ease(prog);

    for (let i = 0; i < 3; i++) {
      const orbA = s.orbitAngle + (i * Math.PI * 2) / 3;
      const sx = visPt.x + Math.cos(orbA) * radius;
      const sy = visPt.y + Math.sin(orbA) * radius;
      let x = sx;
      let y = sy;
      let rot = rotBase;
      if (converging) {
        const ex = s.convergence.targetX;
        const ey = s.convergence.targetY;
        x = sx + (ex - sx) * eased;
        y = sy + (ey - sy) * eased;
        rot = s.convergence.angle;
      }
      const pulse = 0.55 + 0.3 * Math.sin(now * 0.004 + i * 1.7);
      const alpha = Math.max(0, Math.min(1, alphaBase * pulse));
      if (alpha <= 0.001) continue;
      s.chevrons.push({ x: x, y: y, rotation: rot, alpha: alpha });
    }
  } catch (e) {}
}

function draw(ctx) {
  try {
    const s = ensureState();
    const Vv = getV();
    const vis = root() && root().GuildVisitor;
    if (!s || !ctx || !Vv || Vv.gameState !== 'play' || !vis) return;

    ctx.save();
    for (let i = 0; i < s.chevrons.length; i++) {
      const ch = s.chevrons[i];
      if (!ch || !isFinite(num(ch.x)) || !isFinite(num(ch.y))) continue;
      ctx.save();
      ctx.globalAlpha = clamp(num(ch.alpha), 0, 1);
      ctx.strokeStyle = '#d4af37';
      ctx.fillStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.translate(ch.x, ch.y);
      ctx.rotate(num(ch.rotation));
      ctx.beginPath();
      ctx.moveTo(-7, -7);
      ctx.lineTo(7, 0);
      ctx.moveTo(-7, 7);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  ensureState();
  window.GuildGuides.update = update;
  window.GuildGuides.draw = draw;
  window.GuildGuides.__probe = function () {
    const s = ensureState();
    return {
      pois: s && Array.isArray(s.poiList) ? s.poiList.slice() : [],
      target: s ? s.target : null,
      visited: s && Array.isArray(s.visited) ? s.visited.slice() : [],
      reachedAt: s ? s.reachedAt : 0,
      fading: s ? s.fading : false,
      convergence: s ? s.convergence : null,
      chevrons: s && Array.isArray(s.chevrons) ? s.chevrons.slice() : []
    };
  };
}

export {};
