// tasks_out/worker_nightguard.js
// Lantern-carrying night guard for the W museum wing.
// Self-installing ES module; no imports; no top-level DOM access (typeof guards).
// State lives on window.GuildNightGuard; the client render loop calls
// update(now) / draw(ctx) each frame while V.gameState === 'play'.

const ROUTE_CORNERS = [
  { gx: -3, gy: -2 },
  { gx: 2, gy: -2 },
  { gx: 2, gy: 2 },
  { gx: -3, gy: 2 }
];
const BENCH = { gx: 2, gy: -1 }; // 2+ tiles from every existing prop in the wing
const PATROL_SPEED = 0.55;      // slow walk, tiles per second
const NIGHT_THRESHOLD = 0.35;
const INTERACT_DIST = 1.6;      // grid-tile distance for E
const BUBBLE_MIN = 8;
const BUBBLE_MAX = 14;
const BUBBLE_DURATION = 3.0;

let lastTime = null;
let eLatch = false;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildNightGuard; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

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

function cueFn(type) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(type); } catch (e) {} }
}

function createState() {
  return {
    gx: ROUTE_CORNERS[0].gx,
    gy: ROUTE_CORNERS[0].gy,
    corner: 1,
    facing: 'right',
    moving: false,
    walkFrame: 0,
    walkTimer: 0,
    mode: 'patrol',            // 'patrol' | 'sleep'
    bubble: null,              // { text, start }
    nextBubble: 6,
    dialogue: null,            // { text, start }
    dialogueCooldown: 0,
    zTimer: 1.5,
    installed: false
  };
}

function isNight(Vv) {
  return Vv && typeof Vv.daylight === 'number' && Vv.daylight < NIGHT_THRESHOLD;
}

function visitorPos() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') return { gx: vis.gx, gy: vis.gy };
  return null;
}

function gridDistance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function advanceRoute(st, dt) {
  let remaining = PATROL_SPEED * dt;
  let guard = 0;
  while (remaining > 0.0001 && guard < 8) {
    guard++;
    const target = ROUTE_CORNERS[st.corner % ROUTE_CORNERS.length];
    const dx = target.gx - st.gx;
    const dy = target.gy - st.gy;
    const dist = Math.hypot(dx, dy);
    if (dist <= remaining) {
      st.gx = target.gx;
      st.gy = target.gy;
      remaining -= dist;
      st.corner = (st.corner + 1) % ROUTE_CORNERS.length;
    } else {
      st.gx += (dx / dist) * remaining;
      st.gy += (dy / dist) * remaining;
      if (Math.abs(dx) > Math.abs(dy)) st.facing = dx > 0 ? 'right' : 'left';
      else st.facing = dy > 0 ? 'down' : 'up';
      remaining = 0;
    }
  }
}

function tryInteract(st, now) {
  if (st.dialogue || st.dialogueCooldown > 0) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const vp = visitorPos();
  if (!vp) return;
  if (gridDistance(vp.gx, vp.gy, st.gx, st.gy) > INTERACT_DIST) return;
  let text;
  if (st.mode === 'patrol') {
    text = 'All quiet in the W wing. The lantern keeps the pedestals honest.';
  } else {
    text = 'Zzz... day shift is a bench job. Come back after dusk.';
  }
  st.dialogue = { text: text, start: now };
  cueFn('talk');
}

function closeDialogue(st, now) {
  if (!st) return;
  st.dialogue = null;
  st.dialogueCooldown = 0.5;
}

