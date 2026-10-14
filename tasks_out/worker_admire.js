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
function getState() { const w = root(); return w && w.GuildAdmire; }

function createState() { return { active: null, nextAt: 0 }; }

function getPedestals() {
  const w = root();
  const gm = w && w.GuildMuseum;
  if (!gm) return [];
  try {
    if (typeof gm.getPedestals === 'function') {
      const res = gm.getPedestals();
      return Array.isArray(res) ? res : (res ? [res] : []);
    }
    if (Array.isArray(gm.pedestals)) return gm.pedestals;
    if (Array.isArray(gm)) return gm;
    if (gm.pedestals && typeof gm.pedestals === 'object') {
      if (typeof gm.pedestals.length === 'number') return Array.prototype.slice.call(gm.pedestals);
      const vals = [];
      for (const key in gm.pedestals) {
        if (Object.prototype.hasOwnProperty.call(gm.pedestals, key)) vals.push(gm.pedestals[key]);
      }
      if (vals.length && vals.every(function (v) { return v && typeof v === 'object'; })) return vals;
    }
    if (gm.pedestal && typeof gm.pedestal === 'object') return [gm.pedestal];
  } catch (e) {}
  return [];
}

function pedestalPos(ped) {
  if (!ped || typeof ped !== 'object') return { x: 0, y: 0 };
  try {
    if (typeof ped.gx === 'number' && typeof ped.gy === 'number') return isoFn(ped.gx, ped.gy);
    if (ped.projected && typeof ped.projected.x === 'number' && typeof ped.projected.y === 'number') return { x: ped.projected.x, y: ped.projected.y };
    if (typeof ped.x === 'number' && typeof ped.y === 'number') return { x: ped.x, y: ped.y };
    if (ped.pos && typeof ped.pos.x === 'number' && typeof ped.pos.y === 'number') return { x: ped.pos.x, y: ped.pos.y };
  } catch (e) {}
  return { x: 0, y: 0 };
}

function rawQuestId(ped) {
  if (!ped || typeof ped !== 'object') return '';
  const candidates = [ped.questId, ped.quest_id, ped.taskId, ped.task_id, ped.task, ped.exhibit, ped.exhibited, ped.exhibitedQuest, ped.exhibitedTask, ped.quest, ped.id];
  for (let i = 0; i < candidates.length; i++) {
    const v = candidates[i];
    if (v != null && String(v) !== '') return v;
  }
  return '';
}

function resolveQuestId(ped, Vv) {
  let qid = rawQuestId(ped);
  if ((qid === '' || qid == null) && Vv && Array.isArray(Vv.allTasks) && Vv.allTasks.length) {
    qid = Vv.allTasks[0].id;
  }
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t && String(t.id) === String(qid)) return String(t.id);
  }
  return qid != null ? String(qid) : '';
}

function idleWorkers(Vv) {
  if (!Vv) return [];
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  const n = Math.max(states.length, metas.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const st = states[i];
    const meta = metas[i] || {};
    const tasks = Array.isArray(meta.tasks) ? meta.tasks : (Array.isArray(st && st.tasks) ? st.tasks : []);
    const allDone = !tasks.length || tasks.every(function (t) { return t && t.status === 'done'; });
    if ((st && st.workerState === 'IDLE') || allDone) out.push(i);
  }
  return out;
}

function visitorNearPedestal(ped) {
  const w = root();
  const vis = w && w.GuildVisitor;
  const Vv = getV();
  if (!vis || !ped) return false;
  try {
    if (typeof ped.gx === 'number' && typeof ped.gy === 'number' && typeof vis.gx === 'number' && typeof vis.gy === 'number') {
      return Math.hypot(vis.gx - ped.gx, vis.gy - ped.gy) <= 2;
    }
    const pp = pedestalPos(ped);
    const vp = isoFn(vis.gx, vis.gy);
    const g = Vv && Vv.grid;
    const scale = (g && g.tileW) ? Math.max(g.tileW, g.tileH) : 40;
    if (!scale) return false;
    return Math.hypot(vp.x - pp.x, vp.y - pp.y) / scale <= 2;
  } catch (e) {
    return false;
  }
}

