function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function createState() {
  return { isles: [], clouds: [], stars: [], nextStar: 0, lastNow: 0, _w: null, _h: null };
}

function ensureSky(sky) {
  if (!sky || typeof sky !== 'object') return null;
  if (!Array.isArray(sky.isles)) sky.isles = [];
  if (!Array.isArray(sky.clouds)) sky.clouds = [];
  if (!Array.isArray(sky.stars)) sky.stars = [];
  if (typeof sky.nextStar !== 'number') sky.nextStar = 0;
  if (typeof sky.lastNow !== 'number') sky.lastNow = 0;
  if (typeof sky._w !== 'number') sky._w = null;
  if (typeof sky._h !== 'number') sky._h = null;
  return sky;
}

function getState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildSky) w.GuildSky = createState();
  const sky = ensureSky(w.GuildSky);
  if (sky && sky.isles.length === 0 && sky.clouds.length === 0) {
    initArrays(sky, { width: 960, height: 640 });
  }
  return sky;
}

function inferCanvas(ctx, Vv) {
  if (ctx && ctx.canvas) return ctx.canvas;
  if (Vv && Vv.canvas) return Vv.canvas;
  return null;
}

function makeIsle(c, seed, speed, baseYFrac, waterfall, w, h) {
  const trees = [];
  const step = Math.max(4, Math.round(w / 4));
  for (let t = 4; t < w - 2; t += step) trees.push(t);
  return {
    x: 0,
    speedPxMin: speed,
    baseYFrac: baseYFrac,
    phase: Math.random() * Math.PI * 2,
    seed: seed,
    waterfall: !!waterfall,
    trees: trees,
    w: w,
    h: h
  };
}

function makeClouds(c) {
  const out = [];
  const xs = [0.08, 0.38, 0.66, 0.86];
  const speeds = [10, 16, 12, 20];
  const yFracs = [0.70, 0.77, 0.72, 0.80];
  for (let i = 0; i < 4; i++) {
    out.push({
      x: Math.round(c.width * xs[i]),
      speedPxMin: speeds[i],
      yFrac: yFracs[i],
      r: 24 + i * 5,
      phase: Math.random() * Math.PI * 2,
      seed: i
    });
  }
  return out;
}

function initArrays(sky, c) {
  if (!sky) return;
  c = c || { width: 960, height: 640 };
  if (!Array.isArray(sky.isles) || sky.isles.length !== 2) {
    sky.isles = [
      makeIsle(c, 0, 8, 0.20, true, 58, 13),
      makeIsle(c, 1, 14, 0.15, false, 40, 10)
    ];
    sky.isles[0].x = Math.round(c.width * 0.12);
    sky.isles[1].x = Math.round(c.width * 0.60);
  }
  if (!Array.isArray(sky.clouds) || sky.clouds.length !== 4) {
    sky.clouds = makeClouds(c);
  }
  sky._w = c.width;
  sky._h = c.height;
}

function prepareSky(sky, c) {
  if (!sky) return;
  c = c || { width: 960, height: 640 };
  if (typeof sky._w !== 'number' || sky._w == null) {
    initArrays(sky, c);
    return;
  }
  if (sky._w !== c.width && sky.isles.length === 2) {
    const s = c.width / sky._w;
    for (let i = 0; i < sky.isles.length; i++) sky.isles[i].x = Math.round(sky.isles[i].x * s);
    for (let i = 0; i < sky.clouds.length; i++) sky.clouds[i].x = Math.round(sky.clouds[i].x * s);
    sky._w = c.width;
  }
  if (sky.isles.length !== 2 || sky.clouds.length !== 4) initArrays(sky, c);
  sky._h = c.height;
}

function spawnShootingStar(sky, c, now) {
  if (!sky || !c) return;
  const dist = 140 + Math.random() * 80;
  const angle = Math.PI + (Math.random() * 0.5 - 0.25);
  const maxStartY = Math.max(60, Math.round(c.height * 0.30));
  const startX = 80 + Math.random() * Math.max(120, c.width - 200);
  const startY = 28 + Math.random() * Math.max(20, maxStartY - 28);
  const twNum = 2 + Math.floor(Math.random() * 2);
  const twinkles = [];
  for (let i = 0; i < twNum; i++) {
    twinkles.push({
      x: Math.round(startX + (Math.random() - 0.5) * 70),
      y: Math.round(startY + (Math.random() - 0.5) * 50),
      phase: Math.random() * Math.PI * 2
    });
  }
  sky.stars.push({
    startX: startX,
    startY: startY,
    dist: dist,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    age: 0,
    life: 0.7,
    twinkles: twinkles
  });
}

