const POSITIONS = [
  { gx: -4, gy: -6 },
  { gx: -2, gy: -6 },
  { gx: 0, gy: -6 },
  { gx: 2, gy: -6 },
  { gx: 4, gy: -6 }
];

let lastTime = null;

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
  const Vv = getV();
  const ctx = Vv && Vv.ctx;
  if (!ctx || !isFinite(maxW) || maxW <= 0) return String(text == null ? '' : text);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}
function ready() {
  const w = root();
  const Vv = getV();
  if (!w || !Vv) return false;
  if (typeof w.iso !== 'function') return false;
  if (typeof w.fitText !== 'function') return false;
  if (!w.GuildVisitor) return false;
  if (!Array.isArray(w.allTasks)) return false;
  return true;
}
function countDone() {
  const w = root();
  const tasks = Array.isArray(w && w.allTasks) ? w.allTasks : [];
  let n = 0;
  for (let i = 0; i < tasks.length; i++) if (tasks[i] && tasks[i].status === 'done') n++;
  return n;
}
function countTotal() {
  const w = root();
  return Array.isArray(w && w.allTasks) ? w.allTasks.length : 0;
}
function countFailed() {
  const w = root();
  const tasks = Array.isArray(w && w.allTasks) ? w.allTasks : [];
  let n = 0;
  for (let i = 0; i < tasks.length; i++) if (tasks[i] && tasks[i].status === 'failed') n++;
  return n;
}
function countWorkersOnShift() {
  const Vv = getV();
  if (!Vv) return 0;
  if (Array.isArray(Vv.workerStates)) return Vv.workerStates.length;
  if (Array.isArray(Vv.workers)) return Vv.workers.length;
  return 0;
}
function mapLevel() {
  const Vv = getV();
  return Vv && typeof Vv.mapLevel === 'number' ? Vv.mapLevel : 1;
}
function plaqueText(index) {
  if (index === 0) return 'QUESTS DONE ' + countDone();
  if (index === 1) return 'ON SHIFT ' + countWorkersOnShift();
  if (index === 2) return 'TOTAL ' + countTotal();
  if (index === 3) return 'FAILED ' + countFailed();
  return 'MAP LVL ' + mapLevel();
}
function stoneCountFor(index) { return 3 + (index % 3); }

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  if (!ready()) {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;
}

function draw(ctx) {
  if (!ctx) return;
  if (!ready()) return;
  const Vv = getV();
  if (Vv && Vv.gameState !== 'play') return;
  const now = nowFn();

  for (let i = 0; i < POSITIONS.length; i++) {
    const pos = POSITIONS[i];
    const pt = isoFn(pos.gx, pos.gy);
    const cx = Math.round(pt.x);
    const cy = Math.round(pt.y);
    const sc = stoneCountFor(i);

    for (let s = 0; s < sc; s++) {
      const jx = Math.round((seeded(i * 37 + s * 19 + 7) - 0.5) * 4);
      const jy = Math.round((seeded(i * 37 + s * 23 + 11) - 0.5) * 2);
      const w = 10 + ((s + i) % 2) * 2;
      const h = 6;
      const y = cy - s * 6 + jy;
      ctx.fillStyle = (s % 2 === 0) ? '#9ca3af' : '#6b7280';
      ctx.fillRect(cx + jx - Math.round(w * 0.5), y, w, h);
    }

    const pW = 44;
    const pH = 15;
    const px = cx - Math.round(pW * 0.5);
    const py = cy + 10;
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(px, py, pW, pH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pW, pH);
    ctx.fillStyle = '#e8e6df';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(plaqueText(i), pW - 6), px + pW * 0.5, py + pH * 0.5 + 1);
  }
  ctx.textAlign = 'left';
}

if (typeof window !== 'undefined') {
  if (!window.GuildCairns) window.GuildCairns = {};
  window.GuildCairns.update = update;
  window.GuildCairns.draw = draw;
  window.GuildCairns.__rawUpdate = update;
}

export {};
