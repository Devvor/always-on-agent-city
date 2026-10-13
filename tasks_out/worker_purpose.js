const ENDORSE_RANGE = 1.5;

let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return {
    rep: 0,
    rank: 'NOVICE',
    endorsements: [],
    card: { visible: true },
    endorsedWorkers: new Set(),
    paidIds: new Set(),
    backedLabels: [],
    rankFloats: [],
    ceremony: { active: false, start: 0, duration: 1.5 },
    sparks: [],
    lastTaskFingerprint: '',
    lastStatusById: new Map()
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getGP() { const w = root(); return w && w.GuildPurpose; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

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

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function workerTasks(workerIndex) {
  const Vv = getV();
  let tasks = null;
  if (Vv && Array.isArray(Vv.workerStates) && Vv.workerStates[workerIndex]) {
    tasks = Vv.workerStates[workerIndex].tasks;
  }
  if (!Array.isArray(tasks) && Vv && Array.isArray(Vv.workers) && Vv.workers[workerIndex]) {
    tasks = Vv.workers[workerIndex].tasks;
  }
  return Array.isArray(tasks) ? tasks : [];
}

function isWorking(workerIndex) {
  const tasks = workerTasks(workerIndex);
  return tasks.some(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
}

function currentTaskId(workerIndex) {
  const tasks = workerTasks(workerIndex);
  const focus = tasks.find(function (t) { return t && (t.status === 'pending' || t.status === 'in_progress'); });
  if (focus && focus.id != null) return focus.id;
  if (!tasks.length) return null;
  const last = tasks[tasks.length - 1];
  return last && last.id != null ? last.id : null;
}

function rankFor(rep) {
  if (rep >= 25) return 'LEGEND';
  if (rep >= 10) return 'FRIEND';
  return 'NOVICE';
}

function rankMessage(rank) {
  if (rank === 'FRIEND') return 'workers wave as you pass';
  if (rank === 'LEGEND') return 'the cat bows';
  return 'the guild nods at you';
}

function cue(name) {
  try {
    const w = root();
    if (w && typeof w.cue === 'function') w.cue(name);
  } catch (e) {}
}

function statusFingerprint(Vv) {
  if (!Vv || !Array.isArray(Vv.allTasks)) return '';
  let out = '';
  for (let i = 0; i < Vv.allTasks.length; i++) {
    const t = Vv.allTasks[i];
    out += String(t && t.id != null ? t.id : '') + ':' + String(t && t.status != null ? t.status : '') + '|';
  }
  return out;
}

function statusMap(tasks) {
  const m = new Map();
  if (!Array.isArray(tasks)) return m;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t && t.id != null) m.set(String(t.id), t.status);
  }
  return m;
}

function triggerCeremony(gp, vis, Vv, now) {
  if (!gp) return;
  gp.ceremony = { active: true, start: now, duration: 1.5 };
  if (!Array.isArray(gp.sparks)) gp.sparks = [];
  const vp = vis ? isoFn(vis.gx, vis.gy) : { x: 0, y: 0 };
  let baseId = 0;
  if (Vv && typeof Vv.particleId === 'number') baseId = Vv.particleId;
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 68 + Math.random() * 58;
    const p = {
      id: baseId + i,
      kind: 'sparkle',
      x: vp.x + (Math.random() - 0.5) * 4,
      y: vp.y + (Math.random() - 0.5) * 4,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 22,
      phase: Math.random() * Math.PI * 2,
      life: 1.5,
      age: 0,
      size: 2,
      color: '#facc15'
    };
    if (Vv && Array.isArray(Vv.particles)) Vv.particles.push(p);
    gp.sparks.push(p);
  }
  if (Vv && typeof Vv.particleId === 'number') Vv.particleId += 12;
  cue('levelup');
}

