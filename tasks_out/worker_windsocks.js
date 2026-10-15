const SOCK_DEFS = [
  { gx: -4, gy: -6 },
  { gx: -1, gy: -6 },
  { gx: -4, gy: -4 }
];

let ePulse = false;
let lastTime = null;
let currentNow = 0;
let flocks = [];
let notes = [];

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
function getState() { const w = root(); return w && w.GuildWindsocks; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

function createState() {
  return {
    socks: SOCK_DEFS.map(function (p) { return { gx: p.gx, gy: p.gy }; }),
    called: 0,
    lastCall: 0
  };
}

function onKeydown(e) {
  if (!e) return;
  const k = (e.key === ' ') ? ' ' : String(e.key || '').toLowerCase();
  if (k === 'e' || k === ' ') ePulse = true;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  currentNow = now;
  const w = root();
  const Vv = getV();
  const state = getState();
  if (!w || !Vv || !state || Vv.gameState !== 'play') { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (ePulse) {
    ePulse = false;
    const vis = getVisitor();
    if (vis) {
      let best = -1;
      let bestDist = 1.51;
      for (let i = 0; i < state.socks.length; i++) {
        const s = state.socks[i];
        const d = Math.hypot(vis.gx - s.gx, vis.gy - s.gy);
        if (d <= 1.5 && d < bestDist) { bestDist = d; best = i; }
      }
      const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
      if (best >= 0 && dl >= 0.3 && now - state.lastCall >= 5000) {
        try { if (typeof window.cue === 'function') window.cue('alert'); } catch (e) {}
        state.called += 1;
        state.lastCall = now;
        flocks.push({ targetIndex: best, start: now });
        notes.push({ targetIndex: best, start: now });
      }
    }
  }

  const nextFlocks = [];
  for (let i = 0; i < flocks.length; i++) {
    if (now - flocks[i].start < 3200) nextFlocks.push(flocks[i]);
  }
  flocks = nextFlocks;

  const nextNotes = [];
  for (let i = 0; i < notes.length; i++) {
    if (now - notes[i].start < 2000) nextNotes.push(notes[i]);
  }
  notes = nextNotes;
}

function draw(ctx) {
  const w = root();
  if (!ctx || !w) return;
  const Vv = getV();
  const state = getState();
  if (!Vv || !state || !Array.isArray(state.socks) || Vv.gameState !== 'play') return;
  const now = currentNow || nowFn();
  const dl = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const vis = getVisitor();

  for (let i = 0; i < state.socks.length; i++) {
    const s = state.socks[i];
    const pt = isoFn(s.gx, s.gy);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    const fast = (Vv.weather === 'RAIN') ? 1.7 : 1.0;
    const sway = Math.sin(now * 0.004 * fast + i * 1.3) * 4 + (Vv.wind || 0) * 2;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 6, y + 2, 12, 3);

    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(x - 2, y - 42, 4, 44);

    ctx.save();
    ctx.translate(x, y - 42);
    ctx.rotate(sway * 0.03);
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, 26);
    ctx.lineTo(9, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-8, 6, 16, 3);
    ctx.fillRect(-7, 13, 14, 3);
    ctx.fillRect(-2, 26, 4, 2);
    ctx.restore();

    if (dl < 0.3) {
      ctx.fillStyle = '#0b0b10';
      for (let b = 0; b < 4; b++) ctx.fillRect(x - 8 + b * 4, y - 28, 3, 2);
    }
  }

  let hintIndex = -1;
  if (vis) {
    let bestDist = 1.51;
    for (let i = 0; i < state.socks.length; i++) {
      const s = state.socks[i];
      const d = Math.hypot(vis.gx - s.gx, vis.gy - s.gy);
      if (d <= 1.5 && d < bestDist) { bestDist = d; hintIndex = i; }
    }
  }
  if (hintIndex >= 0) {
    const s = state.socks[hintIndex];
    const pt = isoFn(s.gx, s.gy);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = (dl < 0.3) ? '#e8e6df' : '#f3d37a';
    ctx.fillText((dl < 0.3) ? 'the birds sleep' : '[E] BIRD-CALL', Math.round(pt.x), Math.round(pt.y) - 58);
    ctx.restore();
  }

  for (let fi = 0; fi < flocks.length; fi++) {
    const f = flocks[fi];
    const age = now - f.start;
    if (age < 0 || age > 3200) continue;
    const s = state.socks[f.targetIndex];
    if (!s) continue;
    const pt = isoFn(s.gx, s.gy);
    const tx = Math.round(pt.x);
    const ty = Math.round(pt.y) - 28;
    const t = age / 3200;
    const alpha = (t < 0.8) ? 1 : Math.max(0, 1 - (t - 0.8) / 0.2);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0b0b10';
    for (let b = 0; b < 4; b++) {
      let bx = tx;
      let by = ty;
      if (t < 0.4) {
        const u = t / 0.4;
        const eu = u * u * (3 - 2 * u);
        const startX = tx + 180 + b * 6;
        const startY = ty - 120 - b * 4;
        bx = startX + (tx - startX) * eu;
        by = startY + (ty - startY) * eu - Math.sin(u * Math.PI) * 40;
      } else if (t < 0.8) {
        const u = (t - 0.4) / 0.4;
        const angle = u * Math.PI * 2 + b * Math.PI * 0.5;
        const r = 26;
        bx = tx + Math.cos(angle) * r;
        by = ty - 8 + Math.sin(angle) * r * 0.55;
      } else {
        const u = (t - 0.8) / 0.2;
        const angle = Math.PI * 2 + b * Math.PI * 0.5;
        const r = 26 + u * 60;
        bx = tx + Math.cos(angle) * r;
        by = ty - 8 + Math.sin(angle) * r * 0.55 + u * 40;
      }
      ctx.fillRect(Math.round(bx), Math.round(by), 4, 3);
      ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 6, 1);
    }
    ctx.restore();
  }

  for (let ni = 0; ni < notes.length; ni++) {
    const n = notes[ni];
    const age = now - n.start;
    if (age < 0 || age > 2000) continue;
    const s = state.socks[n.targetIndex];
    if (!s) continue;
    const pt = isoFn(s.gx, s.gy);
    const alpha = (age < 1500) ? 1 : Math.max(0, 1 - (age - 1500) / 500);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u266A', Math.round(pt.x), Math.round(pt.y) - 34 - Math.round(age * 0.035));
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildWindsocks) window.GuildWindsocks = createState();
  window.GuildWindsocks.update = update;
  window.GuildWindsocks.draw = draw;
  window.GuildWindsocks.__probe = function () {
    const st = window.GuildWindsocks;
    return { socks: (st && Array.isArray(st.socks)) ? st.socks.length : 0, called: (st ? st.called : 0) };
  };
  if (!window.__gwListeners) {
    window.__gwListeners = true;
    window.addEventListener('keydown', onKeydown);
  }
}

export {};