function randDelay() { return 60000 + Math.random() * 60000; }

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Vv || Vv.gameState !== 'play') return;
  if (!isFinite(st.nextAt)) st.nextAt = 0;
  if (st.nextAt <= 0) st.nextAt = now + randDelay();

  if (st.active) {
    const age = now - (st.active.start || now);
    if (!isFinite(age) || age >= 6000) {
      st.active = null;
      st.nextAt = now + randDelay();
    }
  }

  if (!st.active && now >= st.nextAt) {
    const peds = getPedestals();
    const idles = idleWorkers(Vv);
    if (peds.length && idles.length) {
      const pi = Math.floor(Math.random() * peds.length);
      const wi = idles[Math.floor(Math.random() * idles.length)];
      const ped = peds[pi];
      if (ped && !visitorNearPedestal(ped)) {
        const qid = resolveQuestId(ped, Vv);
        st.active = {
          workerIndex: wi,
          pedestalIndex: pi,
          pedestal: ped,
          questId: qid,
          thought: 'so that is how ' + (qid || 'it') + ' shipped...',
          start: now,
          pos: pedestalPos(ped)
        };
      }
    }
    st.nextAt = now + randDelay();
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  if (!st.active) return;
  const ped = st.active.pedestal;
  if (ped && visitorNearPedestal(ped)) return;

  const now = nowFn();
  const age = (st.active && isFinite(st.active.start)) ? (now - st.active.start) : 0;
  const pos = (st.active && st.active.pos) ? st.active.pos : { x: 0, y: 0 };
  const bob = Math.round(Math.sin(age / 260) * 1.2);
  const x = Math.round(pos.x);
  const y = Math.round(pos.y) + bob - 8;

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  const stepFrame = Math.floor(age / 140) % 2;
  ctx.fillRect(x - 5, Math.round(pos.y) + 18, 16, 3);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x + 2, y + (stepFrame ? 11 : 10), 3, 7);
  ctx.fillRect(x + 10, y + (stepFrame ? 10 : 11), 3, (stepFrame ? 6 : 7));
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(x + 1, y - 2, 14, 12);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x + 3, y - 11, 10, 9);
  ctx.fillStyle = '#374151';
  ctx.fillRect(x + 5, y - 8, 2, 2);
  ctx.fillRect(x + 9, y - 8, 2, 2);
  ctx.restore();

  ctx.font = '10px monospace';
  const thought = fitFn(st.active.thought, 150);
  const tw = ctx.measureText(thought).width;
  const bw = Math.max(56, Math.round(tw) + 12);
  const bh = 16;
  const bx = x + 8 - Math.round(bw * 0.5);
  const by = y - 34;
  ctx.fillStyle = 'rgba(13,19,36,0.92)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(thought, bx + bw * 0.5, by + bh * 0.5 + 1);
  ctx.textAlign = 'left';

  const cycle = age % 2000;
  if (cycle < 260) {
    const fade = 1 - cycle / 260;
    ctx.globalAlpha = fade * 0.5;
    ctx.fillStyle = '#d4af37';
    const r = 5 + Math.round(cycle / 40);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(Math.round(pos.x + Math.cos(a) * r), Math.round(pos.y - 4 + Math.sin(a) * r), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

function probe() { const st = getState(); return { active: !!(st && st.active) }; }

if (typeof window !== 'undefined') {
  if (!window.GuildAdmire) window.GuildAdmire = createState();
  const st = window.GuildAdmire;
  if (st.active == null) st.active = null;
  if (!isFinite(st.nextAt)) st.nextAt = 0;
  st.update = update;
  st.draw = draw;
  st.__probe = probe;
}

export {};
