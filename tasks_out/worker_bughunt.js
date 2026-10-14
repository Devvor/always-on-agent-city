const BUILDINGS_UNUSED = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { return w.iso(gx, gy); } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildBughunt; }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function isOnIsland(gx, gy) {
  const Vv = getV();
  if (!Vv || !Vv.grid) return true;
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  const rx = Math.round(gx);
  const ry = Math.round(gy);
  if (rx < minC || rx > maxC || ry < minC || ry > maxC) return false;
  if (tileRing(rx, ry) > s) return false;
  return true;
}

function randomGardenPoint() {
  let gx = 4 + Math.random() * 2;
  let gy = Math.random() * 3;
  const Vv = getV();
  if (Vv && Vv.grid) {
    let guard = 0;
    while (guard < 30 && !isOnIsland(gx, gy)) {
      gx += (5 - gx) * 0.25;
      gy += (1.5 - gy) * 0.25;
      gx += (Math.random() - 0.5) * 0.12;
      gy += (Math.random() - 0.5) * 0.12;
      if (gx < 4) gx = 4;
      if (gx > 6) gx = 6;
      if (gy < 0) gy = 0;
      if (gy > 3) gy = 3;
      guard++;
    }
  }
  if (gx < 4) gx = 4;
  if (gx > 6) gx = 6;
  if (gy < 0) gy = 0;
  if (gy > 3) gy = 3;
  return { gx: gx, gy: gy };
}

function createGnat() {
  const pos = randomGardenPoint();
  const ang = Math.random() * Math.PI * 2;
  return { gx: pos.gx, gy: pos.gy, vx: Math.cos(ang) * 0.4, vy: Math.sin(ang) * 0.4, caught: false, timer: 0 };
}

function createState() {
  const gnats = [];
  for (let i = 0; i < 4; i++) gnats.push(createGnat());
  return { gnats: gnats, caught: 0, swing: null, sparks: [], cJustPressed: false, lastTime: null, keySet: new Set() };
}

function ensurePopulation(state) {
  if (!state) return;
  if (!Array.isArray(state.gnats)) state.gnats = [];
  while (state.gnats.length < 4) state.gnats.push(createGnat());
  if (state.gnats.length > 4) state.gnats.length = 4;
  for (let i = 0; i < state.gnats.length; i++) {
    const g = state.gnats[i];
    if (!g || typeof g !== 'object') { state.gnats[i] = createGnat(); continue; }
    if (typeof g.caught !== 'boolean') g.caught = false;
    if (typeof g.timer !== 'number') g.timer = 0;
    if (typeof g.gx !== 'number') g.gx = 5;
    if (typeof g.gy !== 'number') g.gy = 1.5;
    if (typeof g.vx !== 'number') g.vx = (Math.random() - 0.5) * 0.8;
    if (typeof g.vy !== 'number') g.vy = (Math.random() - 0.5) * 0.8;
  }
  if (typeof state.caught !== 'number') state.caught = 0;
  if (!Array.isArray(state.sparks)) state.sparks = [];
  if (typeof state.cJustPressed !== 'boolean') state.cJustPressed = false;
  if (state.lastTime === undefined) state.lastTime = null;
}

