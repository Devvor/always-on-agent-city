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
function getState() { const w = root(); return w && w.GuildRainbows; }

function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

function createState() {
  const segments = 32;
  const unitsX = new Array(segments + 1);
  const unitsY = new Array(segments + 1);
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI + (i / segments) * Math.PI;
    unitsX[i] = Math.cos(a);
    unitsY[i] = Math.sin(a);
  }
  return {
    gx: 3.0,
    gy: 9.0,
    active: false,
    _arc: {
      cx: 0,
      cy: 0,
      sway: 0,
      radius: 56,
      radii: [66, 56, 46],
      widths: [4, 5, 4],
      colors: [
        'rgba(255,255,255,0.14)',
        'rgba(212,175,55,0.15)',
        'rgba(59,130,246,0.13)'
      ],
      unitsX: unitsX,
      unitsY: unitsY,
      segments: segments,
      sparkleColor: 'rgba(232,230,223,0.35)'
    }
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;

  const Vv = getV();
  let daylight = NaN;
  let weather = '';
  let wind = 0;
  if (Vv) {
    daylight = Vv.daylight;
    weather = Vv.weather == null ? '' : String(Vv.weather);
    if (isFiniteNumber(Vv.wind)) wind = Vv.wind;
  }

  const daylightNum = (typeof daylight === 'number') ? daylight : Number(daylight);
  const active = isFiniteNumber(daylightNum) && daylightNum > 0.65 && weather.toLowerCase() !== 'storm';
  st.active = active;

  const arc = st._arc;
  const pt = isoFn(st.gx, st.gy);
  const grid = Vv && Vv.grid;
  const tileW = (grid && isFiniteNumber(grid.tileW)) ? grid.tileW : 70;
  const baseRadius = Math.max(40, tileW * 0.85);

  const breathe = 0.5 + 0.5 * Math.sin(now * 0.0009);
  const aW = 0.12 + 0.04 * breathe;
  const aG = 0.14 + 0.04 * (1 - breathe);
  const aB = 0.11 + 0.03 * breathe;

  const windAmp = 6 + Math.abs(wind) * 10;
  const sway = Math.sin(now * 0.0008 + wind * 1.5) * windAmp;

  arc.cx = pt.x;
  arc.cy = pt.y;
  arc.sway = sway;
  arc.radius = baseRadius;
  arc.radii[0] = baseRadius + 10;
  arc.radii[1] = baseRadius;
  arc.radii[2] = Math.max(18, baseRadius - 10);

  arc.colors[0] = 'rgba(255,255,255,' + aW.toFixed(3) + ')';
  arc.colors[1] = 'rgba(212,175,55,' + aG.toFixed(3) + ')';
  arc.colors[2] = 'rgba(59,130,246,' + aB.toFixed(3) + ')';

  arc.sparkleColor = 'rgba(232,230,223,' + (0.18 + 0.08 * breathe).toFixed(3) + ')';
}

function draw(ctx) {
  if (!ctx || typeof ctx.beginPath !== 'function') return;
  const st = getState();
  if (!st) return;
  const arc = st._arc;
  if (!arc || !arc.unitsX) return;
  const now = nowFn();

  if (st.active) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let b = 0; b < 3; b++) {
      const r = arc.radii[b];
      const xs = arc.unitsX;
      const ys = arc.unitsY;
      const n = arc.segments;
      ctx.beginPath();
      ctx.moveTo(arc.cx + arc.sway + xs[0] * r, arc.cy + ys[0] * r);
      for (let i = 1; i <= n; i++) {
        ctx.lineTo(arc.cx + arc.sway + xs[i] * r, arc.cy + ys[i] * r);
      }
      ctx.strokeStyle = arc.colors[b];
      ctx.lineWidth = arc.widths[b];
      ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.save();
    const count = 18;
    const radiusX = arc.radius * 0.82;
    const radiusY = arc.radius * 0.34;
    for (let i = 0; i < count; i++) {
      const phase = i * 1.9 + now * 0.0013;
      const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(phase));
      ctx.globalAlpha = twinkle * 0.42;
      const px = arc.cx + arc.sway * 0.2 + Math.sin(i * 2.1 + now * 0.0007) * radiusX;
      const py = arc.cy + Math.cos(i * 1.7 + now * 0.0005) * radiusY;
      const size = (i % 3 === 0) ? 2 : 1;
      ctx.fillStyle = arc.sparkleColor;
      ctx.fillRect(Math.round(px), Math.round(py), size, size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildRainbows) window.GuildRainbows = createState();
  window.GuildRainbows.update = update;
  window.GuildRainbows.draw = draw;
  window.GuildRainbows.__probe = function () {
    const st = getState();
    return { active: !!(st && st.active) };
  };
  window.GuildRainbows.__rawUpdate = update;
}

export {};