function processEndorsementPayments(gp, Vv, oldMap, now) {
  if (!gp || !Array.isArray(gp.endorsements)) return;
  const vis = getVisitor();
  const curMap = statusMap(Vv && Vv.allTasks);
  let rankChanged = false;
  const prevRank = gp.rank;
  for (let i = 0; i < gp.endorsements.length; i++) {
    const en = gp.endorsements[i];
    if (!en || en.taskId == null) continue;
    const id = String(en.taskId);
    if (!gp.paidIds) gp.paidIds = new Set();
    if (gp.paidIds.has(id)) continue;
    const prev = oldMap.get(id);
    const cur = curMap.get(id);
    if (cur === 'done' && prev != null && prev !== 'done') {
      gp.rep += 10;
      gp.paidIds.add(id);
      try { en.paid = true; } catch (e) {}
      triggerCeremony(gp, vis, Vv, now);
    }
  }
  const nextRank = rankFor(gp.rep);
  if (nextRank !== prevRank) {
    gp.rank = nextRank;
    gp.rankFloats = gp.rankFloats || [];
    gp.rankFloats.push({ text: rankMessage(nextRank), start: now, duration: 2.5 });
    rankChanged = true;
  }
  // Rank floating text should not be suppressed by paid-state details.
  void rankChanged;
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const gp = getGP();
  const Vv = getV();
  const vis = getVisitor();

  if (!gp) {
    prevPressed = new Set(pressed);
    lastTime = now;
    return;
  }
  if (!Vv || Vv.gameState !== 'play') {
    prevPressed = new Set(pressed);
    lastTime = now;
    return;
  }

  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  // Compare task polls before changing internal snapshot.
  const fingerprintNow = statusFingerprint(Vv);
  if (fingerprintNow !== gp.lastTaskFingerprint) {
    const oldMap = gp.lastStatusById instanceof Map ? gp.lastStatusById : new Map();
    processEndorsementPayments(gp, Vv, oldMap, now);
    gp.lastStatusById = statusMap(Vv.allTasks);
    gp.lastTaskFingerprint = fingerprintNow;
  }

  // Endorsement: edge-triggered 'e' (also Space for visitor parity).
  const eNow = pressed.has('e') || pressed.has(' ');
  const eWas = prevPressed.has('e') || prevPressed.has(' ');
  if (vis && !eWas && eNow) {
    let best = -1;
    let bestDist = Infinity;
    const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
    const vp = isoFn(vis.gx, vis.gy);
    if (!gp.endorsedWorkers) gp.endorsedWorkers = new Set();
    for (let i = 0; i < states.length; i++) {
      if (gp.endorsedWorkers.has(i)) continue;
      if (!isWorking(i)) continue;
      const w = states[i];
      if (!w) continue;
      const d = tileDistance(w.x, w.y, vp.x, vp.y, Vv.grid);
      if (d <= ENDORSE_RANGE && d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0) {
      gp.endorsedWorkers.add(best);
      const taskId = currentTaskId(best);
      gp.endorsements.push({ worker: best, taskId: taskId, t: now });
      if (!Array.isArray(gp.backedLabels)) gp.backedLabels = [];
      gp.backedLabels.push({ worker: best, text: 'BACKED!', start: now, duration: 1.2 });
      cue('done');
    }
  }

  // Card toggle.
  const pNow = pressed.has('p');
  const pWas = prevPressed.has('p');
  if (!pWas && pNow) {
    if (!gp.card) gp.card = { visible: true };
    gp.card.visible = !gp.card.visible;
  }

  // Cleanup transient UI state.
  if (!Array.isArray(gp.backedLabels)) gp.backedLabels = [];
  gp.backedLabels = gp.backedLabels.filter(function (l) {
    return (now - l.start) / 1000 < (l.duration || 1.2);
  });
  if (!Array.isArray(gp.rankFloats)) gp.rankFloats = [];
  gp.rankFloats = gp.rankFloats.filter(function (f) {
    return (now - f.start) / 1000 < (f.duration || 2.5);
  });
  if (gp.ceremony && gp.ceremony.active && (now - gp.ceremony.start) / 1000 >= (gp.ceremony.duration || 1.5)) {
    gp.ceremony.active = false;
  }
  if (!Array.isArray(gp.sparks)) gp.sparks = [];
  const alive = [];
  for (let i = 0; i < gp.sparks.length; i++) {
    const p = gp.sparks[i];
    if (!p) continue;
    if ((now - 0) < 0) continue;
    p.age = typeof p.age === 'number' ? p.age : 0;
    if (typeof p.life !== 'number') p.life = 1.5;
    if (p.age >= p.life) continue;
    // Particles are aged by the host particle system; keep local motion stable.
    p.x += (typeof p.vx === 'number' ? p.vx : 0) * dt;
    p.y += (typeof p.vy === 'number' ? p.vy : 0) * dt;
    if (typeof p.vy === 'number') p.vy += 24 * dt;
    alive.push(p);
  }
  gp.sparks = alive;

  prevPressed = new Set(pressed);
}

function draw(ctx) {
  const gp = getGP();
  const Vv = getV();
  if (!gp || !Vv || Vv.gameState !== 'play') return;
  if (!ctx) ctx = Vv.ctx;
  if (!ctx) return;

  const vis = getVisitor();
  const now = nowFn();

  // World-space overlays.
  if (Array.isArray(gp.backedLabels)) {
    const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
    for (let i = 0; i < gp.backedLabels.length; i++) {
      const label = gp.backedLabels[i];
      if (!label) continue;
      const age = (now - label.start) / 1000;
      if (age < 0 || age >= (label.duration || 1.2)) continue;
      const worker = states[label.worker];
      if (!worker) continue;
      const alpha = age < 0.12 ? age / 0.12 : Math.max(0, 1 - (age - 0.12) / ((label.duration || 1.2) - 0.12));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(label.text || 'BACKED!'), Math.round(worker.x + 8), Math.round(worker.y - 20 - age * 10));
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  if (Array.isArray(Vv.particles)) {
    for (let i = 0; i < Vv.particles.length; i++) {
      const p = Vv.particles[i];
      if (!p || p.kind !== 'sparkle') continue;
      if (typeof p.age !== 'number' || typeof p.life !== 'number' || p.age >= p.life) continue;
      const alpha = Math.max(0, 1 - (p.age / p.life));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color || '#facc15';
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
      ctx.fillRect(Math.round(p.x), Math.round(p.y) - 3, 1, 7);
      ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y), 7, 1);
      ctx.restore();
    }
  }

  if (vis && Array.isArray(gp.rankFloats)) {
    const vp = isoFn(vis.gx, vis.gy);
    for (let i = 0; i < gp.rankFloats.length; i++) {
      const f = gp.rankFloats[i];
      if (!f) continue;
      const age = (now - f.start) / 1000;
      if (age < 0 || age >= (f.duration || 2.5)) continue;
      const alpha = Math.max(0, 1 - age / (f.duration || 2.5));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(f.text || ''), Math.round(vp.x), Math.round(vp.y - 42 - age * 16));
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  // Screen-space overlays (banner, card) independent of camera transform.
  const previousTransform = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : Vv.canvas;
  const cw = canvas ? canvas.width : 0;
  const ch = canvas ? canvas.height : 0;

  if (gp.ceremony && gp.ceremony.active) {
    const age = (now - gp.ceremony.start) / 1000;
    const dur = gp.ceremony.duration || 1.5;
    if (age >= 0 && age < dur) {
      let alpha = 1;
      if (age < 0.16) alpha = age / 0.16;
      else if (age > dur - 0.25) alpha = Math.max(0, (dur - age) / 0.25);
      if (alpha > 0) {
        const boxW = 290;
        const boxH = 44;
        const bx = Math.round(cw * 0.5 - boxW * 0.5);
        const by = Math.round(ch * 0.15);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(20, 16, 10, 0.86)';
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, boxW, boxH);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('THE GUILD THANKS ITS PATRON', bx + boxW * 0.5, by + boxH * 0.5);
        ctx.textAlign = 'left';
        ctx.restore();
      }
    }
  }

  if (gp.card && gp.card.visible) {
    const cardW = 210;
    const lineCount = Array.isArray(gp.endorsements) ? gp.endorsements.length : 0;
    const cardH = Math.min(224, Math.max(128, 102 + lineCount * 14));
    const bottomH = 52;
    const chatH = 106;
    const chatY = ch - bottomH - chatH - 8;
    let cardY = chatY - 8 - cardH;
    if (cardY < 44) cardY = 44;
    const cardX = 12;
    const pad = 10;

    ctx.save();
    ctx.fillStyle = 'rgba(46, 36, 24, 0.94)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('PATRON LICENSE', cardX + pad, cardY + 16);

    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('HOLDER: THE VISITOR', cardX + pad, cardY + 34);
    ctx.fillText('REP: ' + String(gp.rep), cardX + pad, cardY + 50);
    ctx.fillText('RANK: ' + String(gp.rank || 'NOVICE'), cardX + pad, cardY + 66);

    ctx.fillStyle = '#e8d8b0';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('BACKED QUESTS:', cardX + pad, cardY + 84);

    const listX = cardX + pad;
    const listY = cardY + 98;
    const listW = cardW - pad * 2;
    const listBottom = cardY + cardH - 8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listBottom - listY);
    ctx.clip();
    let y = listY;
    const ids = Array.isArray(gp.endorsements)
      ? gp.endorsements.map(function (e) { return e && e.taskId != null ? e.taskId : ''; })
      : [];
    for (let i = 0; i < ids.length; i++) {
      if (y + 13 > listBottom) break;
      const shown = fitFn(String(ids[i]), listW);
      ctx.fillStyle = '#e8d8b0';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(shown, listX, y + 6);
      y += 13;
    }
    ctx.restore();
    ctx.restore();
  }

  ctx.setTransform(previousTransform.a, previousTransform.b, previousTransform.c, previousTransform.d, previousTransform.e, previousTransform.f);
}

