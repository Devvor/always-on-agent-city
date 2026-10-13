const MAX_GROWTH = 8;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildScrollRun; }
function getVisitor() { const w = root(); return w && w.GuildVisitor; }
function getPurpose() { const w = root(); return w && w.GuildPurpose; }
function getQuestBoard() {
  const w = root();
  const qb = w && w.GuildQuestBoard;
  if (qb && typeof qb.gx === 'number' && typeof qb.gy === 'number') return qb;
  return { gx: -1.6, gy: 4.2 };
}
function getMuseum() { const w = root(); return w && w.GuildMuseum; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
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
function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) { }
  }
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function seeded(seed) {
  const x = Math.sin(seed * 999.999 + 123.456) * 43758.5453;
  return x - Math.floor(x);
}

function createState() {
  const purpose = getPurpose();
  let rep = 0;
  if (purpose && typeof purpose.rep === 'number') rep = purpose.rep;
  return { scrolls: [], carried: null, rep: rep, lastDrop: 0, ceremony: null, floats: [] };
}

function growthStep(Vv) {
  const raw = (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
  return Math.max(0, Math.min(MAX_GROWTH, raw));
}
function blockedTileSet() {
  const set = new Set();
  function block(gx, gy) {
    if (typeof gx === 'number' && typeof gy === 'number' && isFinite(gx) && isFinite(gy)) {
      set.add(Math.round(gx) + ',' + Math.round(gy));
    }
  }
  const qb = getQuestBoard();
  block(qb.gx, qb.gy);
  block(0.8, 4.5);
  const museum = getMuseum();
  if (museum) block(museum.gx, museum.gy);
  return set;
}
function floorTiles(Vv) {
  const s = growthStep(Vv);
  const minC = -2 - s;
  const maxC = 1 + s;
  const blocked = blockedTileSet();
  const out = [];
  if (!Vv || !Vv.grid) return out;
  for (let gy = minC; gy <= maxC; gy++) {
    for (let gx = minC; gx <= maxC; gx++) {
      if (tileRing(gx, gy) > s) continue;
      if (blocked.has(gx + ',' + gy)) continue;
      out.push({ gx: gx, gy: gy });
    }
  }
  return out;
}
function pickFloorTile(Vv, now) {
  const tiles = floorTiles(Vv);
  if (!tiles.length) return null;
  const idx = Math.floor(seeded((now || 0) * 0.000017 + tiles.length * 11.3 + (getState() ? getState().scrolls.length * 37 : 0)) * tiles.length);
  return tiles[clamp(idx, 0, tiles.length - 1)];
}

function update(now) {
  try {
    if (typeof now !== 'number') now = nowFn();
    const G = getState();
    const Vv = getV();
    if (!G || !Vv) return;
    if (Vv.gameState && Vv.gameState !== 'play') return;

    const vis = getVisitor();

    // Drop timer.
    if (G.lastDrop === 0) G.lastDrop = now;
    else {
      const interval = 150000 + seeded(G.lastDrop * 0.000001 + 2.718) * 90000;
      if (now - G.lastDrop >= interval && G.scrolls.length < 3) {
        const tile = pickFloorTile(Vv, now);
        if (tile) {
          G.scrolls.push({ gx: tile.gx, gy: tile.gy, born: now, phase: seeded(now * 0.000013 + G.scrolls.length * 9.1) * Math.PI * 2 });
          G.lastDrop = now;
        }
      }
    }

    // Pickup.
    if (G.carried === null && vis && ! (vis.carried)) {
      let bestIndex = -1;
      let bestDist = 0.71;
      for (let i = 0; i < G.scrolls.length; i++) {
        const s = G.scrolls[i];
        const d = Math.hypot(s.gx - vis.gx, s.gy - vis.gy);
        if (d <= 0.7 && (bestIndex === -1 || d < bestDist)) {
          bestIndex = i;
          bestDist = d;
        }
      }
      if (bestIndex >= 0) {
        const scroll = G.scrolls.splice(bestIndex, 1)[0];
        G.carried = scroll;
        if (vis) vis.carried = scroll;
        G.floats.push({ tileX: vis.gx, tileY: vis.gy, t0: now, dur: 1200, text: '+SCROLL' });
        cue('grow');
      }
    }

    // Deliver.
    const board = getQuestBoard();
    if (G.carried !== null && vis && !G.ceremony) {
      const d = Math.hypot(vis.gx - board.gx, vis.gy - board.gy);
      if (d <= 1.6) {
        G.carried = null;
        if (vis) vis.carried = null;
        G.rep += 5;
        const purpose = getPurpose();
        if (purpose && typeof purpose.rep === 'number') purpose.rep += 5;
        const particles = [];
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + seeded(now * 0.0001 + i * 0.7) * 0.5;
          const speed = 0.9 + seeded(now * 0.0002 + i * 1.3) * 1.4;
          particles.push({
            gx: board.gx,
            gy: board.gy,
            vx: Math.cos(ang) * speed,
            vy: Math.sin(ang) * speed - 0.4,
            born: now,
            life: 700 + seeded(now * 0.0003 + i) * 500,
            phase: seeded(now * 0.0004 + i * 2.1) * Math.PI * 2,
            size: 2
          });
        }
        G.ceremony = { t0: now, dur: 2000, boardGx: board.gx, boardGy: board.gy, particles: particles };
        cue('levelup');
      }
    }

    // Update floats.
    const nextFloats = [];
    for (let i = 0; i < G.floats.length; i++) {
      const f = G.floats[i];
      if ((now - f.t0) < f.dur) nextFloats.push(f);
    }
    G.floats = nextFloats;

    // Update ceremony particles and expiry.
    if (G.ceremony) {
      const parts = G.ceremony.particles || [];
      const next = [];
      const dtSec = 0; // updated below using elapsed clock is handled in frame-independent approximations sparingly
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if ((now - p.born) >= p.life) continue;
        // Movement done per-frame via a small elapsed; derive from now by storing age.
        next.push(p);
      }
      G.ceremony.particles = next;
      if (now - G.ceremony.t0 >= G.ceremony.dur) {
        G.ceremony = null;
      }
    }
  } catch (e) { }
}

