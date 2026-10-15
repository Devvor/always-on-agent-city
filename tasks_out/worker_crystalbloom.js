const FLOWER_DEFS = [
  { gx: -5, gy: -4 },
  { gx: -4, gy: -4 },
  { gx: -6, gy: -3 },
  { gx: -5, gy: -3 },
  { gx: -4, gy: -3 }
];

function createState() {
  return {
    gx: -5,
    gy: -3,
    moving: false,
    facing: 'down',
    flowers: FLOWER_DEFS.map(function (f, i) {
      return { gx: f.gx, gy: f.gy, phase: i * 1.37 };
    }),
    blooming: false,
    targetOpen: false,
    prevTargetOpen: false,
    openAmount: 0,
    shiverPhase: 0,
    motes: [],
    moteTimer: 3,
    prevDaylight: null,
    lastTime: null
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
function getState() { const w = root(); return w && w.GuildCrystalbloom; }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) return;
  if (Vv.gameState && Vv.gameState !== 'play') {
    st.lastTime = now;
    return;
  }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 0.5;
  const weather = String(Vv.weather || 'CLEAR');
  const flowers = Array.isArray(st.flowers) ? st.flowers : [];

  let target = false;
  if (weather !== 'SNOW' && weather !== 'RAIN') {
    target = daylight < 0.3;
  }

  if (target && !st.prevTargetOpen) {
    try {
      const w = root();
      if (w && typeof w.cue === 'function') w.cue('chime');
    } catch (e) {}
  }
  st.prevTargetOpen = target;
  st.targetOpen = target;
  st.blooming = target;

  if (weather === 'SNOW') {
    st.openAmount = 0;
  } else if (target) {
    st.openAmount = Math.min(1, (st.openAmount || 0) + dt / 10);
  } else {
    st.openAmount = Math.max(0, (st.openAmount || 0) - dt / 5);
  }
  if (!target && (st.openAmount || 0) <= 0.001) {
    st.openAmount = 0;
    st.blooming = false;
  }

  if (weather === 'RAIN') {
    st.shiverPhase = (st.shiverPhase || 0) + dt * 12;
  } else {
    st.shiverPhase = 0;
  }

  const moteAllowed = target && (st.openAmount || 0) > 0.5 && weather === 'CLEAR' && daylight < 0.3;
  if (moteAllowed) {
    st.moteTimer -= dt;
    if (st.moteTimer <= 0 && st.motes.length < 2 && flowers.length >= 2) {
      let a = Math.floor(Math.random() * flowers.length);
      let b = Math.floor(Math.random() * flowers.length);
      if (b === a) b = (a + 1) % flowers.length;
      st.motes.push({
        gx: flowers[a].gx,
        gy: flowers[a].gy,
        target: b,
        age: 0,
        life: randomBetween(4, 7),
        phase: Math.random() * Math.PI * 2
      });
      st.moteTimer = randomBetween(6, 14);
    }
  }

  const nextMotes = [];
  for (let i = 0; i < st.motes.length; i++) {
    const m = st.motes[i];
    m.age += dt;
    if (m.age >= m.life) continue;
    if (!moteAllowed) continue;
    const targetFlower = flowers[m.target];
    if (targetFlower) {
      const dx = targetFlower.gx - m.gx;
      const dy = targetFlower.gy - m.gy;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.15) {
        m.gx += (dx / dist) * 0.45 * dt;
        m.gy += (dy / dist) * 0.45 * dt;
      } else {
        m.target = (m.target + 1 + Math.floor(Math.random() * Math.max(1, flowers.length - 1))) % flowers.length;
      }
    }
    nextMotes.push(m);
  }
  st.motes = nextMotes;

  st.prevDaylight = daylight;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv) return;
  if (Vv.gameState && Vv.gameState !== 'play') return;

  const now = nowFn();
  const growthStep = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 0.5;
  const weather = String(Vv.weather || 'CLEAR');
  const nightFactor = (typeof Vv.nightFactor === 'number') ? Vv.nightFactor : (1 - daylight);
  const flowers = Array.isArray(st.flowers) ? st.flowers : [];
  const open = (typeof st.openAmount === 'number') ? st.openAmount : 0;
  const motes = Array.isArray(st.motes) ? st.motes : [];

  const moteAllowed = st.targetOpen && open > 0.5 && weather === 'CLEAR' && daylight < 0.3;

  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    const ring = tileRing(f.gx, f.gy);
    if (ring > growthStep) continue;

    const pt = isoFn(f.gx, f.gy);
    const baseX = Math.round(pt.x);
    const baseY = Math.round(pt.y);
    let sx = 0;
    let sy = 0;
    if (weather === 'RAIN') {
      sx = Math.round(Math.sin((st.shiverPhase || 0) + f.phase) * 2);
      sy = Math.round(Math.cos((st.shiverPhase || 0) + f.phase));
    }
    const x = baseX + sx;
    const y = baseY + sy;

    ctx.fillStyle = '#4b321f';
    ctx.fillRect(x - 1, y - 12, 2, 12);

    const closed = weather === 'SNOW' || !st.targetOpen || open <= 0.01;
    if (closed) {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(x - 3, y - 15, 6, 5);
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(x - 2, y - 14, 4, 3);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(x - 1, y - 16, 2, 2);

      if (weather === 'SNOW') {
        const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.005 + f.phase));
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x + 1, y - 17, 1, 1);
        ctx.fillRect(x - 2, y - 15, 1, 1);
        ctx.globalAlpha = 1;
      } else if (daylight < 0.3) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x, y - 16, 1, 1);
        ctx.globalAlpha = 1;
      }
    } else {
      const spread = 3 + open * 4;
      const petalCount = 6;
      for (let p = 0; p < petalCount; p++) {
        const angle = (p / petalCount) * Math.PI * 2 + now * 0.00025;
        const px = x + Math.round(Math.cos(angle) * spread);
        const py = y - 15 + Math.round(Math.sin(angle) * spread * 0.6);
        ctx.fillStyle = '#e8e6df';
        ctx.fillRect(px - 1, py - 1, 2, 2);
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(px, py, 1, 1);
      }
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(x - 2, y - 17, 4, 4);

      if (open > 0.35 && daylight < 0.6) {
        const alpha = (0.06 + 0.08 * nightFactor) * open * (0.78 + 0.22 * Math.sin(now * 0.003 + f.phase));
        ctx.globalAlpha = Math.max(0, Math.min(0.22, alpha));
        ctx.fillStyle = 'rgba(212,175,55,1)';
        ctx.beginPath();
        ctx.arc(x, y - 12, 9 + open * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  if (moteAllowed) {
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      const pt = isoFn(m.gx, m.gy);
      const mx = Math.round(pt.x);
      const my = Math.round(pt.y) - 10;
      const blink = 0.55 + 0.45 * Math.sin(now * 0.01 + m.phase + m.age * 3);
      const lifeRatio = Math.max(0, 1 - (m.age / m.life));
      ctx.globalAlpha = Math.max(0.15, lifeRatio * blink * 0.75);
      ctx.fillStyle = 'rgba(212,175,55,0.75)';
      ctx.fillRect(mx - 2, my - 2, 4, 4);
      ctx.globalAlpha = Math.max(0.25, lifeRatio * blink);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(mx, my, 2, 2);
      ctx.globalAlpha = 1;
    }
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildCrystalbloom) window.GuildCrystalbloom = createState();
  const st = window.GuildCrystalbloom;
  st.update = update;
  st.draw = draw;
  st.__probe = function () { return { blooming: !!st.blooming, flowers: (Array.isArray(st.flowers) ? st.flowers.length : 0) }; };
}

export {};
