const DEN_GX = 1.2;
const DEN_GY = -0.8;
let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return {
    gx: DEN_GX, gy: DEN_GY,
    homeGx: DEN_GX, homeGy: DEN_GY,
    facing: 'down',
    moving: false,
    walkFrame: 0,
    walkTimer: 0,
    state: 'idle',
    activity: 'sit',
    activityTimer: 1.2,
    followTimer: 0,
    targetGx: DEN_GX,
    targetGy: DEN_GY,
    hearts: [],
    lastE: false
  };
}

const fox = createState();

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
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function isWalkable(gx, gy, Vv) {
  if (!Vv || !Vv.grid) return false;
  const rx = Math.round(gx);
  const ry = Math.round(gy);
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  if (rx < minC || rx > maxC || ry < minC || ry > maxC) return false;
  if (tileRing(rx, ry) > s) return false;
  const b = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];
  for (let i = 0; i < b.length; i++) {
    if (rx === b[i].gx && ry === b[i].gy) return false;
  }
  return true;
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}
function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
}

function chooseWanderTarget() {
  const Vv = getV();
  for (let tries = 0; tries < 16; tries++) {
    const gx = fox.homeGx + (Math.random() - 0.5) * 2.6;
    const gy = fox.homeGy + (Math.random() - 0.5) * 2.6;
    if (!Vv || isWalkable(gx, gy, Vv)) return { gx: gx, gy: gy };
  }
  return { gx: fox.homeGx, gy: fox.homeGy };
}

