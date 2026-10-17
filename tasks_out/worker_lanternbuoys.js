const S = {
  lastTime: null,
  buoys: [],
  derbyActive: false,
  derbyFlash: 0
};

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
function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

const BUOY_COUNT = 5;

function derbyGlobal() {
  const w = root();
  if (!w) return null;
  const preferred = ['GuildFishingDerby', 'GuildDerby', 'GuildFishDerby', 'GuildFishing'];
  for (let i = 0; i < preferred.length; i++) {
    if (w[preferred[i]] && typeof w[preferred[i]] === 'object') return w[preferred[i]];
  }
  for (const key in w) {
    if (!Object.prototype.hasOwnProperty.call(w, key)) continue;
    if (!/^Guild/i.test(key)) continue;
    if (!/derby|fish/i.test(key)) continue;
    if (w[key] && typeof w[key] === 'object') return w[key];
  }
  return null;
}

function isDerbyActive() {
  const g = derbyGlobal();
  if (!g) return false;
  try {
    if (typeof g.isActive === 'function') return !!g.isActive();
    if (typeof g.isDerbyActive === 'function') return !!g.isDerbyActive();
    if (g.active === true || g.running === true || g.started === true) return true;
    if (g.ended === true || g.complete === true || g.finished === true) return false;
    if (typeof g.state === 'string' && /derby|fish|active/i.test(g.state)) return true;
    const w = root();
    const allTasks = w && Array.isArray(w.allTasks) ? w.allTasks : [];
    const taskDerby = allTasks.some(function (t) {
      const s = String((t && (t.title || t.id)) || '').toLowerCase();
      return s.indexOf('derby') !== -1 || s.indexOf('fish') !== -1;
    });
    if (taskDerby && g.active !== false) return true;
    return false;
  } catch (e) { return false; }
}

function ensureBuoys() {
  if (S.buoys.length === BUOY_COUNT) return;
  S.buoys = [];
  for (let i = 0; i < BUOY_COUNT; i++) {
    const phase = Math.abs(Math.sin((i + 1) * 19.73)) * Math.PI * 2;
    S.buoys.push({ id: i, phase: phase, gx: 0, gy: 0 });
  }
}

function updateBuoys(Vv, now) {
  const s = (typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  const maxC = 1 + s;
  const waterGy = maxC + 1.5;
  const minC = -2 - s;
  for (let i = 0; i < S.buoys.length; i++) {
    const b = S.buoys[i];
    const baseGx = minC + 1 + i * 2;
    const bob = Math.sin(now * 0.0019 + b.phase);
    const drift = Math.sin(now * 0.0011 + b.phase * 1.7 + i * 0.7);
    b.gx = baseGx + drift * 0.55;
    b.gy = waterGy + bob * 0.42 + Math.cos(now * 0.0007 + i) * 0.12;
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const Vv = getV();
  if (!S || !Vv || Vv.gameState !== 'play') {
    S.lastTime = now;
    return;
  }
  if (S.lastTime === null) S.lastTime = now;
  let dt = (now - S.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  S.lastTime = now;

  ensureBuoys();
  updateBuoys(Vv, now);

  const active = isDerbyActive();
  if (active && !S.derbyActive) {
    S.derbyFlash = 1;
    cueFn('lantern');
  }
  S.derbyActive = active;
  if (S.derbyFlash > 0) S.derbyFlash = Math.max(0, S.derbyFlash - dt * 1.3);

  const visitor = root() && root().GuildVisitor;
  if (visitor && typeof visitor.gx === 'number') {
    // Keep a soft awareness of the visitor without changing buoy placement rules.
    void visitor.gx;
  }
}

function draw(ctx) {
  const Vv = getV();
  if (!ctx || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const label = fitFn('LANTERN', 48);
  void label;

  const night = (typeof Vv.nightFactor === 'number') ? clamp(Vv.nightFactor, 0, 1) : 0;
  const derbyBoost = S.derbyActive ? 0.35 : 0;
  const flashBoost = S.derbyFlash * 0.55;

  for (let i = 0; i < S.buoys.length; i++) {
    const b = S.buoys[i];
    const pt = isoFn(b.gx, b.gy);
    const ix = Math.round(pt.x);
    const iy = Math.round(pt.y);

    const intensity = (0.25 + 0.75 * night) * (1 + derbyBoost + flashBoost);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(ix - 5, iy + 3, 10, 3);

    ctx.globalAlpha = clamp(intensity * 0.42, 0, 0.82);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(ix - 6, iy - 6, 12, 12);

    ctx.globalAlpha = clamp(intensity * 0.78, 0, 1);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(ix - 3, iy - 3, 6, 6);

    ctx.globalAlpha = 1;
    ctx.fillStyle = S.derbyFlash > 0.1 ? '#ffe08a' : '#d4af37';
    ctx.fillRect(ix - 2, iy - 2, 4, 4);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(ix - 1, iy + 2, 2, 3);
  }

  ctx.globalAlpha = 1;
}

if (typeof window !== 'undefined') {
  if (!window.GuildLanternBuoys) window.GuildLanternBuoys = S;
  window.GuildLanternBuoys.update = update;
  window.GuildLanternBuoys.draw = draw;
}

export {};
