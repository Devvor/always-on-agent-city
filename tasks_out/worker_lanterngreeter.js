const PATH = [
  { gx: 1.8, gy: 4.2 },
  { gx: 3.0, gy: 4.2 },
  { gx: 3.0, gy: 5.6 },
  { gx: 1.8, gy: 5.6 }
];

const FLAVOR_LINES = [
  'Lanterns are up down the market row - follow the gold light.',
  'Hot broth, sweet buns, and a warm welcome this way.',
  'The night market is glowing - come see what is new down the row.'
];

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
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function getState() { const w = root(); return w && w.GuildLanternGreeter; }

function createState() {
  return {
    active: false,
    leaving: false,
    alpha: 0,
    gx: PATH[0].gx,
    gy: PATH[0].gy,
    targetIndex: 1,
    pauseTimer: 3,
    moving: false,
    facing: 'down',
    walkFrame: 0,
    walkTimer: 0,
    lanternRaise: 0,
    bobPhase: 0,
    visitorNear: false,
    speech: null,
    speechIndex: 0,
    soundPlayed: false,
    flavorLines: FLAVOR_LINES.slice(),
    path: PATH.slice(),
    speed: 0.75,
    prevDaylight: null,
    lastTime: null
  };
}

function activate(s) {
  const p0 = s.path[0];
  s.active = true;
  s.leaving = false;
  s.alpha = 0;
  s.gx = p0.gx;
  s.gy = p0.gy;
  s.targetIndex = s.path.length > 1 ? 1 : 0;
  s.pauseTimer = 3;
  s.moving = false;
  s.visitorNear = false;
  s.lanternRaise = 0;
  s.speech = null;
  s.soundPlayed = false;
  s.walkFrame = 0;
  s.walkTimer = 0;
}

function beginLeave(s) {
  s.active = false;
  s.leaving = true;
}

function getVisitor() {
  const w = root();
  return w && w.GuildVisitor;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const s = getState();
  const Vv = getV();
  if (!s || !Vv || Vv.gameState !== 'play') {
    if (s) s.lastTime = now;
    return;
  }
  if (s.lastTime == null) s.lastTime = now;
  let dt = (now - s.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  s.lastTime = now;

  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 0;
  if (!s.active && !s.leaving && daylight < 0.6) activate(s);
  if (s.active && daylight >= 0.6) beginLeave(s);
  s.prevDaylight = daylight;

  s.bobPhase += dt * (s.visitorNear ? 4 : 2);

  if (s.active) {
    s.alpha = clamp(s.alpha + dt / 0.9, 0, 1);
  } else if (s.leaving) {
    s.alpha = clamp(s.alpha - dt / 1.8, 0, 1);
    s.gx += dt * 0.9;
    s.gy += dt * 0.5;
    if (s.alpha <= 0.001) {
      s.leaving = false;
      s.alpha = 0;
      s.visitorNear = false;
      s.speech = null;
      s.soundPlayed = false;
    }
  }

  const visitor = getVisitor();
  let visitorValid = !!(visitor && typeof visitor.gx === 'number' && typeof visitor.gy === 'number');

  if (s.active && visitorValid) {
    const dist = Math.hypot(visitor.gx - s.gx, visitor.gy - s.gy);
    if (!s.visitorNear && dist <= 2) s.visitorNear = true;
    else if (s.visitorNear && dist > 2.5) s.visitorNear = false;
  } else if (!s.active) {
    s.visitorNear = false;
  }

  if (s.visitorNear) s.lanternRaise = clamp(s.lanternRaise + dt * 2.4, 0, 1);
  else s.lanternRaise = clamp(s.lanternRaise - dt * 1.8, 0, 1);

  if (s.visitorNear && (s.speech == null || (now - s.speech.start) / 1000 >= 4)) {
    const line = s.flavorLines[s.speechIndex % s.flavorLines.length];
    s.speech = { text: line, start: now, duration: 4 };
    s.speechIndex += 1;
    if (!s.soundPlayed) {
      s.soundPlayed = true;
      const w = root();
      if (w && typeof w.cue === 'function') {
        try { w.cue('greeter'); } catch (e) {}
      }
    }
  }

  if (s.speech && (now - s.speech.start) / 1000 > s.speech.duration) {
    s.speech = null;
    s.soundPlayed = false;
  }
  if (!s.visitorNear && s.speech && (now - s.speech.start) / 1000 > 0.75) {
    // keep showing briefly after the visitor leaves
  }

  if (s.active && !s.leaving) {
    if (s.visitorNear) {
      s.moving = false;
      s.walkFrame = 0;
      s.walkTimer = 0;
      if (visitorValid) {
        const dx = visitor.gx - s.gx;
        const dy = visitor.gy - s.gy;
        if (Math.abs(dx) > Math.abs(dy)) s.facing = dx >= 0 ? 'right' : 'left';
        else s.facing = dy >= 0 ? 'down' : 'up';
      }
    } else if (s.pauseTimer > 0) {
      s.pauseTimer = Math.max(0, s.pauseTimer - dt);
      s.moving = false;
      s.walkFrame = 0;
      s.walkTimer = 0;
    } else {
      const target = s.path[s.targetIndex % s.path.length];
      const dx = target.gx - s.gx;
      const dy = target.gy - s.gy;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0.06) {
        s.gx = target.gx;
        s.gy = target.gy;
        s.pauseTimer = 3;
        s.targetIndex = (s.targetIndex + 1) % s.path.length;
        s.moving = false;
        s.walkFrame = 0;
        s.walkTimer = 0;
      } else {
        s.moving = true;
        const step = s.speed * dt;
        if (step >= dist) {
          s.gx = target.gx;
          s.gy = target.gy;
        } else {
          s.gx += (dx / dist) * step;
          s.gy += (dy / dist) * step;
        }
        if (Math.abs(dx) > Math.abs(dy)) s.facing = dx > 0 ? 'right' : 'left';
        else s.facing = dy > 0 ? 'down' : 'up';
        s.walkTimer += dt;
        while (s.walkTimer >= 0.18) {
          s.walkFrame = (s.walkFrame + 1) % 4;
          s.walkTimer -= 0.18;
        }
      }
    }
  }

  if (!s.moving) {
    s.walkFrame = 0;
    s.walkTimer = 0;
  }
}

