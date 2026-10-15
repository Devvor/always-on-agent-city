const ANCHOR_GX = 1.4;
const ANCHOR_GY = 3.2;

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() {
  const w = root();
  return w && w.V ? w.V : null;
}
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') {
    try {
      const p = w.iso(gx, gy);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) {}
  }
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') {
    try { return w.fitText(text, maxW); } catch (e) {}
  }
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() {
  const w = root();
  return w && w.GuildRoast ? w.GuildRoast : null;
}
function getVisitor() {
  const w = root();
  return w && w.GuildVisitor ? w.GuildVisitor : null;
}
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function randRange(a, b) { return a + Math.random() * (b - a); }

function createState() {
  const sticks = [];
  for (let i = 0; i < 3; i++) {
    sticks.push({ toast: 0, toasting: false, sparkleT: 0, carried: false, phase: i * 2.094 });
  }
  return {
    gx: ANCHOR_GX,
    gy: ANCHOR_GY,
    active: false,
    session: false,
    roasted: 0,
    sticks: sticks,
    cooldown: randRange(8, 14),
    visitorTime: 0,
    carry: null,
    transferCooldown: 0,
    floats: []
  };
}

function resetNightState(s) {
  if (!s) return;
  for (let i = 0; i < s.sticks.length; i++) {
    const st = s.sticks[i];
    st.toast = 0;
    st.toasting = false;
    st.sparkleT = 0;
    st.carried = false;
  }
  s.cooldown = randRange(8, 14);
  s.visitorTime = 0;
  s.carry = null;
  s.transferCooldown = 0;
  s.floats = [];
  s.roasted = 0;
}

function lerpBrown(t) {
  t = clamp(t, 0, 1);
  const r = Math.round(255 + (201 - 255) * t);
  const g = Math.round(255 + (154 - 255) * t);
  const b = Math.round(255 + (91 - 255) * t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const s = getState();
  if (!s) return;

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const Vv = getV();
  const play = !!(Vv && Vv.gameState === 'play');
  const dl = Vv && typeof Vv.daylight === 'number' ? Vv.daylight : 0;
  const weather = Vv ? Vv.weather : 'RAIN';
  const night = dl < 0.3;

  if (night) {
    if (!s.session) {
      resetNightState(s);
      s.session = true;
    }
  } else {
    if (s.session) resetNightState(s);
    s.session = false;
  }

  s.active = !!(night && weather !== 'RAIN' && play);

  if (s.transferCooldown > 0) s.transferCooldown = Math.max(0, s.transferCooldown - dt);

  for (let i = 0; i < s.sticks.length; i++) {
    const st = s.sticks[i];
    if (st.toasting && st.toast < 1) {
      st.toast = Math.min(1, st.toast + dt / 1.5);
      if (st.sparkleT < 0.35) st.sparkleT = 0.35;
      if (st.toast >= 1) st.toasting = false;
    }
    if (st.sparkleT > 0) st.sparkleT = Math.max(0, st.sparkleT - dt * 1.1);
  }

  if (s.active) {
    s.cooldown -= dt;
    if (s.cooldown <= 0) {
      let candidates = [];
      for (let i = 0; i < s.sticks.length; i++) {
        if (!s.sticks[i].carried && s.sticks[i].toast < 0.99) candidates.push(s.sticks[i]);
      }
      if (!candidates.length) {
        for (let i = 0; i < s.sticks.length; i++) {
          if (!s.sticks[i].carried) candidates.push(s.sticks[i]);
        }
      }
      if (candidates.length) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        pick.toast = 0;
        pick.toasting = true;
        pick.sparkleT = 0.75;
        cueFn('pop');
      }
      s.cooldown = randRange(8, 14);
    }

    const vis = getVisitor();
    if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number' && !s.carry) {
      const dist = Math.hypot(vis.gx - s.gx, vis.gy - s.gy);
      if (dist <= 2) {
        s.visitorTime += dt;
        if (s.visitorTime >= 3 && s.transferCooldown <= 0) {
          let idx = -1;
          for (let i = 0; i < s.sticks.length; i++) {
            if (!s.sticks[i].carried) { idx = i; break; }
          }
          if (idx >= 0) {
            s.sticks[idx].carried = true;
            s.carry = { index: idx, start: now, toasted: false, toast: 0 };
            s.visitorTime = 0;
          }
        }
      } else {
        s.visitorTime = 0;
      }
    } else if (s.carry) {
      s.visitorTime = 0;
    } else {
      s.visitorTime = Math.max(0, s.visitorTime - dt);
    }
  } else {
    s.visitorTime = 0;
  }

  if (s.carry) {
    const age = (now - s.carry.start) / 1000;
    if (!s.carry.toasted && age >= 4) {
      s.carry.toasted = true;
      const vis = getVisitor();
      let pt = null;
      if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') pt = isoFn(vis.gx, vis.gy);
      else pt = isoFn(s.gx, s.gy);
      s.floats.push({ x: pt.x + 10, y: pt.y - 18, vy: -24, t: 0, dur: 1.45, text: '+roasted' });
      s.roasted += 1;
      cueFn('done');
      s.transferCooldown = 6;
    }
    if (s.carry.toasted) {
      s.carry.toast = Math.min(1, s.carry.toast + dt / 0.7);
    }
  }

  const nextFloats = [];
  for (let i = 0; i < s.floats.length; i++) {
    const f = s.floats[i];
    f.t += dt;
    f.y += f.vy * dt;
    f.vy += 6 * dt;
    if (f.t < f.dur) nextFloats.push(f);
  }
  s.floats = nextFloats;
}

