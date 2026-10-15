const MAX_LIVE = 16;
const SPAWN_RATE = 0.38;

let bubbles = [];
let lastTime = null;

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

function isNight(Vv) {
  if (!Vv) return false;
  const nf = Vv.nightFactor;
  if (typeof nf === 'number') return nf > 0.45;
  if (typeof Vv.daylight === 'number') return Vv.daylight < 0.55;
  return false;
}

function sleepingWorkers(Vv) {
  if (!Vv || !Array.isArray(Vv.workerStates)) return [];
  const out = [];
  for (let i = 0; i < Vv.workerStates.length; i++) {
    const w = Vv.workerStates[i];
    if (!w || !isFinite(w.x) || !isFinite(w.y)) continue;
    if (w.mode !== 'idle') continue;
    if (!w.atDesk) continue;
    if (w.sitting === false) continue;
    out.push({ index: i, worker: w });
  }
  return out;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  if (!w || !w.V) return;
  const Vv = w.V;
  if (Vv.gameState !== 'play') {
    lastTime = null;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (!isNight(Vv)) {
    bubbles = [];
    return;
  }

  const next = [];
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    b.age += dt;
    if (b.age >= b.life) continue;
    b.vy += 6 * dt;
    b.vx *= 0.985;
    b.x += (b.vx + Math.sin(b.age * 2.6 + b.phase) * 4.5) * dt;
    b.y += b.vy * dt;
    next.push(b);
  }
  bubbles = next;

  const sleepers = sleepingWorkers(Vv);
  if (!sleepers.length || bubbles.length >= MAX_LIVE) return;

  const countByWorker = {};
  for (let i = 0; i < bubbles.length; i++) {
    const idx = bubbles[i].workerIndex;
    countByWorker[idx] = (countByWorker[idx] || 0) + 1;
  }

  let live = bubbles.length;
  for (let s = 0; s < sleepers.length && live < MAX_LIVE; s++) {
    const slot = sleepers[s];
    const worker = slot.worker;
    const existing = countByWorker[slot.index] || 0;
    if (existing >= 3) continue;
    if (Math.random() >= dt * SPAWN_RATE) continue;

    bubbles.push({
      workerIndex: slot.index,
      x: worker.x + 8 + (Math.random() - 0.5) * 6,
      y: worker.y - 12 + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 6,
      vy: -16 - Math.random() * 12,
      age: 0,
      life: 1.35 + Math.random() * 1.15,
      size: 3 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      color: Math.random() < 0.62 ? '#facc15' : '#ffffff'
    });
    countByWorker[slot.index] = (countByWorker[slot.index] || 0) + 1;
    live++;
  }
}

function draw(ctx) {
  if (!ctx) return;
  const w = root();
  if (!w || !w.V) return;
  const Vv = w.V;
  if (Vv.gameState !== 'play' || !isNight(Vv)) return;

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    const t = b.age / b.life;
    const fadeIn = Math.min(1, b.age * 2.2);
    const fadeOut = Math.max(0, 1 - t);
    const alpha = fadeIn * fadeOut * fadeOut;
    if (alpha <= 0.01) continue;

    const pop = t > 0.76;
    const radius = b.size * (1 - 0.42 * t);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, Math.max(0.5, radius), 0, Math.PI * 2);
    ctx.fill();

    if (pop) {
      const ringR = b.size + (t - 0.76) / 0.24 * 9;
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(1, ringR), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildDreamBubbles) window.GuildDreamBubbles = {};
  window.GuildDreamBubbles.update = update;
  window.GuildDreamBubbles.draw = draw;
}

export {};