function draw(ctx) {
  const s = getState();
  const Vv = getV();
  if (!ctx || !s || !Vv || Vv.gameState !== 'play') return;
  if ((!s.active && !s.leaving) || s.alpha <= 0.01) return;

  const n = nowFn();
  const pt = isoFn(s.gx, s.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const alpha = clamp(s.alpha, 0, 1);

  ctx.save();
  ctx.globalAlpha = alpha;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 4, y + 17, 16, 4);

  // legs
  const frame = s.moving ? (s.walkFrame % 4) : 0;
  const vertical = (s.facing === 'up' || s.facing === 'down');
  let leftY = y + 10, rightY = y + 10, leftH = 7, rightH = 7;
  if (frame === 1) { leftY = y + 9; rightY = y + 12; leftH = 7; rightH = 4; }
  else if (frame === 2) { leftY = y + 11; rightY = y + 11; leftH = 5; rightH = 5; }
  else if (frame === 3) { leftY = y + 12; rightY = y + 9; leftH = 4; rightH = 7; }
  if (vertical) { leftY = y + 10; rightY = y + 10; leftH = 6; rightH = 6; }
  if (s.facing === 'left') {
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 11, leftY, 3, leftH);
    ctx.fillRect(x + 3, rightY, 3, rightH);
  } else if (s.facing === 'right') {
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 11, rightY, 3, rightH);
  } else {
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 11, rightY, 3, rightH);
  }

  // body / robe
  ctx.fillStyle = '#52525b';
  ctx.fillRect(x + 1, y - 2, 14, 12);
  ctx.fillStyle = '#2f343c';
  ctx.fillRect(x + 1, y + 3, 14, 7);

  // head
  ctx.fillStyle = '#e7cfad';
  ctx.fillRect(x + 3, y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, y - 8, 2, 2);
  ctx.fillRect(x + 9, y - 8, 2, 2);
  ctx.fillStyle = '#7c5a34';
  ctx.fillRect(x + 4, y - 12, 8, 2);

  // inviting bob
  const inviteBob = s.visitorNear ? Math.round(Math.sin(s.bobPhase) * 2) : 0;

  // arm / lantern position
  const handX = (s.facing === 'left') ? x - 3 : x + 13;
  const lift = Math.round(s.lanternRaise * 8);
  const handY = y + 4 - lift + inviteBob;

  ctx.fillStyle = '#5a3f25';
  if (s.facing === 'left') {
    ctx.fillRect(handX + 1, handY - 6, 2, 6);
    ctx.fillRect(handX - 1, handY - 2, 4, 2);
  } else {
    ctx.fillRect(handX - 1, handY - 6, 2, 6);
    ctx.fillRect(handX - 3, handY - 2, 4, 2);
  }

  // lantern body
  ctx.fillStyle = '#3f2d14';
  ctx.fillRect(handX - 2, handY - 9, 5, 5);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(handX - 1, handY - 8, 3, 3);

  // gold halo, 2px light radius
  const lx = handX + 0.5;
  const ly = handY - 7.5;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(lx, ly, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.95;
  ctx.fillStyle = '#ffe8a3';
  ctx.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 2, 2);
  ctx.globalCompositeOperation = 'source-over';

  // speech bubble
  if (s.speech) {
    const age = (n - s.speech.start) / 1000;
    if (age >= 0 && age <= 4.5) {
      let bAlpha = 1;
      if (age > 3) bAlpha = clamp(1 - (age - 3) / 1.5, 0, 1);
      ctx.globalAlpha = alpha * bAlpha;
      const text = fitFn(s.speech.text, 150);
      ctx.font = '10px monospace';
      const tw = ctx.measureText(text).width;
      const bw = Math.max(72, Math.round(tw + 14));
      const bx = x + 8 - Math.round(bw * 0.5);
      const by = y - 40;
      ctx.fillStyle = 'rgba(10,10,12,0.92)';
      ctx.fillRect(bx, by, bw, 18);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, 18);
      ctx.fillStyle = '#f3d37a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + bw * 0.5, by + 9);
      ctx.textAlign = 'left';
    }
  }

  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildLanternGreeter) window.GuildLanternGreeter = createState();
  window.GuildLanternGreeter.update = update;
  window.GuildLanternGreeter.draw = draw;
  window.GuildLanternGreeter.__probe = function () {
    const s = getState();
    return {
      active: !!(s && s.active),
      visitorNear: !!(s && s.visitorNear)
    };
  };
  window.GuildLanternGreeter.__rawUpdate = update;
}

export {};
