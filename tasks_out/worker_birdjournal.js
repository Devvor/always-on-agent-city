// ISLAND BIRDWATCHING JOURNAL — self-installing ES module (no imports, no top-level DOM access)
// ZONES (tile coords, visitor GuildVisitor.gx/gy):
//   BIRDS:      within 2 tiles of (-2,-2)   (NE aviary)
//   BUTTERFLIES: within 2 tiles of (2,-2)  (E garden meadow)
//   PIGEONS:    within 2 tiles of (0,0)    (courtyard)
//   OWL:        within 2 tiles of (-2,-2) AND V.daylight < 0.35 (NE roost, night)
//   CAT:        within 1.5 tiles of (1,1)  (sleeping guild cat)
// A stamp requires standing in the zone with conditions met for 2 continuous seconds.

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getVis() { const w = root(); return w && w.GuildVisitor; }
function getJ() { const w = root(); return w && w.GuildBirdJournal; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}

const FAUNA = [
  { id: 'birds', label: 'BIRDS', note: 'Chatter in the aviary pines; they know the guild bell by heart.', cx: -2, cy: -2, r: 2 },
  { id: 'butterflies', label: 'BUTTERFLIES', note: 'Meadow wings drift east of the forge, tasting the thyme.', cx: 2, cy: -2, r: 2 },
  { id: 'pigeons', label: 'PIGEONS', note: 'Courtyard pigeons bow for crumbs and gossip in equal measure.', cx: 0, cy: 0, r: 2 },
  { id: 'owl', label: 'OWL', note: 'Only after dusk does the roost owl open one golden eye.', cx: -2, cy: -2, r: 2, night: true },
  { id: 'cat', label: 'CAT', note: 'The guild cat dreams in sunbeams and permits quiet company.', cx: 1, cy: 1, r: 1.5 }
];

function inZone(f, vis, Vv) {
  if (!vis) return false;
  const d = Math.hypot(vis.gx - f.cx, vis.gy - f.cy);
  if (d > f.r) return false;
  if (f.night) {
    const dl = (Vv && typeof Vv.daylight === 'number') ? Vv.daylight : 1;
    if (dl >= 0.35) return false;
  }
  return true;
}

let lastTime = null;
let keyPrev = false;

function onKeydown(e) {
  const w = root();
  if (!w) return;
  const Vv = getV();
  const J = getJ();
  if (!J || !Vv || Vv.gameState !== 'play') return;
  if (String((e && e.key) || '').toLowerCase() === 'j') {
    if (!keyPrev) {
      J.open = !J.open;
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
    keyPrev = true;
  }
}
function onKeyup(e) {
  if (String((e && e.key) || '').toLowerCase() === 'j') keyPrev = false;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  const J = getJ();
  const Vv = getV();
  const vis = getVis();
  if (!w || !J || !Vv || Vv.gameState !== 'play' || !vis) { lastTime = now; return; }
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  lastTime = now;

  if (!J.complete) {
    for (let i = 0; i < FAUNA.length; i++) {
      const f = FAUNA[i];
      if (J.entries[f.id]) continue;
      if (inZone(f, vis, Vv)) {
        J.progress[f.id] = (J.progress[f.id] || 0) + dt;
        if (J.progress[f.id] >= 2) {
          J.entries[f.id] = { stampedAt: now };
          J.popAt = now;
          cue('coin');
          const count = Object.keys(J.entries).length;
          if (count >= FAUNA.length) {
            J.complete = true;
            J.confettiStart = now;
            J.ceremonyAt = now;
            cue('levelup');
          }
        }
      } else {
        J.progress[f.id] = 0;
      }
    }
  }

  if (J.confettiStart != null) {
    if (J.confetti == null) J.confetti = [];
    const elapsed = now - J.confettiStart;
    if (elapsed < 3000) {
      const c = (Vv && Vv.canvas) || null;
      const cw = c ? c.width : 800;
      const ch = c ? c.height : 600;
      while (J.confetti.length < 90) {
        J.confetti.push({
          x: cw * 0.5 + (Math.random() - 0.5) * 120,
          y: ch * 0.4,
          vx: (Math.random() - 0.5) * 220,
          vy: -120 - Math.random() * 160,
          age: 0
        });
      }
      for (let i = 0; i < J.confetti.length; i++) {
        const p = J.confetti[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 180 * dt;
      }
    } else {
      J.confetti = [];
      J.confettiStart = null;
    }
  }
}

function drawPictogram(ctx, id, x, y) {
  // tiny pixel pictograms, fillRect blocks only
  if (id === 'birds') {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x + 2, y + 4, 8, 5);
    ctx.fillRect(x + 9, y + 2, 4, 4);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + 12, y + 3, 3, 2);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x + 0, y + 5, 2, 2);
  } else if (id === 'butterflies') {
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(x + 5, y + 5, 3, 3);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + 1, y + 2, 4, 4);
    ctx.fillRect(x + 8, y + 2, 4, 4);
    ctx.fillRect(x + 2, y + 7, 3, 3);
    ctx.fillRect(x + 7, y + 7, 3, 3);
  } else if (id === 'pigeons') {
    ctx.fillStyle = '#8d847c';
    ctx.fillRect(x + 2, y + 4, 8, 5);
    ctx.fillRect(x + 9, y + 2, 4, 4);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + 12, y + 3, 2, 2);
    ctx.fillStyle = '#8d847c';
    ctx.fillRect(x + 3, y + 9, 2, 2);
    ctx.fillRect(x + 7, y + 9, 2, 2);
  } else if (id === 'owl') {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x + 3, y + 2, 8, 9);
    ctx.fillRect(x + 1, y + 3, 2, 3);
    ctx.fillRect(x + 11, y + 3, 2, 3);
    ctx.fillStyle = '#f3e6bf';
    ctx.fillRect(x + 5, y + 4, 2, 2);
    ctx.fillRect(x + 8, y + 4, 2, 2);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x + 6, y + 8, 3, 1);
  } else if (id === 'cat') {
    ctx.fillStyle = '#8d847c';
    ctx.fillRect(x + 2, y + 5, 9, 5);
    ctx.fillRect(x + 9, y + 2, 5, 4);
    ctx.fillRect(x + 9, y + 1, 2, 2);
    ctx.fillRect(x + 12, y + 1, 2, 2);
    ctx.fillStyle = '#4a2f16';
    ctx.fillRect(x + 11, y + 3, 1, 1);
    ctx.fillRect(x + 13, y + 3, 1, 1);
  }
}

