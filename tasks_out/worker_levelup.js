const PLATE_DURATION = 8;

let events = [];
let confetti = [];
let initialized = false;
let lastTime = null;
let prevWorkerLevels = [];
let prevGlobalActive = false;
let prevMapLevel = null;
let prevGrowthStep = null;
let prevWorkerDone = [];
let lastNewDone = [];
let lastTriggerByWorker = {};

function createState() {
  return {
    active: false,
    t: 0,
    duration: PLATE_DURATION,
    workerIndex: -1,
    workerName: '',
    newLevel: 0,
    events: events,
    confetti: confetti,
    pedestal: { gx: 0, gy: -1 },
    trigger: function (workerIndex, newLevel) {
      const Vv = getV();
      if (!Vv) return;
      triggerCeremony(workerIndex == null ? 0 : workerIndex, newLevel, Vv, nowFn());
    }
  };
}

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
function getState() {
  const w = root();
  if (!w) return null;
  if (!w.GuildLevelUp) w.GuildLevelUp = createState();
  return w.GuildLevelUp;
}
function cueSafe(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) { }
  }
}

function numericLevel(value) {
  if (value == null) return null;
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    const m = value.match(/-?\d+(?:\.\d+)?/);
    if (m) {
      const n = Number(m[0]);
      if (isFinite(n)) return n;
    }
  }
  return null;
}

function objectLevel(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const direct = ['level', 'lvl', 'workerLevel', 'xpLevel', 'mapLevel', 'levelNum', 'tier', 'rank'];
  for (let i = 0; i < direct.length; i++) {
    const v = numericLevel(obj[direct[i]]);
    if (v != null) return v;
  }
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const kl = String(key).toLowerCase();
    if (kl.indexOf('level') !== -1 || kl === 'tier' || kl === 'rank') {
      const v = numericLevel(obj[key]);
      if (v != null) return v;
    }
  }
  return null;
}

function getWorkers(Vv) { return (Vv && Array.isArray(Vv.workers)) ? Vv.workers : []; }
function getWorkerStates(Vv) { return (Vv && Array.isArray(Vv.workerStates)) ? Vv.workerStates : []; }
function countDone(tasks) {
  if (!Array.isArray(tasks)) return 0;
  let n = 0;
  for (let i = 0; i < tasks.length; i++) if (tasks[i] && tasks[i].status === 'done') n++;
  return n;
}
function workerDoneCounts(Vv) {
  const ws = getWorkers(Vv);
  const out = [];
  for (let i = 0; i < ws.length; i++) out.push(countDone(ws[i] && ws[i].tasks));
  return out;
}

function externalLevel(Vv, index, meta, st) {
  let v = objectLevel(meta);
  if (v != null) return v;
  v = objectLevel(st);
  if (v != null) return v;
  if (Vv && Array.isArray(Vv.workerLevels)) {
    v = numericLevel(Vv.workerLevels[index]);
    if (v != null) return v;
  }
  if (Vv && Array.isArray(Vv.levels)) {
    v = numericLevel(Vv.levels[index]);
    if (v != null) return v;
  }
  if (Vv && Vv.levels && typeof Vv.levels === 'object' && !Array.isArray(Vv.levels)) {
    v = numericLevel(Vv.levels[(meta && meta.name != null) ? meta.name : index]);
    if (v == null) v = numericLevel(Vv.levels[String(index)]);
    if (v != null) return v;
  }
  if (Vv && Vv.workerLevel && typeof Vv.workerLevel === 'object') {
    v = numericLevel(Vv.workerLevel[index]);
    if (v == null) v = numericLevel(Vv.workerLevel[(meta && meta.name != null) ? meta.name : index]);
    if (v != null) return v;
  }
  return null;
}

function currentWorkerLevel(Vv, index) {
  const workers = getWorkers(Vv);
  const states = getWorkerStates(Vv);
  const meta = workers[index] || {};
  const st = states[index] || {};
  return externalLevel(Vv, index, meta, st);
}

function chooseAttributedWorker(Vv, candidates) {
  const states = getWorkerStates(Vv);
  for (let i = 0; i < states.length; i++) {
    if (states[i] && states[i].flash && states[i].flash.active) return i;
  }
  if (Array.isArray(candidates) && candidates.length) return candidates[0];
  if (getWorkers(Vv).length) return 0;
  return -1;
}

