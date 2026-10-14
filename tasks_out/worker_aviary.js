# worker_aviary.js — LIVING FAUNA in the sky and garden
const BUILDINGS = [{ gx: -2, gy: 0 }, { gx: 0, gy: -2 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 }];

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
function getState() { const w = root(); return w && w.GuildAviary; }
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}
function rand() { return seeded(nowFn() * 0.001 + Math.random() * 1000); }

function createBird(index) {
  return {
    index: index,
    orbit: index % 3,
    angle: seeded(index * 13.7) * Math.PI * 2,
    speed: 0.18 + seeded(index * 7.3) * 0.12,
    radius: 110 + seeded(index * 5.1) * 40,
    height: 60 + seeded(index * 9.2) * 30,
    state: 'orbit',
    target: null,
    landTimer: 0,
    flapPhase: seeded(index * 11.1) * Math.PI * 2,
    color: '#1e293b'
  };
}

function createButterfly(index) {
  return {
    index: index,
    gx: 2 + seeded(index * 17.1) * 3,
    gy: 1 + seeded(index * 19.3) * 2,
    angle: seeded(index * 23.7) * Math.PI * 2,
    speed: 0.04 + seeded(index * 13.9) * 0.03,
    radius: 24 + seeded(index * 11.5) * 16,
    flapPhase: seeded(index * 29.1) * Math.PI * 2,
    pauseTimer: 0,
    color: index === 0 ? '#f9a8d4' : (index === 1 ? '#fcd34d' : '#a5b4fc')
  };
}

function createOwl() {
  return {
    gx: -2,
    gy: 0,
    blinkTimer: 0,
    eyeOpen: true
  };
}

function initState() {
  return {
    birds: [createBird(0), createBird(1), createBird(2)],
    butterflies: [createButterfly(0), createButterfly(1), createButterfly(2), createButterfly(3)],
    owl: null,
    lastTime: null
  };
}

function getIslandCenter(Vv) {
  if (!Vv || !Vv.grid) return { x: 480, y: 340 };
  const g = Vv.grid;
  const c = Vv.canvas || { width: 960, height: 640 };
  const center = isoFn(0, 0);
  return { x: center.x, y: center.y, g: g, c: c };
}

function getBuildingRoof(Vv, index) {
  if (!Vv || !Vv.grid) return null;
  const b = BUILDINGS[index];
  if (!b) return null;
  const pt = isoFn(b.gx, b.gy);
  return { x: pt.x, y: pt.y - 8 };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    st && (st.lastTime = now);
    return;
  }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const isRain = Vv.weather === 'RAIN';
  const isNight = (typeof Vv.daylight === 'number') && Vv.daylight < 0.3;

  // OWL
  if (isNight && !isRain) {
    if (!st.owl) st.owl = createOwl();
  } else {
    st.owl = null;
  }
  if (st.owl) {
    st.owl.blinkTimer -= dt;
    if (st.owl.blinkTimer <= 0) {
      st.owl.eyeOpen = !st.owl.eyeOpen;
      st.owl.blinkTimer = 3 + seeded(st.owl.gx * 100 + st.owl.gy * 50) * 2;
    }
  }

  // BUTTERFLIES (hide in rain)
  for (let i = 0; i < st.butterflies.length; i++) {
    const bf = st.butterflies[i];
    if (isRain) {
      bf.pauseTimer = 0;
      continue;
    }
    bf.flapPhase += dt * 4.2;
    if (bf.pauseTimer > 0) {
      bf.pauseTimer -= dt;
      continue;
    }
    bf.angle += dt * bf.speed;
    const px = Math.cos(bf.angle) * bf.radius;
    const py = Math.sin(bf.angle * 0.7) * bf.radius * 0.5;
    bf.gx = 2 + (px / 60) + (bf.index * 0.3);
    bf.gy = 1 + (py / 60) + (bf.index * 0.2);
    if (seeded(now * 0.001 + bf.index * 37) < 0.02) {
      bf.pauseTimer = 1.5 + seeded(bf.index * 41) * 2;
    }
  }

  // BIRDS
  for (let i = 0; i < st.birds.length; i++) {
    const b = st.birds[i];
    b.flapPhase += dt * Math.PI / 0.3;
    if (b.state === 'orbit') {
      b.angle += dt * b.speed * (isRain ? 1.6 : 1);
      if (seeded(now * 0.001 + b.index * 53) < 0.008 * dt * 60 && !isRain) {
        b.state = 'glide';
        b.target = getBuildingRoof(Vv, b.index % BUILDINGS.length);
        if (!b.target) b.state = 'orbit';
      }
    } else if (b.state === 'glide') {
      if (b.target) {
        const center = getIslandCenter(Vv);
        const sx = center.x + Math.cos(b.angle) * b.radius;
        const sy = center.y - b.height;
        const dx = b.target.x - sx;
        const dy = b.target.y - sy;
        const dist = Math.hypot(dx, dy);
        if (dist > 1.5) {
          b.angle += dt * b.speed * 3 * (isRain ? 1.4 : 1);
          b.radius = Math.max(20, b.radius - dist * 0.3);
          b.height = Math.max(10, b.height - dy * 0.2);
        } else {
          b.state = 'landed';
          b.landTimer = 4 + seeded(b.index * 61) * 4;
          b.target = null;
        }
      }
    } else if (b.state === 'landed') {
      b.landTimer -= dt;
      if (b.landTimer <= 0) {
        b.state = 'takeoff';
        b.angle = seeded(b.index * 73) * Math.PI * 2;
        b.radius = 110 + seeded(b.index * 5.1) * 40;
        b.height = 60 + seeded(b.index * 9.2) * 30;
      }
    } else if (b.state === 'takeoff') {
      b.angle += dt * b.speed * 2;
      b.height += dt * 80;
      b.radius += dt * 40;
      if (b.height >= 60 + seeded(b.index * 9.2) * 30) {
        b.state = 'orbit';
        b.height = 60 + seeded(b.index * 9.2) * 30;
        b.radius = 110 + seeded(b.index * 5.1) * 40;
      }
    }
  }
}

