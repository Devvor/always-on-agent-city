// GuildDerbyPodium - D7: a 3-step podium ceremony at the S rim by the fishing derby post.
const ANCHOR = { gx: 5, gy: 3.4 };
const RISE_MS = 950;
const HOLD_MS = 5200;
const LOWER_MS = 650;
const TRIGGER_COOLDOWN_MS = 6000;

const GOLD = '#d4af37';
const GOLD_LIGHT = '#facc15';
const GOLD_TEXT = '#f3d37a';
const WHITE = '#f3f4f6';
const BLUE = '#3b82f6';
const GREEN = '#22c55e';
const RED = '#ef4444';
const PANEL = 'rgba(10,10,12,0.90)';
const OUTLINE = '#1f2937';

let lastTime = null;

function root() { return (typeof window !== 'undefined') ? window : null; }

function getV() {
  const w = root();
  if (!w || !w.V || typeof w.V !== 'object') return null;
  return w.V;
}

function getState() { const w = root(); return w && w.GuildDerbyPodium; }

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

function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

function easeOutCubic(t) {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  t = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function derbyState() {
  const w = root();
  if (!w) return null;
  const names = ['GuildFishingDerby', 'GuildFishDerby', 'GuildDerby', 'Derby'];
  for (let i = 0; i < names.length; i++) {
    const s = w[names[i]];
    if (s && typeof s === 'object') return s;
  }
  for (const key in w) {
    if (key === 'GuildDerbyPodium') continue;
    if (key.indexOf('Guild') !== 0) continue;
    if (key.toLowerCase().indexOf('derby') === -1) continue;
    if (w[key] && typeof w[key] === 'object') return w[key];
  }
  return null;
}

function collectDerbyTasks() {
  const w = root();
  const out = [];
  if (w && Array.isArray(w.allTasks)) {
    for (let i = 0; i < w.allTasks.length; i++) out.push(w.allTasks[i]);
  }
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) {
    for (let i = 0; i < Vv.allTasks.length; i++) out.push(Vv.allTasks[i]);
  }
  const keep = [];
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    if (!t || typeof t !== 'object') continue;
    const s = (String(t.title || '') + ' ' + String(t.id || '') + ' ' + String(t.name || '')).toLowerCase();
    if (s.indexOf('derby') !== -1) keep.push(t);
  }
  return keep;
}

function derbyNameFromBoard() {
  const tasks = collectDerbyTasks();
  const fields = ['catcher', 'winner', 'leader', 'champion', 'angler', 'assignee', 'worker', 'owner', 'name'];
  for (let i = tasks.length - 1; i >= 0; i--) {
    const t = tasks[i];
    for (let f = 0; f < fields.length; f++) {
      const v = t[fields[f]];
      if (typeof v === 'string' && v) return v;
      if (v && typeof v === 'object' && typeof v.name === 'string' && v.name) return v.name;
    }
  }
  return '';
}

function resolveWinner() {
  const st = derbyState();
  let name = '';
  let score = 0;
  let catches = 0;
  if (st) {
    const nameFields = ['topCatcher', 'champion', 'leader', 'winner', 'topAngler', 'angler'];
    for (let i = 0; i < nameFields.length; i++) {
      const v = st[nameFields[i]];
      if (typeof v === 'string' && v) { name = v; break; }
      if (v && typeof v === 'object') {
        const inner = v.name || v.angler || v.catcher;
        if (typeof inner === 'string' && inner) { name = inner; break; }
      }
    }
    score = num(st.sessionScore) || num(st.roundScore) || num(st.score) || num(st.bestScore);
    catches = num(st.sessionCatches) || num(st.catches);
  }
  if (!name) name = derbyNameFromBoard();
  if (!name) {
    const Vv = getV();
    const ws = Vv && Vv.workers;
    if (Array.isArray(ws) && ws[0] && typeof ws[0].name === 'string' && ws[0].name) name = ws[0].name;
  }
  if (!name) name = 'GUILD ANGLER';
  return { name: name, score: score, catches: catches };
}

