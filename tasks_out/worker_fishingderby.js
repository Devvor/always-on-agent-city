const POST = { gx: 3, gy: 2 };

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return {
    anchor: { gx: POST.gx, gy: POST.gy },
    active: false,
    startedAt: 0,
    endsAt: 0,
    sessionScore: 0,
    catches: 0,
    nextCatchAt: 0,
    cooldownUntil: 0,
    castCooldownUntil: 0,
    bestScore: 0,
    feedbackText: '',
    feedbackUntil: 0
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() {
  const w = root();
  if (!w || typeof w.V !== 'object' || !w.V) return null;
  return w.V;
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
  const s = String(text == null ? '' : text);
  if (!isFinite(maxW) || maxW <= 0) return '';
  return s.length * 7 <= maxW ? s : s.slice(0, Math.max(0, Math.floor(maxW / 7) - 1)) + '\u2026';
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildFishingDerby; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function getAllTasks() {
  const w = root();
  if (!w || typeof w.allTasks === 'undefined' || !Array.isArray(w.allTasks)) return [];
  return w.allTasks;
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function isNearDerby() {
  const vis = getVisitor();
  const st = getState();
  if (!vis || !st || !st.anchor) return false;
  return Math.hypot(vis.gx - st.anchor.gx, vis.gy - st.anchor.gy) <= 1.7;
}

function awardCoins(amount) {
  const Vv = getV();
  if (!Vv) return;
  const hooks = ['awardCoins', 'addCoins', 'gainCoins', 'earnCoins', 'collectCoins', 'depositCoins'];
  let used = false;
  for (let i = 0; i < hooks.length; i++) {
    if (typeof Vv[hooks[i]] === 'function') {
      try { Vv[hooks[i]](amount); used = true; } catch (e) {}
      if (used) break;
    }
  }
  if (typeof Vv.coins === 'number') Vv.coins += amount;
  if (typeof Vv.score === 'number') Vv.score += amount;
  cue('done');
}

function performCatch(now, st) {
  if (!st) return;
  const values = [5, 10, 10, 15, 20, 25];
  const value = values[Math.floor(Math.random() * values.length)];
  awardCoins(value);
  st.catches += 1;
  st.sessionScore += value;
  st.bestScore = Math.max(st.bestScore, st.sessionScore);
  st.feedbackText = '+' + value + ' coins';
  st.feedbackUntil = now + 1200;
  st.castCooldownUntil = now + 350;
  if (st.catches >= 6) endDerby(now, st);
}

function endDerby(now, st) {
  if (!st) return;
  st.active = false;
  st.cooldownUntil = now + 10000;
  st.feedbackText = 'DERBY END';
  st.feedbackUntil = now + 1400;
}

function handleInteract(now) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!isNearDerby()) return;

  if (now < st.cooldownUntil) {
    st.feedbackText = 'NEXT IN ' + Math.ceil((st.cooldownUntil - now) / 1000) + 's';
    st.feedbackUntil = now + 900;
    return;
  }

  if (!st.active) {
    st.active = true;
    st.startedAt = now;
    st.endsAt = now + 6000;
    st.sessionScore = 0;
    st.catches = 0;
    st.nextCatchAt = now + 1200;
    performCatch(now, st);
    return;
  }

  if (now >= st.castCooldownUntil) performCatch(now, st);
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
  const now = nowFn();
  const Vv = getV();
  const vis = getVisitor();
  const st = getState();
  if (st && vis && Vv && Vv.gameState === 'play' && (k === 'e' || k === ' ') && isNearDerby()) {
    handleInteract(now);
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
  if (k === 'e' || k === ' ' || k === 'escape') prevPressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const w = root();
  if (!w) { lastTime = now; return; }
  if (!Vv || Vv.gameState !== 'play') { lastTime = now; return; }

  const st = getState();
  if (!st) { lastTime = now; return; }

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  getAllTasks();

  if (st.active) {
    if (now >= st.nextCatchAt) {
      performCatch(now, st);
      st.nextCatchAt = now + 1200 + Math.floor(Math.random() * 600);
    }
    if (now >= st.endsAt) endDerby(now, st);
  }
  if (st.feedbackUntil && now >= st.feedbackUntil) {
    st.feedbackText = '';
    st.feedbackUntil = 0;
  }
}

function draw(ctx) {
  if (!ctx) return;
  const Vv = getV();
  const w = root();
  if (!w || !Vv || Vv.gameState !== 'play') return;
  const st = getState();
  if (!st || !st.anchor) return;

  const now = nowFn();
  const pt = isoFn(st.anchor.gx, st.anchor.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const near = isNearDerby();
  const bob = Math.round(Math.sin(now * 0.003) * 2);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 16, y + 10, 32, 5);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(x - 3, y - 34, 6, 36);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 15, y - 36, 30, 6);
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x - 4, y - 42, 8, 10);

  const px = x - 30;
  const py = y - 86 + bob;
  const pw = 60;
  const ph = 34;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn('DERBY', pw - 8), px + pw * 0.5, py + 8);

  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 10px monospace';
  if (st.active) {
    ctx.fillStyle = '#22c55e';
    ctx.fillText(fitFn(String(st.sessionScore), pw - 8), px + pw * 0.5, py + 20);
  } else {
    ctx.fillStyle = '#facc15';
    ctx.fillText(fitFn('BEST ' + st.bestScore, pw - 8), px + pw * 0.5, py + 20);
  }

  let status = '';
  if (st.active) {
    status = 'CASTING  ' + st.catches;
  } else if (now < st.cooldownUntil) {
    status = 'NEXT ' + Math.ceil((st.cooldownUntil - now) / 1000) + 'S';
  } else if (near) {
    status = 'PRESS E';
  } else if (st.feedbackText) {
    status = st.feedbackText;
  }
  if (status) {
    ctx.fillStyle = st.active ? '#22c55e' : (now < st.cooldownUntil ? '#ef4444' : '#f3f4f6');
    ctx.font = 'bold 8px monospace';
    ctx.fillText(fitFn(status, pw - 4), px + pw * 0.5, py + 30);
  }

  if (st.feedbackText && now < st.feedbackUntil) {
    ctx.save();
    const a = Math.max(0, 1 - (now - (st.feedbackUntil - 1200)) / 1200);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(fitFn(st.feedbackText, 80), x - 40, y - 100);
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

if (typeof window !== 'undefined') {
  if (!window.GuildFishingDerby) window.GuildFishingDerby = createState();
  const gfd = window.GuildFishingDerby;
  gfd.update = update;
  gfd.draw = draw;
  if (!window.__gfdListeners) {
    window.__gfdListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