function update(now) {
  try {
    if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
    const Vv = getV();
    const sky = getState();
    if (!sky) return;

    const c = inferCanvas(null, Vv) || { width: 960, height: 640 };
    prepareSky(sky, c);

    const weather = (Vv && Vv.weather) ? String(Vv.weather) : 'CLEAR';
    const daylight = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;

    let dt = 0;
    if (sky.lastNow) {
      dt = (now - sky.lastNow) / 1000;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.12) dt = 0.12;
    }
    sky.lastNow = now;

    for (let i = 0; i < sky.isles.length; i++) {
      const isle = sky.isles[i];
      const span = c.width + isle.w + 160;
      isle.x -= (isle.speedPxMin / 60) * dt;
      if (isle.x + isle.w < -80) isle.x += span;
    }
    for (let i = 0; i < sky.clouds.length; i++) {
      const cloud = sky.clouds[i];
      const span = c.width + cloud.r * 4 + 200;
      cloud.x -= (cloud.speedPxMin / 60) * dt;
      if (cloud.x + cloud.r * 2 < -100) cloud.x += span;
    }

    if (weather === 'RAIN') {
      sky.stars = [];
      sky.nextStar = 0;
    } else if (daylight < 0.25) {
      if (!sky.nextStar || sky.nextStar <= 0) {
        sky.nextStar = now + 6000 + Math.random() * 8000;
      }
      if (now >= sky.nextStar) {
        spawnShootingStar(sky, c, now);
        sky.nextStar = now + 6000 + Math.random() * 8000;
      }
    } else {
      sky.nextStar = 0;
    }

    const alive = [];
    for (let i = 0; i < sky.stars.length; i++) {
      const star = sky.stars[i];
      star.age += dt;
      if (star.age < star.life) alive.push(star);
    }
    sky.stars = alive;
  } catch (e) { }
}

