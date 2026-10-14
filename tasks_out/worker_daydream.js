let activeList = [];
let nextPickAt = null;
let prevPending = null;
let pendingSparks = [];

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildDaydream; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
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

function personalityFor(name) {
  const n = String(name || '').toLowerCase();
  if (n.indexOf('missing') !== -1) return 'missingno';
  if (n.indexOf('step') !== -1) return 'step5';
  if (n.indexOf('laguna') !== -1) return 'laguna';
  if (n.indexOf('long') !== -1) return 'longcat';
  return 'generic';
}

const POOLS = {
  missingno: {
    withQuest: ['{title}... but make it haunted', 'if I ignore {title}, maybe it solves itself', 'corrupting {title} for fun', '404: reason to do {title}'],
    generic: ['undefined is not a guild', 'segmentation fault of tea', 'NULL pointer to snack bar', 'I wonder if the cat compiles']
  },
  step5: {
    withQuest: ['{title} waits like rain', 'a verse hidden in {title}', '{title}, unfinished and honest', 'the horizon and {title}'],
    generic: ['silence is also work', 'dusk settles over logs', 'I write in white space', 'brevity is a lantern']
  },
  laguna: {
    withQuest: ['{title}! I can do this!', 'new quest {title} unlocked!', 'ooh, {title} looks fun', 'I will finish {title} super fast!'],
    generic: ['So many friends!', 'Everything is exciting!', 'I want to help more', 'Guild life rules!']
  },
  longcat: {
    withQuest: ['{title} is one with the floor', 'observe {title}, then accept', '{title} needs no rush', 'patience builds {title}'],
    generic: ['the island breathes', 'stillness is progress', 'watch the clouds', 'all paths lead home']
  },
  generic: {
    withQuest: ['thinking about {title}', 'next up: {title}', '{title} on my mind'],
    generic: ['guild musings', 'a quiet moment', 'hmm...']
  }
};

function rng() { return Math.random(); }

function shortTitle(t) { return String(t == null ? '' : t).slice(0, 20); }

function pickLine(wi, meta, personality) {
  const p = POOLS[personality] || POOLS.generic;
  let quests = [];
  if (meta && Array.isArray(meta.tasks)) quests = meta.tasks.filter(function (t) { return t && t.status === 'pending'; });
  if (!quests.length && getV() && Array.isArray(getV().allTasks)) {
    quests = getV().allTasks.filter(function (t) { return t && t.status === 'pending'; });
  }
  let useQuest = quests.length > 0 && rng() < 0.78;
  let title = quests.length ? shortTitle(quests[Math.floor(rng() * quests.length)].title != null ? quests[Math.floor(rng() * quests.length)].title : quests[0].id) : '';
  let pool = useQuest && title ? p.withQuest : p.generic;
  let tmpl = pool[Math.floor(rng() * pool.length)];
  if (useQuest && title) tmpl = tmpl.replace(/\{title\}/g, title);
  tmpl = tmpl.replace(/\{title\}/g, 'guild work');
  return tmpl;
}

function isPendingTask(t) { return !!t && (t.status === 'pending'); }

function hasActiveDaydream(wi, now) {
  for (let i = 0; i < activeList.length; i++) {
    const d = activeList[i];
    if (d.workerIndex === wi && now < d.end) return true;
  }
  return false;
}

function chatActive(wi, now) {
  const Vv = getV();
  if (!Vv || !Array.isArray(Vv.workerChatBubbles)) return false;
  const b = Vv.workerChatBubbles[wi];
  if (!b || !b.text) return false;
  const age = (now - b.start) / 1000;
  if (!isFinite(age) || age < 0) return false;
  return age < (typeof b.duration === 'number' ? b.duration : 6);
}

