const lastTimeRef = { value: null };
let sparkleFx = [];
let cDown = false;
let cEdge = false;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getJar() { const w = root(); return w && w.GuildFirejar; }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return null;
}
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function normKey(e) {
  if (!e) return '';
  if (e.key === ' ') return ' ';
  return String(e.key || '').toLowerCase();
}
function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

function groveTile() {
  const w = root();
  if (w && w.GuildFireflies && w.GuildFireflies.grove &&
      isFiniteNumber(w.GuildFireflies.grove.gx) && isFiniteNumber(w.GuildFireflies.grove.gy)) {
    return { gx: w.GuildFireflies.grove.gx, gy: w.GuildFireflies.grove.gy };
  }
  const Vv = getV();
  const s = Vv && isFiniteNumber(Vv.growthStep) ? Vv.growthStep : 0;
  const minC = -2 - s;
  const maxC = 1 + s;
  return { gx: maxC - 1, gy: minC + 1 };
}

function crystalTiles() {
  const w = root();
  const out = [];
  function addArray(arr) {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (item && typeof item === 'object' && isFiniteNumber(item.gx) && isFiniteNumber(item.gy)) {
        out.push({ gx: item.gx, gy: item.gy });
      }
    }
  }
  if (w) {
    if (w.GuildCrystal) {
      addArray(w.GuildCrystal.crystals);
      addArray(w.GuildCrystal.crystalPositions);
      addArray(w.GuildCrystal.items);
    }
    if (w.V) addArray(w.V.crystals);
  }
  return out;
}

function jarTile() {
  const grove = groveTile();
  const crystals = crystalTiles();
  const candidates = [
    grove,
    { gx: grove.gx + 1, gy: grove.gy },
    { gx: grove.gx - 1, gy: grove.gy },
    { gx: grove.gx, gy: grove.gy + 1 },
    { gx: grove.gx, gy: grove.gy - 1 },
    { gx: grove.gx + 1, gy: grove.gy - 1 },
    { gx: grove.gx - 1, gy: grove.gy + 1 }
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let conflict = false;
    for (let j = 0; j < crystals.length; j++) {
      if (Math.hypot(crystals[j].gx - c.gx, crystals[j].gy - c.gy) < 1.5) {
        conflict = true;
        break;
      }
    }
    if (!conflict) return c;
  }
  return grove;
}

function collectFireflies() {
  const w = root();
  const out = [];
  const seen = new Set();
  function addArray(arr, fireflyOnly) {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item || typeof item !== 'object' || seen.has(item)) continue;
      if (fireflyOnly && item.kind !== 'firefly') continue;
      if (!isFiniteNumber(item.x) || !isFiniteNumber(item.y)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  if (w && w.GuildFireflies) {
    const gf = w.GuildFireflies;
    addArray(gf.fireflies, false);
    addArray(gf.particles, false);
    addArray(gf.items, false);
    addArray(gf.flies, false);
    addArray(gf.dots, false);
  }
  const Vv = getV();
  if (Vv) {
    addArray(Vv.particles, true);
    addArray(Vv.fireflies, false);
  }
  return out;
}

function removeCaughtFireflies(caughtSet) {
  const Vv = getV();
  if (Vv && Array.isArray(Vv.particles)) {
    Vv.particles = Vv.particles.filter(function (p) { return !caughtSet.has(p); });
  }
  if (Vv && Array.isArray(Vv.fireflies)) {
    Vv.fireflies = Vv.fireflies.filter(function (p) { return !caughtSet.has(p); });
  }
  const w = root();
  if (w && w.GuildFireflies) {
    const gf = w.GuildFireflies;
    const keys = ['fireflies', 'particles', 'items', 'flies', 'dots'];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (Array.isArray(gf[key])) {
        gf[key] = gf[key].filter(function (item) { return !caughtSet.has(item); });
      }
    }
  }
}

function onKeydown(e) {
  const k = normKey(e);
  if (k === 'c' && !cDown) {
    cDown = true;
    cEdge = true;
  }
}
function onKeyup(e) {
  const k = normKey(e);
  if (k === 'c') cDown = false;
}

