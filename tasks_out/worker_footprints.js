const FOOT_LIFE = 3500;
const FOOT_LIFE_RAIN = 5000;
const FOOT_MAX = 40;
const STEP_INTERVAL = 0.5;
const SPARK_LIFE = 0.8;
const SPARK_MAX = 120;
const AMBIENT_INTERVAL = 90000;
const EMOTE_WINDOW = 1200;

let lastTime = null;
let moveAccum = 0;
let emoteAccum = 0;
let ambientAt = 0;
let lastCoinAt = 0;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildFootprints; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function facingVectors(facing) {
  const Vv = getV();
  const g = Vv && Vv.grid;
  const tileW = (g && isFinite(g.tileW)) ? g.tileW : 70;
  const tileH = (g && isFinite(g.tileH)) ? g.tileH : 35;
  let dx, dy;
  if (facing === 'left') { dx = -tileW; dy = -tileH; }
  else if (facing === 'right') { dx = tileW; dy = tileH; }
  else if (facing === 'up') { dx = tileW; dy = -tileH; }
  else { dx = -tileW; dy = tileH; }
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl;
  const uy = dy / dl;
  return { ux: ux, uy: uy, px: -uy, py: ux };
}

function recentEmoteAt(now) {
  const w = root();
  if (!w) return 0;
  const names = ['GuildEmotes', 'GuildEmote', 'GuildEmoter', 'GuildInteract', 'GuildInteractions'];
  const props = ['lastEmote', 'lastEmoteAt', 'lastAt', 'last', 'at', 'time', 'ts', 'timestamp'];
  for (let i = 0; i < names.length; i++) {
    const g = w[names[i]];
    if (!g || typeof g !== 'object') continue;
    const cur = g.current;
    if (cur && typeof cur === 'object' && typeof cur.start === 'number') {
      const age = now - cur.start;
      if (age >= 0 && age <= EMOTE_WINDOW) return cur.start;
    }
    for (let j = 0; j < props.length; j++) {
      const v = g[props[j]];
      if (typeof v === 'number') {
        const age = now - v;
        if (age >= 0 && age <= EMOTE_WINDOW) return v;
      }
    }
  }
  return 0;
}

function dropPrint(state, vis, now) {
  if (!isFinite(vis.gx) || !isFinite(vis.gy)) return;
  const Vv = getV();
  const weather = (Vv && typeof Vv.weather === 'string') ? Vv.weather : '';
  const rain = (weather === 'RAIN');
  const f = facingVectors(vis.facing);
  const s = (state.steps % 2 === 0) ? 1 : -1;
  const along = 2.0;
  const perp = 2.6;
  const ax = f.px * perp + f.ux * along * s;
  const ay = f.py * perp + f.uy * along * s;
  state.prints.push({
    gx: vis.gx, gy: vis.gy, ax: ax, ay: ay, bx: -ax, by: -ay,
    born: now, life: rain ? FOOT_LIFE_RAIN : FOOT_LIFE, dark: rain
  });
  state.steps++;
  while (state.prints.length > FOOT_MAX) state.prints.shift();
}