function burstHearts() {
  for (let i = 0; i < 7; i++) {
    fox.hearts.push({
      gx: fox.gx + (Math.random() - 0.5) * 0.8,
      gy: fox.gy - 0.3,
      rise: 0,
      life: 1.7,
      age: 0
    });
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!fox || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const tasks = Array.isArray(root().allTasks) ? root().allTasks : (Array.isArray(Vv.allTasks) ? Vv.allTasks : []);

  for (let hi = fox.hearts.length - 1; hi >= 0; hi--) {
    const h = fox.hearts[hi];
    h.age += dt;
    h.rise += dt * 0.9;
    if (h.age >= h.life) fox.hearts.splice(hi, 1);
  }

  const visitor = getVisitor();
  const eNow = pressed.has('e') || pressed.has(' ');
  const eEdge = eNow && !fox.lastE;
  fox.lastE = eNow;

  if (fox.state === 'follow') {
    fox.followTimer -= dt;
    if (visitor && typeof visitor.gx === 'number') {
      fox.targetGx = visitor.gx;
      fox.targetGy = visitor.gy;
    }
    if (fox.followTimer <= 0) {
      fox.state = 'return';
      fox.targetGx = fox.homeGx;
      fox.targetGy = fox.homeGy;
    }
  } else if (fox.state === 'return') {
    const dist = Math.hypot(fox.gx - fox.homeGx, fox.gy - fox.homeGy);
    if (dist <= 0.55) {
      fox.gx = fox.homeGx;
      fox.gy = fox.homeGy;
      fox.state = 'idle';
      fox.activity = 'sit';
      fox.activityTimer = 1.4;
      fox.targetGx = fox.gx;
      fox.targetGy = fox.gy;
    } else {
      fox.targetGx = fox.homeGx;
      fox.targetGy = fox.homeGy;
    }
  } else {
    if (fox.activity === 'moving') {
      const dist = Math.hypot(fox.gx - fox.targetGx, fox.gy - fox.targetGy);
      if (dist <= 0.45) {
        fox.activity = (Math.random() < 0.55) ? 'sniff' : 'sit';
        fox.activityTimer = (fox.activity === 'sniff') ? (0.9 + Math.random() * 0.8) : (1.6 + Math.random() * 1.8);
        fox.targetGx = fox.gx;
        fox.targetGy = fox.gy;
      }
    } else {
      fox.activityTimer -= dt;
      if (fox.activityTimer <= 0) {
        const nt = chooseWanderTarget();
        fox.targetGx = nt.gx;
        fox.targetGy = nt.gy;
        fox.activity = 'moving';
      }
    }
  }

  if (eEdge && visitor && typeof visitor.gx === 'number') {
    const d = Math.hypot(fox.gx - visitor.gx, fox.gy - visitor.gy);
    if (d <= 1.8 && fox.state !== 'follow') {
      fox.state = 'follow';
      fox.followTimer = 15;
      fox.targetGx = visitor.gx;
      fox.targetGy = visitor.gy;
      burstHearts();
      try { if (typeof root().cue === 'function') root().cue('pet'); } catch (e) {}
    }
  }

  let dx = fox.targetGx - fox.gx;
  let dy = fox.targetGy - fox.gy;
  const dist = Math.hypot(dx, dy);
  let moving = false;
  const followSpeed = fox.state === 'follow' ? 3.2 : 1.7;
  if (dist > 0.12) {
    dx /= dist;
    dy /= dist;
    const nx = fox.gx + dx * followSpeed * dt;
    const ny = fox.gy + dy * followSpeed * dt;
    let allow = false;
    if (fox.state === 'follow' || fox.state === 'return') {
      allow = true;
    } else {
      allow = isWalkable(nx, ny, Vv);
    }
    if (allow) {
      fox.gx = nx;
      fox.gy = ny;
      moving = true;
    }
  }
  fox.moving = moving;
  if (dist > 0.12) {
    if (Math.abs(dx) > Math.abs(dy)) fox.facing = (dx > 0) ? 'right' : 'left';
    else fox.facing = (dy > 0) ? 'down' : 'up';
  }
  if (moving) {
    fox.walkTimer += dt;
    while (fox.walkTimer >= 0.16) {
      fox.walkFrame = (fox.walkFrame + 1) % 4;
      fox.walkTimer -= 0.16;
    }
  } else {
    fox.walkFrame = 0;
    fox.walkTimer = 0;
  }

  if (fox.state === 'follow' && Math.random() < 0.03) {
    fox.hearts.push({
      gx: fox.gx + (Math.random() - 0.5) * 0.5,
      gy: fox.gy - 0.4,
      rise: 0,
      life: 1.2,
      age: 0
    });
  }
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;

  const denPt = isoFn(fox.homeGx, fox.homeGy);
  const dx = Math.round(denPt.x);
  const dy = Math.round(denPt.y);
  ctx.fillStyle = '#3a2a15';
  ctx.fillRect(dx - 9, dy - 4, 18, 10);
  ctx.fillStyle = '#1f1a14';
  ctx.fillRect(dx - 6, dy - 2, 12, 8);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(dx - 10, dy - 7, 20, 4);

  const pt = isoFn(fox.gx, fox.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const moving = fox.moving;
  const bob = moving ? (fox.walkFrame % 2 === 0 ? 0 : 1) : 0;
  const Y = y + bob;
  const frame = moving ? (fox.walkFrame % 4) : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 6, y + 16, 20, 4);

  let leftY = Y + 12, rightY = Y + 12, leftH = 6, rightH = 6;
  if (frame === 1) { leftY = Y + 11; rightY = Y + 13; leftH = 6; rightH = 4; }
  else if (frame === 2) { leftY = Y + 13; rightY = Y + 13; leftH = 5; rightH = 5; }
  else if (frame === 3) { leftY = Y + 13; rightY = Y + 11; leftH = 4; rightH = 6; }

  ctx.fillStyle = '#4b5563';
  if (fox.facing === 'left') {
    ctx.fillRect(x + 9, leftY, 3, leftH);
    ctx.fillRect(x + 3, rightY, 3, rightH);
  } else if (fox.facing === 'right') {
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 9, rightY, 3, rightH);
  } else {
    ctx.fillRect(x + 2, leftY, 3, leftH);
    ctx.fillRect(x + 10, rightY, 3, rightH);
  }

  ctx.fillStyle = '#ff6b1a';
  ctx.fillRect(x - 5, Y - 1, 18, 11);
  ctx.fillStyle = '#ffc27a';
  ctx.fillRect(x + 9, Y - 7, 8, 8);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 12, Y - 5, 2, 2);
  ctx.fillRect(x + 15, Y - 5, 2, 2);
  ctx.fillStyle = '#ff6b1a';
  ctx.fillRect(x - 10, Y + 1, 6, 3);
  ctx.fillRect(x - 14, Y, 5, 3);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 12, Y - 1, 4, 2);
  if (fox.state === 'sniff' || fox.activity === 'sniff') {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x + 16, Y - 8, 2, 2);
    ctx.fillRect(x + 18, Y - 9, 2, 2);
    ctx.fillRect(x + 20, Y - 10, 2, 2);
  }

  ctx.font = 'bold 9px monospace';
  const name = 'FOX';
  const tw = ctx.measureText(name).width;
  const pw = Math.round(tw) + 8;
  const ph = 12;
  const px = x + 4 - Math.round(pw * 0.5);
  const py = Y - 28;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(name, pw - 6), px + pw * 0.5, py + ph * 0.5 + 1);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 12px monospace';
  for (let i = 0; i < fox.hearts.length; i++) {
    const h = fox.hearts[i];
    const hpt = isoFn(h.gx, h.gy - h.rise * 0.12);
    const a = Math.max(0, 1 - (h.age / h.life));
    ctx.globalAlpha = a;
    ctx.fillText('\u2665', Math.round(hpt.x) - 4, Math.round(hpt.y));
  }
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  window.GuildPetFox = fox;
  window.GuildPetFox.update = update;
  window.GuildPetFox.draw = draw;
  if (!window.__gpfxListeners) {
    window.__gpfxListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
