const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];
let lastTime = null;
let lastRng = 0;

function createState() {
  return {
    state: 'idle',
    timer: 0,
    nextCheck: 0,
    zGlyphs: [],
    starGlint: null,
    lastDaylight: -1
  };
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
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildCatnaps; }
function getCat() { const w = root(); return w && w.GuildCat; }

function rng() {
  lastRng = (lastRng * 1664525 + 1013904223) >>> 0;
  return lastRng / 4294967296;
}

function catScreenPos(cat, Vv) {
  if (!cat) return null;
  let gx = cat.gx, gy = cat.gy;
  if (typeof gx !== 'number') gx = 1;
  if (typeof gy !== 'number') gy = 1;
  const pt = isoFn(gx, gy);
  return { x: Math.round(pt.x), y: Math.round(pt.y) };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 0;
  const cat = getCat();

  if (st.state === 'napping') {
    st.timer += dt;
    if (st.timer >= st.duration) {
      st.state = 'idle';
      st.timer = 0;
      st.zGlyphs = [];
      st.starGlint = null;
      st.nextCheck = 40 + rng() * 50;
    } else {
      const age = st.timer;
      const life = st.duration;
      const ratio = age / life;
      if (age - st.lastZSpawn >= 0.4 + rng() * 0.4) {
        const pos = catScreenPos(cat, Vv);
        if (pos) {
          st.zGlyphs.push({
            x: pos.x + 4 + (rng() - 0.5) * 6,
            y: pos.y - 10,
            vx: (rng() - 0.5) * 4,
            vy: -12 - rng() * 5,
            life: 1.6 + rng() * 0.8,
            age: 0
          });
        }
        st.lastZSpawn = age;
      }
      for (let i = 0; i < st.zGlyphs.length; i++) {
        const z = st.zGlyphs[i];
        z.age += dt;
        z.x += (z.vx + Math.sin(z.age * 2 + z.phase) * 2) * dt;
        z.y += z.vy * dt;
      }
      st.zGlyphs = st.zGlyphs.filter(function (z) { return z.age < z.life; });
    }
  } else if (st.state === 'stargazing') {
    st.timer += dt;
    if (st.timer >= st.duration) {
      st.state = 'idle';
      st.timer = 0;
      st.starGlint = null;
      st.nextCheck = 40 + rng() * 50;
    }
  } else {
    st.nextCheck -= dt;
    if (st.nextCheck <= 0 && cat) {
      if (dl > 0.6) {
        st.state = 'napping';
        st.timer = 0;
        st.duration = 20 + rng() * 20;
        st.lastZSpawn = -10;
        st.zGlyphs = [];
        try { if (typeof root().cue === 'function') root().cue('catnap'); } catch (e) {}
      } else if (dl < 0.25) {
        st.state = 'stargazing';
        st.timer = 0;
        st.duration = 3 + rng() * 4;
        st.starGlint = { age: 0, life: st.duration };
        try { if (typeof root().cue === 'function') root().cue('stargaze'); } catch (e) {}
      }
      if (st.state === 'idle') {
        st.nextCheck = 40 + rng() * 50;
      }
    }
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const cat = getCat();
  const pos = catScreenPos(cat, Vv);
  if (!pos) return;

  if (st.state === 'napping') {
    const age = st.timer;
    const life = st.duration;
    const ratio = age / life;
    const pulse = 0.5 + 0.5 * Math.sin(age * 2);
    const radius = 22 + 8 * pulse;
    const alpha = 0.15 * (0.6 + 0.4 * ratio);
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(pos.x, pos.y + 6, 1, pos.x, pos.y + 6, radius);
    grad.addColorStop(0, 'rgba(255,200,80,0.45)');
    grad.addColorStop(0.5, 'rgba(255,170,40,0.20)');
    grad.addColorStop(1, 'rgba(255,140,20,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + 6, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#e8e6df';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < st.zGlyphs.length; i++) {
      const z = st.zGlyphs[i];
      const lifeRatio = Math.max(0, 1 - (z.age / z.life));
      ctx.globalAlpha = lifeRatio;
      ctx.fillText('z', Math.round(z.x), Math.round(z.y));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (st.state === 'stargazing') {
    const age = st.timer;
    const life = st.duration;
    const ratio = age / life;
    const pulse = 0.5 + 0.5 * Math.sin(age * 4);
    ctx.save();
    ctx.globalAlpha = 0.7 * pulse;
    ctx.fillStyle = '#e8e6df';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function probe() {
  const st = getState();
  if (!st) return { state: 'absent' };
  return { state: st.state };
}

if (typeof window !== 'undefined') {
  if (!window.GuildCatnaps) window.GuildCatnaps = createState();
  window.GuildCatnaps.update = update;
  window.GuildCatnaps.draw = draw;
  window.GuildCatnaps.__probe = probe;
  window.GuildCatnaps.__rawUpdate = update;
}

export {};
