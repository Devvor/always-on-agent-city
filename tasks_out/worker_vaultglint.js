const COIN_GX = 1;
const COIN_GY = 0;

let sparks = [];
let glints = [];
let lastNow = null;
let prevValue = null;
let initialized = false;
let currentValue = null;
let cueCount = 0;

function root() { return (typeof window !== 'undefined') ? window : null; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
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

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function readTreasuryValue() {
  const Vv = getV();
  if (Vv && typeof Vv.treasury === 'number') return Vv.treasury;
  if (Vv && typeof Vv.treasuryValue === 'number') return Vv.treasuryValue;
  if (Vv && typeof Vv.totalDone === 'number') return Vv.totalDone;
  const ledger = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : (Array.isArray(root() && root().allTasks) ? root().allTasks : null);
  if (Array.isArray(ledger)) {
    let done = 0;
    for (let i = 0; i < ledger.length; i++) if (ledger[i] && ledger[i].status === 'done') done++;
    return done;
  }
  const gl = root() && root().GuildLedger;
  if (gl && typeof gl.value === 'number') return gl.value;
  return null;
}

function spawnBurst(now) {
  const pt = isoFn(COIN_GX, COIN_GY);
  const cx = Math.round(pt.x + 2);
  const cy = Math.round(pt.y - 6);
  glints.push({ x: cx, y: cy, age: 0, life: 0.42 });
  const count = 12;
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.15;
    const speed = 24 + Math.random() * 30;
    sparks.push({
      x: cx + (Math.random() - 0.5) * 10,
      y: cy + (Math.random() - 0.5) * 6,
      vx: Math.cos(ang) * speed * 0.4,
      vy: Math.sin(ang) * speed,
      age: 0,
      life: 0.42 + Math.random() * 0.22,
      size: Math.random() < 0.35 ? 2 : 1,
      shade: Math.random()
    });
  }
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue('glint'); } catch (e) {}
  }
  cueCount++;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const dtRaw = lastNow === null ? 0 : (now - lastNow) / 1000;
  const dt = clamp(isFinite(dtRaw) ? dtRaw : 0, 0, 0.12);
  lastNow = now;

  const nextSparks = [];
  for (let i = 0; i < sparks.length; i++) {
    const p = sparks[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.95;
    p.vy += 10 * dt;
    nextSparks.push(p);
  }
  sparks = nextSparks;

  const nextGlints = [];
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i];
    g.age += dt;
    if (g.age < g.life) nextGlints.push(g);
  }
  glints = nextGlints;

  const value = readTreasuryValue();
  currentValue = value;
  if (!initialized) {
    prevValue = value;
    initialized = true;
    return;
  }
  if (value != null && prevValue != null && value > prevValue) {
    spawnBurst(now);
  }
  prevValue = value;
}

function draw(ctx) {
  if (!ctx) return;
  const w = root();
  const Vv = getV();
  if (Vv && Vv.gameState && Vv.gameState !== 'play') return;

  ctx.save();
  for (let i = 0; i < glints.length; i++) {
    const g = glints[i];
    const t = clamp(g.age / g.life, 0, 1);
    const alpha = Math.max(0, 1 - t);
    const radius = 6 + t * 12;
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(Math.round(g.x - radius * 0.5), Math.round(g.y - radius * 0.5), Math.round(radius), Math.round(radius));
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < sparks.length; i++) {
    const p = sparks[i];
    const t = clamp(p.age / p.life, 0, 1);
    const alpha = Math.max(0, 1 - t);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.shade < 0.5 ? '#facc15' : '#d4af37';
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 2), p.size + 2, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Keeps the configured fitText path exercised without adding arbitrary text.
  fitFn('', 1);
  void w;
}

if (typeof window !== 'undefined') {
  if (!window.GuildVaultGlint) window.GuildVaultGlint = {};
  const G = window.GuildVaultGlint;
  G.update = update;
  G.draw = draw;
  G.__probe = function () {
    return {
      value: currentValue,
      previous: prevValue,
      previousValue: prevValue,
      sparks: sparks.slice(),
      particles: sparks.slice(),
      glints: glints.slice(),
      bursts: glints.length,
      cueCount: cueCount,
      lastNow: lastNow,
      now: lastNow
    };
  };
}

export {};
