function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function getV() {
  const w = root();
  return w && w.V;
}

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

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

function getState() {
  const w = root();
  return w && w.GuildGlowFish;
}

function getAllTasks() {
  const w = root();
  if (!w) return null;
  if (Array.isArray(w.allTasks)) return w.allTasks;
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks;
  return null;
}

function contractOk() {
  const w = root();
  if (!w) return false;
  if (!w.V) return false;
  if (typeof w.iso !== 'function') return false;
  if (typeof w.fitText !== 'function') return false;
  if (!w.GuildVisitor) return false;
  if (typeof w.cue !== 'function') return false;
  if (!Array.isArray(getAllTasks())) return false;
  return true;
}

function clamp(v, a, b) {
  return v < a ? a : (v > b ? b : v);
}

function createState() {
  return {
    fishes: [],
    splashes: [],
    lastTime: null,
    dusk: false,
    spawned: 0,
    budget: 4,
    nextSpawn: 0
  };
}

function isDusk(Vv) {
  if (!Vv || typeof Vv.dayHour !== 'number') return false;
  const h = Vv.dayHour;
  return h >= 17 && h < 19.5;
}

function waterAnchor(Vv) {
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const maxC = 1 + s;
  const water = isoFn(0, maxC);
  return {
    start: { x: water.x - 18, y: water.y - 4 },
    end: { x: water.x + 14, y: water.y + 3 },
    height: 18 + Math.random() * 8
  };
}

function fishPos(f) {
  const t = clamp(f.t, 0, 1);
  return {
    x: f.sx + (f.ex - f.sx) * t,
    y: f.sy + (f.ey - f.sy) * t - f.height * 4 * t * (1 - t)
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) {
    return;
  }
  if (!Vv || !contractOk()) {
    st.lastTime = now;
    return;
  }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  if (Vv.gameState !== 'play') return;

  const duskNow = isDusk(Vv);
  if (duskNow) {
    if (!st.dusk) {
      st.dusk = true;
      st.spawned = 0;
      st.budget = 3 + Math.floor(Math.random() * 3);
      st.nextSpawn = 0.2 + Math.random() * 1.8;
    }
    if (st.spawned < st.budget) {
      st.nextSpawn -= dt;
      if (st.nextSpawn <= 0 && st.fishes.length < 3) {
        const a = waterAnchor(Vv);
        st.fishes.push({
          sx: a.start.x,
          sy: a.start.y,
          ex: a.end.x,
          ey: a.end.y,
          height: a.height,
          dur: 0.75 + Math.random() * 0.4,
          t: 0,
          size: 2
        });
        st.spawned += 1;
        st.nextSpawn = 2.4 + Math.random() * 4.2;
      }
    }
  } else {
    st.dusk = false;
    st.spawned = 0;
    st.fishes = [];
  }

  const alive = [];
  for (let i = 0; i < st.fishes.length; i++) {
    const f = st.fishes[i];
    f.t += dt / (f.dur > 0 ? f.dur : 1);
    if (f.t >= 1) {
      const p = fishPos(f);
      st.splashes.push({
        x: p.x,
        y: p.y,
        age: 0,
        duration: 0.55,
        size: 2.5
      });
    } else {
      alive.push(f);
    }
  }
  st.fishes = alive;

  const splashes = [];
  for (let i = 0; i < st.splashes.length; i++) {
    const sp = st.splashes[i];
    sp.age += dt;
    if (sp.age < sp.duration) splashes.push(sp);
  }
  st.splashes = splashes;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;

  ctx.save();
  try {
    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    ctx.fillStyle = '#facc15';
    for (let i = 0; i < st.fishes.length; i++) {
      const f = st.fishes[i];
      const p = fishPos(f);
      ctx.globalAlpha = 0.95;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), f.size, f.size);
      ctx.globalAlpha = 0.45;
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 1, 1);
    }

    for (let i = 0; i < st.splashes.length; i++) {
      const sp = st.splashes[i];
      const ratio = clamp(sp.age / (sp.duration > 0 ? sp.duration : 1), 0, 1);
      const grow = 1 + ratio * 2.6;
      const size = sp.size * grow;
      const half = size * 0.5;

      ctx.globalAlpha = (1 - ratio) * 0.85;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(
        Math.round(sp.x - half),
        Math.round(sp.y - half),
        Math.round(size),
        Math.round(size)
      );

      const size2 = size * 1.7;
      const half2 = size2 * 0.5;
      ctx.globalAlpha = (1 - ratio) * 0.45;
      ctx.fillRect(
        Math.round(sp.x - half2),
        Math.round(sp.y - half2),
        Math.round(size2),
        Math.round(size2)
      );
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prevComposite;
  } finally {
    ctx.restore();
  }
}

function drawBackdrop(ctx, now) {
  if (ctx) return;
}

function boot() {
  if (typeof window === 'undefined') return;
  if (!contractOk()) return;
  if (window.GuildGlowFish && typeof window.GuildGlowFish.update === 'function') return;

  const instance = createState();
  instance.update = update;
  instance.draw = draw;
  instance.drawBackdrop = drawBackdrop;
  instance.__booted = true;
  window.GuildGlowFish = instance;
}

if (typeof window !== 'undefined') {
  try {
    boot();
  } catch (e) {
  }
}

export {};
