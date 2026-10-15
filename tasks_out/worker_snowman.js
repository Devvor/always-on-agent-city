const ANCHOR_GX = 4.5;
const ANCHOR_GY = -2.0;

let lastTime = null;
let gsPressed = new Set();
let gsPrevPressed = new Set();

function createState() {
  return {
    gx: ANCHOR_GX,
    gy: ANCHOR_GY,
    moving: false,
    facing: 'down',
    stage: 0,
    hatted: false,
    buildProgress: 0,
    meltProgress: 0,
    sparkles: [],
    lastWeather: null
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
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildSnowman; }
function visitorDist(st) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!st || !vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return Infinity;
  return Math.hypot(vis.gx - st.gx, vis.gy - st.gy);
}

function normKey(e) {
  if (!e) return '';
  return String(e.key || '').toLowerCase();
}

function onKeydown(e) {
  const k = normKey(e);
  if (k === 'e') gsPressed.add('e');
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  gsPressed.delete(k);
  gsPrevPressed.delete(k);
}

function rand() { return Math.random(); }

function spawnSparkles(st) {
  const pt = isoFn(st.gx, st.gy);
  const cx = pt.x;
  const cy = pt.y - 34;
  st.sparkles = [];
  for (let i = 0; i < 14; i++) {
    st.sparkles.push({
      x: cx + (rand() - 0.5) * 8,
      y: cy,
      vx: (rand() - 0.5) * 70,
      vy: -35 - rand() * 45,
      age: 0,
      life: 0.75 + rand() * 0.45,
      size: 2
    });
  }
}

function updateSparkles(st, dt) {
  const next = [];
  for (let i = 0; i < st.sparkles.length; i++) {
    const p = st.sparkles[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 48 * dt;
    next.push(p);
  }
  st.sparkles = next;
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

  const weather = (Vv.weather == null) ? 'CLEAR' : String(Vv.weather).toUpperCase();

  let idleWorkers = 0;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : null;
  if (ws) {
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (!w) continue;
      if (w.workerState === 'IDLE' || w.mode === 'idle') idleWorkers++;
    }
  }
  const buildSpeed = (ws && ws.length > 0) ? (idleWorkers >= 2 ? 1 : 0.25) : 1;

  if (weather === 'SNOW') {
    if (st.stage < 3) {
      st.buildProgress += dt * buildSpeed;
      while (st.stage < 3 && st.buildProgress >= 60) {
        st.stage++;
        st.buildProgress -= 60;
      }
      if (st.stage >= 3) {
        st.stage = 3;
        st.buildProgress = 0;
      }
    }
    st.meltProgress = 0;
  } else {
    st.buildProgress = 0;
    if (st.hatted) {
      st.hatted = false;
      st.stage = 0;
      st.meltProgress = 0;
    } else if (st.stage > 0) {
      st.meltProgress += dt;
      while (st.stage > 0 && st.meltProgress >= 60) {
        st.stage--;
        st.meltProgress -= 60;
      }
      if (st.stage === 0) st.meltProgress = 0;
    }
  }
  st.lastWeather = weather;

  updateSparkles(st, dt);

  const eNow = gsPressed.has('e');
  const eWas = gsPrevPressed.has('e');
  if (!st.hatted && st.stage === 3 && eNow && !eWas && visitorDist(st) <= 1.5) {
    st.hatted = true;
    spawnSparkles(st);
    const w = root();
    try {
      if (w && typeof w.cue === 'function') w.cue('hat');
    } catch (e) {}
  }

  gsPrevPressed = new Set(gsPressed);
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const pt = isoFn(st.gx, st.gy);
  if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const now = nowFn();

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 15, y + 15, 30, 5);

  if (st.stage >= 1) {
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(x - 15, y - 4, 30, 15);
    ctx.fillRect(x - 10, y - 11, 20, 8);
  }
  if (st.stage >= 2) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 11, y - 19, 22, 10);
    ctx.fillRect(x - 7, y - 25, 14, 7);
  }
  if (st.stage >= 3) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 6, y - 31, 12, 7);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x - 4, y - 29, 2, 2);
    ctx.fillRect(x + 2, y - 29, 2, 2);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(x + 4, y - 28, 3, 2);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x - 3, y - 25, 2, 2);
    ctx.fillRect(x - 1, y - 23, 2, 2);
    ctx.fillRect(x + 2, y - 25, 2, 2);

    if (st.hatted) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(x - 8, y - 33, 16, 3);
      ctx.fillRect(x - 6, y - 40, 12, 8);
    }
  }

  for (let i = 0; i < st.sparkles.length; i++) {
    const p = st.sparkles[i];
    const a = Math.max(0, 1 - p.age / p.life);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  if (st.stage === 3 && !st.hatted && visitorDist(st) <= 1.5) {
    const text = fitFn('E: top the hat', 100);
    const bw = 104;
    const bh = 18;
    const bx = x - Math.round(bw * 0.5);
    const by = y - 58;
    ctx.fillStyle = 'rgba(10,10,12,0.90)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + bh * 0.5 + 1);
    ctx.textAlign = 'left';
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildSnowman) window.GuildSnowman = createState();
  window.GuildSnowman.update = update;
  window.GuildSnowman.draw = draw;
  window.GuildSnowman.__probe = function () {
    const st = getState();
    return { stage: st ? st.stage : 0, hatted: !!(st && st.hatted) };
  };

  if (!window.__gsListeners) {
    window.__gsListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