if (typeof window !== 'undefined') {
  if (!window.GuildPurpose) window.GuildPurpose = createState();
  if (!(window.GuildPurpose.endorsedWorkers instanceof Set)) window.GuildPurpose.endorsedWorkers = new Set();
  if (!(window.GuildPurpose.paidIds instanceof Set)) window.GuildPurpose.paidIds = new Set();
  if (!Array.isArray(window.GuildPurpose.backedLabels)) window.GuildPurpose.backedLabels = [];
  if (!Array.isArray(window.GuildPurpose.rankFloats)) window.GuildPurpose.rankFloats = [];
  if (!Array.isArray(window.GuildPurpose.sparks)) window.GuildPurpose.sparks = [];
  if (!window.GuildPurpose.card) window.GuildPurpose.card = { visible: true };
  window.GuildPurpose.update = update;
  window.GuildPurpose.draw = draw;
  window.GuildPurpose.__keys = pressed;
  window.GuildPurpose.__rawUpdate = update;
  window.GuildPurpose.__probe = function () {
    const gp = getGP();
    return {
      pressed: Array.from(pressed),
      prev: Array.from(prevPressed),
      sparks: gp && Array.isArray(gp.sparks) ? gp.sparks.length : 0,
      ceremony: !!(gp && gp.ceremony && gp.ceremony.active),
      rankFloats: gp && Array.isArray(gp.rankFloats) ? gp.rankFloats.length : 0,
      backedLabels: gp && Array.isArray(gp.backedLabels) ? gp.backedLabels.length : 0,
      paidIds: gp && gp.paidIds instanceof Set ? Array.from(gp.paidIds) : [],
      endorsements: gp && Array.isArray(gp.endorsements) ? gp.endorsements.length : 0,
      rep: gp ? gp.rep : 0,
      rank: gp ? gp.rank : 'NOVICE'
    };
  };

  if (!window.__gpListeners) {
    window.__gpListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