function onKeydown(e) {
  const k = e ? String(e.key || '').toLowerCase() : '';
  if (k !== 'e' && k !== 'escape') return;
  const w = root();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (k === 'escape') {
    if (st.dialogue) { closeDialogue(st, nowFn()); if (e && e.preventDefault) e.preventDefault(); }
    return;
  }
  if (e && e.repeat) return;
  if (st.dialogue) { closeDialogue(st, nowFn()); if (e && e.preventDefault) e.preventDefault(); }
  else { tryInteract(st, nowFn()); if (st.dialogue && e && e.preventDefault) e.preventDefault(); }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const night = isNight(Vv);
  const wantMode = night ? 'patrol' : 'sleep';
  if (st.mode !== wantMode) {
    st.mode = wantMode;
    st.bubble = null;
    st.nextBubble = 2 + Math.random() * 4;
    if (wantMode === 'sleep') { st.gx = BENCH.gx; st.gy = BENCH.gy; st.facing = 'down'; }
  }

  if (st.dialogueCooldown > 0) st.dialogueCooldown = Math.max(0, st.dialogueCooldown - dt);
  if (st.dialogue && now - st.dialogue.start >= 6000) closeDialogue(st, now);

  if (st.mode === 'patrol') {
    st.moving = true;
    advanceRoute(st, dt);
    st.walkTimer += dt;
    while (st.walkTimer >= 0.18) {
      st.walkFrame = (st.walkFrame + 1) % 4;
      st.walkTimer -= 0.18;
    }
    st.nextBubble -= dt;
    if (st.nextBubble <= 0 && !st.bubble) {
      st.bubble = { text: 'all quiet', start: now };
      st.nextBubble = BUBBLE_MIN + Math.random() * (BUBBLE_MAX - BUBBLE_MIN);
    }
  } else {
    st.moving = false;
    st.walkFrame = 0;
    st.walkTimer = 0;
    st.zTimer -= dt;
    if (st.zTimer <= 0) st.zTimer = 2.2 + Math.random() * 2;
  }
  if (st.bubble && (now - st.bubble.start) / 1000 >= BUBBLE_DURATION) st.bubble = null;
}

function drawLanternGlow(ctx, x, y, now) {
  const flicker = 0.75 + 0.25 * Math.sin(now * 0.006) * Math.sin(now * 0.0027);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const r = 58 * flicker;
  const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
  grad.addColorStop(0, 'rgba(255,214,120,' + (0.30 * flicker).toFixed(3) + ')');
  grad.addColorStop(0.5, 'rgba(250,204,21,' + (0.12 * flicker).toFixed(3) + ')');
  grad.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
}

function drawTileGlow(ctx, st, Vv, now) {
  const flicker = 0.7 + 0.3 * Math.sin(now * 0.005);
  const cx = Math.round(st.gx);
  const cy = Math.round(st.gy);
  for (let gy = cy - 2; gy <= cy + 2; gy++) {
    for (let gx = cx - 2; gx <= cx + 2; gx++) {
      const d = gridDistance(gx + 0.5, gy + 0.5, st.gx, st.gy);
      if (d > 2.2) continue;
      const a = Math.max(0, 0.16 * (1 - d / 2.2) * flicker);
      if (a <= 0.01) continue;
      const p0 = isoFn(gx, gy);
      const p1 = isoFn(gx + 1, gy);
      const p2 = isoFn(gx + 1, gy + 1);
      const p3 = isoFn(gx, gy + 1);
      ctx.fillStyle = 'rgba(250,204,21,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(Math.round(p0.x), Math.round(p0.y));
      ctx.lineTo(Math.round(p1.x), Math.round(p1.y));
      ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
      ctx.lineTo(Math.round(p3.x), Math.round(p3.y));
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawGuard(ctx, st, now) {
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const sleeping = st.mode === 'sleep';
  const bob = st.moving ? (st.walkFrame % 2 === 0 ? 0 : 1) : (sleeping ? Math.round(Math.sin(now * 0.0012) * 1) : 0);
  const Y = y + bob;
  const frame = st.moving ? st.walkFrame : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 4, y + 17, 20, 4);

  let leftY = Y + 10, rightY = Y + 10, leftH = 8, rightH = 8;
  if (sleeping) { leftY = Y + 13; rightY = Y + 13; leftH = 4; rightH = 4; }
  else if (frame === 1) { leftY = Y + 9; rightY = Y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = Y + 11; rightY = Y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = Y + 12; rightY = Y + 9; leftH = 5; rightH = 8; }
  ctx.fillStyle = '#1f2937';
  if (st.facing === 'left') {
    ctx.fillRect(x + 10, leftY, 4, leftH);
    ctx.fillRect(x + 2, rightY, 4, rightH);
  } else if (st.facing === 'right') {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  } else {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  }

  ctx.fillStyle = '#3b3f8c';
  ctx.fillRect(x + 1, Y - 2, 14, 12);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 3, Y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  if (sleeping) {
    ctx.fillRect(x + 5, Y - 7, 2, 1);
    ctx.fillRect(x + 9, Y - 7, 2, 1);
  } else {
    ctx.fillRect(x + 5, Y - 8, 2, 2);
    ctx.fillRect(x + 9, Y - 8, 2, 2);
  }
  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 4, Y - 12, 8, 2);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 2, Y + 3, 12, 2);

  if (!sleeping) {
    // lantern arm + lantern
    const armX = st.facing === 'left' ? x - 4 : x + 15;
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(armX, Y + 2, 4, 2);
    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(armX + 1, Y - 4, 2, 7);
    const flick = 0.7 + 0.3 * Math.sin(now * 0.008);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(armX - 1, Y - 8, 6, 5);
    ctx.fillStyle = 'rgba(255,224,138,' + flick.toFixed(2) + ')';
    ctx.fillRect(armX, Y - 7, 4, 3);
    drawLanternGlow(ctx, armX + 1, Y - 5, now);
  } else {
    const zt = (now * 0.001) % 2.4;
    if (zt < 1.8) {
      const a = Math.max(0, 1 - zt / 1.8);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e8e6df';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('z', x + 16, Y - 14 - Math.round(zt * 10));
      ctx.globalAlpha = 1;
    }
  }

  // name tag
  ctx.font = 'bold 9px monospace';
  const name = 'NIGHT GUARD';
  const tw = ctx.measureText(name).width;
  const pw = Math.round(tw) + 8;
  const px = x + 7 - Math.round(pw * 0.5);
  const py = Y - 35;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, 12);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, 12);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, px + pw * 0.5, py + 7);
  ctx.textAlign = 'left';
}

