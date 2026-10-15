const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

function createState() {
  return {
    x: 0, y: 0, gx: 2, gy: -1, moving: false, facing: 'down',
    speaker: null, speakerIndex: 0, wasDusk: false, nightSerial: 0,
    lastUpdateNow: null, lastTrigger: 0, story: null, sparkles: [],
    lastNow: null
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
function getState() { const w = root(); return w && w.GuildStoryteller; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function hasIso(Vv) {
  const w = root();
  if (w && typeof w.iso === 'function') return true;
  return !!(Vv && Vv.grid);
}

function workerNames(Vv) {
  if (!Vv || !Array.isArray(Vv.workers)) return [];
  const out = [];
  for (let i = 0; i < Vv.workers.length; i++) {
    const w = Vv.workers[i];
    const name = (w && w.name != null) ? String(w.name).trim() : '';
    if (name) out.push(name);
  }
  return out;
}

function tileDistance(sx, sy, vx, vy, g) {
  if (!g || !isFinite(sx) || !isFinite(sy) || !isFinite(vx) || !isFinite(vy)) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function normalizeName(value) {
  return String(value == null ? '' : value).toLowerCase().trim();
}

function findOwnerName(Vv, task) {
  if (!Vv || !Array.isArray(Vv.workers) || !task) return null;
  for (let wi = 0; wi < Vv.workers.length; wi++) {
    const worker = Vv.workers[wi];
    const tasks = Array.isArray(worker && worker.tasks) ? worker.tasks : [];
    for (let ti = 0; ti < tasks.length; ti++) {
      const t = tasks[ti];
      if (!t) continue;
      let match = false;
      if (task.id != null && t.id != null && String(t.id) === String(task.id)) match = true;
      if (!match && task.title != null && t.title != null && String(t.title) === String(task.title)) match = true;
      if (match) return (worker && worker.name != null) ? String(worker.name) : null;
    }
  }
  return null;
}

function pickEvent(Vv) {
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  for (let i = tasks.length - 1; i >= 0; i--) {
    const t = tasks[i];
    if (!t || typeof t !== 'object') continue;
    const status = String(t.status == null ? '' : t.status).toLowerCase();
    if (status === 'done' || status === 'failed') {
      return {
        title: (t.title != null ? t.title : (t.id != null ? t.id : 'a quest')),
        status: status,
        ownerName: findOwnerName(Vv, t)
      };
    }
  }
  if (tasks.length) {
    const t = tasks[tasks.length - 1];
    if (t && typeof t === 'object') {
      return {
        title: (t.title != null ? t.title : (t.id != null ? t.id : 'a quest')),
        status: String(t.status == null ? 'pending' : t.status).toLowerCase(),
        ownerName: findOwnerName(Vv, t)
      };
    }
  }
  return null;
}

function flavorFor(speaker, status) {
  const n = normalizeName(speaker);
  if (n.indexOf('missing') !== -1) return status === 'failed' ? 'glitch turned into a plot twist' : 'glitched it into glory';
  if (n.indexOf('laguna') !== -1) return status === 'failed' ? 'the tide went sideways, the lesson stayed' : 'rode the wave to shore';
  if (n.indexOf('step') !== -1) return status === 'failed' ? 'silence is also a stanza' : 'left the stanza blank on purpose';
  return status === 'failed' ? 'a comic mishap, fondly retold' : 'worth a candle by the guild fire';
}

function worldToTile(wx, wy, Vv) {
  const g = Vv && Vv.grid;
  if (!g || !isFinite(wx) || !isFinite(wy)) return { gx: 0, gy: 0 };
  const u = (wx - g.originX) / g.tileW;
  const v = (wy - g.originY) / g.tileH;
  return { gx: u + v, gy: v - u };
}

function storyAnchor(Vv, st) {
  const g = Vv && Vv.grid;
  if (!g) return null;
  const hearth = isoFn(0, -1);
  if (!hearth) return null;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w || !isFinite(w.x) || !isFinite(w.y)) continue;
    const d = tileDistance(w.x, w.y, hearth.x, hearth.y, g);
    if (d <= 3 && d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  if (best) return { x: best.x, y: best.y };
  return isoFn(2, -1);
}

function findNearWorker(Vv) {
  const g = Vv && Vv.grid;
  if (!g) return null;
  const hearth = isoFn(0, -1);
  if (!hearth) return null;
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w || !isFinite(w.x) || !isFinite(w.y)) continue;
    const d = tileDistance(w.x, w.y, hearth.x, hearth.y, g);
    if (d <= 3 && d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

function drawSilhouette(ctx, world, now) {
  if (!ctx || !world) return;
  const x = Math.round(world.x);
  const y = Math.round(world.y);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 3, y + 12, 12, 3);
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 2, y + 5, 10, 8);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x, y - 3, 8, 8);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x + 2, y + 1, 4, 2);
  ctx.restore();
}

function drawSparkle(ctx, world, now) {
  if (!ctx || !world) return;
  ctx.save();
  for (let k = 0; k < 6; k++) {
    const ang = (now * 0.004 + k * (Math.PI / 3));
    const px = Math.round(world.x + Math.cos(ang) * 9);
    const py = Math.round(world.y - 24 + Math.sin(ang * 1.7) * 4);
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now * 0.01 + k);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(px, py, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBubble(ctx, st, world, age, now) {
  if (!ctx || !st || !st.story || !world) return;
  const lines = Array.isArray(st.story.lines) ? st.story.lines : [];
  if (!lines.length) return;
  const alpha = (age <= 7000) ? 1 : Math.max(0, 1 - ((age - 7000) / 1000));
  if (alpha <= 0) return;
  const boxW = 236;
  const lineH = 13;
  const boxH = 8 + lines.length * lineH + 4;
  const x = Math.round(world.x - boxW * 0.5);
  const y = Math.round(world.y - 74 - boxH);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = '#e8e6df';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let i = 0; i < lines.length && i < 3; i++) {
    const shown = fitFn(String(lines[i]), boxW - 12);
    ctx.fillText(shown, x + 6, y + 10 + i * lineH);
  }
  ctx.restore();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !hasIso(Vv)) return;

  let dt = 0;
  if (st.lastUpdateNow != null) {
    dt = (now - st.lastUpdateNow) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
  }
  st.lastUpdateNow = now;
  st.lastNow = now;

  const names = workerNames(Vv);
  if (st.speaker == null) {
    st.speakerIndex = 0;
    st.speaker = names.length ? names[0] : 'MISSINGNO';
  }

  const dusk = (typeof Vv.daylight === 'number') && Vv.daylight < 0.25;
  if (dusk && !st.wasDusk) {
    if (names.length) {
      st.speakerIndex = ((st.speakerIndex || 0) + 1) % names.length;
      st.speaker = names[st.speakerIndex];
    } else {
      st.speaker = 'MISSINGNO';
    }
    st.nightSerial = (st.nightSerial || 0) + 1;
  }
  st.wasDusk = dusk;

  if (st.story) {
    const age = now - st.story.start;
    if (age >= 8000) {
      st.story = null;
      st.sparkles = [];
    }
  }

  const anchor = storyAnchor(Vv, st);
  const vis = getVisitor();
  let within = false;
  if (anchor && vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') {
    const vWorld = isoFn(vis.gx, vis.gy);
    if (vWorld && Vv.grid) {
      within = tileDistance(anchor.x, anchor.y, vWorld.x, vWorld.y, Vv.grid) <= 4;
    }
  }

  if (dusk && !st.story && within && (now - (st.lastTrigger || 0)) >= 20000) {
    const evt = pickEvent(Vv);
    if (evt && anchor) {
      const proud = evt.status === 'done' && normalizeName(evt.ownerName) === normalizeName(st.speaker);
      const lines = [
        String(evt.title == null ? '' : evt.title),
        'Shipped by ' + String(evt.ownerName || 'an unknown guildmate'),
        String(st.speaker) + ': ' + flavorFor(st.speaker, evt.status)
      ];
      st.story = {
        start: now,
        lines: lines,
        proud: proud,
        speaker: st.speaker
      };
      st.lastTrigger = now;
      st.sparkles = proud ? [0, 1, 2] : [];
    }
  }

  if (!within && !st.story) {
    st.lastTrigger = Math.max(st.lastTrigger || 0, now);
  }

  if (anchor) {
    st.x = anchor.x;
    st.y = anchor.y;
    const tile = worldToTile(anchor.x, anchor.y, Vv);
    st.gx = tile.gx;
    st.gy = tile.gy;
  }
  st.moving = false;
  st.facing = 'down';

  if (st.sparkles && st.sparkles.length) {
    for (let i = 0; i < st.sparkles.length; i++) {
      st.sparkles[i] = (st.sparkles[i] + dt * (0.8 + i * 0.35)) % (Math.PI * 2);
    }
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv || Vv.gameState !== 'play' || !hasIso(Vv)) return;

  const now = nowFn();
  const dusk = (typeof Vv.daylight === 'number') && Vv.daylight < 0.25;
  if (!dusk) return;

  const anchor = storyAnchor(Vv, st);
  if (!anchor) return;

  const nearWorker = findNearWorker(Vv);
  if (!nearWorker) {
    drawSilhouette(ctx, anchor, now);
  }

  if (st.story && (now - st.story.start) < 8000) {
    const age = now - st.story.start;
    if (st.story.proud) drawSparkle(ctx, anchor, now);
    drawBubble(ctx, st, anchor, age, now);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildStoryteller) window.GuildStoryteller = createState();
  window.GuildStoryteller.update = update;
  window.GuildStoryteller.draw = draw;
  window.GuildStoryteller.__probe = function () {
    const st = getState();
    return {
      speaker: st ? st.speaker : null,
      lines: (st && st.story && Array.isArray(st.story.lines)) ? st.story.lines.length : 0
    };
  };
  window.GuildStoryteller.__rawUpdate = update;
}

export {};
