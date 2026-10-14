const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];
const PALETTE = ['#facc15','#34d399','#60a5fa','#f472b6'];
const STRING_COLOR = '#334155';
const DUSK_EDGE = '#fbbf24';
const SPARKLE_COLOR = '#ffffff';
const STRING_SPACING = 14;
const SWAY_AMPLITUDE = 3;
const SWAY_PERIOD = 2.4;
const SPARKLE_INTERVAL = 400;

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
function getState() { const w = root(); return w && w.GuildBanners; }

function buildingAnchors() {
  const out = [];
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i];
    const pt = isoFn(b.gx, b.gy);
    out.push({ x: Math.round(pt.x), y: Math.round(pt.y), gx: b.gx, gy: b.gy });
  }
  return out;
}

function buildLines() {
  const anchors = buildingAnchors();
  const lines = [];
  if (anchors.length < 2) return lines;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    lines.push({ a: a, b: b });
  }
  return lines;
}

function buildPennants(lines) {
  const pennants = [];
  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    const dx = ln.b.x - ln.a.x;
    const dy = ln.b.y - ln.a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    let dist = 0;
    let idx = 0;
    while (dist < len - STRING_SPACING) {
      const t = dist / len;
      const cx = ln.a.x + ux * dist;
      const cy = ln.a.y + uy * dist;
      pennants.push({
        lineIndex: li,
        t: t,
        cx: cx,
        cy: cy,
        nx: nx,
        ny: ny,
        colorIndex: (li + idx) % PALETTE.length,
        phase: idx * 0.9,
        sparkle: false
      });
      dist += STRING_SPACING;
      idx++;
    }
  }
  return pennants;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const state = getState();
  if (!state) return;
  const lines = buildLines();
  state.lines = lines;
  state.pennants = buildPennants(lines);
  state.lastUpdate = now;
}

function isCeremonyActive() {
  const w = root();
  if (!w) return false;
  const lu = w.GuildLevelUp;
  const lu2 = w.GuildLevelup;
  const obj = lu || lu2;
  if (!obj) return false;
  if (typeof obj.__probe === 'function') {
    try {
      const p = obj.__probe();
      if (p && p.active) return true;
      if (p && p.phase != null && p.phase !== 'idle' && p.phase !== null && p.phase !== 'idle') return true;
    } catch (e) {}
  }
  if (obj.active === true) return true;
  if (obj.phase != null && obj.phase !== 'idle' && obj.phase !== null) return true;
  return false;
}

function draw(ctx) {
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const state = getState();
  if (!state || !ctx) return;
  const now = nowFn();
  const cam = Vv.camera || { x: 0, y: 0, zoom: 1 };
  const c = Vv.canvas;
  if (!c) return;
  const lines = state.lines || [];
  const pennants = state.pennants || [];
  const daylight = (typeof Vv.daylight === 'number') ? Vv.daylight : 1;
  const weather = (typeof Vv.weather === 'string') ? Vv.weather : 'CLEAR';
  const ceremony = isCeremonyActive();
  const dusk = daylight >= 0.2 && daylight <= 0.5;
  const duskDepth = dusk ? ((daylight - 0.2) / 0.3) : 0;
  const rain = weather === 'RAIN';
  const swayPeriod = rain ? SWAY_PERIOD * 0.6 : SWAY_PERIOD;
  const swayAmp = rain ? SWAY_AMPLITUDE * 0.5 : SWAY_AMPLITUDE;

  ctx.save();
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(cam.zoom || 1, cam.zoom || 1);
  ctx.translate(-c.width / 2 + (cam.x || 0), -c.height / 2 + (cam.y || 0));

  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li];
    ctx.beginPath();
    ctx.moveTo(ln.a.x, ln.a.y);
    ctx.quadraticCurveTo(
      (ln.a.x + ln.b.x) * 0.5,
      (ln.a.y + ln.b.y) * 0.5 + 10,
      ln.b.x, ln.b.y
    );
    ctx.strokeStyle = STRING_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = STRING_COLOR;
    ctx.beginPath();
    ctx.arc(ln.a.x, ln.a.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ln.b.x, ln.b.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let pi = 0; pi < pennants.length; pi++) {
    const pn = pennants[pi];
    const ln = lines[pn.lineIndex];
    if (!ln) continue;
    const sway = Math.sin(now * 0.001 * (2 * Math.PI / swayPeriod) + pn.phase) * swayAmp;
    const tipX = pn.cx + pn.nx * (6 + sway);
    const tipY = pn.cy + pn.ny * (6 + sway);
    const baseX = pn.cx - pn.nx * 3;
    const baseY = pn.cy - pn.ny * 3;
    const color = PALETTE[pn.colorIndex];

    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseX + pn.nx * 6, baseY + pn.ny * 6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    if (dusk) {
      ctx.strokeStyle = DUSK_EDGE;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35 + 0.65 * duskDepth;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseX + pn.nx * 6, baseY + pn.ny * 6);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (ceremony) {
      const sparklePhase = (now + pn.phase * 100) % SPARKLE_INTERVAL;
      if (sparklePhase < 16) {
        ctx.fillStyle = SPARKLE_COLOR;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(Math.round(tipX) - 1, Math.round(tipY) - 1, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  ctx.restore();
}

function probe() {
  const state = getState();
  if (!state) return { lines: 0, pennants: 0 };
  return {
    lines: Array.isArray(state.lines) ? state.lines.length : 0,
    pennants: Array.isArray(state.pennants) ? state.pennants.length : 0
  };
}

if (typeof window !== 'undefined') {
  if (!window.GuildBanners) window.GuildBanners = { lines: [], pennants: [] };
  window.GuildBanners.update = update;
  window.GuildBanners.draw = draw;
  window.GuildBanners.__probe = probe;
}

export {};
