const PRESSED = new Set();
let PREV_PRESSED = new Set();
let LAST_TIME = null;

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

function createState() {
  return { caught: 0, jar: false, released: false };
}

function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function getV() {
  const w = root();
  return w && w.V;
}

function isoPoint(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) {
    return {
      x: g.originX + (gx - gy) * g.tileW * 0.5,
      y: g.originY + (gx + gy) * g.tileH * 0.5
    };
  }
  return null;
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function getState() {
  const w = root();
  return (w && w.GuildFirejar) ? w.GuildFirejar : null;
}

function getVisitor() {
  const w = root();
  const v = w && w.GuildVisitor;
  if (!v || !isFinite(v.gx) || !isFinite(v.gy)) return null;
  return v;
}

function tileDistTile(a, b) {
  if (!a || !b || !isFinite(a.gx) || !isFinite(a.gy) || !isFinite(b.gx) || !isFinite(b.gy)) return Infinity;
  return Math.hypot(a.gx - b.gx, a.gy - b.gy);
}

function getGrove(Vv) {
  if (!Vv) return null;
  const w = root();
  const ff = w && w.GuildFireflies;
  if (ff && ff.grove && isFinite(ff.grove.gx) && isFinite(ff.grove.gy)) {
    return { gx: ff.grove.gx, gy: ff.grove.gy };
  }
  const s = Math.floor(typeof Vv.growthStep === 'number' ? Vv.growthStep : 0);
  const minC = -2 - s;
  const maxC = 1 + s;
  return { gx: maxC - 1, gy: minC + 1 };
}

const NE_PROPS = [
  { gx: -2, gy: 0 }, { gx: 0, gy: -2 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 },
  { gx: 1, gy: -1 }, { gx: 0, gy: -1 }, { gx: 1, gy: 0 }
];