function drawStick(ctx, s, st, now) {
  const center = isoFn(s.gx, s.gy);
  const t = now * 0.0012 + st.phase;
  const hx = center.x + Math.cos(t) * 18;
  const hy = center.y + Math.sin(t) * 9;
  const mx = center.x + Math.cos(t) * 4;
  const my = center.y + Math.sin(t) * 2 - 2;

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#6b4a2d';
  ctx.beginPath();
  ctx.moveTo(Math.round(hx), Math.round(hy));
  ctx.lineTo(Math.round(mx), Math.round(my));
  ctx.stroke();

  ctx.fillStyle = lerpBrown(st.toast);
  ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 1, 3, 3);

  if (st.sparkleT > 0) {
    ctx.globalAlpha = clamp(st.sparkleT, 0, 1);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(Math.round(mx) + 2, Math.round(my) - 3, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function drawCarriedStick(ctx, s, now) {
  const vis = getVisitor();
  let pt;
  if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') pt = isoFn(vis.gx, vis.gy);
  else pt = isoFn(s.gx, s.gy);

  const hx = Math.round(pt.x + 10);
  const hy = Math.round(pt.y - 2);
  const mx = Math.round(pt.x + 4);
  const my = Math.round(pt.y - 10);

  ctx.lineWidth = 1;
  ctx.strokeStyle = '#6b4a2d';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(mx, my);
  ctx.stroke();

  const stick = s.sticks[s.carry.index];
  const toastLevel = s.carry.toasted ? (0.4 + 0.6 * clamp(s.carry.toast, 0, 1)) : (stick ? stick.toast : 0);
  ctx.fillStyle = lerpBrown(toastLevel);
  ctx.fillRect(mx - 1, my - 1, 3, 3);
}

function draw(ctx) {
  const s = getState();
  if (!s || !ctx) return;
  const Vv = getV();
  if (!Vv) return;
  if (!s.active) return;

  const now = nowFn();
  for (let i = 0; i < s.sticks.length; i++) {
    const st = s.sticks[i];
    if (st.carried) continue;
    drawStick(ctx, s, st, now);
  }

  if (s.carry) drawCarriedStick(ctx, s, now);

  for (let i = 0; i < s.floats.length; i++) {
    const f = s.floats[i];
    const a = Math.max(0, 1 - (f.t / f.dur));
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 11px monospace';
    const shown = fitFn(f.text, 80);
    ctx.fillText(shown, Math.round(f.x), Math.round(f.y));
    ctx.globalAlpha = 1;
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildRoast) window.GuildRoast = createState();
  const G = window.GuildRoast;
  G.update = update;
  G.draw = draw;
  G.__probe = function () {
    const st = getState() || G;
    return { active: !!(st && st.active), roasted: st ? st.roasted : 0 };
  };
}

export {};