function winnerLine(w) {
  const parts = [];
  if (w.catches > 0) parts.push(w.catches + (w.catches === 1 ? ' CATCH' : ' CATCHES'));
  if (w.score > 0) parts.push(w.score + ' GC');
  if (!parts.length) parts.push('GUILD CHAMPION');
  return parts.join('  ');
}

function scanBoard(st) {
  const tasks = collectDerbyTasks();
  const doneIds = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const status = String(t.status != null ? t.status : (t.state != null ? t.state : '')).toLowerCase();
    if (status === 'done' || status === 'completed' || status === 'complete' || status === 'success') {
      doneIds.push(String(t.id != null ? t.id : (t.title != null ? t.title : ('d' + i))));
    }
  }
  if (!st.boardPrimed) {
    for (let i = 0; i < doneIds.length; i++) st.seenDone[doneIds[i]] = true;
    st.boardPrimed = true;
    return false;
  }
  let event = false;
  for (let i = 0; i < doneIds.length; i++) {
    if (!st.seenDone[doneIds[i]]) {
      st.seenDone[doneIds[i]] = true;
      event = true;
    }
  }
  return event;
}

function detectDerby(st, derby, now) {
  let active = false;
  if (derby) {
    if (typeof derby.active === 'boolean') active = derby.active;
    else if (typeof derby.running === 'boolean') active = derby.running;
    else {
      const ph = String(derby.phase != null ? derby.phase : (derby.state != null ? derby.state : '')).toLowerCase();
      active = ph === 'active' || ph === 'running' || ph === 'casting' || ph === 'derby';
    }
    if (active && derby.endsAt && now >= derby.endsAt) active = false;
  }
  let completed = false;
  if (st.lastActive === true && !active) completed = true;
  st.lastActive = active;
  return completed;
}

function createState() {
  return {
    anchor: { gx: ANCHOR.gx, gy: ANCHOR.gy },
    phase: 'idle',
    rise: 0,
    lower: 0,
    startAt: 0,
    holdStart: 0,
    lowerStart: 0,
    shimmer: 0,
    winner: { name: 'GUILD ANGLER', score: 0, catches: 0 },
    confetti: [],
    confettiFired: false,
    lastActive: null,
    lastCeremonyAt: -999999,
    boardPrimed: false,
    seenDone: {}
  };
}

function currentProgress(st) {
  if (!st) return 0;
  if (st.phase === 'rising') return clamp(easeOutBack(st.rise), 0, 1.12);
  if (st.phase === 'holding') return 1;
  if (st.phase === 'lowering') return 1 - easeOutCubic(st.lower);
  return 0;
}

function beginCeremony(st, now) {
  st.phase = 'rising';
  st.startAt = now;
  st.rise = 0;
  st.lower = 0;
  st.shimmer = 0;
  st.confettiFired = false;
  st.confetti.length = 0;
  st.winner = resolveWinner();
  st.lastCeremonyAt = now;
}

function fireConfetti(st) {
  if (st.confettiFired) return;
  st.confettiFired = true;
  const pt = isoFn(st.anchor.gx, st.anchor.gy);
  const cx = Math.round(pt.x);
  const cy = Math.round(pt.y) + 8 - 42;
  const colors = [GOLD, GOLD_LIGHT, WHITE, BLUE, GREEN, RED];
  for (let i = 0; i < 44; i++) {
    const ang = -Math.PI * 0.5 + (i / 44 - 0.5) * Math.PI * 1.4 + (Math.random() - 0.5) * 0.2;
    const spd = 60 + Math.random() * 150;
    st.confetti.push({
      x: cx + (Math.random() - 0.5) * 16,
      y: cy + (Math.random() - 0.5) * 6,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      w: 2 + Math.round(Math.random() * 3),
      h: 2 + Math.round(Math.random() * 3),
      color: colors[i % colors.length],
      age: 0,
      life: 1.1 + Math.random() * 0.9
    });
  }
  if (st.confetti.length > 220) st.confetti = st.confetti.slice(-220);
}