function chooseAnchor(grove) {
  if (!grove) return null;
  const deltas = [[2, 0], [0, 2], [2, 2], [1, 2], [2, 1], [-2, 0], [0, -2], [-2, -2], [2, -1], [-1, 2]];
  for (let d = 0; d < deltas.length; d++) {
    const cand = { gx: grove.gx + deltas[d][0], gy: grove.gy + deltas[d][1] };
    let ok = Math.hypot(cand.gx - grove.gx, cand.gy - grove.gy) >= 2;
    if (ok) {
      for (let i = 0; i < NE_PROPS.length; i++) {
        if (Math.hypot(cand.gx - NE_PROPS[i].gx, cand.gy - NE_PROPS[i].gy) < 2) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return cand;
  }
  return { gx: grove.gx + 2, gy: grove.gy };
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  if (k === 'e' || k === ' ') {
    PRESSED.add(k);
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  PRESSED.delete(k);
  PREV_PRESSED.delete(k);
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  const visitor = getVisitor();

  if (!st || !Vv || Vv.gameState !== 'play') {
    LAST_TIME = now;
    return;
  }
  if (!isoPoint(0, 0)) {
    LAST_TIME = now;
    return;
  }

  if (LAST_TIME === null) LAST_TIME = now;
  let dt = (now - LAST_TIME) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  LAST_TIME = now;

  const grove = getGrove(Vv);
  if (!grove) return;
  const anchor = chooseAnchor(grove);
  if (!anchor) return;

  st._grove = grove;
  st._anchor = anchor;
  st.jar = true;

  if (!Array.isArray(st._arcs)) st._arcs = [];
  if (!Array.isArray(st._releaseArcs)) st._releaseArcs = [];

  const ePressed = PRESSED.has('e') || PRESSED.has(' ');
  const eWas = PREV_PRESSED.has('e') || PREV_PRESSED.has(' ');

  const inRange = !!visitor && tileDistTile(visitor, anchor) <= 1.5;
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 0;
  const isNight = dl < 0.35;

  if (inRange && isNight && !eWas && ePressed && (st.caught || 0) < 5 && !st._releaseActive) {
    st.caught = Math.min(5, (st.caught || 0) + 1);
    const from = isoPoint(grove.gx, grove.gy);
    const to = isoPoint(anchor.gx, anchor.gy);
    if (from && to) {
      st._arcs.push({
        kind: 'in',
        start: now,
        dur: 600,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y
      });
    }
    try {
      const w = root();
      if (w && typeof w.cue === 'function') w.cue('grow');
    } catch (e) { void e; }
  }

  if (!st._releaseActive && (st.caught || 0) > 0 && dl > 0.5 &&
      (st._prevDaylight == null || st._prevDaylight <= 0.5)) {
    st._releaseActive = true;
    st._releaseStart = now;
    st._releaseDur = 2000;
    st._releaseArcs = [];
    const from = isoPoint(anchor.gx, anchor.gy);
    const count = st.caught || 0;
    for (let i = 0; i < count; i++) {
      const ang = (count > 1 ? (i / count) * Math.PI * 2 : 0);
      const gx = anchor.gx + Math.cos(ang) * 2.4;
      const gy = anchor.gy + Math.sin(ang) * 2.4;
      const to = isoPoint(gx, gy);
      if (from && to) {
        st._releaseArcs.push({
          kind: 'out',
          start: now,
          dur: 2000,
          fromX: from.x,
          fromY: from.y,
          toX: to.x,
          toY: to.y
        });
      }
    }
  }

  if (st._releaseActive) {
    const age = now - (st._releaseStart || now);
    if (age >= (st._releaseDur || 2000)) {
      st.caught = 0;
      st._releaseActive = false;
      st._releaseArcs = [];
      st._sparkleStart = now;
      st.released = true;
    }
  }

  if (dl < 0.35) st.released = false;

  st._prevDaylight = dl;

  st._arcs = st._arcs.filter(function (a) {
    return now - a.start < a.dur;
  });
  st._releaseArcs = st._releaseArcs.filter(function (a) {
    return now - a.start < a.dur;
  });

  PREV_PRESSED = new Set(PRESSED);
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !ctx || !Vv || Vv.gameState !== 'play') return;
  if (!isoPoint(0, 0)) return;

  const visitor = getVisitor();
  const grove = st._grove || getGrove(Vv);
  const anchor = st._anchor || (grove ? chooseAnchor(grove) : null);
  if (!anchor) return;
  const jarPt = isoPoint(anchor.gx, anchor.gy);
  if (!jarPt) return;

  // Glass jar prop.
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(Math.round(jarPt.x) - 4, Math.round(jarPt.y) - 9, 8, 12);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#e8e6df';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(jarPt.x) - 4, Math.round(jarPt.y) - 9, 8, 12);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(Math.round(jarPt.x) - 5, Math.round(jarPt.y) - 12, 10, 3);
  ctx.restore();

  // Tiny warm dots flying into the jar.
  if (Array.isArray(st._arcs)) {
    for (let i = 0; i < st._arcs.length; i++) {
      const a = st._arcs[i];
      const t = Math.max(0, Math.min(1, (nowFn() - a.start) / a.dur)); // fallback if now stale? handled below
      void t;
    }
  }

  // Draw arcs with time from closure? Use performance now only; module update already ate now.
  // We recalc progress from stored start and current performance time.
  const now = nowFn();
  if (Array.isArray(st._arcs)) {
    for (let i = 0; i < st._arcs.length; i++) {
      const a = st._arcs[i];
      const t = Math.max(0, Math.min(1, (now - a.start) / a.dur));
      const x = a.fromX + (a.toX - a.fromX) * t;
      const y = a.fromY + (a.toY - a.fromY) * t - Math.sin(t * Math.PI) * 10;
      const alpha = 1 - t;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      ctx.restore();
    }
  }

  if (Array.isArray(st._releaseArcs)) {
    for (let i = 0; i < st._releaseArcs.length; i++) {
      const a = st._releaseArcs[i];
      const t = Math.max(0, Math.min(1, (now - a.start) / a.dur));
      const x = a.fromX + (a.toX - a.fromX) * t;
      const y = a.fromY + (a.toY - a.fromY) * t - Math.sin(t * Math.PI) * 6;
      const alpha = 1 - t;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      ctx.restore();
    }
  }

  // Glow around visitor for caught fireflies.
  if ((st.caught || 0) > 0 && visitor) {
    const pt = isoPoint(visitor.gx, visitor.gy);
    if (pt) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const alpha = Math.min(0.25, (st.caught || 0) * 0.05);
      const gradient = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 24);
      gradient.addColorStop(0, 'rgba(212,175,55,' + alpha + ')');
      gradient.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Sparkle on release completion.
  if (st._sparkleStart) {
    const age = now - st._sparkleStart;
    if (age < 1000) {
      const t = age / 1000;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const r = 4 + t * 18;
        const x = jarPt.x + Math.cos(ang) * r;
        const y = jarPt.y + Math.sin(ang) * r;
        ctx.fillStyle = (i % 2 === 0) ? '#d4af37' : '#ffffff';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      ctx.restore();
    } else {
      st._sparkleStart = null;
    }
  }

  const night = (typeof Vv.daylight === 'number') ? Vv.daylight < 0.35 : false;
  const inRange = !!visitor && tileDistTile(visitor, anchor) <= 1.5;
  if (night && inRange) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#f3d37a';
    ctx.fillText('[E] CATCH', Math.round(jarPt.x), Math.round(jarPt.y) - 18);
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildFirejar) window.GuildFirejar = createState();
  const state = window.GuildFirejar;
  if (typeof state.caught !== 'number') state.caught = 0;
  if (typeof state.jar !== 'boolean') state.jar = false;
  if (typeof state.released !== 'boolean') state.released = false;

  window.GuildFirejar.update = update;
  window.GuildFirejar.draw = draw;
  window.GuildFirejar.__probe = function () {
    const current = getState() || state;
    return { caught: Number(current.caught || 0), jar: !!current.jar };
  };

  if (!window.__gfListeners) {
    window.__gfListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