function drawBench(ctx) {
  const pt = isoFn(BENCH.gx, BENCH.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 14, y + 12, 30, 4);
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 12, y + 2, 26, 4);
  ctx.fillRect(x - 12, y + 8, 26, 4);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(x - 12, y - 2, 26, 4);
  ctx.fillStyle = '#4b3320';
  ctx.fillRect(x - 11, y + 6, 3, 8);
  ctx.fillRect(x + 8, y + 6, 3, 8);
}

function drawBubble(ctx, st, now) {
  if (!st.bubble) return;
  const age = (now - st.bubble.start) / 1000;
  let alpha = 1;
  if (age > BUBBLE_DURATION - 0.6) alpha = Math.max(0, (BUBBLE_DURATION - age) / 0.6);
  if (alpha <= 0) return;
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const text = st.bubble.text;
  ctx.font = '10px monospace';
  const shown = fitFn(text, 90);
  const tw = ctx.measureText(shown).width;
  const bw = Math.max(44, Math.round(tw) + 12);
  const bh = 16;
  const bx = x + 7 - Math.round(bw * 0.5);
  const by = y - 54;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.5 - 3, by + bh);
  ctx.lineTo(bx + bw * 0.5 + 3, by + bh);
  ctx.lineTo(x + 7, y - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f3d37a';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, bx + 6, by + bh * 0.5 + 1);
  ctx.restore();
}

function drawDialogue(ctx, st, now) {
  if (!st || !st.dialogue) return;
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : null;
  if (!canvas) return;
  const boxW = Math.min(canvas.width - 40, 440);
  const boxH = 52;
  const bx = Math.round((canvas.width - boxW) * 0.5);
  const by = canvas.height - boxH - 70;
  ctx.fillStyle = 'rgba(20,16,10,0.90)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 2, by + 2, boxW - 4, boxH - 4);
  ctx.clip();
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('NIGHT GUARD', boxW - 16), bx + 10, by + 14);
  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  ctx.fillText(fitFn(st.dialogue.text, boxW - 16), bx + 10, by + 35);
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !ctx) return;
  const now = nowFn();
  drawBench(ctx);
  if (st.mode === 'patrol') drawTileGlow(ctx, st, Vv, now);
  drawGuard(ctx, st, now);
  drawBubble(ctx, st, now);
  drawDialogue(ctx, st, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildNightGuard) window.GuildNightGuard = createState();
  window.GuildNightGuard.update = update;
  window.GuildNightGuard.draw = draw;
  window.GuildNightGuard.__probe = function () {
    const st = window.GuildNightGuard;
    return {
      mode: st.mode,
      gx: st.gx,
      gy: st.gy,
      corner: st.corner,
      facing: st.facing,
      moving: st.moving,
      hasBubble: !!st.bubble,
      bubbleText: st.bubble ? st.bubble.text : null,
      hasDialogue: !!st.dialogue,
      bench: { gx: BENCH.gx, gy: BENCH.gy },
      route: ROUTE_CORNERS.slice()
    };
  };
  window.GuildNightGuard.__interact = function () { tryInteract(window.GuildNightGuard, nowFn()); };
  if (!window.__ngListeners) {
    window.__ngListeners = true;
    window.addEventListener('keydown', onKeydown);
  }
}

export {};
