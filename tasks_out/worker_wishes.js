let pressedSet = new Set();
let lastTime = null;
let lastE = false;
let particles = [];
let texts = [];
let flare = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildWishes) w.GuildWishes = createState();
  return ensureState(w.GuildWishes);
}
function createState() { return { stars: [], nextAt: 0, wish: null }; }
function ensureState(s) {
  if (!s || typeof s !== 'object') return null;
  if (!Array.isArray(s.stars)) s.stars = [];
  if (typeof s.nextAt !== 'number') s.nextAt = 0;
  return s;
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
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getGuildPurpose() { const w = root(); return w && w.GuildPurpose; }
function canvasOf(ctx) { return (ctx && ctx.canvas && ctx.canvas.width) ? ctx.canvas : null; }
function canvas() {
  const Vv = getV();
  if (Vv && Vv.canvas && Vv.canvas.width) return Vv.canvas;
  return { width: 960, height: 640 };
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function starPos(star, now) {
  const age = now - star.t0;
  const p = clamp(age / star.duration, 0, 1);
  return {
    x: star.x0 + (star.x1 - star.x0) * p,
    y: star.y0 + (star.y1 - star.y0) * p
  };
}
function screenToWorld(sx, sy) {
  const Vv = getV();
  const c = canvas();
  const w = c.width || 960;
  const h = c.height || 640;
  const cam = (Vv && Vv.camera) ? Vv.camera : {};
  const z = (typeof cam.zoom === 'number' && Math.abs(cam.zoom) > 0.0001) ? cam.zoom : 1;
  const panX = (typeof cam.x === 'number') ? cam.x : 0;
  const panY = (typeof cam.y === 'number') ? cam.y : 0;
  return {
    x: (sx - (z - 1) * (w * 0.5) - panX) / z,
    y: (sy - (z - 1) * (h * 0.5) - panY) / z
  };
}
function randomInterval() { return (180000 + Math.random() * 120000); }
function spawnStar(now) {
  const c = canvas();
  const w = c.width || 960;
  const h = c.height || 640;
  const state = getState();
  if (!state) return;
  state.stars.push({
    t0: now,
    duration: 2500,
    x0: -30,
    y0: Math.round(h * 0.12 + Math.random() * h * 0.12),
    x1: Math.round(w * 0.55 + Math.random() * w * 0.10),
    y1: Math.round(h * 0.22 + Math.random() * h * 0.15),
    trail: 7
  });
}
function campfirePos() {
  const base = isoFn(0, -1);
  return { x: base.x + 12, y: base.y + 22 };
}
function collectPressed() {
  const out = new Set(pressedSet);
  const vis = getVisitor();
  if (vis) {
    const candidates = [vis.pressed, vis.__keys, vis.keys, vis.keyState];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c instanceof Set) {
        for (const k of c) out.add(k);
      } else if (Array.isArray(c)) {
        for (let j = 0; j < c.length; j++) out.add(c[j]);
      } else if (c && typeof c === 'object') {
        if (c.e === true || c.E === true) out.add('e');
        if (c.space === true || c[' '] === true) out.add(' ');
      }
    }
    if (vis.ePressed === true || vis.e === true) out.add('e');
  }
  return out;
}
function makeWish(now, star, vis) {
  const state = getState();
  if (!state) return;
  try {
    state.wish = { t0: now };
    const pos = starPos(star, now);
    const center = screenToWorld(pos.x, pos.y);
    const c = canvas();
    let vx = c.width * 0.5;
    let vy = c.height * 0.55;
    if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
      const p = isoFn(vis.gx, vis.gy);
      vx = p.x;
      vy = p.y;
    }
    for (let i = 0; i < 10; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const angle = Math.atan2(vy - center.y, vx - center.x) + spread;
      const speed = 80 + Math.random() * 60;
      particles.push({
        x: center.x + (Math.random() - 0.5) * 6,
        y: center.y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.5 + Math.random() * 0.8,
        age: 0,
        size: (Math.random() < 0.5) ? 1 : 2,
        color: (Math.random() < 0.5) ? '#fde68a' : '#fef9c3'
      });
    }
    texts.push({ x: vx, y: vy - 20, vy: -32, t0: now, duration: 2, text: '+1 REP' });
    flare = { t0: now, duration: 10 };
    try {
      const gp = getGuildPurpose();
      if (gp && typeof gp.rep === 'number' && isFinite(gp.rep)) gp.rep += 1;
    } catch (e) {}
    try {
      const w = root();
      if (w && typeof w.cue === 'function') w.cue('grow');
    } catch (e) {}
  } catch (e) {}
}
function update(now) {
  try {
    const state = getState();
    if (!state) return;
    if (typeof now !== 'number') now = nowFn();
    if (lastTime === null) lastTime = now;
    let dt = (now - lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    lastTime = now;

    if (!isFinite(state.nextAt) || state.nextAt <= 0) state.nextAt = now + randomInterval();
    if (now >= state.nextAt) {
      spawnStar(now);
      state.nextAt = now + randomInterval();
    }

    const survivors = [];
    const active = [];
    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const age = now - s.t0;
      if (age < -1000) { survivors.push(s); continue; }
      if (age < s.duration) {
        survivors.push(s);
        if (age >= 0) active.push(s);
      }
    }
    state.stars = survivors;

    const pressedNow = collectPressed();
    const eNow = pressedNow.has('e') || pressedNow.has('E') || pressedNow.has(' ') || pressedNow.has('space');
    const edge = eNow && !lastE;
    lastE = eNow;

    const vis = getVisitor();
    if (active.length && edge && state.wish == null) {
      makeWish(now, active[active.length - 1], vis);
    }

    const nextParticles = [];
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.vx *= 0.98;
      nextParticles.push(p);
    }
    particles = nextParticles;

    const nextTexts = [];
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const age = (now - t.t0) / 1000;
      if (age < 0 || age >= t.duration) continue;
      t.y += t.vy * dt;
      nextTexts.push(t);
    }
    texts = nextTexts;

    if (state.wish) {
      if ((now - state.wish.t0) / 1000 >= 2) state.wish = null;
    }
    if (flare) {
      if ((now - flare.t0) / 1000 >= flare.duration) flare = null;
    }
  } catch (e) {}
}
function draw(ctx) {
  try {
    const state = getState();
    if (!state || !ctx) return;
    const Vv = getV();
    const now = (Vv && isFinite(Vv.nowTime)) ? Vv.nowTime : nowFn();
    const c = canvasOf(ctx) || canvas();

    for (let i = 0; i < state.stars.length; i++) {
      const star = state.stars[i];
      const age = now - star.t0;
      if (!isFinite(age) || age < 0 || age >= star.duration) continue;
      const head = starPos(star, now);
      const hw = screenToWorld(head.x, head.y);
      const tr = (typeof star.trail === 'number') ? star.trail : 7;
      for (let j = 1; j <= tr; j++) {
        const ppAge = age / star.duration - (j * 0.06);
        if (ppAge < 0) continue;
        const pp = clamp(ppAge, 0, 1);
        const tx = star.x0 + (star.x1 - star.x0) * pp;
        const ty = star.y0 + (star.y1 - star.y0) * pp;
        const tw = screenToWorld(tx, ty);
        ctx.globalAlpha = Math.max(0, (1 - j / (tr + 1)) * 0.65);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(Math.round(tw.x), Math.round(tw.y), 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(Math.round(hw.x) - 1, Math.round(hw.y) - 1, 3, 3);
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const lifeRatio = (p.life > 0) ? Math.max(0, 1 - (p.age / p.life)) : 0;
      if (lifeRatio <= 0) continue;
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color || '#fde68a';
      const sz = p.size || 1;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }

    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      const age = (now - t.t0) / 1000;
      if (age < 0 || age >= t.duration) continue;
      const a = Math.max(0, 1 - (age / t.duration));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn(t.text, 80), Math.round(t.x), Math.round(t.y));
    }

    if (flare) {
      const age = (now - flare.t0) / 1000;
      if (age >= 0 && age < flare.duration) {
        const intensity = Math.max(0, 1 - (age / flare.duration));
        const pulse = 0.5 + 0.5 * Math.sin(age * 3.2);
        const radius = 44 + pulse * 26;
        const cp = campfirePos();
        if (typeof ctx.createRadialGradient === 'function') {
          const grad = ctx.createRadialGradient(cp.x, cp.y, 2, cp.x, cp.y, radius);
          grad.addColorStop(0, 'rgba(255,190,90,' + (0.55 * intensity) + ')');
          grad.addColorStop(0.45, 'rgba(255,130,40,' + (0.22 * intensity) + ')');
          grad.addColorStop(1, 'rgba(255,90,20,0)');
          ctx.fillStyle = grad;
          if (typeof ctx.beginPath === 'function') {
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, radius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(cp.x - radius, cp.y - radius, radius * 2, radius * 2);
          }
        } else {
          ctx.globalAlpha = 0.25 * intensity;
          ctx.fillStyle = '#ff9a3c';
          ctx.fillRect(cp.x - radius, cp.y - radius, radius * 2, radius * 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  } catch (e) {}
}
function probe() {
  const state = getState();
  if (!state) return { stars: 0, wish: false };
  return { stars: state.stars.length, wish: !!state.wish };
}
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressedSet.add(k);
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressedSet.delete(k);
}

if (typeof window !== 'undefined') {
  if (!window.GuildWishes) window.GuildWishes = createState();
  else ensureState(window.GuildWishes);
  const state = window.GuildWishes;
  state.update = update;
  state.draw = draw;
  state.__probe = probe;
  if (!window.__gwListeners) {
    window.__gwListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