function updateConfetti(st, dt) {
  const next = [];
  for (let i = 0; i < st.confetti.length; i++) {
    const c = st.confetti[i];
    c.age += dt;
    if (c.age >= c.life) continue;
    if (c.age < c.life * 0.35) {
      c.vy += 40 * dt;
    } else {
      c.vy += 300 * dt;
    }
    c.vx *= Math.max(0, 1 - 1.4 * dt);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    next.push(c);
  }
  st.confetti = next;
}

function advanceCeremony(st, now, dt) {
  if (st.phase === 'rising') {
    st.rise = clamp((now - st.startAt) / RISE_MS, 0, 1);
    if (st.rise >= 1) {
      st.phase = 'holding';
      st.holdStart = now;
      fireConfetti(st);
      cue('done');
    }
  } else if (st.phase === 'holding') {
    st.shimmer += dt;
    if (now - st.holdStart > HOLD_MS) {
      st.phase = 'lowering';
      st.lowerStart = now;
    }
  } else if (st.phase === 'lowering') {
    st.lower = clamp((now - st.lowerStart) / LOWER_MS, 0, 1);
    if (st.lower >= 1) {
      st.phase = 'idle';
      st.rise = 0;
      st.lower = 0;
    }
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const Vv = getV();
  if (!w || !Vv || Vv.gameState !== 'play') { lastTime = now; return; }
  const st = getState();
  if (!st) { lastTime = now; return; }

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const derby = derbyState();
  const boardEvent = scanBoard(st);
  const derbyEvent = detectDerby(st, derby, now);

  if (st.phase === 'idle' && (derbyEvent || boardEvent) && (now - st.lastCeremonyAt) > TRIGGER_COOLDOWN_MS) {
    beginCeremony(st, now);
  }

  advanceCeremony(st, now, dt);
  updateConfetti(st, dt);
}

function drawStowed(ctx, x, groundY) {
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(x - 30, groundY - 1, 60, 6);
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 28, groundY - 3, 56, 3);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 28, groundY - 4, 56, 1);
}

function drawPodium(ctx, x, groundY, p) {
  const steps = [
    { hw: 27, hh: 11, top: '#71717a', face: '#52525b' },
    { hw: 19, hh: 10, top: '#8b5a2b', face: '#6b4a2f' },
    { hw: 12, hh: 9, top: '#9a7a5e', face: '#7a5a44' }
  ];
  let y = groundY;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const span = 1 - 0.32;
    const local = clamp((p - i * 0.16) / span, 0, 1);
    const hh = s.hh * local;
    if (hh < 0.4) continue;
    const top = y - hh - 4;
    ctx.fillStyle = s.face;
    ctx.fillRect(x - s.hw, top + 4, s.hw * 2, hh);
    ctx.fillStyle = s.top;
    ctx.fillRect(x - s.hw, top, s.hw * 2, 4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - s.hw, top + 4, s.hw * 2, 1);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - s.hw + 0.5, top + 0.5, s.hw * 2 - 1, hh + 3);
    y = top;
  }
  return y;
}

function drawTrophy(ctx, x, topY, p) {
  if (p < 0.65) return;
  const a = clamp((p - 0.65) / 0.35, 0, 1);
  const ty = Math.round(topY - 10 * a);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(x - 3, ty + 5, 6, 2);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 4, ty, 8, 5);
  ctx.fillRect(x - 6, ty - 1, 2, 3);
  ctx.fillRect(x + 4, ty - 1, 2, 3);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillRect(x - 2, ty + 1, 4, 2);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4.5, ty - 0.5, 9, 6);
}