function update(now) {
  const jar = getJar();
  if (typeof now !== 'number') now = nowFn();

  let dt = 0;
  if (lastTimeRef.value !== null) {
    dt = (now - lastTimeRef.value) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.12) dt = 0.12;
  }
  lastTimeRef.value = now;

  for (let i = sparkleFx.length - 1; i >= 0; i--) {
    const sp = sparkleFx[i];
    sp.age += dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vx *= 0.92;
    sp.vy *= 0.92;
    if (sp.age >= sp.life) sparkleFx.splice(i, 1);
  }

  if (cEdge) {
    cEdge = false;
    const Vv = getV();
    const visitor = root() ? root().GuildVisitor : null;
    const grove = groveTile();
    let inRange = false;
    if (visitor && isFiniteNumber(visitor.gx) && isFiniteNumber(visitor.gy)) {
      inRange = Math.hypot(visitor.gx - grove.gx, visitor.gy - grove.gy) <= 1.2;
    }
    const isNight = Vv ? Vv.daylight < 0.35 : false;
    const noSwing = !jar || !jar.swing;
    if (jar && Vv && Vv.gameState === 'play' && isNight && inRange && noSwing) {
      jar.swing = { start: now, duration: 300 };
      const visitorPt = visitor ? isoFn(visitor.gx, visitor.gy) : null;
      const caught = new Set();
      if (visitorPt) {
        const flies = collectFireflies();
        for (let i = 0; i < flies.length; i++) {
          const f = flies[i];
          if (Math.hypot(f.x - visitorPt.x, f.y - visitorPt.y) <= 14) caught.add(f);
        }
      }
      caught.forEach(function (f) {
        jar.jar = (jar.jar || 0) + 1;
        jar.glow = jar.jar;
        for (let k = 0; k < 6; k++) {
          sparkleFx.push({
            x: f.x,
            y: f.y,
            vx: (Math.random() - 0.5) * 36,
            vy: -8 - Math.random() * 20,
            age: 0,
            life: 0.35 + Math.random() * 0.25,
            size: 2
          });
        }
        try { const w = root(); if (w && typeof w.cue === 'function') w.cue('pop'); } catch (e) {}
      });
      if (caught.size) removeCaughtFireflies(caught);
    }
  }

  if (jar && jar.swing) {
    if (now - jar.swing.start >= (jar.swing.duration || 300)) jar.swing = null;
  }
}

function draw(ctx) {
  const jar = getJar();
  const Vv = getV();
  if (!jar || !Vv || Vv.gameState !== 'play' || !ctx) return;

  const n = nowFn();
  const jt = jarTile();
  const pt = isoFn(jt.gx, jt.gy);
  if (!pt) return;

  for (let i = 0; i < sparkleFx.length; i++) {
    const sp = sparkleFx[i];
    const a = Math.max(0, 1 - (sp.age / sp.life));
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(sp.x), Math.round(sp.y), sp.size || 2, sp.size || 2);
  }
  ctx.globalAlpha = 1;

  if (jar.swing) {
    const visitor = root() ? root().GuildVisitor : null;
    const visPt = visitor ? isoFn(visitor.gx, visitor.gy) : null;
    if (visPt) {
      const progress = Math.min(1, (n - jar.swing.start) / (jar.swing.duration || 300));
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(visPt.x, visPt.y - 5, 20, -Math.PI / 2 + progress * Math.PI, Math.PI / 2 + progress * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  const glowStep = isFiniteNumber(jar.glow) ? jar.glow : (jar.jar || 0);
  const glowR = 9 + glowStep * 3;
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = 'rgba(255,225,130,0.95)';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y - 6, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(Math.round(pt.x) - 7, Math.round(pt.y) + 2, 14, 3);

  ctx.fillStyle = 'rgba(185,225,255,0.34)';
  ctx.fillRect(Math.round(pt.x) - 6, Math.round(pt.y) - 17, 12, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(Math.round(pt.x) - 6, Math.round(pt.y) - 17, 12, 3);
  ctx.fillStyle = '#7a5526';
  ctx.fillRect(Math.round(pt.x) - 7, Math.round(pt.y) - 19, 14, 3);

  const isNight = Vv.daylight < 0.35;
  const chipText = isNight ? ('Fireflies: ' + (jar.jar || 0)) : 'they sleep';
  const shown = fitFn(chipText, 120);
  ctx.font = 'bold 9px monospace';
  const tw = ctx.measureText(shown).width;
  const chipW = Math.max(58, Math.round(tw) + 10);
  const chipH = 13;
  const chipX = Math.round(pt.x) - Math.round(chipW / 2);
  const chipY = Math.round(pt.y) - 33;
  ctx.fillStyle = 'rgba(10,10,12,0.90)';
  ctx.fillRect(chipX, chipY, chipW, chipH);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1;
  ctx.strokeRect(chipX, chipY, chipW, chipH);
  ctx.fillStyle = '#f3d37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, chipX + chipW * 0.5, chipY + chipH * 0.5 + 1);
  ctx.textAlign = 'left';
}

if (typeof window !== 'undefined') {
  if (!window.GuildFirejar) window.GuildFirejar = { jar: 0, swing: null };
  window.GuildFirejar.update = update;
  window.GuildFirejar.draw = draw;
  window.GuildFirejar.__probe = function () {
    const j = getJar();
    return { jar: j ? (j.jar || 0) : 0 };
  };
  if (!window.__gfListeners) {
    window.__gfListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
