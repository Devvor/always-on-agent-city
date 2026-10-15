const BUILDINGS = [];

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

const MERCHANT_DEFS = [
  { name: 'MISSINGNO', archetype: 'trickster', gx: -1, gy: 4 },
  { name: 'LAGUNA', archetype: 'rookie', gx: 1, gy: 5 }
];

const MOOD_LINES = {
  trickster: {
    busy: ['[glitch] BUY! BUY! The GC counter moved.', '[glitch] sales are alive. keheheh.'],
    quiet: ['[glitch] ...tumbleweeds. not one buy.', '[glitch] did the visitors forget our stalls?'],
    idle: ['[glitch] the stalls remember everything.', 'keheheh... coins in, hype out.']
  },
  rookie: {
    busy: ['Busy day! Real customers! I tagged every bag.', 'Fresh stock moving! I polished the coins.'],
    quiet: ['Aw... no visitors? I will tidy then.', 'Quiet... maybe I priced too high?'],
    idle: ['I saved a copper - want to see? ...please say yes.', 'Is this how guilds always feel before busy?']
  }
};

function readAllTasks() {
  const w = root();
  if (w && Array.isArray(w.allTasks)) return w.allTasks.slice();
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks.slice();
  if (Vv && Array.isArray(Vv.tasks)) return Vv.tasks.slice();
  if (Vv && Array.isArray(Vv.workers)) {
    let out = [];
    for (let i = 0; i < Vv.workers.length; i++) {
      const ws = Vv.workers[i];
      if (ws && Array.isArray(ws.tasks)) out = out.concat(ws.tasks);
    }
    return out;
  }
  return [];
}

function readEconomy() {
  const Vv = getV();
  const tasks = readAllTasks();
  let doneCount = 0;
  let activeCount = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const s = String(t && t.status != null ? t.status : '').toLowerCase();
    if (s === 'done' || s === 'completed' || s === 'complete') doneCount++;
    if (s === 'pending' || s === 'in_progress' || s === 'todo' || s === 'queued' || s === 'active') activeCount++;
  }
  const totalDone = (Vv && typeof Vv.totalDone === 'number') ? Vv.totalDone : doneCount;
  return { tasks: tasks, doneCount: doneCount, activeCount: activeCount, totalDone: totalDone };
}

function decideMood(snap, lastTotalDone) {
  const total = snap.tasks.length;
  const active = snap.activeCount;
  const gcDelta = snap.totalDone - (lastTotalDone == null ? snap.totalDone : lastTotalDone);
  if (total === 0 || active === 0) return 'quiet';
  if (gcDelta > 0 || active >= 2 || total >= 4) return 'busy';
  return 'idle';
}

function pickLine(merchant, mood) {
  const bank = (MOOD_LINES[merchant.archetype] || MOOD_LINES.rookie);
  const options = (bank && Array.isArray(bank[mood])) ? bank[mood] : (bank.idle || ['...']);
  return options[Math.floor(Math.random() * options.length)];
}

function createState() {
  return {
    merchants: MERCHANT_DEFS.map(function (def, index) {
      return {
        id: index,
        name: def.name,
        archetype: def.archetype,
        gx: def.gx,
        gy: def.gy,
        mood: 'idle',
        line: pickLine({ archetype: def.archetype }, 'idle'),
        lastMoodAt: null,
        bob: index * 1.3,
        phase: index * 0.9,
        accent: '#d4af37'
      };
    }),
    lastTime: null,
    lastTotalDone: null
  };
}

let CURRENT = createState();

function getState() { return CURRENT; }

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state || !state.merchants) return;
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;
  const snap = readEconomy();
  if (state.lastTotalDone == null) state.lastTotalDone = snap.totalDone;

  for (let i = 0; i < state.merchants.length; i++) {
    const m = state.merchants[i];
    if (m.lastMoodAt == null || now - m.lastMoodAt >= 45000) {
      const mood = decideMood(snap, state.lastTotalDone);
      m.mood = mood;
      m.line = pickLine(m, mood);
      m.lastMoodAt = now;
    }
    m.bob += 0.05;
  }
  state.lastTotalDone = snap.totalDone;
  state.lastTime = now;
}

function drawMerchant(ctx, m, now) {
  if (!ctx || !m) return;
  const pt = isoFn(m.gx, m.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y + Math.sin(now * 0.0025 + m.phase) * 1.2);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 4, Math.round(pt.y) + 17, 20, 4);

  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x + 2, y + 10, 4, 8);
  ctx.fillRect(x + 10, y + 10, 4, 8);
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(x + 1, y - 2, 14, 12);
  ctx.fillStyle = '#f1c9a5';
  ctx.fillRect(x + 3, y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, y - 8, 2, 2);
  ctx.fillRect(x + 9, y - 8, 2, 2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 4, y - 12, 8, 2);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 2, y + 3, 12, 2);

  const name = String(m.name || 'MERCHANT');
  const tagW = 82;
  const tagH = 12;
  const cx = x + 7;
  const tagX = cx - Math.round(tagW * 0.5);
  const tagY = y - 35;
  ctx.fillStyle = 'rgba(10,10,12,0.88)';
  ctx.fillRect(tagX, tagY, tagW, tagH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(tagX, tagY, tagW, tagH);
  ctx.fillStyle = '#f3d37a';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitFn(name, tagW - 6), tagX + tagW * 0.5, tagY + tagH * 0.5 + 1);
  ctx.textAlign = 'left';

  const line = String(m.line || '');
  if (!line) return;
  const maxBw = 172;
  const shown = fitFn(line, maxBw - 12);
  ctx.font = '10px monospace';
  const textW = ctx.measureText(shown).width;
  const bw = Math.max(52, Math.round(textW + 12));
  const bh = 16;
  let bx = Math.round(x + 8 - bw * 0.5);
  let by = Math.round(y - 58);
  const c = (ctx && ctx.canvas) ? ctx.canvas : (getV() && getV().canvas);
  if (c) {
    if (bx < 4) bx = 4;
    if (bx + bw > c.width - 4) bx = c.width - bw - 4;
  }
  const tipY = Math.round(y - 20);
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.beginPath();
  ctx.moveTo(Math.round(bx + bw * 0.5 - 3), by + bh);
  ctx.lineTo(Math.round(bx + bw * 0.5 + 3), by + bh);
  ctx.lineTo(Math.round(x + 8), tipY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(bx + bw * 0.5 - 3), by + bh);
  ctx.lineTo(Math.round(x + 8), tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.round(bx + bw * 0.5 + 3), by + bh);
  ctx.lineTo(Math.round(x + 8), tipY);
  ctx.stroke();
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#e8e6df';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, bx + 6, by + bh * 0.5);
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  if (!state || !state.merchants) return;
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;
  const now = nowFn();
  for (let i = 0; i < state.merchants.length; i++) {
    drawMerchant(ctx, state.merchants[i], now);
  }
}

if (typeof window !== 'undefined') {
  window.GuildMerchants = CURRENT;
  window.GuildMerchants.update = update;
  window.GuildMerchants.draw = draw;
  window.GuildMerchants.merchants = CURRENT.merchants;
  window.GuildMerchants.__rawUpdate = update;
}

export {};
