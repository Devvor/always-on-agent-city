let pressed = new Set();
let prevPressed = new Set();
let cooldownUntil = 0;
let feathers = [];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V ? w.V : null; }
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
function getState() { const w = root(); return w && w.GuildPigeonPost; }

function createState() {
  return { gx: 6.0, gy: -2.2, letter: null, replies: [], nextReply: 0 };
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function visitorDistanceTiles() {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return Infinity;
  return Math.hypot(vis.gx - 6.0, vis.gy - (-2.2));
}

function pickWorkingWorker() {
  const Vv = getV();
  if (!Vv) return -1;
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  const out = [];
  for (let i = 0; i < states.length; i++) {
    const st = states[i];
    if (!st) continue;
    const meta = workers[i] || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(st.tasks) ? st.tasks : []);
    const working = st.workerState === 'WORKING' || tasks.some(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
    if (working) out.push(i);
  }
  if (!out.length && workers.length) {
    for (let i = 0; i < workers.length; i++) out.push(i);
  }
  if (!out.length) return -1;
  return out[Math.floor(Math.random() * out.length)];
}

function archetypeFor(name, index) {
  const n = String(name || '').toLowerCase();
  if (n.indexOf('trick') !== -1 || n.indexOf('glitch') !== -1 || n.indexOf('miss') !== -1 || n.indexOf('chaos') !== -1 || n.indexOf('gremlin') !== -1) return 'trickster';
  if (n.indexOf('poet') !== -1 || n.indexOf('bard') !== -1 || n.indexOf('verse') !== -1 || n.indexOf('step') !== -1 || n.indexOf('aloof') !== -1 || n.indexOf('shadow') !== -1) return 'poet';
  if (n.indexOf('rook') !== -1 || n.indexOf('rookie') !== -1 || n.indexOf('eager') !== -1 || n.indexOf('junior') !== -1 || n.indexOf('new') !== -1 || n.indexOf('appren') !== -1) return 'rookie';
  if (n.indexOf('phil') !== -1 || n.indexOf('sage') !== -1 || n.indexOf('serene') !== -1 || n.indexOf('wise') !== -1 || n.indexOf('monk') !== -1 || n.indexOf('oracle') !== -1) return 'philosopher';
  const choices = ['trickster', 'poet', 'rookie', 'philosopher'];
  return choices[(index == null ? 0 : index) % choices.length];
}

function replyTextFor(name, index) {
  const arch = archetypeFor(name, index);
  if (arch === 'trickster') return 'heh, mail received - thanks, guild visitor. glitch signature optional.';
  if (arch === 'poet') return 'your parchment arrived like wind across the isle; thanks, guild visitor.';
  if (arch === 'rookie') return 'Got your letter! Thanks, guild visitor - I will do my best!';
  return 'Your words reached me. Thank you, guild visitor.';
}

function easeOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - t, 3);
}

function onKeydown(e) {
  const k = normKey(e);
  if (k !== 'e') return;
  pressed.add('e');
}

function onKeyup(e) {
  const k = normKey(e);
  if (k !== 'e') return;
  pressed.delete('e');
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  if (!state) return;
  const Vv = getV();

  const eNow = pressed.has('e');
  const eEdge = eNow && !prevPressed.has('e');
  prevPressed = new Set(pressed);

  if (Vv && typeof Vv.gameState === 'string' && Vv.gameState !== 'play') return;

  const dist = visitorDistanceTiles();
  const inRange = isFinite(dist) && dist <= 1.5;

  if (eEdge && inRange && !state.letter && now >= cooldownUntil) {
    const wi = pickWorkingWorker();
    if (wi >= 0) {
      const workers = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
      const meta = workers[wi] || {};
      state.letter = {
        workerIndex: wi,
        workerName: meta.name != null ? meta.name : ('WORKER ' + (wi + 1)),
        start: now,
        duration: 1800 + Math.random() * 1200,
        progress: 0
      };
      cooldownUntil = now + 3000;
    }
  }

  if (state.letter) {
    const letter = state.letter;
    const elapsed = now - letter.start;
    const duration = letter.duration || 2000;
    letter.progress = Math.max(0, Math.min(1, elapsed / duration));
    if (letter.progress >= 1) {
      const wi = letter.workerIndex;
      const workers = (Vv && Array.isArray(Vv.workers)) ? Vv.workers : [];
      const states = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
      const meta = workers[wi] || {};
      const name = meta.name != null ? meta.name : (states[wi] && states[wi].name != null ? states[wi].name : '');
      const text = replyTextFor(name, wi);

      if (true) {
        state.replies.push({
          id: state.nextReply++,
          workerIndex: wi,
          text: text,
          start: now,
          duration: 4000
        });
      }

      const wst = states[wi];
      if (wst && isFinite(wst.x) && isFinite(wst.y)) {
        feathers.push({
          x: wst.x + 8,
          y: wst.y - 8,
          vx: (Math.random() - 0.5) * 12,
          vy: -22 - Math.random() * 10,
          start: now,
          life: 1.4
        });
      }

      if (typeof window !== 'undefined' && typeof window.cue === 'function') {
        try { window.cue('done'); } catch (e) {}
      }
      state.letter = null;
    }
  }

  const nextReplies = [];
  for (let i = 0; i < state.replies.length; i++) {
    const reply = state.replies[i];
    if (!reply || !isFinite(reply.start) || !isFinite(reply.duration)) continue;
    if (now - reply.start < reply.duration) nextReplies.push(reply);
  }
  state.replies = nextReplies;

  const nextFeathers = [];
  for (let i = 0; i < feathers.length; i++) {
    const f = feathers[i];
    if (!f || !isFinite(f.start) || !isFinite(f.life)) continue;
    if (now - f.start < f.life * 1000) nextFeathers.push(f);
  }
  feathers = nextFeathers;
}

