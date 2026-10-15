const BUILDING_BLOCKER = null;
let __dummy = BUILDING_BLOCKER;
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
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function getState() { const w = root(); return w && w.GuildCrickets; }

function southEdgeGy() {
  const Vv = getV();
  const s = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  return 1 + s;
}

function createState() {
  return {
    nextPatternAt: 0,
    chirping: false,
    queue: [],
    lastChime: 0,
    flecks: []
  };
}

function pickSource() {
  if (Math.random() < 0.5) {
    return { gx: 5 + Math.floor(Math.random() * 2), gy: Math.floor(Math.random() * 3) };
  }
  return { gx: 2 + Math.floor(Math.random() * 3), gy: southEdgeGy() };
}

function spawnFleck(st, source, now) {
  if (!st || !source) return;
  const pt = isoFn(source.gx, source.gy);
  st.flecks.push({
    x: pt.x + (Math.random() * 6 - 3),
    y: pt.y + (Math.random() * 6 - 3),
    start: now,
    duration: 260 + Math.random() * 180
  });
  if (st.flecks.length > 12) st.flecks.splice(0, st.flecks.length - 12);
}

function clearQueue(st) {
  if (st) st.queue.length = 0;
}

function updateFlecks(st, now) {
  if (!st) return;
  const next = [];
  for (let i = 0; i < st.flecks.length; i++) {
    const f = st.flecks[i];
    if (now - f.start < f.duration) next.push(f);
  }
  st.flecks = next;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  const w = root();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const dusk = (typeof Vv.daylight === 'number' && Vv.daylight < 0.3);
  const rain = (Vv.weather === 'RAIN');
  const hasCue = (w && typeof w.cue === 'function');

  updateFlecks(st, now);

  if (!dusk) {
    st.chirping = false;
    clearQueue(st);
    st.flecks = [];
    st.nextPatternAt = 0;
    return;
  }

  if (rain || !hasCue) {
    st.chirping = false;
    clearQueue(st);
    if (!rain) st.flecks = [];
    if (!st.nextPatternAt || st.nextPatternAt < now) st.nextPatternAt = now + 4000 + Math.random() * 5000;
    return;
  }

  if (!st.nextPatternAt || st.nextPatternAt <= 0) {
    st.nextPatternAt = now + 4000 + Math.random() * 5000;
  }

  if (!st.chirping && now >= st.nextPatternAt) {
    const count = 2 + Math.floor(Math.random() * 3);
    st.queue.length = 0;
    let t = now + Math.random() * 120;
    for (let i = 0; i < count; i++) {
      if (i > 0) t += 120 + Math.random() * 240;
      st.queue.push({ t: t, source: pickSource() });
    }
    st.queue.sort(function (a, b) { return a.t - b.t; });
    st.chirping = true;
  }

  while (st.queue.length && now >= st.queue[0].t) {
    const item = st.queue.shift();
    try { w.cue('cricket'); } catch (e) {}
    st.lastChime = now;
    if (Math.random() < 0.55) {
      spawnFleck(st, item.source, now);
      if (Math.random() < 0.30) spawnFleck(st, pickSource(), now);
    }
  }

  if (st.chirping && st.queue.length === 0) {
    st.chirping = false;
    st.nextPatternAt = now + 4000 + Math.random() * 5000;
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;

  const now = nowFn();
  updateFlecks(st, now);

  for (let i = 0; i < st.flecks.length; i++) {
    const f = st.flecks[i];
    const age = now - f.start;
    if (age < 0 || age >= f.duration) continue;
    const p = age / f.duration;
    const alpha = Math.sin(Math.PI * p);
    if (!(alpha > 0)) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
  }
  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildCrickets) window.GuildCrickets = createState();
  const cr = window.GuildCrickets;
  cr.update = update;
  cr.draw = draw;
  cr.__probe = function () {
    const s = getState();
    return {
      chirping: !!(s && s.chirping),
      lastChime: (s && typeof s.lastChime === 'number') ? s.lastChime : 0
    };
  };
}

export {};
