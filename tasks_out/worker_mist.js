function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V ? w.V : null; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try { return w.iso(gx, gy); } catch (e) { return { x: 0, y: 0 }; }
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function nowFn() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildMist ? w.GuildMist : null; }

let lastTime = null;
let spawnTimer = 1.5;
let rngSeed = 987654321;

function rng() {
  rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
  return rngSeed / 4294967296;
}

function isMistActive(Vv) {
  if (!Vv) return false;
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const dusk = dl >= 0.2 && dl <= 0.45;
  const rain = String(Vv.weather || '') === 'RAIN';
  return dusk || rain;
}

function spawnWisp(Vv) {
  const gx = 2 + rng() * 2;
  const gy = 1.5 + rng() * 1.5;
  const pt = isoFn(gx, gy);
  const canvas = Vv && Vv.canvas;
  let x = pt.x;
  let y = pt.y;
  if (canvas && canvas.width) {
    if (x < 10) x = 10;
    if (x > canvas.width - 10) x = canvas.width - 10;
    if (y < 10) y = 10;
    if (y > canvas.height - 10) y = canvas.height - 10;
  }
  return {
    x: x,
    y: y,
    baseY: y,
    vx: (rng() < 0.5 ? -1 : 1) * (4 + rng() * 4),
    phase: rng() * Math.PI * 2,
    bobAmp: 2 + rng() * 3,
    age: 0,
    life: 6 + rng() * 3,
    rx: 22 + rng() * 18,
    ry: 8 + rng() * 5,
    alpha: 0.10 + rng() * 0.06,
    dying: false
  };
}

function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) { lastTime = now; return; }
  if (!Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const active = isMistActive(Vv);

  if (active && st.wisps.length < 8) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      st.wisps.push(spawnWisp(Vv));
      spawnTimer = 2 + rng() * 2;
    }
  } else {
    spawnTimer = Math.max(spawnTimer, 1.0);
  }

  if (!active) {
    for (let i = 0; i < st.wisps.length; i++) st.wisps[i].dying = true;
  }

  const next = [];
  for (let i = 0; i < st.wisps.length; i++) {
    const p = st.wisps[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.baseY += Math.sin(p.phase + p.age * 0.9) * 0.4 * dt * 6;
    p.y = p.baseY + Math.sin(p.phase + p.age * 1.1) * p.bobAmp;
    if (p.dying && p.age < p.life) p.age = Math.min(p.life, p.age + dt * 3);
    if (p.age < p.life) next.push(p);
  }
  st.wisps = next;
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv || Vv.gameState !== 'play') return;
  for (let i = 0; i < st.wisps.length; i++) {
    const p = st.wisps[i];
    let fade = 1;
    if (p.age < 1) fade = p.age;
    const remain = p.life - p.age;
    if (remain < 1) fade = Math.max(0, remain);
    const a = p.alpha * fade;
    if (a <= 0.005) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#dfe9ec';
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(Math.round(p.x - p.rx), Math.round(p.y - p.ry), Math.round(p.rx * 2), Math.round(p.ry * 2));
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildMist) window.GuildMist = { wisps: [] };
  window.GuildMist.update = update;
  window.GuildMist.draw = draw;
  window.GuildMist.__probe = function () { return { wisps: window.GuildMist.wisps.length }; };
  window.GuildMist.__rawUpdate = update;
}

export {};
