let pressed = new Set();
let prevPressed = new Set();
let lastTime = null;

function createState() {
  return { casting: null, catches: [], best: null };
}

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
function getState() { const w = root(); return w && w.GuildFishing; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function getPond() {
  const w = root();
  const Vv = getV();
  let s = 0;
  if (Vv && typeof Vv.growthStep === 'number' && isFinite(Vv.growthStep)) {
    s = Math.floor(Vv.growthStep);
    if (s < 0) s = 0;
    if (s > 8) s = 8;
  }
  const ff = w && w.GuildFireflies;
  if (ff) {
    const candidates = [ff.grove, ff.pond, ff.groveTile, ff.grovePos, ff.fireflyGrove, ff.grovePosition];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c && typeof c === 'object' && isFinite(c.gx) && isFinite(c.gy)) {
        return { gx: c.gx, gy: c.gy };
      }
    }
    if (ff.state && ff.state.grove && isFinite(ff.state.grove.gx) && isFinite(ff.state.grove.gy)) {
      return { gx: ff.state.grove.gx, gy: ff.state.grove.gy };
    }
  }
  const maxC = 1 + s;
  const minC = -2 - s;
  return { gx: maxC - 1, gy: minC + 1 };
}

function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const state = getState();
  const Vv = getV();
  const w = root();
  if (!state || !Vv || Vv.gameState !== 'play') {
    lastTime = now;
    return;
  }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (!Array.isArray(state.floats)) state.floats = [];
  if (state.splash === undefined) state.splash = null;

  const pond = getPond();
  const vis = getVisitor();
  let dist = Infinity;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    dist = Math.hypot(vis.gx - pond.gx, vis.gy - pond.gy);
  }

  const fPressed = pressed.has('f');
  const fWas = prevPressed.has('f');

  if (!state.casting && vis && dist <= 1.6) {
    if (!fWas && fPressed) {
      state.casting = { phase: 'wait', t0: now, dur: 3000 + Math.random() * 5000 };
    }
  }

  const casting = state.casting;
  if (casting) {
    if (casting.phase === 'wait' && now - casting.t0 >= casting.dur) {
      casting.phase = 'bite';
      casting.biteStart = now;
    }
    if (casting.phase === 'bite') {
      if (!fWas && fPressed) {
        const size = 0.5 + Math.random() * 0.5;
        state.catches.push({ t: now, size: size });
        const sizes = state.catches.map(function (c) { return c.size; });
        const largest = sizes.length ? Math.max.apply(null, sizes) : 0;
        state.best = sizes.length ? Math.round(largest * 40) : state.best;
        state.floats.push({ t: now });
        try { if (typeof w.cue === 'function') w.cue('done'); } catch (e) {}
        if (w && w.GuildTips && typeof w.GuildTips.coins === 'number') {
          try { w.GuildTips.coins += 1; } catch (e) {}
        }
        state.casting = null;
      } else if (now - casting.biteStart >= 1200) {
        state.splash = { t: now, gx: pond.gx, gy: pond.gy };
        state.casting = null;
      }
    }
  }

  const nextFloats = [];
  for (let i = 0; i < state.floats.length; i++) {
    if (now - state.floats[i].t < 1200) nextFloats.push(state.floats[i]);
  }
  state.floats = nextFloats;
  if (state.splash && now - state.splash.t > 600) state.splash = null;

  prevPressed = new Set(pressed);
}

function onKeydown(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.add(k);
}

function onKeyup(e) {
  const k = normKey(e);
  if (!k) return;
  pressed.delete(k);
  prevPressed.delete(k);
}