function drawOneIsle(ctx, isle, c, rain, now) {
  const bob = Math.sin(now * 0.0007 + isle.seed * 2.3) * 3.5;
  const x = Math.round(isle.x);
  const y = Math.round(c.height * isle.baseYFrac + bob);
  const w = isle.w;
  const h = isle.h;
  const top = rain ? '#0f172a' : '#1e293b';
  const under = rain ? '#020617' : '#0f172a';

  ctx.fillStyle = under;
  ctx.fillRect(x + 2, y + h, w - 4, Math.max(2, Math.round(h * 0.55)));
  ctx.fillRect(x + 5, y + h + Math.round(h * 0.55), Math.max(2, w - 10), 2);

  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, h);

  ctx.globalAlpha = 0.45;
  ctx.fillStyle = rain ? '#0b1220' : '#334155';
  for (let d = 0; d < 7; d++) {
    ctx.fillRect(x + (d * 7) % Math.max(1, w - 1), y + (d * 3) % Math.max(1, h - 1), 1, 1);
  }
  ctx.globalAlpha = 1;

  const treeColor = rain ? '#052e16' : '#166534';
  ctx.fillStyle = treeColor;
  for (let t = 0; t < isle.trees.length; t++) {
    const tx = x + isle.trees[t];
    ctx.fillRect(tx, y - 5, 2, 5);
    ctx.fillRect(tx - 1, y - 7, 4, 2);
  }

  if (isle.waterfall) {
    const wx = x + Math.round(w * 0.35);
    for (let k = 0; k < 18; k++) {
      ctx.globalAlpha = Math.max(0, 0.65 * (1 - k / 20));
      ctx.fillStyle = 'rgba(191,219,254,0.9)';
      ctx.fillRect(wx, y + h + 1 + k, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawCloud(ctx, cloud, c, now) {
  const bob = Math.sin(now * 0.0005 + cloud.phase) * 2;
  const x = Math.round(cloud.x);
  const y = Math.round(c.height * cloud.yFrac + bob);
  const r = cloud.r;

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#94a3b8';
  if (ctx.ellipse) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - Math.round(r * 1.15), y - Math.round(r * 0.55), Math.round(r * 2.3), Math.round(r * 1.1));
  }

  ctx.fillStyle = '#cbd5e1';
  if (ctx.ellipse) {
    ctx.beginPath();
    ctx.ellipse(x + Math.round(r * 0.22), y - Math.round(r * 0.18), r * 0.82, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(x + Math.round(r * 0.38), y - Math.round(r * 0.28), r * 0.30, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - Math.round(r * 0.6), y - Math.round(r * 0.55), Math.round(r * 1.6), Math.round(r * 0.85));
  }
  ctx.globalAlpha = 1;
}

function drawShootingStars(ctx, sky, now) {
  for (let i = 0; i < sky.stars.length; i++) {
    const star = sky.stars[i];
    const progress = Math.max(0, Math.min(1, star.age / star.life));
    if (progress >= 1) continue;
    const headDist = star.dist * progress;
    const hx = star.startX + star.cos * headDist;
    const hy = star.startY + star.sin * headDist;

    for (let k = 0; k < 14; k++) {
      const d = headDist - k * 4.5;
      if (d < 0) continue;
      const px = star.startX + star.cos * d;
      const py = star.startY + star.sin * d;
      const alpha = Math.max(0, (1 - k / 14) * (1 - progress * 0.35));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(hx), Math.round(hy), 2, 2);
    ctx.fillRect(Math.round(hx - star.cos * 2), Math.round(hy - star.sin * 2), 2, 2);

    for (let t = 0; t < star.twinkles.length; t++) {
      const tw = star.twinkles[t];
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(now * 0.009 + tw.phase + progress * 6));
      ctx.globalAlpha = Math.max(0, pulse * (1 - progress * 0.3));
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(Math.round(tw.x), Math.round(tw.y), 1, 1);
      ctx.fillRect(Math.round(tw.x + 1), Math.round(tw.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

function drawBackdrop(ctx, now) {
  try {
    if (!ctx) return;
    const Vv = getV();
    const sky = getState();
    if (!sky) return;

    const c = inferCanvas(ctx, Vv) || { width: 960, height: 640 };
    prepareSky(sky, c);

    if (typeof now !== 'number' || !isFinite(now)) {
      now = (Vv && typeof Vv.nowTime === 'number') ? Vv.nowTime : nowFn();
    }

    const weather = (Vv && Vv.weather) ? String(Vv.weather) : 'CLEAR';
    const daylight = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;
    const rain = weather === 'RAIN';
    const deep = daylight < 0.25;

    ctx.save();

    for (let i = 0; i < sky.clouds.length; i++) {
      drawCloud(ctx, sky.clouds[i], c, now);
    }
    for (let i = 0; i < sky.isles.length; i++) {
      drawOneIsle(ctx, sky.isles[i], c, rain, now);
    }
    if (deep && !rain) {
      drawShootingStars(ctx, sky, now);
    }

    ctx.restore();
  } catch (e) { }
}

function draw(ctx) {
  // Tiny/no regular foreground pass; backdrop holds the scenery.
}

if (typeof window !== 'undefined') {
  if (!window.GuildSky) window.GuildSky = createState();
  const g = ensureSky(window.GuildSky);
  if (g && g.isles.length === 0 && g.clouds.length === 0) {
    initArrays(g, { width: 960, height: 640 });
  }
  g.update = update;
  g.draw = draw;
  g.drawBackdrop = drawBackdrop;
  g.__probe = function () {
    const s = ensureSky(getState());
    if (s && s.isles.length === 0 && s.clouds.length === 0) {
      initArrays(s, { width: 960, height: 640 });
    }
    return {
      isles: (s && Array.isArray(s.isles)) ? s.isles.length : 0,
      clouds: (s && Array.isArray(s.clouds)) ? s.clouds.length : 0,
      stars: (s && Array.isArray(s.stars)) ? s.stars.length : 0
    };
  };
}

export {};
