const EMOTE_DEFS = {
  '1': { kind: 'wave', label: 'waves!', duration: 1.6 },
  '2': { kind: 'cheer', label: 'cheers!', duration: 1.6 },
  '3': { kind: 'sit', label: 'sits down', duration: 3.0 },
  '4': { kind: 'point', label: 'points!', duration: 1.6 }
};

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;
let particles = [];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getGE() { const w = root(); return w && w.GuildEmotes; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
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

function spawnCheerParticles(vis) {
  if (!vis) return;
  const pt = isoFn(vis.gx, vis.gy);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const speed = 14 + Math.random() * 24;
    particles.push({
      kind: 'sparkle',
      x: pt.x + Math.cos(ang) * 6,
      y: pt.y - 14 + Math.sin(ang) * 4,
      vx: Math.cos(ang) * speed,
      vy: -8 - Math.random() * 22,
      life: 0.7 + Math.random() * 0.4,
      age: 0,
      size: Math.random() < 0.5 ? 2 : 1,
      color: Math.random() < 0.5 ? '#facc15' : '#fde68a'
    });
  }
}

function startEmote(key, now) {
  const def = EMOTE_DEFS[key];
  const ge = getGE();
  const vis = getVisitor();
  if (!def || !ge || ge.current) return;
  const emote = {
    key: key,
    kind: def.kind,
    type: def.kind,
    name: def.kind,
    id: def.kind,
    label: def.label,
    duration: def.duration,
    start: (typeof now === 'number') ? now : nowFn(),
    facing: (vis && vis.facing) ? vis.facing : 'down'
  };
  ge.current = emote;
  ge.t = 0;
  if (def.kind === 'cheer' && vis) {
    spawnCheerParticles(vis);
    const w = root();
    if (w && typeof w.cue === 'function') {
      try { w.cue('done'); } catch (e) {}
    }
  }
}

function updateParticles(dt) {
  const next = [];
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 34 * dt;
    p.vx *= 0.97;
    next.push(p);
  }
  particles = next;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const ge = getGE();
  const Vv = getV();
  const vis = getVisitor();
  if (!ge || !Vv || Vv.gameState !== 'play' || !vis) {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  let triggerKey = null;
  if (!ge.current) {
    for (const k of pressed) {
      if (!prevPressed.has(k) && EMOTE_DEFS[k]) {
        triggerKey = k;
        break;
      }
    }
  }
  if (triggerKey) startEmote(triggerKey, now);

  prevPressed = new Set(pressed);

  if (ge.current) {
    const age = (now - ge.current.start) / 1000;
    ge.t = age;
    if (age >= ge.current.duration) {
      ge.current = null;
      ge.t = 0;
    }
  }

  updateParticles(dt);
}

function drawPointArm(ctx, x, y, facing) {
  ctx.fillStyle = '#f1c9a5';
  if (facing === 'left') {
    ctx.fillRect(x - 12, y - 6, 12, 3);
    ctx.fillRect(x - 16, y - 9, 3, 2);
    ctx.fillRect(x - 16, y - 5, 3, 2);
    ctx.fillRect(x - 18, y - 7, 2, 4);
  } else if (facing === 'right') {
    ctx.fillRect(x + 13, y - 6, 12, 3);
    ctx.fillRect(x + 23, y - 9, 3, 2);
    ctx.fillRect(x + 23, y - 5, 3, 2);
    ctx.fillRect(x + 26, y - 7, 2, 4);
  } else if (facing === 'up') {
    ctx.fillRect(x + 6, y - 20, 3, 12);
    ctx.fillRect(x + 4, y - 24, 2, 3);
    ctx.fillRect(x + 9, y - 24, 2, 3);
    ctx.fillRect(x + 6, y - 27, 3, 2);
  } else {
    ctx.fillRect(x + 6, y + 4, 3, 12);
    ctx.fillRect(x + 4, y + 17, 2, 3);
    ctx.fillRect(x + 9, y + 17, 2, 3);
    ctx.fillRect(x + 6, y + 21, 3, 2);
  }
}

function drawLabel(ctx, x, y, text) {
  ctx.font = 'bold 9px monospace';
  const tw = ctx.measureText(text).width;
  const bw = Math.max(42, Math.round(tw) + 8);
  const bh = 12;
  const bx = x + 7 - Math.round(bw * 0.5);
  const by = y - 44;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx + 1, by + 1, bw - 2, bh - 2);
  ctx.clip();
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(text, bw - 4), bx + bw * 0.5, by + bh * 0.5 + 1);
  ctx.restore();
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const ge = getGE();
  const Vv = getV();
  const vis = getVisitor();
  if (!ctx || !ge || !Vv || Vv.gameState !== 'play' || !vis) return;

  const pt = isoFn(vis.gx, vis.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.save();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const alpha = Math.max(0, 1 - (p.age / p.life));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const cur = ge.current;
  if (!cur) return;

  const t = (typeof ge.t === 'number') ? ge.t : 0;
  if (cur.kind === 'wave') {
    const swing = Math.round(Math.sin(t * 8) * 5);
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x + 5 + swing, y - 20, 3, 11);
  } else if (cur.kind === 'cheer') {
    ctx.fillStyle = '#f1c9a5';
    ctx.fillRect(x - 1, y - 20, 3, 11);
    ctx.fillRect(x + 13, y - 20, 3, 11);
  } else if (cur.kind === 'sit') {
    ctx.fillStyle = 'rgba(75,85,99,0.92)';
    ctx.fillRect(x + 1, y + 9, 14, 6);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x + 3, y + 5, 10, 4);
  } else if (cur.kind === 'point') {
    drawPointArm(ctx, x, y, cur.facing || vis.facing);
  }

  drawLabel(ctx, x, y, cur.label);
}

function onKeydown(e) {
  const k = (e && e.key != null) ? String(e.key) : '';
  if (!EMOTE_DEFS[k]) return;
  if (!pressed.has(k)) pressed.add(k);
  const Vv = getV();
  const vis = getVisitor();
  if (vis && Vv && Vv.gameState === 'play') {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const k = (e && e.key != null) ? String(e.key) : '';
  if (!EMOTE_DEFS[k]) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function createState() {
  return { current: null, t: 0 };
}

if (typeof window !== 'undefined') {
  if (!window.GuildEmotes) window.GuildEmotes = createState();
  window.GuildEmotes.update = update;
  window.GuildEmotes.draw = draw;
  window.GuildEmotes.trigger = function (key, now) {
    startEmote(String(key), (typeof now === 'number') ? now : nowFn());
    return window.GuildEmotes;
  };
  window.GuildEmotes.__keys = pressed;
  window.GuildEmotes.__pressed = pressed;
  window.GuildEmotes.__prevPressed = prevPressed;
  window.GuildEmotes.__probe = function () {
    return {
      pressed: Array.from(pressed),
      prev: Array.from(prevPressed),
      current: window.GuildEmotes.current,
      t: window.GuildEmotes.t,
      particles: particles.length
    };
  };
  if (!window.__geListeners) {
    window.__geListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
