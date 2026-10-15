const STATUES = [
  { gx: 3, gy: 2, color: '#22c55e' },
  { gx: 2, gy: 3, color: '#facc15' }
];

const GLOBAL_NAME = 'GuildSEHeroes';
let lastTime = null;

function createState() {
  return {
    statues: STATUES.map(function (s, i) {
      return {
        gx: s.gx,
        gy: s.gy,
        color: s.color,
        whisperIndex: i,
        whisperTask: null,
        nextRotate: 0,
        active: false,
        wasNear: false,
        chimed: false
      };
    })
  };
}

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w[GLOBAL_NAME]; }

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

function cueFn(type) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(type); } catch (e) {}
  }
}

function isFiniteNumber(v) {
  return typeof v === 'number' && isFinite(v);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;

  const vis = (typeof window !== 'undefined') ? window.GuildVisitor : null;
  const doneTasks = Array.isArray(Vv.allTasks)
    ? Vv.allTasks.filter(function (t) { return t && t.status === 'done'; })
    : [];

  for (let i = 0; i < st.statues.length; i++) {
    const s = st.statues[i];

    if (s.whisperTask) {
      let exists = false;
      for (let k = 0; k < doneTasks.length; k++) {
        if (String(doneTasks[k].id) === String(s.whisperTask.id)) {
          exists = true;
          break;
        }
      }
      if (!exists) s.whisperTask = null;
    }

    const near = !!vis &&
      isFiniteNumber(vis.gx) &&
      isFiniteNumber(vis.gy) &&
      Math.hypot(s.gx - vis.gx, s.gy - vis.gy) <= 1.5;

    if (near && !s.wasNear && s.chimed === false && doneTasks.length > 0) {
      // Preserve "chime on first whisper" until an actual whisper can be shown.
    }

    s.wasNear = near;

    if (near) {
      let showedNow = false;
      if (!s.whisperTask && doneTasks.length > 0) {
        s.whisperTask = doneTasks[s.whisperIndex % doneTasks.length];
        s.whisperIndex = (s.whisperIndex + 1) % Math.max(1, doneTasks.length);
        s.nextRotate = now + 4000;
        showedNow = true;
      } else if (s.whisperTask && now >= s.nextRotate && doneTasks.length > 0) {
        s.whisperTask = doneTasks[s.whisperIndex % doneTasks.length];
        s.whisperIndex = (s.whisperIndex + 1) % Math.max(1, doneTasks.length);
        s.nextRotate = now + 4000;
      }

      s.active = !!s.whisperTask;

      if (showedNow && !s.chimed) {
        s.chimed = true;
        cueFn('chime');
      }
    } else {
      s.active = false;
    }
  }

  lastTime = now;
}

function drawStatue(ctx, s) {
  const p = isoFn(s.gx, s.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 5, y + 14, 10, 3);

  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 5, y - 1, 10, 7);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(x - 6, y - 1, 12, 2);

  ctx.fillStyle = s.color;
  ctx.fillRect(x - 3, y - 11, 6, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, y - 14, 4, 3);
  ctx.fillStyle = s.color;
  ctx.fillRect(x - 4, y - 8, 8, 2);
}

function drawWhisper(ctx, s) {
  if (!s.active || !s.whisperTask) return;
  const task = s.whisperTask;
  const questId = String(task.id == null ? '' : task.id);
  const story = (task.title != null ? String(task.title) : questId).trim();
  const line = questId + ': ' + story;

  const p = isoFn(s.gx, s.gy);
  const x = Math.round(p.x);
  const y = Math.round(p.y);

  ctx.font = '10px monospace';
  const shown = fitFn(line, 168);
  const textW = ctx.measureText(shown).width;
  const bw = Math.max(96, Math.min(210, Math.round(textW + 16)));
  const bh = 22;
  const bx = Math.round(x - bw * 0.5);
  const by = Math.round(y - 62);

  ctx.fillStyle = 'rgba(217,200,163,0.96)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.beginPath();
  ctx.moveTo(Math.round(x - 4), by + bh);
  ctx.lineTo(Math.round(x + 4), by + bh);
  ctx.lineTo(x, by + bh + 7);
  ctx.closePath();
  ctx.fillStyle = 'rgba(217,200,163,0.96)';
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.beginPath();
  ctx.moveTo(Math.round(x - 4), by + bh);
  ctx.lineTo(x, by + bh + 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.round(x + 4), by + bh);
  ctx.lineTo(x, by + bh + 7);
  ctx.stroke();

  ctx.fillStyle = '#2b1d0e';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, bx + 8, by + bh * 0.5 + 1);
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !ctx) return;

  for (let i = 0; i < st.statues.length; i++) {
    const s = st.statues[i];
    drawStatue(ctx, s);
  }
  for (let i = 0; i < st.statues.length; i++) {
    drawWhisper(ctx, st.statues[i]);
  }
}

function probe() {
  const st = getState();
  const statuses = (st && Array.isArray(st.statues)) ? st.statues : [];
  return {
    global: GLOBAL_NAME,
    positions: STATUES.map(function (s) { return { gx: s.gx, gy: s.gy }; }),
    statues: STATUES.map(function (s, i) {
      const r = statuses[i] || {};
      const task = r.whisperTask || null;
      return {
        index: i,
        gx: s.gx,
        gy: s.gy,
        color: s.color,
        active: !!r.active,
        chimed: !!r.chimed,
        questId: task ? task.id : null,
        story: task ? (task.title != null ? task.title : task.id) : null,
        text: task ? (String(task.id) + ': ' + String(task.title != null ? task.title : task.id)) : null
      };
    })
  };
}

if (typeof window !== 'undefined') {
  if (!window[GLOBAL_NAME]) window[GLOBAL_NAME] = createState();
  const inst = window[GLOBAL_NAME];
  inst.update = update;
  inst.draw = draw;
  inst.__probe = probe;
  inst.__rawUpdate = update;
}

export {};