function isIdleWorker(wi) {
  const Vv = getV();
  if (!Vv) return false;
  const w = Vv.workerStates && Vv.workerStates[wi];
  const meta = Vv.workers && Vv.workers[wi];
  if (!w || !meta) return false;
  const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(w.tasks) ? w.tasks : []);
  const hasActive = tasks.some(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
  if (hasActive) return false;
  if (w.moving) return false;
  if (w.sleeping || w.napping) return false;
  if (w.mode === 'pending' || w.mode === 'in_progress') return false;
  return true;
}

function createDaydream(wi, sparkle, now) {
  const Vv = getV();
  if (!Vv || !Vv.workers || !Vv.workers[wi]) return false;
  if (hasActiveDaydream(wi, now)) return false;
  if (chatActive(wi, now)) return false;
  const meta = Vv.workers[wi];
  const personality = personalityFor(meta && meta.name);
  const text = pickLine(wi, meta, personality);
  const dur = 5.5 + rng() * 1.2;
  const dd = {
    workerIndex: wi,
    name: meta.name,
    personality: personality,
    text: text,
    start: now,
    duration: dur,
    end: now + dur * 1000,
    sparkle: !!sparkle
  };
  activeList.push(dd);
  const GD = getState();
  if (GD) GD.active = dd;
  if (sparkle) {
    const w = root();
    if (w && typeof w.cue === 'function') { try { w.cue('idea'); } catch (e) {} }
  }
  return true;
}

function scheduleSpark(wi, id, now) {
  for (let i = 0; i < pendingSparks.length; i++) {
    if (pendingSparks[i].workerIndex === wi && pendingSparks[i].id === id) return;
  }
  pendingSparks.push({ workerIndex: wi, id: id, at: now + 300 + rng() * 1500, deadline: now + 5000 });
}

function updateSparkDetection(now) {
  const Vv = getV();
  if (!Vv || !Array.isArray(Vv.workers)) return;
  if (!prevPending) {
    prevPending = Vv.workers.map(function (w) {
      const tasks = Array.isArray(w && w.tasks) ? w.tasks : [];
      return new Set(tasks.filter(isPendingTask).map(function (t) { return t.id; }));
    });
    return;
  }
  while (prevPending.length < Vv.workers.length) prevPending.push(new Set());
  for (let wi = 0; wi < Vv.workers.length; wi++) {
    const w = Vv.workers[wi];
    const tasks = Array.isArray(w && w.tasks) ? w.tasks : [];
    const curr = new Set(tasks.filter(isPendingTask).map(function (t) { return t.id; }));
    if (prevPending[wi]) {
      curr.forEach(function (id) {
        if (!prevPending[wi].has(id)) scheduleSpark(wi, id, now);
      });
    } else {
      prevPending[wi] = new Set();
    }
    prevPending[wi] = curr;
  }
  if (prevPending.length > Vv.workers.length) prevPending = prevPending.slice(0, Vv.workers.length);
}

function processSparks(now) {
  const survivors = [];
  for (let i = 0; i < pendingSparks.length; i++) {
    const s = pendingSparks[i];
    if (now > s.deadline) continue;
    if (now >= s.at) {
      if (!createDaydream(s.workerIndex, true, now)) {
        s.at = now + 800;
        if (s.at <= s.deadline) survivors.push(s);
      }
    } else {
      survivors.push(s);
    }
  }
  pendingSparks = survivors;
}

function tryPick(now) {
  const Vv = getV();
  if (!Vv || !Array.isArray(Vv.workers)) return;
  const cands = [];
  for (let wi = 0; wi < Vv.workers.length; wi++) {
    if (isIdleWorker(wi) && !hasActiveDaydream(wi, now) && !chatActive(wi, now)) cands.push(wi);
  }
  if (!cands.length) {
    nextPickAt = now + 5000 + rng() * 5000;
    return;
  }
  const wi = cands[Math.floor(rng() * cands.length)];
  createDaydream(wi, false, now);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  const GD = getState();
  if (!GD) return;
  if (!Vv || Vv.gameState !== 'play') { if (GD.active && now >= (GD.active.end || 0)) GD.active = null; return; }
  // remove expired
  const beforeLen = activeList.length;
  activeList = activeList.filter(function (d) { return now < d.end; });
  if (activeList.length !== beforeLen || (GD.active && now >= GD.active.end)) {
    GD.active = activeList.length ? activeList[activeList.length - 1] : null;
  }
  if (GD.active && now >= GD.active.end) GD.active = activeList.length ? activeList[activeList.length - 1] : null;
  if (Vv && Array.isArray(Vv.workers)) {
    updateSparkDetection(now);
    processSparks(now);
  }
  if (nextPickAt === null) nextPickAt = now + 18000 + rng() * 7000;
  if (now >= nextPickAt) {
    nextPickAt = now + 18000 + rng() * 7000;
    tryPick(now);
  }
}