function draw(ctx) {
  const w = root();
  const J = getJ();
  const Vv = getV();
  if (!w || !J || !Vv || Vv.gameState !== 'play' || !ctx) return;
  const now = nowFn();
  const canvas = (ctx && ctx.canvas) || Vv.canvas;
  if (!canvas) return;

  // confetti (screen space, gold tones)
  if (J.confetti && J.confetti.length) {
    for (let i = 0; i < J.confetti.length; i++) {
      const p = J.confetti[i];
      if (p.age > 3) continue;
      ctx.globalAlpha = Math.max(0, 1 - p.age / 3);
      ctx.fillStyle = (i % 2 === 0) ? '#d4af37' : '#f3d37a';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // ceremony bubble
  if (J.complete && J.ceremonyAt != null && now - J.ceremonyAt < 4000) {
    const bw = 220;
    const bx = Math.round((canvas.width - bw) * 0.5);
    const by = Math.round(canvas.height * 0.28);
    ctx.fillStyle = 'rgba(20,16,10,0.90)';
    ctx.fillRect(bx, by, bw, 22);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, 22);
    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn('MASTER BIRDER OF THE ISLAND', bw - 10), bx + bw * 0.5, by + 11);
    ctx.textAlign = 'left';
  }

  if (!J.open) return;

  const panelW = 210;
  const rowH = 26;
  const panelH = 26 + FAUNA.length * rowH + 10;
  const px = 12;
  const py = 56;

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, panelW, panelH);
  ctx.clip();

  ctx.fillStyle = '#e8d9b5';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 11px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fitFn('FIELD JOURNAL', panelW - 12), px + 8, py + 13);

  for (let i = 0; i < FAUNA.length; i++) {
    const f = FAUNA[i];
    const ry = py + 26 + i * rowH;
    const entry = J.entries[f.id];
    if (entry) {
      const age = now - entry.stampedAt;
      const pop = age < 400 ? 1 + 0.35 * Math.sin((age / 400) * Math.PI) : 1;
      ctx.save();
      ctx.translate(px + 8, ry + 2);
      ctx.scale(pop, pop);
      drawPictogram(ctx, f.id, 0, 0);
      ctx.restore();
      ctx.fillStyle = '#4a2f16';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(fitFn(f.label, 60), px + 28, ry + 6);
      ctx.fillStyle = '#6b5a3a';
      ctx.font = '8px monospace';
      ctx.fillText(fitFn(f.note, panelW - 44), px + 8, ry + 18);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(px + panelW - 16, ry + 2, 8, 8);
    } else {
      ctx.fillStyle = 'rgba(74,47,22,0.18)';
      ctx.fillRect(px + 8, ry + 2, 16, 16);
      ctx.fillStyle = '#8d847c';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(fitFn(f.label, 60), px + 28, ry + 6);
      const prog = Math.min(1, (J.progress[f.id] || 0) / 2);
      ctx.fillStyle = '#c9b88f';
      ctx.fillRect(px + 8, ry + 18, panelW - 24, 3);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(px + 8, ry + 18, Math.round((panelW - 24) * prog), 3);
    }
  }
  ctx.restore();
}

if (typeof window !== 'undefined') {
  if (!window.GuildBirdJournal) {
    window.GuildBirdJournal = { entries: {}, complete: false, open: false };
  }
  const J = window.GuildBirdJournal;
  if (J.progress == null) J.progress = {};
  if (J.confetti == null) J.confetti = [];
  J.update = update;
  J.draw = draw;
  J.__probe = function () {
    return { entries: Object.keys(J.entries).length, complete: !!J.complete, open: !!J.open };
  };
  if (!window.__gbjListeners) {
    window.__gbjListeners = true;
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
  }
}

export {};
