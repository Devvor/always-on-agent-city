// tasks_out/worker_banter.js — campfire banter FX layer.
// Self-installing ES module, no imports, no top-level DOM access.
// Never writes to V; pure FX. Bails silently if V or iso are missing.

const BANTER_INTERVAL = 20000;   // ~20s between lines
const BANTER_LIFE = 6000;        // max 6s visible
const BANTER_FADE = 1200;        // fade-out window

const GRIT_LINES = [
  'Another plank, another day.',
  'The grind never sleeps, friend.',
  'Calluses are just XP for hands.',
  'Smoke keeps the bugs off the ledger.',
  'One more beam before the bell.'
];
const WISTFUL_LINES = [
  'I used to dream in color. Now it is beige.',
  'The coin purse echoes these days.',
  'Someday I will quest past that rim.',
  'Broke, but the fire is free.',
  'Idle hands, heavy heart.'
];

function createState() {
  return {
    anchor: { gx: 2, gy: 2 },      // 2+ tiles from every HEARTH prop
    zone: 'HEARTH',
    bubble: null,                   // { text, color, start }
    nextAt: 0,
    lastPick: -1
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  return null;   // hard bail per spec
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildBanter; }

function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function isWorking(meta) {
  const tasks = (meta && Array.isArray(meta.tasks)) ? meta.tasks : [];
  for (let i = 0; i < tasks.length; i++) {
    const s = tasks[i] && tasks[i].status;
    if (s === 'pending' || s === 'in_progress') return true;
  }
  return false;
}

function pickWorker(Vv) {
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  if (!metas.length) return -1;
  const st = getState();
  if (metas.length === 1) return 0;
  let idx = Math.floor(Math.random() * metas.length);
  if (idx === st.lastPick) idx = (idx + 1) % metas.length;
  return idx;
}

function spawnBubble(now) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv) return;
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  const idx = pickWorker(Vv);
  if (idx < 0 || !metas[idx]) return;
  const meta = metas[idx];
  const working = isWorking(meta);
  const pool = working ? GRIT_LINES : WISTFUL_LINES;
  const line = pool[Math.floor(Math.random() * pool.length)];
  const name = (meta.name != null) ? String(meta.name) : ('WORKER ' + (idx + 1));
  st.lastPick = idx;
  st.bubble = {
    workerIndex: idx,
    name: name,
    color: workerColor(idx, name),
    text: name + ': ' + line,
    start: now
  };
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(working ? 'work' : 'idle'); } catch (e) {}
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (!isoFn(0, 0)) return;   // iso missing -> silent bail
  if (!st.nextAt) st.nextAt = now + BANTER_INTERVAL;
  if (st.bubble && now - st.bubble.start >= BANTER_LIFE) st.bubble = null;
  if (!st.bubble && now >= st.nextAt) {
    spawnBubble(now);
    st.nextAt = now + BANTER_INTERVAL;
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !st.bubble) return;
  const pt = isoFn(st.anchor.gx, st.anchor.gy);
  if (!pt) return;
  const now = nowFn();
  const age = now - st.bubble.start;
  if (age < 0 || age >= BANTER_LIFE) return;
  let alpha = 1;
  if (age > BANTER_LIFE - BANTER_FADE) alpha = Math.max(0, 1 - (age - (BANTER_LIFE - BANTER_FADE)) / BANTER_FADE);
  const bob = Math.sin(now * 0.003) * 2;
  const x = Math.round(pt.x);
  const y = Math.round(pt.y - 46 + bob);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '10px monospace';
  const text = fitFn(st.bubble.text, 150);
  const tw = ctx.measureText(text).width;
  const bw = Math.max(50, Math.round(tw) + 12);
  const bh = 16;
  const bx = x - Math.round(bw * 0.5);
  const by = y;
  // tail
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.beginPath();
  ctx.moveTo(x - 3, by + bh);
  ctx.lineTo(x + 3, by + bh);
  ctx.lineTo(x, by + bh + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = st.bubble.color || '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#e8e6df';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, bx + 6, by + bh * 0.5 + 1);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildBanter) window.GuildBanter = createState();
  window.GuildBanter.update = update;
  window.GuildBanter.draw = draw;
  window.GuildBanter.__probe = function () {
    const st = window.GuildBanter;
    return {
      zone: st.zone,
      anchor: { gx: st.anchor.gx, gy: st.anchor.gy },
      bubble: st.bubble ? { name: st.bubble.name, text: st.bubble.text } : null,
      nextAt: st.nextAt
    };
  };
  window.GuildBanter.__rawUpdate = update;
}

export {};
