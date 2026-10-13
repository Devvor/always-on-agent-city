let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildSpar) w.GuildSpar = { active: null, nextAt: 0 };
  return w.GuildSpar;
}
function randDelay() { return 90000 + Math.random() * 60000; }
function cueFn(name) {
  const w = root();
  if (!w || typeof w.cue !== 'function') return;
  try { w.cue(name); } catch (e) {}
}
function isIdleState(ws) {
  if (!ws || typeof ws !== 'object') return false;
  const direct = ['workerState', 'state', 'status', 'mode', 'worker_status', 'workerStatus'];
  for (let i = 0; i < direct.length; i++) {
    const v = ws[direct[i]];
    if (typeof v === 'string' && /IDLE/i.test(v)) return true;
  }
  for (const k in ws) {
    if (Object.prototype.hasOwnProperty.call(ws, k)) {
      const v = ws[k];
      if (typeof v === 'string' && /IDLE/i.test(v)) return true;
    }
  }
  return false;
}
function finitePos(w) {
  return !!w && typeof w.x === 'number' && isFinite(w.x) && typeof w.y === 'number' && isFinite(w.y);
}
function workerStates() {
  const Vv = getV();
  return (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
}

const QUIPS = [
  'en garde!',
  'this is how we train',
  'no spells, just keys!',
  'rematch after standup',
  'the cat judges us'
];

function update(now) {
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  const st = getState();
  if (!st) return;
  if (!st.nextAt) st.nextAt = now + randDelay();

  if (st.active) {
    const a = st.active;
    const dur = (a && typeof a.dur === 'number') ? a.dur : 4000;
    const t0 = (a && typeof a.t0 === 'number') ? a.t0 : 0;
    if (!a || now - t0 >= dur) {
      cueFn('done');
      st.active = null;
    }
    return;
  }

  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  if (now < st.nextAt) return;

  const ws = workerStates();
  if (ws.length < 2) {
    st.nextAt = now + randDelay();
    return;
  }

  const idle = [];
  for (let i = 0; i < ws.length; i++) {
    if (isIdleState(ws[i]) && finitePos(ws[i])) idle.push(i);
  }
  if (idle.length < 2) {
    st.nextAt = now + randDelay();
    return;
  }

  let bestA = idle[0];
  let bestB = idle[1];
  let bestDist = Infinity;
  for (let i = 0; i < idle.length; i++) {
    for (let j = i + 1; j < idle.length; j++) {
      const a = idle[i];
      const b = idle[j];
      const dist = Math.hypot(ws[a].x - ws[b].x, ws[a].y - ws[b].y);
      if (dist < bestDist) {
        bestDist = dist;
        bestA = a;
        bestB = b;
      }
    }
  }

  st.active = {
    a: bestA,
    b: bestB,
    t0: now,
    dur: 4000,
    quipA: QUIPS[Math.floor(Math.random() * QUIPS.length)],
    quipB: QUIPS[Math.floor(Math.random() * QUIPS.length)]
  };
  st.nextAt = now + 4000 + randDelay();
  cueFn('alert');
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  if (!st || !st.active) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const a = st.active;
  const ws = workerStates();
  const p0 = ws[a.a];
  const p1 = ws[a.b];
  if (!finitePos(p0) || !finitePos(p1)) return;

  const now = nowFn();
  const dur = (typeof a.dur === 'number') ? a.dur : 4000;
  const t0 = (typeof a.t0 === 'number') ? a.t0 : now;
  if (now - t0 >= dur) return;

  const age = now - t0;
  const mx = (p0.x + p1.x) * 0.5;
  const my = (p0.y + p1.y) * 0.5;

  ctx.save();

  // Comic FX: spinning gold asterisk burst at midpoint.
  const spin = now * 0.008;
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const ang = spin + i * Math.PI * 0.25;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(ang) * 2, my + Math.sin(ang) * 2);
    ctx.lineTo(mx + Math.cos(ang) * 13, my + Math.sin(ang) * 13);
    ctx.stroke();
  }

  // Overlay-only dust puffs at workers' feet (real workers are never moved).
  const puffs = [p0, p1];
  ctx.fillStyle = 'rgba(160,150,140,0.75)';
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    const bx = Math.round(p.x);
    const by = Math.round(p.y) + 17;
    ctx.fillRect(bx + 2, by, 4, 2);
    ctx.fillRect(bx + 10, by, 4, 2);
    ctx.fillRect(bx + 1, by + 2, 3, 1);
    ctx.fillRect(bx + 12, by + 2, 3, 1);
  }

  // Quip bubbles above each worker.
  const speeches = [a.quipA, a.quipB];
  const workers = [p0, p1];
  for (let i = 0; i < 2; i++) {
    const p = workers[i];
    const text = fitFn(String(speeches[i] == null ? '' : speeches[i]), 120);
    const font = 'bold 10px monospace';
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const bw = Math.max(28, Math.round(tw + 10));
    const bh = 18;
    const bx = Math.round(p.x + 8 - bw * 0.5);
    let by = Math.round(p.y - bh - 16);
    if (by <= 60) by = 61;
    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 5, by + bh * 0.5 + 0.5);
  }

  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildSpar) window.GuildSpar = { active: null, nextAt: 0 };
  window.GuildSpar.update = update;
  window.GuildSpar.draw = draw;
  window.GuildSpar.__probe = function () { return getState(); };
  window.GuildSpar.__rawUpdate = update;
}

export {};