function drawFlag(ctx, x, groundY, p, now) {
  const poleH = 46 * clamp(p, 0, 1);
  if (poleH < 6) return;
  const poleX = x + 16;
  const poleBaseY = groundY - 6;
  const poleTopY = Math.round(poleBaseY - poleH);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(poleX, poleTopY, 2, Math.round(poleH));
  const wave = Math.sin(now * 0.006) * 2;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(poleX + 2, poleTopY);
  ctx.lineTo(poleX + 16 + wave, poleTopY + 5);
  ctx.lineTo(poleX + 2, poleTopY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillRect(poleX + 2, poleTopY + 3, 4, 3);
}

function drawPanel(ctx, cx, cy, winner, appear, now) {
  if (appear <= 0.01) return;
  const cv = clamp(appear, 0, 1);
  ctx.font = 'bold 10px monospace';
  const name = fitFn(winner.name || 'GUILD ANGLER', 168);
  const nameW = ctx.measureText(name).width;
  ctx.font = '10px monospace';
  const line = fitFn(winnerLine(winner), 176);
  const lineW = ctx.measureText(line).width;
  const fullW = Math.min(200, Math.max(nameW, lineW) + 22);
  const pw = Math.max(8, Math.round(fullW * cv));
  const ph = 34;
  const bob = Math.round(Math.sin(now * 0.003) * 1.5);
  const px = Math.round(cx - pw * 0.5);
  const py = Math.round(cy - ph + bob);

  ctx.fillStyle = PANEL;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

  ctx.fillStyle = GOLD;
  ctx.fillRect(px, py, 6, 2);
  ctx.fillRect(px, py, 2, 6);
  ctx.fillRect(px + pw - 6, py, 6, 2);
  ctx.fillRect(px + pw - 2, py, 2, 6);
  ctx.fillRect(px, py + ph - 2, 6, 2);
  ctx.fillRect(px, py + ph - 6, 2, 6);
  ctx.fillRect(px + pw - 6, py + ph - 2, 6, 2);
  ctx.fillRect(px + pw - 2, py + ph - 6, 2, 6);

  ctx.save();
  ctx.beginPath();
  ctx.rect(px + 2, py + 2, pw - 4, ph - 4);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(name, cx, py + 13);
  ctx.fillStyle = WHITE;
  ctx.font = '10px monospace';
  ctx.fillText(line, cx, py + 25);
  if (appear > 0.9) {
    const sweep = px + ((now * 0.12) % (pw + 40)) - 20;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sweep, py + 2, 8, ph - 4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawConfetti(ctx, st) {
  for (let i = 0; i < st.confetti.length; i++) {
    const c = st.confetti[i];
    let a = 1;
    if (c.age > c.life * 0.6) a = Math.max(0, 1 - (c.age - c.life * 0.6) / (c.life * 0.4));
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(Math.round(c.x), Math.round(c.y));
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w * 0.5, -c.h * 0.5, c.w, c.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function draw(ctx) {
  const w = root();
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const st = getState();
  if (!st) return;
  const now = nowFn();
  const p = currentProgress(st);
  const pt = isoFn(st.anchor.gx, st.anchor.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const groundY = y + 8;

  drawStowed(ctx, x, groundY);
  const topY = drawPodium(ctx, x, groundY, p);
  drawTrophy(ctx, x, topY, p);
  drawFlag(ctx, x, groundY, p, now);

  const appear = clamp((p - 0.55) / 0.45, 0, 1);
  drawPanel(ctx, x, topY - 44, st.winner, appear, now);

  drawConfetti(ctx, st);
}

if (typeof window !== 'undefined') {
  if (!window.GuildDerbyPodium) window.GuildDerbyPodium = createState();
  window.GuildDerbyPodium.anchor = { gx: ANCHOR.gx, gy: ANCHOR.gy };
  window.GuildDerbyPodium.update = update;
  window.GuildDerbyPodium.draw = draw;
  window.GuildDerbyPodium.__probe = function () {
    const st = getState();
    return {
      phase: st ? st.phase : 'idle',
      reveal: st ? currentProgress(st) : 0,
      confetti: st ? st.confetti.length : 0,
      winner: st ? st.winner.name : '',
      anchor: { gx: ANCHOR.gx, gy: ANCHOR.gy }
    };
  };
}

export {};