function spawnConfetti(pt, count) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 45 + Math.random() * 115;
    confetti.push({
      x: pt.x,
      y: pt.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 85,
      age: 0,
      life: 1.3 + Math.random() * 1.4,
      size: 2 + Math.floor(Math.random() * 3),
      color: ['#facc15', '#fde047', '#ffffff', '#f59e0b', '#a78bfa'][Math.floor(Math.random() * 5)],
      spin: (Math.random() - 0.5) * 9
    });
  }
}

function canTrigger(index, now) {
  if (index < 0) return false;
  const last = lastTriggerByWorker[index];
  if (last != null && now - last < 2500) return false;
  for (let i = 0; i < events.length; i++) {
    if (events[i].workerIndex === index && (now - events[i].start) < 2500) return false;
  }
  return true;
}

function triggerCeremony(index, level, Vv, now) {
  const states = getWorkerStates(Vv);
  const workers = getWorkers(Vv);
  if (index < 0 || index >= Math.max(workers.length, states.length || 1)) index = 0;
  if (!canTrigger(index, now)) return;
  lastTriggerByWorker[index] = now;

  const meta = workers[index] || {};
  const st = states[index] || (states.length ? states[0] : null);
  const workerName = (meta && meta.name != null) ? meta.name : (st && st.name != null ? st.name : (index === 1 ? 'STEP5' : 'MISSINGNO'));
  const workerLevel = (level != null && isFinite(level)) ? level : (Vv.mapLevel != null ? Vv.mapLevel : ((Vv.growthStep != null ? Vv.growthStep : 0) + 1));

  cueSafe('bell');
  cueSafe('bellToll');

  if (st) {
    st.flash = st.flash || { active: false, t: 0, duration: 0.9, count: 0 };
    st.flash.active = true;
    st.flash.t = 0;
    st.flash.duration = 0.9;
    st.flash.count = 1;
    st.flashHandled = false;
  }

  const pt = isoFn(0, -1);
  spawnConfetti(pt, 52);

  const event = {
    start: now,
    duration: PLATE_DURATION,
    workerIndex: index,
    workerName: String(workerName),
    newLevel: workerLevel
  };
  if (events.length > 3) events.shift();
  events.push(event);

  const stt = getState();
  if (stt) {
    stt.active = true;
    stt.workerIndex = index;
    stt.workerName = String(workerName);
    stt.newLevel = workerLevel;
    stt.events = events;
    stt.confetti = confetti;
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  if (!state) return;
  if (!Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  const states = getWorkerStates(Vv);
  const workers = getWorkers(Vv);
  const totalWorkers = Math.max(workers.length, states.length);

  if (!initialized) {
    prevWorkerLevels = [];
    for (let i = 0; i < totalWorkers; i++) prevWorkerLevels[i] = currentWorkerLevel(Vv, i);
    prevGlobalActive = !!(Vv.levelUp && Vv.levelUp.active);
    prevMapLevel = (Vv.mapLevel != null) ? Vv.mapLevel : null;
    prevGrowthStep = (Vv.growthStep != null) ? Vv.growthStep : null;
    prevWorkerDone = workerDoneCounts(Vv);
    initialized = true;
  } else {
    const levels = [];
    for (let i = 0; i < totalWorkers; i++) levels[i] = currentWorkerLevel(Vv, i);
    for (let i = 0; i < totalWorkers; i++) {
      if (prevWorkerLevels[i] != null && levels[i] != null && levels[i] > prevWorkerLevels[i]) {
        triggerCeremony(i, levels[i], Vv, now);
      }
      prevWorkerLevels[i] = levels[i];
    }

    const globalActive = !!(Vv.levelUp && Vv.levelUp.active);
    lastNewDone = [];
    const curDone = workerDoneCounts(Vv);
    for (let i = 0; i < curDone.length; i++) {
      if (curDone[i] > (prevWorkerDone[i] || 0)) lastNewDone.push(i);
    }

    if (!prevGlobalActive && globalActive) {
      const idx = chooseAttributedWorker(Vv, lastNewDone);
      triggerCeremony(idx, currentWorkerLevel(Vv, idx), Vv, now);
    }
    prevGlobalActive = globalActive;

    if (prevMapLevel != null && Vv.mapLevel != null && Vv.mapLevel > prevMapLevel) {
      const idx = chooseAttributedWorker(Vv, lastNewDone);
      triggerCeremony(idx, Vv.mapLevel, Vv, now);
    }
    prevMapLevel = (Vv.mapLevel != null) ? Vv.mapLevel : prevMapLevel;

    if (prevGrowthStep != null && Vv.growthStep != null && Vv.growthStep > prevGrowthStep) {
      const idx = chooseAttributedWorker(Vv, lastNewDone);
      triggerCeremony(idx, (Vv.mapLevel != null ? Vv.mapLevel : Vv.growthStep + 1), Vv, now);
    }
    prevGrowthStep = (Vv.growthStep != null) ? Vv.growthStep : prevGrowthStep;
    prevWorkerDone = curDone;
  }

  const nextEvents = [];
  for (let i = 0; i < events.length; i++) {
    if ((now - events[i].start) / 1000 < events[i].duration) nextEvents.push(events[i]);
  }
  events = nextEvents;

  const nextConfetti = [];
  for (let i = 0; i < confetti.length; i++) {
    const p = confetti[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy += 118 * dt;
    nextConfetti.push(p);
  }
  confetti = nextConfetti;

  const latest = events.length ? events[events.length - 1] : null;
  state.active = events.length > 0;
  state.t = latest ? (now - latest.start) : 0;
  state.workerIndex = latest ? latest.workerIndex : -1;
  state.workerName = latest ? latest.workerName : '';
  state.newLevel = latest ? latest.newLevel : 0;
  state.events = events;
  state.confetti = confetti;
  if (state.events.length !== events.length) state.events = events;
}

function draw(ctx) {
  if (!ctx) return;
  const state = getState();
  const Vv = getV();
  if (!state) return;
  const now = nowFn();

  for (let i = 0; i < confetti.length; i++) {
    const p = confetti[i];
    const lifeRatio = Math.max(0, 1 - (p.age / p.life));
    if (lifeRatio <= 0) continue;
    ctx.globalAlpha = lifeRatio;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.globalAlpha = 1;
  }

  for (let e = 0; e < events.length; e++) {
    const ev = events[e];
    const age = (now - ev.start) / 1000;
    if (age < 1.35) {
      const states = getWorkerStates(Vv);
      const st = states[ev.workerIndex];
      if (st) {
        const flashAlpha = Math.max(0, 1 - (age / 1.35)) * 0.42;
        if (flashAlpha > 0) {
          ctx.globalAlpha = flashAlpha;
          ctx.fillStyle = '#facc15';
          ctx.fillRect(Math.round(st.x) - 15, Math.round(st.y) - 22, 44, 48);
          ctx.globalAlpha = 1;
          ctx.globalAlpha = flashAlpha * 0.65;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(st.x) - 8, Math.round(st.y) - 14, 30, 32);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  for (let e = 0; e < events.length; e++) {
    const ev = events[e];
    const age = (now - ev.start) / 1000;
    const alpha = age < (PLATE_DURATION - 2) ? 1 : Math.max(0, 1 - ((age - (PLATE_DURATION - 2)) / 2));
    if (alpha <= 0) continue;

    const pt = isoFn(ev.pedestal ? ev.pedestal.gx : 0, ev.pedestal ? ev.pedestal.gy : -1);
    // ev.pedestal may not exist; state default is origin shift above
    const pedestalPt = (ev.pedestal && typeof ev.pedestal.gx === 'number') ? isoFn(ev.pedestal.gx, ev.pedestal.gy) : pt;
    const text = String(ev.workerName) + ' — LVL ' + String(ev.newLevel);
    ctx.font = 'bold 10px monospace';
    const shown = fitFn(text, 220);
    const tw = ctx.measureText(shown).width;
    const padX = 10;
    const bw = Math.max(62, Math.round(tw) + padX * 2);
    const bh = 16;
    const x = Math.round(pedestalPt.x - bw * 0.5);
    const y = Math.round(pedestalPt.y - 44);

    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = 'rgba(20,16,10,0.92)';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shown, x + bw * 0.5, y + bh * 0.5 + 1);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

const state0 = getState();
if (state0) {
  state0.update = update;
  state0.draw = draw;
}

if (typeof window !== 'undefined') {
  if (!window.GuildLevelUp) window.GuildLevelUp = createState();
  if (!window.GuildLevelup) window.GuildLevelup = window.GuildLevelUp;
  if (!window.WorkerLevelUp) window.WorkerLevelUp = window.GuildLevelUp;
  if (!window.worker_levelup) window.worker_levelup = window.GuildLevelUp;
  const g = window.GuildLevelUp;
  g.update = update;
  g.draw = draw;
  if (typeof g.events === 'undefined') g.events = events;
  if (typeof g.confetti === 'undefined') g.confetti = confetti;
  g.__probe = function () { return { events: events.slice(), confetti: confetti.length, initialized: initialized }; };
  g.__rawUpdate = update;
}

export {};