function drawScroll(ctx, sx, sy, now, phase) {
  const bob = Math.round(Math.sin(now * 0.004 + (phase || 0)) * 2);
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = 'rgba(255, 190, 90, 0.7)';
  ctx.fillRect(Math.round(sx) - 8, Math.round(sy) - 8 + bob, 16, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#f4e8c1';
  ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 3 + bob, 6, 6);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.9)';
  ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1 + bob, 2, 2);
  ctx.restore();
}

function draw(ctx) {
  try {
    const G = getState();
    const Vv = getV();
    if (!G || !Vv || !ctx || (Vv.gameState && Vv.gameState !== 'play')) return;
    const now = nowFn();
    const vis = getVisitor();

    for (let i = 0; i < G.scrolls.length; i++) {
      const sc = G.scrolls[i];
      const pt = isoFn(sc.gx, sc.gy);
      drawScroll(ctx, pt.x, pt.y, now, sc.phase);
    }

    if (G.carried && vis) {
      const pt = isoFn(vis.gx, vis.gy);
      drawScroll(ctx, pt.x + 9, pt.y - 12, now, G.carried.phase);
    }

    for (let i = 0; i < G.floats.length; i++) {
      const f = G.floats[i];
      const pt = isoFn(f.tileX, f.tileY);
      const age = clamp((now - f.t0) / f.dur, 0, 1);
      const alpha = 1 - age;
      const rise = Math.round(age * 26);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fitFn(f.text, 80), pt.x, pt.y - 26 - rise);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    if (G.ceremony) {
      const c = G.ceremony;
      const age = (now - c.t0) / c.dur;
      const boardPt = isoFn(c.boardGx, c.boardGy);
      if (age <= 0.75) {
        const bannerAlpha = age <= 0.6 ? 1 : Math.max(0, (0.75 - age) / 0.15);
        ctx.save();
        ctx.globalAlpha = bannerAlpha;
        ctx.fillStyle = 'rgba(10, 10, 12, 0.88)';
        const bw = 160, bh = 24;
        const bx = Math.round(boardPt.x - bw * 0.5);
        const by = Math.round(boardPt.y - 46);
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#f3d37a';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitFn('SCROLL DELIVERED', bw - 10), boardPt.x, by + bh * 0.5 + 1);
        ctx.textAlign = 'left';
        ctx.restore();
      }

      for (let i = 0; i < c.particles.length; i++) {
        const p = c.particles[i];
        const pAge = (now - p.born) / p.life;
        if (pAge >= 1) continue;
        const life = Math.max(0, 1 - pAge);
        const px = p.gx + p.vx * (now - p.born) * 0.001;
        const py = p.gy + p.vy * (now - p.born) * 0.001 + 0.8 * pAge * pAge;
        const pt = isoFn(px, py);
        ctx.save();
        ctx.globalAlpha = life;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), p.size, p.size);
        ctx.restore();
      }
    }
  } catch (e) { }
}

if (typeof window !== 'undefined') {
  if (!window.GuildScrollRun) window.GuildScrollRun = createState();
  window.GuildScrollRun.update = update;
  window.GuildScrollRun.draw = draw;
  window.GuildScrollRun.__probe = function () {
    const G = getState();
    if (!G) return { scrolls: 0, carried: false, rep: 0 };
    let rep = G.rep;
    const purpose = getPurpose();
    if (purpose && typeof purpose.rep === 'number') rep = purpose.rep;
    return { scrolls: G.scrolls.length, carried: !!G.carried, rep: rep };
  };
}

export {};
