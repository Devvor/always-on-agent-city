const GM = (typeof window !== 'undefined')
  ? (window.GuildMist = window.GuildMist || { wisps: [], _lastTime: null, _spawnTimer: 2, _wasActive: false, _lastUpdateNow: 0, _lastBackdropNow: 0 })
  : { wisps: [], _lastTime: null, _spawnTimer: 2, _wasActive: false, _lastUpdateNow: 0, _lastBackdropNow: 0 };

if (!Array.isArray(GM.wisps)) GM.wisps = [];

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
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function isActive(Vv) {
  if (!Vv) return false;
  const dusk = Vv.daylight >= 0.2 && Vv.daylight <= 0.45;
  const rain = Vv.weather === 'RAIN';
  return dusk || rain;
}

function clampSpawnPoint(pt, canvas, tileW, tileH) {
  const mx = (tileW || 70) * 2;
  const my = (tileH || 35) * 2;
  return {
    x: clamp(pt.x, mx, (canvas ? canvas.width : 960) - mx),
    y: clamp(pt.y, my, (canvas ? canvas.height : 640) - my)
  };
}

function spawnWisp(Vv) {
  if (!Vv || GM.wisps.length >= 8) return;
  const canvas = Vv.canvas;
  const g = Vv.grid || {};
  const gx = 2 + Math.random() * 2;
  const gy = Math.max(1.5, (typeof Vv.growthStep === 'number' ? Vv.growthStep : 0) + 1.5);
  const pt = isoFn(gx, gy);
  const p = clampSpawnPoint(pt, canvas, g.tileW, g.tileH);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const wisp = {
    x: p.x,
    y: p.y,
    baseY: p.y,
    vx: dir * (5 + Math.random() * 2),
    bobAmp: 2 + Math.random() * 2,
    bobPhase: Math.random() * Math.PI * 2,
    life: 6 + Math.random() * 3,
    age: 0,
    peakAlpha: 0.10 + Math.random() * 0.06,
    rx: 16 + Math.random() * 12,
    ry: 6 + Math.random() * 6,
    fadeIn: 0.9,
    fadeOut: 1.2,
    forcedFade: false
  };
  GM.wisps.push(wisp);
}

function envelope(w) {
  if (!w) return 0;
  const t = w.age;
  const life = w.life;
  let a = 1;
  if (t < w.fadeIn) a = t / w.fadeIn;
  if (t > life - w.fadeOut) a = Math.min(a, (life - t) / w.fadeOut);
  a = clamp(a, 0, 1);
  return w.peakAlpha * a;
}

function updateWisps(dt, active, canvas, tileW, tileH) {
  const mx = (tileW || 70) * 2;
  const my = (tileH || 35) * 2;
  const w = (canvas && canvas.width) ? canvas.width : 960;
  const h = (canvas && canvas.height) ? canvas.height : 640;
  const next = [];
  for (let i = 0; i < GM.wisps.length; i++) {
    const p = GM.wisps[i];
    p.age += dt;
    if (!active) {
      if (!p.forcedFade) {
        p.forcedFade = true;
        p.life = Math.min(p.life, p.age + 1.5);
      }
    } else if (p.forcedFade) {
      p.forcedFade = false;
      p.life = Math.max(p.life, p.age + 3);
    }
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    if (p.x < mx) { p.x = mx; p.vx = Math.abs(p.vx); }
    if (p.x > w - mx) { p.x = w - mx; p.vx = -Math.abs(p.vx); }
    p.y = p.baseY + Math.sin(p.age * 0.7 + p.bobPhase) * p.bobAmp;
    if (p.y < my) p.y = my;
    if (p.y > h - my) p.y = h - my;
    next.push(p);
  }
  GM.wisps = next;
}

function renderWisps(ctx) {
  if (!ctx) return;
  for (let i = 0; i < GM.wisps.length; i++) {
    const w = GM.wisps[i];
    const a = envelope(w);
    if (a <= 0.001) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    if (typeof ctx.ellipse === 'function') {
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(Math.round(w.x - w.rx), Math.round(w.y - w.ry), Math.round(w.rx * 2), Math.round(w.ry * 2));
    }
    ctx.restore();
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  GM._lastUpdateNow = now;
  const v = getV();
  if (GM._lastTime === null) GM._lastTime = now;
  let dt = (now - GM._lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  GM._lastTime = now;

  const active = v ? isActive(v) : false;
  const gamePlay = !!(v && v.gameState === 'play');
  const shouldSpawn = active && gamePlay;

  if (shouldSpawn) {
    if (!GM._wasActive) GM._spawnTimer = 2 + Math.random() * 2;
    GM._spawnTimer -= dt;
    while (GM._spawnTimer <= 0 && GM.wisps.length < 8) {
      spawnWisp(v);
      GM._spawnTimer += 2 + Math.random() * 2;
    }
  } else {
    GM._spawnTimer = 2 + Math.random() * 2;
  }
  GM._wasActive = shouldSpawn;

  const canvas = v ? v.canvas : null;
  const g = v ? v.grid : null;
  updateWisps(dt, active, canvas, g ? g.tileW : 70, g ? g.tileH : 35);
}

function draw(ctx) {
  if (!ctx) return;
  const now = (arguments.length > 1 && typeof arguments[1] === 'number') ? arguments[1] : (GM._lastUpdateNow || nowFn());
  if (GM._lastBackdropNow === now) return;
  renderWisps(ctx);
}

function drawBackdrop(ctx, now) {
  if (!ctx) return;
  const t = (typeof now === 'number') ? now : nowFn();
  GM._lastBackdropNow = t;
  renderWisps(ctx);
}

if (typeof window !== 'undefined') {
  GM.update = update;
  GM.draw = draw;
  GM.drawBackdrop = drawBackdrop;
  GM.__probe = function () { return { wisps: GM.wisps.length }; };
  window.GuildMist = GM;
}

export {};
