const MOODS = {
  0: {
    rain: ['my pixels are WET', 'heh. sky patch notes.'],
    hum: ['heh. sky patch notes.', 'my pixels are WET']
  },
  1: {
    rain: ['the sky writes in grey ink', 'a clear note. fine.'],
    hum: ['a clear note. fine.', 'the sky writes in grey ink']
  },
  2: {
    rain: ['rain! does the board rust??', 'great weather for quests!'],
    hum: ['great weather for quests!', 'rain! does the board rust??']
  },
  3: {
    rain: ['water returns to water', 'the island breathes.'],
    hum: ['the island breathes.', 'water returns to water']
  }
};

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
function randFn() {
  const w = root();
  const Vv = getV();
  if (Vv && typeof Vv.rnd === 'number') {
    Vv.rnd = (Vv.rnd * 1664525 + 1013904223) >>> 0;
    return Vv.rnd / 4294967296;
  }
  return Math.random();
}

function isIdleOrResting(workerState) {
  if (!workerState) return false;
  const ws = String(workerState.workerState || workerState.state || '').toUpperCase();
  if (ws === 'IDLE' || ws === 'RESTING' || ws === 'REST') return true;
  if (ws === 'WORKING' || ws === 'IN_PROGRESS' || ws === 'BUSY') return false;
  const mode = String(workerState.mode || '').toLowerCase();
  if (mode === 'idle' || mode === 'rest' || mode === 'resting') return true;
  if (mode === 'in_progress' || mode === 'pending' || mode === 'working' || mode === 'done' || mode === 'failed') return false;
  return true;
}

function pickWorkerIndex(Vv) {
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  if (!states.length) return -1;
  const candidates = [];
  for (let i = 0; i < states.length; i++) {
    if (isIdleOrResting(states[i])) candidates.push(i);
  }
  if (!candidates.length) return -1;
  const idx = Math.floor(randFn() * candidates.length);
  return candidates[idx];
}

function moodText(index, kind) {
  const m = MOODS[index % 4];
  if (!m) return '';
  const arr = m[kind];
  if (!arr || !arr.length) return '';
  return arr[Math.floor(randFn() * arr.length)];
}

function weatherIsRain(Vv) {
  if (!Vv || !Vv.weather) return false;
  const w = String(Vv.weather).toUpperCase();
  return w === 'RAIN' || w === 'RAINNY' || w === 'DRIZZLE';
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  if (!w) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const moods = w.GuildMoods;
  if (!moods) return;

  if (moods.nextAt <= now) {
    const rain = weatherIsRain(Vv);
    const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
    const isNight = daylight < 0.3;
    const useRain = rain;
    const kind = useRain ? 'rain' : 'hum';
    const wi = pickWorkerIndex(Vv);
    if (wi >= 0) {
      const text = moodText(wi, kind);
      if (text) {
        moods.bubble = {
          workerIndex: wi,
          text: text,
          kind: kind,
          start: now,
          duration: 4000
        };
        if (typeof w.cue === 'function') {
          try { w.cue('mood'); } catch (e) {}
        }
      }
    }
    const base = useRain ? 18000 : 35000;
    const span = useRain ? 6000 : 13000;
    moods.nextAt = now + base + randFn() * span;
  }

  if (moods.bubble && now - moods.bubble.start >= moods.bubble.duration) {
    moods.bubble = null;
  }
}

function drawBubble(ctx, Vv, bubble, now) {
  if (!ctx || !bubble || !Vv || !Vv.grid) return;
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const ws = states[bubble.workerIndex];
  if (!ws) return;
  const pt = isoFn(ws.x, ws.y);
  const c = Vv.canvas;
  if (!c) return;

  const maxW = 90;
  const text = fitFn(bubble.text, maxW);
  ctx.font = '10px monospace';
  const metrics = ctx.measureText(text);
  const textW = Math.round(metrics.width);
  const textH = 12;
  const pad = 6;
  const bw = Math.max(28, textW + pad * 2);
  const bh = textH + pad * 2;

  const age = now - bubble.start;
  const life = bubble.duration;
  let alpha = 1;
  if (age < 400) alpha = age / 400;
  else if (age > life - 400) alpha = Math.max(0, (life - age) / 400);
  alpha = Math.max(0, Math.min(1, alpha)) * 0.9;

  const bx = Math.round(pt.x + 8 - bw * 0.5);
  const by = Math.round(pt.y - bh - 14);

  const topPad = 46;
  const chatH = 14 + 6 * 14 + 8 + 8;
  const chatTop = c.height - chatH - topPad;
  const minY = chatTop - 4;
  const clampedBy = Math.max(by, minY);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  const radius = 5;
  ctx.moveTo(bx + radius, by);
  ctx.lineTo(bx + bw - radius, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
  ctx.lineTo(bx + bw, by + bh - radius);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
  ctx.lineTo(bx + radius, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
  ctx.lineTo(bx, by + radius);
  ctx.quadraticCurveTo(bx, by, bx + radius, by);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.stroke();

  const tailX = Math.round(pt.x + 8);
  const tailY = Math.round(pt.y - 4);
  ctx.beginPath();
  ctx.moveTo(bx + Math.round(bw * 0.5) - 3, by + bh);
  ctx.lineTo(bx + Math.round(bw * 0.5) + 3, by + bh);
  ctx.lineTo(tailX, tailY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#111827';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, bx + pad, by + pad + textH * 0.5);
  ctx.restore();
}

function draw(ctx) {
  const w = root();
  if (!w) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const moods = w.GuildMoods;
  if (!moods || !moods.bubble) return;
  const now = nowFn();
  drawBubble(ctx, Vv, moods.bubble, now);
}

function __probe() {
  const w = root();
  if (!w) return { bubble: false, nextIn: 0 };
  const moods = w.GuildMoods;
  if (!moods) return { bubble: false, nextIn: 0 };
  const now = nowFn();
  return {
    bubble: !!moods.bubble,
    nextIn: Math.max(0, (moods.nextAt || 0) - now)
  };
}

if (typeof window !== 'undefined') {
  if (!window.GuildMoods) {
    window.GuildMoods = { nextAt: 0, bubble: null };
  }
  window.GuildMoods.update = update;
  window.GuildMoods.draw = draw;
  window.GuildMoods.__probe = __probe;
}

export {};