function glitchText(s) {
  if (!s || !s.length) return s;
  const idx = Math.floor(rng() * s.length);
  const syms = '!@#$%^&*?~<>[]{}';
  const ch = syms[Math.floor(rng() * syms.length)];
  return s.slice(0, idx) + ch + s.slice(idx + 1);
}

function draw(ctx) {
  const Vv = getV();
  const GD = getState();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const workerStates = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  for (let i = 0; i < activeList.length; i++) {
    const dd = activeList[i];
    if (now >= dd.end) continue;
    const wi = dd.workerIndex;
    const w = workerStates[wi];
    if (!w) continue;
    const x = Math.round((typeof w.x === 'number' ? w.x : 0) + 8);
    const y = Math.round((typeof w.y === 'number' ? w.y : 0) - 18);
    const age = (now - dd.start) / 1000;
    let alpha = 1;
    if (age < 0.25) alpha = age / 0.25;
    else if (age > dd.duration - 0.6) alpha = Math.max(0, (dd.duration - age) / 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = Math.max(60, 100);
    const bh = 26;
    const bx = x - bw / 2;
    const by = y - bh;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillRect(bx + 8, by - 4, Math.round(bw * 0.3), 4);
    ctx.fillRect(bx + Math.round(bw * 0.4), by - 5, Math.round(bw * 0.28), 5);
    ctx.fillRect(bx + bw - 16, by - 3, 12, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fillRect(x - 4, by + bh + 1, 6, 6);
    ctx.fillRect(x - 7, by + bh + 8, 4, 4);
    ctx.fillRect(x - 9, by + bh + 13, 3, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.strokeRect(x - 4, by + bh + 1, 6, 6);
    ctx.strokeRect(x - 7, by + bh + 8, 4, 4);
    ctx.strokeRect(x - 9, by + bh + 13, 3, 3);
    let shown = dd.text;
    if (dd.personality === 'missingno' && rng() < 0.06) shown = glitchText(shown);
    const textFit = fitFn(shown, bw - 14);
    ctx.fillStyle = '#111827';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textFit, x, by + bh * 0.5 + 1);
    // sparkle
    if (dd.sparkle && age < 1.2) {
      const sa = Math.max(0, 1 - age / 1.2);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + age * 4;
        const r = 12 + Math.sin(age * 6 + k) * 4;
        const sx = x + Math.cos(ang) * r;
        const sy = by + Math.sin(ang) * r * 0.6;
        ctx.globalAlpha = alpha * sa;
        ctx.fillStyle = (k % 2 === 0) ? '#facc15' : '#ffffff';
        ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
      }
      ctx.globalAlpha = alpha;
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }
  if (GD) GD.active = activeList.length ? activeList[activeList.length - 1] : null;
}

if (typeof window !== 'undefined') {
  if (!window.GuildDaydream) window.GuildDaydream = { active: null };
  if (!Object.prototype.hasOwnProperty.call(window.GuildDaydream, 'active')) window.GuildDaydream.active = null;
  window.GuildDaydream.update = update;
  window.GuildDaydream.draw = draw;
  window.GuildDaydream.__probe = function () {
    const GD = getState();
    return { active: GD ? GD.active : null };
  };
}

export {};