function drawStation(ctx, now) {
  const pt = isoFn(6.0, -2.2);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 1, y - 18, 2, 18);

  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x + 5, y - 13, 13, 17);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 5, y - 13, 13, 17);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 8, y - 8, 7, 2);
  ctx.fillRect(x + 8, y - 3, 7, 1);
}

function drawPigeon(ctx, x, y, now, carrying) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#8a8f98';
  ctx.fillRect(x - 6, y - 4, 12, 8);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 4, y - 8, 8, 4);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 2, y - 10, 5, 5);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(x + 7, y - 9, 3, 2);
  const wing = Math.round(Math.sin(now * 0.015) * 2);
  ctx.fillStyle = '#5b6068';
  ctx.fillRect(x - 8, y - 2 + wing, 6, 4);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 2, y + 4, 2, 3);
  ctx.fillRect(x + 3, y + 4, 2, 3);
  if (carrying) {
    ctx.fillStyle = '#f4e8c1';
    ctx.fillRect(x + 4, y + 1, 4, 3);
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 1, 4, 3);
  }
}

function drawReplies(ctx, Vv, now) {
  const state = getState();
  if (!state) return;
  const wstates = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];

  for (let i = 0; i < state.replies.length; i++) {
    const reply = state.replies[i];
    if (!reply) continue;
    const age = now - reply.start;
    if (!isFinite(age) || age < 0 || age >= reply.duration) continue;
    const w = wstates[reply.workerIndex];
    if (!w || !isFinite(w.x) || !isFinite(w.y)) continue;

    const alpha = age <= 3000 ? 1 : Math.max(0, 1 - (age - 3000) / 1000);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '10px monospace';
    const text = fitFn(reply.text, 168);
    const tw = ctx.measureText(text).width;
    const bw = Math.max(44, Math.round(tw + 12));
    const bh = 16;
    const bx = Math.round(w.x + 8 - bw * 0.5);
    const by = Math.round(w.y - 52);

    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.beginPath();
    ctx.moveTo(Math.round(bx + bw * 0.5 - 3), by + bh);
    ctx.lineTo(Math.round(bx + bw * 0.5 + 3), by + bh);
    ctx.lineTo(Math.round(w.x + 8), Math.round(w.y - 20));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e8e6df';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, bx + 6, by + bh * 0.5);
    ctx.restore();
  }
}

function drawFeathers(ctx, now) {
  for (let i = 0; i < feathers.length; i++) {
    const f = feathers[i];
    const age = (now - f.start) / 1000;
    if (!isFinite(age) || age < 0 || age >= f.life) continue;
    const alpha = Math.max(0, 1 - age / f.life);
    const x = Math.round(f.x + f.vx * age + Math.sin(age * 4) * 1.5);
    const y = Math.round(f.y + f.vy * age + 15 * age * age);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(x, y, 4, 1);
    ctx.fillRect(x + 1, y - 1, 2, 1);
    ctx.restore();
  }
}

function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  if (!state) return;
  const Vv = getV();
  if (Vv && typeof Vv.gameState === 'string' && Vv.gameState !== 'play') return;

  const now = nowFn();
  drawStation(ctx, now);

  const dist = visitorDistanceTiles();
  const inRange = isFinite(dist) && dist <= 1.5;
  if (inRange && !state.letter) {
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3d37a';
    ctx.fillText(fitFn('[E] send a letter', 150), Math.round(isoFn(6.0, -2.2).x), Math.round(isoFn(6.0, -2.2).y) - 32);
    ctx.restore();
  }

  if (state.letter && Vv) {
    const letter = state.letter;
    const startPt = isoFn(6.0, -2.2);
    const ws = (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : [];
    const wi = letter.workerIndex;
    let targetX = startPt.x;
    let targetY = startPt.y;
    if (ws[wi] && isFinite(ws[wi].x) && isFinite(ws[wi].y)) {
      targetX = ws[wi].x + 8;
      targetY = ws[wi].y - 8;
    }
    const t = easeOutCubic(letter.progress);
    const px = startPt.x + (targetX - startPt.x) * t;
    const py = startPt.y + (targetY - startPt.y) * t;
    drawPigeon(ctx, px, py, now, true);
  }

  drawReplies(ctx, Vv, now);
  drawFeathers(ctx, now);
}

if (typeof window !== 'undefined') {
  if (!window.GuildPigeonPost) window.GuildPigeonPost = createState();
  const state = window.GuildPigeonPost;
  state.update = update;
  state.draw = draw;
  state.__rawUpdate = update;
  state.__keys = pressed;
  state.__probe = function () {
    const now = nowFn();
    return {
      gx: state.gx,
      gy: state.gy,
      letter: state.letter,
      replies: state.replies.slice(),
      feathers: feathers.map(function (f) { return { x: f.x, y: f.y, vx: f.vx, vy: f.vy, start: f.start, life: f.life, age: now - f.start }; }),
      pressed: Array.from(pressed),
      prevPressed: Array.from(prevPressed),
      cooldownRemaining: Math.max(0, cooldownUntil - now),
      inRange: visitorDistanceTiles() <= 1.5,
      visitorDistance: visitorDistanceTiles()
    };
  };
  if (!window.__ppListeners) {
    window.__ppListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
