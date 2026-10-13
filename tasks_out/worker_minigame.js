const SIGN_GX = 0.8;
const SIGN_GY = 4.5;

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;
let sparkles = [];

function createState() {
  return { active: false, t0: 0, orbs: [], score: 0, best: 0, endCard: 0, lastSpawn: 0 };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getMG() { const w = root(); return w && w.GuildMinigame; }
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
function visitorFn() { const w = root(); return w && w.GuildVisitor; }
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}

function tileDistanceToSign(vis) {
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return Infinity;
  return Math.hypot(vis.gx - SIGN_GX, vis.gy - SIGN_GY);
}

function makeSparkleBurst(x, y) {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 75;
    sparkles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.35 + Math.random() * 0.28,
      size: 2,
      color: Math.random() < 0.55 ? '#facc15' : '#ffe066'
    });
  }
}

function spawnOrb(mg, Vv) {
  const growth = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const minC = -2 - growth;
  const maxC = 1 + growth;
  const gx = minC + Math.random() * (maxC - minC + 1);
  const pt = isoFn(gx, 0);
  mg.orbs.push({
    x: pt.x,
    y: -70 - Math.random() * 45,
    vx: (Math.random() - 0.5) * 36,
    vy: 165 + Math.random() * 95,
    trail: []
  });
}

function endGame(mg, now) {
  if (!mg || !mg.active) return;
  mg.active = false;
  if (mg.score > mg.best) mg.best = mg.score;
  mg.endCard = now + 3000;
  cueFn(mg.score >= 15 ? 'levelup' : 'done');
}

function onKeydown(e) {
  if (!e) return;
  let k = (e.key === ' ') ? ' ' : String(e.key || '').toLowerCase();
  if (!k) return;
  pressed.add(k);
}

function onKeyup(e) {
  if (!e) return;
  let k = (e.key === ' ') ? ' ' : String(e.key || '').toLowerCase();
  if (!k) return;
  pressed.delete(k);
}

function update(now) {
  try {
    if (typeof now !== 'number') now = nowFn();
    const w = root();
    const Vv = w && w.V;
    if (!Vv || Vv.gameState !== 'play') {
      lastTime = now;
      return;
    }
    const mg = w.GuildMinigame;
    if (!mg) {
      lastTime = now;
      return;
    }
    if (!Array.isArray(mg.orbs)) mg.orbs = [];
    if (!Array.isArray(sparkles)) sparkles = [];

    if (lastTime === null) lastTime = now;
    let dt = (now - lastTime) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
    lastTime = now;

    const vis = visitorFn();
    const ePressed = pressed.has('e');
    const eWas = prevPressed.has('e');

    if (mg.active) {
      if (now - mg.t0 >= 20000) {
        endGame(mg, now);
      } else if (ePressed && !eWas) {
        endGame(mg, now);
      }
    } else {
      if (vis && tileDistanceToSign(vis) <= 1.6 && ePressed && !eWas) {
        mg.active = true;
        mg.t0 = now;
        mg.score = 0;
        mg.orbs = [];
        mg.lastSpawn = now;
        mg.endCard = 0;
        sparkles = [];
      }
    }

    if (mg.active) {
      if (!mg.lastSpawn) mg.lastSpawn = mg.t0;
      while (now - mg.lastSpawn >= 320) {
        spawnOrb(mg, Vv);
        mg.lastSpawn += 320;
        if (mg.lastSpawn > now) break;
      }

      const vpt = vis ? isoFn(vis.gx, vis.gy) : null;
      const floorY = (Vv.canvas && isFinite(Vv.canvas.height)) ? (Vv.canvas.height + 70) : 900;
      const nextOrbs = [];
      for (let i = 0; i < mg.orbs.length; i++) {
        const orb = mg.orbs[i];
        if (!orb || !isFinite(orb.x) || !isFinite(orb.y)) continue;

        if (Array.isArray(orb.trail)) {
          orb.trail.push({ x: orb.x, y: orb.y });
          if (orb.trail.length > 5) orb.trail.shift();
        }

        let caught = false;
        if (vpt && Math.hypot(orb.x - vpt.x, orb.y - vpt.y) <= 16) {
          caught = true;
        }

        if (caught) {
          mg.score += 1;
          makeSparkleBurst(orb.x, orb.y);
          continue;
        }

        if (!isFinite(orb.vx)) orb.vx = 0;
        if (!isFinite(orb.vy)) orb.vy = 160;
        orb.vy += 130 * dt;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;

        if (orb.y > floorY) {
          makeSparkleBurst(orb.x, floorY - 8);
          continue;
        }
        nextOrbs.push(orb);
      }
      mg.orbs = nextOrbs;
    }

    const nextSparkles = [];
    for (let i = 0; i < sparkles.length; i++) {
      const p = sparkles[i];
      if (!p || !isFinite(p.life)) continue;
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += (isFinite(p.vx) ? p.vx : 0) * dt;
      p.y += (isFinite(p.vy) ? p.vy : 0) * dt;
      if (isFinite(p.vy)) p.vy += 40 * dt;
      nextSparkles.push(p);
    }
    sparkles = nextSparkles;

    prevPressed = new Set(pressed);
  } catch (e) {}
}

