const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

let lanterns = [];
const primedStates = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); try { return w && w.V; } catch (e) { return null; } }
function getState() { const w = root(); try { return w && w.GuildLanterns; } catch (e) { return null; } }
function isoFn(gx, gy) {
  const w = root();
  try {
    if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  } catch (e) {}
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() {
  try {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') return performance.now();
  } catch (e) {}
  return Date.now();
}
function cue(name) {
  try {
    const w = root();
    if (w && typeof w.cue === 'function') w.cue(name);
  } catch (e) {}
}
function markPrimed(state) {
  if (primedStates) primedStates.add(state);
  else state._lanternPrimed = true;
}
function isPrimed(state) {
  if (primedStates) return primedStates.has(state);
  return !!state._lanternPrimed;
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function countDone(Vv) {
  let count = 0;
  const tasks = Vv && Array.isArray(Vv.allTasks) ? Vv.allTasks : [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t && t.status === 'done') count++;
  }
  return count;
}
function randomFloorTile(Vv) {
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  for (let tries = 0; tries < 80; tries++) {
    const gx = minC + Math.floor(Math.random() * (maxC - minC + 1));
    const gy = minC + Math.floor(Math.random() * (maxC - minC + 1));
    if (tileRing(gx, gy) > s) continue;
    let blocked = false;
    for (let i = 0; i < BUILDINGS.length; i++) {
      if (BUILDINGS[i].gx === gx && BUILDINGS[i].gy === gy) { blocked = true; break; }
    }
    if (blocked) continue;
    return { gx: gx, gy: gy };
  }
  return { gx: 0, gy: 0 };
}
function spawnLantern(Vv, spawnAt) {
  const tile = randomFloorTile(Vv || {});
  const pt = isoFn(tile.gx + 0.5, tile.gy + 0.5);
  const speedY = 9 + Math.random() * 8;
  const lantern = {
    spawn: (typeof spawnAt === 'number') ? spawnAt : nowFn(),
    x: pt.x,
    y: pt.y,
    speedY: speedY,
    amp: 6 + Math.random() * 8,
    freq: 0.9 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    size: 2 + Math.random() * 3,
    life: 0
  };
  const targetY = 20;
  const travel = Math.max(6, (pt.y - targetY) / speedY);
  lantern.life = (travel + 2) * 1000;
  lanterns.push(lantern);
}
function startFestival(state, now, Vv) {
  const dur = 40000;
  const count = 24;
  const interval = dur / count;
  const spawns = [];
  for (let i = 0; i < count; i++) {
    const t = now + i * interval + (Math.random() - 0.5) * interval * 0.35;
    spawns.push(Math.min(now + dur - 100, Math.max(now, t)));
  }
  state.festival = { t0: now, dur: dur, midpointCued: false, spawns: spawns, spawned: 0 };
  lanterns = [];
  cue('levelup');
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function pruneLanterns(now) {
  const alive = [];
  for (let i = 0; i < lanterns.length; i++) {
    const L = lanterns[i];
    const age = now - L.spawn;
    if (age < 0) { alive.push(L); continue; }
    const y = L.y - (L.speedY * (age / 1000));
    if (age >= L.life) continue;
    if (y < -60) continue;
    alive.push(L);
  }
  lanterns = alive;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  try {
    const Vv = getV();
    const state = getState();
    if (!state) return;
    if (!Vv || Vv.gameState !== 'play') return;

    const count = countDone(Vv);
    if (!isPrimed(state)) {
      markPrimed(state);
      state.lastDone = count;
      return;
    }

    const prevLast = state.lastDone;
    let crossed = false;
    if (typeof count === 'number' && count > prevLast) {
      const milestone = Math.floor(count / 5) * 5;
      if (milestone >= 5 && milestone > prevLast) crossed = true;
    }

    if (crossed) {
      startFestival(state, now, Vv);
      state.lastDone = count;
    } else {
      state.lastDone = count;
    }

    if (state.festival) {
      const f = state.festival;
      const elapsed = now - f.t0;
      while (f.spawned < f.spawns.length && now >= f.spawns[f.spawned]) {
        spawnLantern(Vv, f.spawns[f.spawned]);
        f.spawned++;
      }
      if (elapsed >= 20000 && !f.midpointCued) {
        f.midpointCued = true;
        cue('grow');
      }
      if (elapsed >= f.dur) {
        state.festival = null;
        lanterns = [];
      }
    }
  } catch (e) {}
}

function draw(ctx) {
  if (!ctx) return;
  try {
    const state = getState();
    if (!state || !state.festival) {
      lanterns = [];
      return;
    }
    const now = nowFn();
    const Vv = getV();
    const f = state.festival;
    const elapsed = now - f.t0;
    const dur = (typeof f.dur === 'number') ? f.dur : 40000;
    if (elapsed >= dur) {
      state.festival = null;
      lanterns = [];
      return;
    }
    if (Vv) {
      while (f.spawned < f.spawns.length && now >= f.spawns[f.spawned]) {
        spawnLantern(Vv, f.spawns[f.spawned]);
        f.spawned++;
      }
    }
    pruneLanterns(now);

    for (let i = 0; i < lanterns.length; i++) {
      const L = lanterns[i];
      const age = now - L.spawn;
      if (age < 0) continue;
      const rise = L.speedY * (age / 1000);
      const x = L.x + Math.sin((age / 1000) * L.freq + L.phase) * L.amp;
      const y = L.y - rise;
      let alpha = 1;
      if (age > L.life * 0.65) alpha *= clamp(1 - (age - L.life * 0.65) / (L.life * 0.35), 0, 1);
      if (y < 90) alpha *= clamp((y + 30) / 120, 0, 1);
      if (alpha <= 0.01) continue;
      const flicker = 0.82 + 0.18 * Math.sin(now * 0.018 + L.phase * 2 + age * 0.005);
      const glowAlpha = alpha * flicker;
      const radius = 8 + L.size * 2 + flicker * 3;

      ctx.save();
      ctx.globalAlpha = glowAlpha;
      const gradient = ctx.createRadialGradient(x, y, 0.5, x, y, radius);
      gradient.addColorStop(0, '#ffb347');
      gradient.addColorStop(0.45, '#ff7a1a');
      gradient.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff8c1a';
      ctx.fillRect(Math.round(x - 3), Math.round(y - 4), 6, 7);
      ctx.fillStyle = '#ffc27a';
      ctx.fillRect(Math.round(x - 2), Math.round(y - 3), 4, 5);
      ctx.fillStyle = '#6b4a2d';
      ctx.fillRect(Math.round(x - 1), Math.round(y - 6), 2, 2);
      ctx.fillRect(Math.round(x - 1), Math.round(y + 3), 2, 2);
      ctx.restore();
    }

    const canvas = (ctx.canvas) || (Vv && Vv.canvas);
    if (canvas) {
      ctx.save();
      try {
        if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
      } catch (e) {}
      ctx.beginPath();
      ctx.rect(Math.round(canvas.width * 0.5 - 65), 4, 130, 16);
      ctx.clip();
      ctx.fillStyle = '#d4af37';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LANTERN FESTIVAL', canvas.width * 0.5, 12);
      ctx.restore();
    }
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildLanterns) window.GuildLanterns = { lastDone: 0, festival: null };
  window.GuildLanterns.update = update;
  window.GuildLanterns.draw = draw;
  window.GuildLanterns.__probe = function () {
    try {
      const state = getState();
      return {
        lastDone: state ? state.lastDone : 0,
        festival: state ? state.festival : null,
        festivalActive: !!(state && state.festival),
        lanternCount: lanterns.length,
        lanterns: lanterns.slice()
      };
    } catch (e) {
      return null;
    }
  };
}

export {};