function drawBird(ctx, b, Vv, now) {
  if (!ctx || !Vv || !Vv.grid) return;
  const center = getIslandCenter(Vv);
  let x, y;
  if (b.state === 'orbit') {
    x = center.x + Math.cos(b.angle) * b.radius;
    y = center.y - b.height + Math.sin(now * 0.01 + b.index) * 2;
  } else if (b.state === 'glide') {
    const sx = center.x + Math.cos(b.angle) * b.radius;
    const sy = center.y - b.height;
    if (b.target) {
      x = sx + (b.target.x - sx) * 0.5;
      y = sy + (b.target.y - sy) * 0.5;
    } else {
      x = sx; y = sy;
    }
  } else if (b.state === 'landed') {
    if (b.target) {
      x = b.target.x;
      y = b.target.y;
    } else {
      x = center.x + Math.cos(b.angle) * b.radius;
      y = center.y - b.height;
    }
  } else {
    x = center.x + Math.cos(b.angle) * b.radius;
    y = center.y - b.height;
  }

  const flap = Math.sin(b.flapPhase) > 0;
  ctx.fillStyle = b.color;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;

  if (b.state === 'landed') {
    // folded wings, head bob
    const bob = Math.sin(now * 3 + b.index * 1.7) * 0.6;
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y + bob));
    ctx.lineTo(Math.round(x + 3), Math.round(y - 1 + bob));
    ctx.lineTo(Math.round(x + 6), Math.round(y + bob));
    ctx.lineTo(Math.round(x + 3), Math.round(y + 2 + bob));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // head bob
    ctx.fillRect(Math.round(x + 5), Math.round(y - 2 + bob), 1, 1);
  } else {
    // flying with wing flap
    const wingH = flap ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y));
    ctx.lineTo(Math.round(x + 4), Math.round(y - wingH));
    ctx.lineTo(Math.round(x + 8), Math.round(y));
    ctx.lineTo(Math.round(x + 4), Math.round(y + wingH));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.fillRect(Math.round(x + 6), Math.round(y), 2, 2);
  }
}

function drawButterfly(ctx, bf, Vv, now) {
  if (!ctx || !Vv || !Vv.grid) return;
  const pt = isoFn(bf.gx, bf.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const flap = Math.sin(bf.flapPhase) > 0;
  ctx.fillStyle = bf.color;
  ctx.strokeStyle = '#4a203f';
  ctx.lineWidth = 1;
  // body
  ctx.fillRect(x, y, 2, 4);
  // wings
  const wingW = flap ? 3 : 2;
  const wingH = flap ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - wingW, y - wingH);
  ctx.lineTo(x - wingW, y + wingH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 2, y);
  ctx.lineTo(x + 2 + wingW, y - wingH);
  ctx.lineTo(x + 2 + wingW, y + wingH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawOwl(ctx, owl, Vv, now) {
  if (!ctx || !Vv || !Vv.grid) return;
  const pt = isoFn(owl.gx, owl.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  // body
  ctx.fillStyle = '#a16207';
  ctx.strokeStyle = '#7a4a06';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + 5, y + 6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eyes
  const eyeY = y + 3;
  if (owl.eyeOpen) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, eyeY, 2, 3);
    ctx.fillRect(x + 7, eyeY, 2, 3);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + 2, eyeY + 1, 1, 1);
    ctx.fillRect(x + 8, eyeY + 1, 1, 1);
  } else {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + 1, eyeY + 1, 3, 1);
    ctx.fillRect(x + 6, eyeY + 1, 3, 1);
  }
  // beak
  ctx.fillStyle = '#d4a72c';
  ctx.fillRect(x + 4, y + 7, 2, 2);
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  const isRain = Vv.weather === 'RAIN';

  for (let i = 0; i < st.birds.length; i++) {
    drawBird(ctx, st.birds[i], Vv, n);
  }
  if (!isRain) {
    for (let i = 0; i < st.butterflies.length; i++) {
      drawButterfly(ctx, st.butterflies[i], Vv, n);
    }
  }
  if (st.owl) {
    drawOwl(ctx, st.owl, Vv, n);
  }
}

function install() {
  const w = root();
  if (!w) return;
  if (!w.GuildAviary) w.GuildAviary = initState();
  w.GuildAviary.update = update;
  w.GuildAviary.draw = draw;
  w.GuildAviary.__probe = function () {
    const st = getState();
    if (!st) return { birds: 0, landed: 0, butterflies: 0, owl: 0 };
    const landed = st.birds.filter(function (b) { return b.state === 'landed'; }).length;
    const isRain = (getV() && getV().weather === 'RAIN');
    return {
      birds: st.birds.length,
      landed: landed,
      butterflies: isRain ? 0 : st.butterflies.length,
      owl: st.owl ? 1 : 0
    };
  };
}

install();

export {};