function drawSign(ctx) {
  try {
    const pt = isoFn(SIGN_GX, SIGN_GY);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);

    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(x - 15, y - 3, 4, 23);
    ctx.fillRect(x + 11, y - 3, 4, 23);
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - 14, y - 2, 2, 21);
    ctx.fillRect(x + 12, y - 2, 2, 21);

    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - 20, y - 31, 40, 26);
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(x - 20, y - 31, 40, 4);
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - 20, y - 27, 40, 1);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 20, y - 31, 40, 2);
    ctx.fillRect(x - 20, y - 7, 40, 2);
    ctx.fillRect(x - 20, y - 31, 2, 26);
    ctx.fillRect(x + 18, y - 31, 2, 26);

    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 5, y - 25, 10, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 2, y - 22, 4, 4);
    ctx.fillStyle = '#ffe7a8';
    ctx.fillRect(x - 1, y - 21, 2, 2);
  } catch (e) {}
}

function drawOrbs(ctx) {
  try {
    const mg = getMG();
    if (!mg || !Array.isArray(mg.orbs)) return;
    for (let i = 0; i < mg.orbs.length; i++) {
      const orb = mg.orbs[i];
      if (!orb || !isFinite(orb.x) || !isFinite(orb.y)) continue;

      if (Array.isArray(orb.trail)) {
        for (let j = 0; j < orb.trail.length; j++) {
          const t = orb.trail[j];
          if (!t || !isFinite(t.x) || !isFinite(t.y)) continue;
          const a = 0.10 + (j / Math.max(1, orb.trail.length)) * 0.28;
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(Math.round(t.x - 2), Math.round(t.y - 2), 4, 4);
        }
      }

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ffc27a';
      ctx.fillRect(Math.round(orb.x - 6), Math.round(orb.y - 6), 12, 12);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(orb.x - 4), Math.round(orb.y - 4), 8, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(Math.round(orb.x - 2), Math.round(orb.y - 2), 4, 4);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(Math.round(orb.x - 1), Math.round(orb.y - 1), 2, 2);
    }
    ctx.globalAlpha = 1;
  } catch (e) {}
}

function drawSparkles(ctx) {
  try {
    for (let i = 0; i < sparkles.length; i++) {
      const p = sparkles[i];
      if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      const lifeRatio = Math.max(0, 1 - (p.age / p.life));
      if (lifeRatio <= 0) continue;
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color || '#facc15';
      const size = isFinite(p.size) ? p.size : 2;
      ctx.fillRect(Math.round(p.x - size * 0.5), Math.round(p.y - size * 0.5), size, size);
    }
    ctx.globalAlpha = 1;
  } catch (e) {}
}

function drawEndCard(ctx, canvas, mg, now) {
  try {
    if (!mg || !mg.endCard || now >= mg.endCard) return;
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const pw = 300;
    const ph = 132;
    const x = Math.round(cx - pw * 0.5);
    const y = Math.round(cy - ph * 0.5);

    ctx.fillStyle = 'rgba(6, 6, 10, 0.92)';
    ctx.fillRect(x, y, pw, ph);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x, y, pw, 2);
    ctx.fillRect(x, y + ph - 2, pw, 2);
    ctx.fillRect(x, y, 2, ph);
    ctx.fillRect(x + pw - 2, y, 2, ph);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 6, y + 6, pw - 12, ph - 12);
    ctx.clip();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(fitFn('ORB CATCH!', pw - 24), cx, y + 34);

    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(fitFn('Score: ' + mg.score, pw - 24), cx, y + 68);

    ctx.fillStyle = '#e8e6df';
    ctx.font = '12px monospace';
    ctx.fillText(fitFn('Best: ' + mg.best, pw - 24), cx, y + 96);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  } catch (e) {}
}

function draw(ctx) {
  try {
    const Vv = getV();
    const mg = getMG();
    if (!ctx) return;
    const now = nowFn();
    const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas ? Vv.canvas : null);

    ctx.save();
    if (canvas) {
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.clip();
    }

    drawSign(ctx);

    if (mg && mg.active) {
      drawOrbs(ctx);
      drawSparkles(ctx);
    }

    if (mg && !mg.active && mg.endCard) {
      if (canvas) drawEndCard(ctx, canvas, mg, now);
    }

    ctx.restore();
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  if (!window.GuildMinigame) window.GuildMinigame = createState();
  if (!window.GuildMinigame.orbs) window.GuildMinigame.orbs = [];
  window.GuildMinigame.update = update;
  window.GuildMinigame.draw = draw;
  window.GuildMinigame.__probe = function () {
    return { pressed: Array.from(pressed), prev: Array.from(prevPressed) };
  };
  if (!window.__mmListeners) {
    window.__mmListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
