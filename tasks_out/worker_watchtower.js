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
function getState() { const w = root(); return w && w.GuildWatchtower; }

function getAllTasks(Vv) {
  if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks;
  if (Vv && Array.isArray(Vv.tasks)) return Vv.tasks;
  const w = root();
  if (w && Array.isArray(w.allTasks)) return w.allTasks;
  return [];
}

function createState() {
  const state = {
    gx: 0,
    gy: -5,
    facing: 'down',
    moving: false,
    walkFrame: 0,
    walkTimer: 0,
    doneIds: new Set(),
    rememberedDone: null,
    initialized: false,
    flash: { active: false, t: 0, total: 3, period: 0.2 },
    banner: { active: false, text: null, t: 0, duration: 2.4 },
    pendingShipments: [],
    lastTime: null
  };
  state.rememberedDone = state.doneIds;
  return state;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') {
    if (st) st.lastTime = now;
    return;
  }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  const tasks = getAllTasks(Vv);
  const doneNow = new Set();
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t && t.status === 'done' && t.id != null) doneNow.add(String(t.id));
  }

  if (!st.initialized) {
    st.doneIds = doneNow;
    st.rememberedDone = st.doneIds;
    st.initialized = true;
  } else {
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t || t.status !== 'done' || t.id == null) continue;
      const id = String(t.id);
      if (st.doneIds.has(id)) continue;
      const title = (t.title != null ? t.title : (t.id != null ? t.id : 'task'));
      st.pendingShipments.push(String(title));
    }
    st.doneIds = doneNow;
    st.rememberedDone = st.doneIds;

    if (!st.flash.active && st.pendingShipments.length > 0) {
      const title = st.pendingShipments.shift();
      st.flash.active = true;
      st.flash.t = 0;
      st.banner.active = true;
      st.banner.text = 'SHIPPED: ' + title;
      st.banner.t = 0;
      const w = root();
      if (w && typeof w.cue === 'function') {
        try { w.cue(); } catch (e) {}
      }
    }
  }

  if (st.flash.active) {
    st.flash.t += dt;
    const totalBlinkTime = st.flash.total * st.flash.period * 2;
    if (st.flash.t >= totalBlinkTime) {
      st.flash.active = false;
      st.flash.t = totalBlinkTime;
    }
  }

  if (st.banner.active) {
    st.banner.t += dt;
    if (st.banner.t >= st.banner.duration) {
      st.banner.active = false;
      st.banner.text = null;
    }
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();

  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 8, y + 14, 16, 4);

  ctx.fillStyle = '#3a4252';
  ctx.fillRect(x - 6, y - 38, 12, 38);
  ctx.fillStyle = '#4b5566';
  ctx.fillRect(x - 6, y - 38, 3, 38);
  ctx.fillStyle = '#202733';
  ctx.fillRect(x - 7, y - 40, 14, 3);
  ctx.fillStyle = '#4b5566';
  ctx.fillRect(x - 8, y - 44, 16, 6);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 1, y - 52, 2, 8);

  let lanternOn = false;
  if (st.flash.active) {
    const index = Math.floor(st.flash.t / st.flash.period);
    lanternOn = (index % 2 === 0) && (index < st.flash.total * 2);
  }

  ctx.fillStyle = lanternOn ? '#facc15' : '#b8860b';
  ctx.fillRect(x - 4, y - 54, 8, 8);
  ctx.fillStyle = lanternOn ? '#fff3b0' : '#854d0e';
  ctx.fillRect(x - 2, y - 52, 4, 4);

  if (lanternOn) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x - 10, y - 60, 20, 20);
    ctx.globalAlpha = 1;
  }

  if (st.banner.active && st.banner.text) {
    const fadeT = st.banner.t;
    const alpha = fadeT < 2.0 ? 1 : Math.max(0, 1 - (fadeT - 2.0) / 0.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    const text = fitFn(st.banner.text, 150);
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText(text).width;
    const bw = Math.max(48, Math.round(tw + 12));
    const bh = 14;
    const bx = x - Math.round(bw * 0.5);
    const by = y - 74;
    ctx.fillStyle = 'rgba(10,10,12,0.90)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + bw * 0.5, by + bh * 0.5 + 1);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildWatchtower) window.GuildWatchtower = createState();
  window.GuildWatchtower.update = update;
  window.GuildWatchtower.draw = draw;
  window.GuildWatchtower.__rawUpdate = update;
}

export {};