function spawnSparkles(x, y) {
  const state = getState();
  if (!state) return;
  for (let i = 0; i < 8; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 14 + Math.random() * 26;
    state.sparks.push({ x: x, y: y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0.55 + Math.random() * 0.35, age: 0, size: 1 + Math.random() * 2 });
  }
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function onKeydown(e) {
  try {
    const k = normKey(e);
    if (k !== 'c') return;
    const state = getState();
    if (state) state.cJustPressed = true;
  } catch (err) {}
}

function onKeyup(e) {
  try {
    const k = normKey(e);
    if (k !== 'c') return;
    const state = getState();
    if (state) state.keySet.delete(k);
  } catch (err) {}
}

function update(now) {
  try {
    const state = getState();
    if (!state) return;
    if (typeof now !== 'number') now = nowFn();
    const Vv = getV();
    if (!state || !Vv || Vv.gameState !== 'play') {
      state.lastTime = now;
      return;
    }
    const hasIso = (root() && typeof root().iso === 'function') || !!(Vv && Vv.grid);
    if (!hasIso) {
      state.lastTime = now;
      return;
    }
    const gv = (root() && root().GuildVisitor) ? root().GuildVisitor : null;
    if (!gv || !isFinite(gv.gx) || !isFinite(gv.gy)) {
      state.lastTime = now;
      return;
    }
    ensurePopulation(state);
    if (state.lastTime === null) state.lastTime = now;
    let dt = (now - state.lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    state.lastTime = now;

    const raining = (Vv.weather === 'RAIN');

    if (!raining) {
      for (let i = 0; i < state.gnats.length; i++) {
        const g = state.gnats[i];
        if (!g || g.caught) continue;
        let vx = (typeof g.vx === 'number') ? g.vx : 0;
        let vy = (typeof g.vy === 'number') ? g.vy : 0;
        vx += (Math.random() - 0.5) * 2.4 * dt;
        vy += (Math.random() - 0.5) * 2.4 * dt;
        const dx = g.gx - gv.gx;
        const dy = g.gy - gv.gy;
        const dist = Math.hypot(dx, dy);
        if (isFinite(dist) && dist > 0 && dist < 1.2) {
          const strength = (1.2 - dist) / 1.2;
          vx += (dx / dist) * strength * 0.9;
          vy += (dy / dist) * strength * 0.9;
        }
        const speed = Math.hypot(vx, vy);
        if (speed > 0) {
          const target = 0.4;
          vx = (vx / speed) * target;
          vy = (vy / speed) * target;
        }
        const oldX = g.gx;
        const oldY = g.gy;
        let nx = oldX + vx * dt;
        let ny = oldY + vy * dt;
        if (nx < 4) { nx = 4; vx = Math.abs(vx); }
        if (nx > 6) { nx = 6; vx = -Math.abs(vx); }
        if (ny < 0) { ny = 0; vy = Math.abs(vy); }
        if (ny > 3) { ny = 3; vy = -Math.abs(vy); }
        if (!isOnIsland(nx, ny)) {
          nx = oldX;
          ny = oldY;
          vx = -vx * 0.6;
          vy = -vy * 0.6;
        }
        g.gx = nx;
        g.gy = ny;
        g.vx = vx;
        g.vy = vy;
      }
    }

    for (let i = 0; i < state.gnats.length; i++) {
      const g = state.gnats[i];
      if (!g || !g.caught) continue;
      g.timer -= dt;
      if (g.timer <= 0) {
        const pos = randomGardenPoint();
        g.gx = pos.gx;
        g.gy = pos.gy;
        const ang = Math.random() * Math.PI * 2;
        g.vx = Math.cos(ang) * 0.4;
        g.vy = Math.sin(ang) * 0.4;
        g.caught = false;
        g.timer = 0;
      }
    }

    const nextSparks = [];
    for (let i = 0; i < state.sparks.length; i++) {
      const sp = state.sparks[i];
      sp.age += dt;
      if (sp.age < sp.life) {
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 18 * dt;
        sp.vx *= 0.96;
        nextSparks.push(sp);
      }
    }
    state.sparks = nextSparks;

    if (state.swing) {
      const ageMs = now - state.swing.start;
      if (!isFinite(ageMs) || ageMs >= state.swing.duration * 1000) state.swing = null;
    }

    if (state.cJustPressed) {
      state.cJustPressed = false;
      if (!state.swing && !raining) {
        let near = false;
        for (let i = 0; i < state.gnats.length; i++) {
          const g = state.gnats[i];
          if (!g || g.caught) continue;
          const d = Math.hypot(g.gx - gv.gx, g.gy - gv.gy);
          if (isFinite(d) && d <= 1) { near = true; break; }
        }
        if (near) {
          state.swing = { start: now, duration: 0.25, facing: (gv.facing || 'down') };
          const visPt = isoFn(gv.gx, gv.gy);
          let didCatch = false;
          for (let i = 0; i < state.gnats.length; i++) {
            const g = state.gnats[i];
            if (!g || g.caught) continue;
            const gp = isoFn(g.gx, g.gy);
            const pd = Math.hypot(gp.x - visPt.x, gp.y - visPt.y);
            if (isFinite(pd) && pd <= 14) {
              g.caught = true;
              g.timer = 1;
              state.caught++;
              spawnSparkles(gp.x, gp.y);
              didCatch = true;
            }
          }
          if (didCatch) {
            const cue = root() && root().cue;
            if (typeof cue === 'function') {
              try { cue('pop'); } catch (e) {}
            }
          }
        }
      }
    }
  } catch (e) {}
}

function draw(ctx) {
  try {
    const state = getState();
    if (!state || !ctx) return;
    const Vv = getV();
    if (!Vv || Vv.gameState !== 'play') return;
    const hasIso = (root() && typeof root().iso === 'function') || !!(Vv && Vv.grid);
    if (!hasIso) return;
    ensurePopulation(state);
    const raining = (Vv.weather === 'RAIN');

    if (!raining) {
      ctx.fillStyle = '#fbbf24';
      for (let i = 0; i < state.gnats.length; i++) {
        const g = state.gnats[i];
        if (!g || g.caught) continue;
        const p = isoFn(g.gx, g.gy);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    }

    for (let i = 0; i < state.sparks.length; i++) {
      const sp = state.sparks[i];
      const a = Math.max(0, 1 - (sp.age / sp.life));
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = (Math.random() < 0.5) ? '#fbbf24' : '#ffffff';
      const sz = Math.max(1, Math.round(sp.size));
      ctx.fillRect(Math.round(sp.x), Math.round(sp.y), sz, sz);
    }
    ctx.globalAlpha = 1;

    const gv = (root() && root().GuildVisitor) ? root().GuildVisitor : null;
    if (state.swing && gv && isFinite(gv.gx) && isFinite(gv.gy)) {
      const ageMs = nowFn() - state.swing.start;
      if (isFinite(ageMs) && ageMs >= 0 && ageMs < state.swing.duration * 1000) {
        const pt = isoFn(gv.gx, gv.gy);
        const facing = state.swing.facing || gv.facing || 'down';
        let angle = 0;
        if (facing === 'up') angle = -Math.PI / 2;
        else if (facing === 'down') angle = Math.PI / 2;
        else if (facing === 'left') angle = Math.PI;
        else angle = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 16, angle - Math.PI / 4, angle + Math.PI / 4);
        ctx.stroke();
      }
    }

    const gardenPt = isoFn(5, 1.5);
    const text = fitFn('Bugs ' + state.caught, 80);
    ctx.font = '8px monospace';
    const tw = ctx.measureText(text).width;
    const pw = Math.max(26, Math.round(tw + 8));
    const ph = 12;
    const x = Math.round(gardenPt.x - pw * 0.5);
    const y = Math.round(gardenPt.y - ph - 6);
    ctx.fillStyle = '#0d1324';
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, pw, ph);
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pw * 0.5, y + ph * 0.5 + 1);
    ctx.textAlign = 'left';
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildBughunt) window.GuildBughunt = createState();
  const s = window.GuildBughunt;
  ensurePopulation(s);
  window.GuildBughunt = s;
  s.update = update;
  s.draw = draw;
  s.__probe = function () { return { caught: (getState() && getState().caught) || 0, gnats: (getState() && Array.isArray(getState().gnats)) ? getState().gnats.length : 0 }; };
  if (!window.__gbhListeners) {
    window.__gbhListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