function spawnSpark(state, x, y) {
  state.sparkles.push({
    x: x, y: y, vx: (Math.random() - 0.5) * 14, vy: -18 - Math.random() * 26,
    age: 0, life: SPARK_LIFE * (0.75 + Math.random() * 0.5),
    size: Math.random() < 0.5 ? 1 : 2, color: Math.random() < 0.5 ? '#facc15' : '#fde68a'
  });
  while (state.sparkles.length > SPARK_MAX) state.sparkles.shift();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const Vv = getV();
  const state = getState();
  if (!w || !Vv || Vv.gameState !== 'play' || !state) { lastTime = now; return; }
  const vis = w.GuildVisitor;
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const hasPos = !!(vis && isFinite(vis.gx) && isFinite(vis.gy));
  const moving = hasPos && !!vis.moving;

  if (moving) {
    moveAccum += dt;
    while (moveAccum >= STEP_INTERVAL) {
      moveAccum -= STEP_INTERVAL;
      dropPrint(state, vis, now);
    }
  } else {
    moveAccum = 0;
  }

  if (state.prints.length) {
    const kept = [];
    for (let i = 0; i < state.prints.length; i++) {
      if (now - state.prints[i].born <= state.prints[i].life) kept.push(state.prints[i]);
    }
    state.prints = kept;
    while (state.prints.length > FOOT_MAX) state.prints.shift();
  }

  if (hasPos) {
    const emoteTs = recentEmoteAt(now);
    if (emoteTs > 0) {
      emoteAccum += dt;
      while (emoteAccum >= 0.09) {
        emoteAccum -= 0.09;
        const pt = isoFn(vis.gx, vis.gy);
        spawnSpark(state, pt.x + (Math.random() - 0.5) * 14, pt.y - 6 - Math.random() * 10);
      }
    } else {
      emoteAccum = 0;
    }

    if (!ambientAt) ambientAt = now + AMBIENT_INTERVAL;
    if (now >= ambientAt && !moving && emoteTs <= 0) {
      const pt = isoFn(vis.gx, vis.gy);
      for (let i = 0; i < 5; i++) {
        spawnSpark(state, pt.x + (Math.random() - 0.5) * 18, pt.y - 2 - Math.random() * 10);
      }
      if (now - lastCoinAt >= AMBIENT_INTERVAL) {
        lastCoinAt = now;
        try { if (typeof w.cue === 'function') w.cue('coin'); } catch (e) {}
      }
      ambientAt = now + AMBIENT_INTERVAL;
    }
  } else {
    emoteAccum = 0;
  }

  if (state.sparkles.length) {
    const kept = [];
    for (let i = 0; i < state.sparkles.length; i++) {
      const s = state.sparkles[i];
      s.age += dt;
      if (s.age >= s.life) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      kept.push(s);
    }
    state.sparkles = kept;
  }
}

function draw(ctx) {
  const w = root();
  if (!w || !ctx) return;
  const Vv = getV();
  const state = getState();
  if (!Vv || Vv.gameState !== 'play' || !state) return;
  const now = nowFn();
  ctx.save();

  const prints = state.prints;
  for (let i = 0; i < prints.length; i++) {
    const p = prints[i];
    const age = now - p.born;
    if (age < 0 || age > p.life) continue;
    const a = 0.35 * (1 - age / p.life);
    if (a <= 0) continue;
    const pt = isoFn(p.gx, p.gy);
    const bx = Math.round(pt.x);
    const by = Math.round(pt.y + 16);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.dark ? 'rgb(74,68,58)' : 'rgb(120,110,92)';
    ctx.fillRect(bx + Math.round(p.ax) - 1, by + Math.round(p.ay) - 1, 2, 2);
    ctx.fillRect(bx + Math.round(p.bx) - 1, by + Math.round(p.by) - 1, 2, 2);
  }

  const sparkles = state.sparkles;
  for (let i = 0; i < sparkles.length; i++) {
    const s = sparkles[i];
    const a = 0.9 * (1 - s.age / s.life);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = s.color;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function probe() {
  const s = getState();
  if (!s) return { steps: 0, prints: 0 };
  return { steps: (typeof s.steps === 'number') ? s.steps : 0, prints: Array.isArray(s.prints) ? s.prints.length : 0 };
}

if (typeof window !== 'undefined') {
  if (!window.GuildFootprints || typeof window.GuildFootprints !== 'object') {
    window.GuildFootprints = { prints: [], sparkles: [], steps: 0 };
  }
  const st = window.GuildFootprints;
  if (!Array.isArray(st.prints)) st.prints = [];
  if (!Array.isArray(st.sparkles)) st.sparkles = [];
  if (typeof st.steps !== 'number') st.steps = 0;
  st.update = update;
  st.draw = draw;
  st.__probe = probe;
}

export {};