function draw(ctx) {
  const state = getState();
  const Vv = getV();
  const w = root();
  if (!state || !ctx || !Vv || Vv.gameState !== 'play') return;
  if (!Array.isArray(state.floats)) state.floats = [];
  if (state.splash === undefined) state.splash = null;

  const pond = getPond();
  const p = isoFn(pond.gx, pond.gy);

  // Dock plank and gold trim.
  const dx = Math.round(p.x - 14);
  const dy = Math.round(p.y - 6);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(dx, dy, 28, 9);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(dx, dy, 28, 1);
  ctx.fillRect(dx, dy + 8, 28, 1);
  ctx.fillRect(dx, dy, 1, 9);
  ctx.fillRect(dx + 27, dy, 1, 9);

  const casting = state.casting;
  if (casting) {
    let bob = Math.sin(nowFn() * 0.004) * 1.5;
    let by = Math.round(p.y - 2 + bob);
    const bx = Math.round(p.x);
    if (casting.phase === 'bite') {
      by = Math.round(p.y + 4 + Math.sin(nowFn() * 0.012) * 1.2);
      const biteStart = casting.biteStart != null ? casting.biteStart : casting.t0 + casting.dur;
      const age = nowFn() - biteStart;
      for (let k = 0; k < 3; k++) {
        const ringAge = age - k * 170;
        if (ringAge < 0) continue;
        const progress = Math.min(1, ringAge / 1200);
        const radius = 4 + progress * 20 + k * 3;
        const alpha = Math.max(0, (1 - progress) * 0.62);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(147, 197, 253, 1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const vis = getVisitor();
    if (vis) {
      const vp = isoFn(vis.gx, vis.gy);
      ctx.strokeStyle = 'rgba(230, 230, 230, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(Math.round(vp.x), Math.round(vp.y));
      ctx.stroke();
    }

    // Red-white bobber.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, 1.5, -Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Miss splash.
  if (state.splash) {
    const age = nowFn() - state.splash.t;
    if (age >= 0 && age < 600) {
      const sp = isoFn(state.splash.gx, state.splash.gy);
      const progress = age / 600;
      for (let k = 0; k < 2; k++) {
        const radius = 5 + progress * (18 + k * 4);
        const alpha = Math.max(0, (1 - progress) * (0.7 - k * 0.15));
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(147, 197, 253, 1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(Math.round(sp.x), Math.round(sp.y), radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Catch floats.
  const visForFloat = getVisitor();
  if (visForFloat) {
    for (let i = 0; i < state.floats.length; i++) {
      const fl = state.floats[i];
      const age = nowFn() - fl.t;
      if (age < 0 || age >= 1200) continue;
      const alpha = Math.max(0, 1 - age / 1200);
      const vp = isoFn(visForFloat.gx, visForFloat.gy);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('+1 FISH', Math.round(vp.x - 22), Math.round(vp.y - 16 - (age / 1000) * 18));
    }
    ctx.globalAlpha = 1;
  }

  // HUD conditions.
  const vis = getVisitor();
  let hudDist = Infinity;
  if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
    hudDist = Math.hypot(vis.gx - pond.gx, vis.gy - pond.gy);
  }
  if (casting || hudDist <= 2) {
    const catches = Array.isArray(state.catches) ? state.catches : [];
    const sizes = catches.map(function (c) { return c.size; });
    const largest = sizes.length ? Math.max.apply(null, sizes) : 0;
    const bestCm = catches.length ? Math.round(largest * 40) : 0;
    const text = 'FISH: ' + catches.length + '  BEST: ' + bestCm + ' cm';
    const maxW = 160;
    const shown = fitFn(text, maxW);
    const textW = ctx.measureText(shown).width;
    const plateW = Math.min(maxW, Math.round(textW + 12));
    const plateH = 14;
    const px = Math.round(p.x - plateW * 0.5);
    const py = Math.round(p.y - 34);
    ctx.fillStyle = 'rgba(10, 10, 12, 0.90)';
    ctx.fillRect(px, py, plateW, plateH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, plateW, plateH);
    ctx.clip();
    ctx.fillStyle = '#d4af37';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(shown, px + 6, py + plateH * 0.5);
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildFishing) window.GuildFishing = createState();
  window.GuildFishing.update = update;
  window.GuildFishing.draw = draw;
  window.GuildFishing.__probe = function () {
    const st = getState();
    const c = st && st.casting;
    return { phase: c ? c.phase : 'idle', catches: (st && Array.isArray(st.catches)) ? st.catches.length : 0 };
  };
  window.GuildFishing.__rawUpdate = update;
  window.GuildFishing.__keys = pressed;
  if (!window.__gfListeners) {
    window.__gfListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
