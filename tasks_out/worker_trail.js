const BUILDINGS = [{gx:-2,gy:0},{gx:0,gy:-2},{gx:1,gy:0},{gx:0,gy:1}];

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
function getState() { const w = root(); return w && w.GuildVisitor; }

function createState() {
  return { steps: [], lastDrop: 0, side: 0 };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  if (!w) return;
  const Vv = w.V;
  if (!Vv || Vv.gameState !== 'play') return;
  const vis = w.GuildVisitor;
  if (!vis) return;
  if (!vis.moving) return;
  const trail = w.GuildTrail;
  if (!trail) return;
  if (now - trail.lastDrop <= 180) return;
  trail.lastDrop = now;
  const weather = (typeof Vv.weather === 'string') ? Vv.weather : '';
  const kind = (weather === 'RAIN') ? 'splash' : 'print';
  trail.side = (trail.side + 1) % 2;
  trail.steps.push({ x: vis.gx, y: vis.gy, side: trail.side, t: now, kind: kind });
  if (trail.steps.length > 40) trail.steps.shift();
  const cutoff = now - 1200;
  const kept = [];
  for (let i = 0; i < trail.steps.length; i++) {
    if (trail.steps[i].t >= cutoff) kept.push(trail.steps[i]);
  }
  trail.steps = kept;
}

function draw(ctx) {
  const w = root();
  if (!w) return;
  const Vv = w.V;
  if (!Vv || Vv.gameState !== 'play') return;
  const vis = w.GuildVisitor;
  if (!vis) return;
  const trail = w.GuildTrail;
  if (!trail) return;
  if (!ctx) return;
  const now = nowFn();
  const steps = trail.steps;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const age = now - step.t;
    if (age < 0 || age > 1200) continue;
    const alpha = 0.6 * (1 - age / 1200);
    const p = isoFn(step.x, step.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (step.kind === 'print') {
      const off = (step.side === 0) ? -2.5 : 2.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(20,24,32,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + off, y + 18, 2.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (step.kind === 'splash') {
      const radius = 3 + (age / 1200) * 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y + 18, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

function probe() {
  const w = root();
  if (!w || !w.GuildTrail) return { steps: 0 };
  return { steps: w.GuildTrail.steps.length };
}

if (typeof window !== 'undefined') {
  if (!window.GuildTrail) window.GuildTrail = createState();
  window.GuildTrail.update = update;
  window.GuildTrail.draw = draw;
  window.GuildTrail.__probe = probe;
}

export {};
