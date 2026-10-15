// tasks_out/market_row.js - SW market row: 3 idle villagers strolling, murmuring real quest activity.
// Self-installing ES module. No imports, no top-level DOM access.

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildMarketRow; }
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
function cueFn(type) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(type); } catch (e) {} }
}

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

// Existing props/buildings in the scene (grid tiles the villagers must never overlap).
function propTiles() {
  return [
    { gx: -2, gy: 0 }, { gx: 0, gy: -2 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 }, // buildings
    { gx: 0, gy: -1 }, // campfire
    { gx: 1, gy: -1 }, // bookshelf
    { gx: -1, gy: 1 }, // forge
    { gx: 1, gy: 0 },  // coin pile (same tile as P3)
    { gx: 1, gy: 1 },  // cat
    { gx: -1, gy: -1 }, { gx: 1, gy: -1 }, { gx: -1, gy: 1 }, { gx: 1, gy: 1 } // desks
  ];
}

function chebDist(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function growthOf(Vv) {
  return (Vv && typeof Vv.growthStep === 'number') ? Vv.growthStep : 0;
}

function isWalkable(gx, gy, Vv, stall) {
  if (!Vv) return false;
  const rx = Math.round(gx);
  const ry = Math.round(gy);
  if (tileRing(rx, ry) > growthOf(Vv)) return false;
  const props = propTiles();
  for (let i = 0; i < props.length; i++) {
    if (rx === props[i].gx && ry === props[i].gy) return false;
  }
  if (stall && rx === stall.gx && ry === stall.gy) return false;
  return true;
}

// Place the market stall 2+ tiles from every existing prop, in the SW area, on a walkable tile.
function placeStall(Vv) {
  const s = growthOf(Vv);
  const minC = -2 - s;
  const maxC = 1 + s;
  const props = propTiles();
  let best = null;
  for (let gy = minC; gy <= maxC; gy++) {
    for (let gx = minC; gx <= maxC; gx++) {
      if (tileRing(gx, gy) > s) continue;
      let minD = Infinity;
      for (let i = 0; i < props.length; i++) {
        const d = chebDist(gx, gy, props[i].gx, props[i].gy);
        if (d < minD) minD = d;
      }
      if (minD < 2) continue; // ZONE RULE: 2+ tiles from any existing prop
      // prefer SW (small gx, large gy), then max clearance
      const score = minD * 1000 + (gy - gx);
      if (!best || score > best.score) best = { gx: gx, gy: gy, score: score };
    }
  }
  if (!best) return { gx: -2, gy: 1, fallback: true }; // dense map fallback: SW corner tile
  return { gx: best.gx, gy: best.gy };
}

function statusWord(status) {
  const s = String(status == null ? '' : status).toLowerCase();
  if (s === 'done') return 'shipped clean';
  if (s === 'in_progress') return 'in the works';
  if (s === 'pending') return 'queued up';
  if (s === 'failed') return 'hit a snag';
  return 'on the board';
}

function allTasks(Vv) {
  return (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
}

function pickTask(Vv, seed) {
  const tasks = allTasks(Vv);
  if (!tasks.length) return null;
  const idx = Math.abs(Math.floor(seed)) % tasks.length;
  return tasks[idx];
}

function makeMurmur(Vv, seed) {
  const t = pickTask(Vv, seed);
  if (!t) return 'quiet day at the guild...';
  const id = String(t.id != null ? t.id : (t.title != null ? t.title : 'task'));
  return fitFn(id + ' ' + statusWord(t.status), 150);
}

function makeLongMurmur(Vv, seed) {
  const t = pickTask(Vv, seed);
  if (!t) return 'No quests on the board. The cat takes shifts.';
  const id = String(t.id != null ? t.id : 'task');
  const title = fitFn(String(t.title != null ? t.title : id), 120);
  return fitFn(id + ' ' + statusWord(t.status) + ' - ' + title, 220);
}

function createState() {
  const t = nowFn();
  const villagers = [];
  const robes = ['#8b5a2b', '#4d7c0f', '#b45309'];
  for (let i = 0; i < 3; i++) {
    villagers.push({
      index: i,
      gx: 0, gy: 0, placed: false,
      tx: 0, ty: 0,
      facing: 'down',
      moving: false,
      walkFrame: 0, walkTimer: 0,
      pauseUntil: 0,
      bubble: null,
      murmurAt: t + i * 2600,
      seed: 17 + i * 31,
      robe: robes[i % robes.length]
    });
  }
  return {
    stall: null,
    stallStep: -1,
    villagers: villagers,
    lastTime: null,
    lastVisitorNear: false
  };
}

function ensureStall(st, Vv) {
  const s = growthOf(Vv);
  if (!st.stall || st.stallStep !== s) {
    st.stall = placeStall(Vv);
    st.stallStep = s;
  }
}

function marketAnchors(st) {
  // Points of interest the villagers stroll between: our stall + nearby market props.
  const anchors = [{ gx: st.stall.gx, gy: st.stall.gy }];
  const props = [{ gx: -1, gy: 1 }, { gx: 1, gy: 0 }, { gx: 0, gy: -1 }, { gx: 1, gy: 1 }];
  for (let i = 0; i < props.length; i++) anchors.push(props[i]);
  return anchors;
}

function pickTarget(v, st, Vv) {
  const anchors = marketAnchors(st);
  const a = anchors[Math.abs(Math.floor(v.seed * 7.3)) % anchors.length];
  // walk to a walkable tile adjacent to the anchor (never onto the prop itself)
  const offs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  let chosen = null;
  for (let k = 0; k < 6; k++) {
    const o = offs[Math.abs(Math.floor(v.seed * (11 + k * 3.7) + k)) % offs.length];
    const cx = a.gx + o[0];
    const cy = a.gy + o[1];
    if (isWalkable(cx, cy, Vv, st.stall)) { chosen = { gx: cx, gy: cy }; break; }
  }
  if (!chosen) chosen = { gx: st.stall.gx + 1, gy: st.stall.gy };
  v.seed = (v.seed * 1.7 + 3.1) % 100000;
  return chosen;
}

function villagerSeparated(v, st, gx, gy) {
  for (let i = 0; i < st.villagers.length; i++) {
    const o = st.villagers[i];
    if (o === v) continue;
    if (chebDist(gx, gy, o.gx, o.gy) < 1) return false;
  }
  return true;
}

function refreshMurmurs(st, Vv, now) {
  for (let i = 0; i < st.villagers.length; i++) {
    const v = st.villagers[i];
    if (now >= v.murmurAt) {
      v.seed = (v.seed * 1.3 + 7.7) % 100000;
      v.bubble = { text: makeMurmur(Vv, v.seed), start: now, duration: 4200, long: false };
      v.murmurAt = now + 8000 + (i * 400); // refreshed every ~8s, staggered
    }
  }
}

function updateVillager(v, st, Vv, dt, now) {
  if (!v.placed) {
    // spawn near the stall without overlapping it
    const offs = [[1, 0], [0, 1], [1, 1], [-1, 0]];
    const o = offs[v.index % offs.length];
    let sx = st.stall.gx + o[0];
    let sy = st.stall.gy + o[1];
    if (!isWalkable(sx, sy, Vv, st.stall)) { sx = st.stall.gx + 1; sy = st.stall.gy + 1; }
    v.gx = sx; v.gy = sy; v.tx = sx; v.ty = sy;
    v.placed = true;
  }
  if (now < v.pauseUntil) {
    v.moving = false;
    v.walkFrame = 0;
    v.walkTimer = 0;
    return;
  }
  const dx = v.tx - v.gx;
  const dy = v.ty - v.gy;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.08) {
    // arrived: pause near the prop, then pick a new stroll target
    v.gx = v.tx; v.gy = v.ty;
    v.moving = false;
    v.pauseUntil = now + 2200 + (v.index * 900) + (Math.abs(Math.sin(v.seed)) * 1800);
    const nt = pickTarget(v, st, Vv);
    v.tx = nt.gx; v.ty = nt.gy;
    return;
  }
  v.moving = true;
  const speed = 0.55; // slow stroll
  const nx = v.gx + (dx / dist) * speed * dt;
  const ny = v.gy + (dy / dist) * speed * dt;
  if (isWalkable(nx, ny, Vv, st.stall) && villagerSeparated(v, st, nx, ny)) {
    v.gx = nx; v.gy = ny;
  } else {
    // blocked: re-target
    const nt = pickTarget(v, st, Vv);
    v.tx = nt.gx; v.ty = nt.gy;
  }
  if (Math.abs(dx) > Math.abs(dy)) v.facing = dx >= 0 ? 'right' : 'left';
  else v.facing = dy >= 0 ? 'down' : 'up';
  v.walkTimer += dt;
  while (v.walkTimer >= 0.22) {
    v.walkFrame = (v.walkFrame + 1) % 4;
    v.walkTimer -= 0.22;
  }
}

function visitorNearStall(st, Vv) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return false;
  return chebDist(vis.gx, vis.gy, st.stall.gx, st.stall.gy) <= 1.6;
}

function visitorNearVillager(st) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (!vis || !isFinite(vis.gx) || !isFinite(vis.gy)) return -1;
  for (let i = 0; i < st.villagers.length; i++) {
    const v = st.villagers[i];
    if (Math.hypot(v.gx - vis.gx, v.gy - vis.gy) <= 1.6) return i;
  }
  return -1;
}

function onKeydown(e) {
  const k = e ? String(e.key || '').toLowerCase() : '';
  if (k !== 'e') return;
  const w = root();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !st.stall) return;
  const now = nowFn();
  const vi = visitorNearVillager(st);
  if (vi >= 0) {
    const v = st.villagers[vi];
    v.seed = (v.seed * 2.1 + 5.3) % 100000;
    v.bubble = { text: makeLongMurmur(Vv, v.seed), start: now, duration: 6000, long: true };
    v.pauseUntil = now + 2500;
    cueFn('chat');
    if (typeof e.preventDefault === 'function') e.preventDefault();
    return;
  }
  if (visitorNearStall(st, Vv)) {
    // interacting with the stall: nearest villager chimes in
    const v = st.villagers[0];
    v.seed = (v.seed * 1.9 + 2.7) % 100000;
    v.bubble = { text: makeLongMurmur(Vv, v.seed), start: now, duration: 6000, long: true };
    v.pauseUntil = now + 2500;
    cueFn('chat');
    if (typeof e.preventDefault === 'function') e.preventDefault();
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') { st.lastTime = now; return; }
  if (st.lastTime === null) st.lastTime = now;
  let dt = (now - st.lastTime) / 1000;
  if (!isFinite(dt) || dt < 0) dt = 0;
  if (dt > 0.12) dt = 0.12;
  st.lastTime = now;

  ensureStall(st, Vv);
  refreshMurmurs(st, Vv, now);
  for (let i = 0; i < st.villagers.length; i++) {
    updateVillager(st.villagers[i], st, Vv, dt, now);
  }
  st.lastVisitorNear = visitorNearStall(st, Vv);
}

function drawStall(ctx, st, Vv, now) {
  const pt = isoFn(st.stall.gx, st.stall.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 20, y + 12, 40, 5);
  // table
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 16, y - 12, 32, 16);
  ctx.fillStyle = '#8b643f';
  ctx.fillRect(x - 16, y - 14, 32, 4);
  // posts + striped awning
  ctx.fillStyle = '#4b3320';
  ctx.fillRect(x - 16, y - 34, 3, 22);
  ctx.fillRect(x + 13, y - 34, 3, 22);
  const sway = Math.round(Math.sin(now * 0.002) * 1.5);
  for (let s = 0; s < 6; s++) {
    ctx.fillStyle = (s % 2 === 0) ? '#b91c1c' : '#f3f4f6';
    ctx.fillRect(x - 19 + s * 6.5 + sway, y - 40, 7, 8);
  }
  // goods on the table
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - 10, y - 18, 5, 4);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(x - 2, y - 18, 5, 4);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(x + 6, y - 18, 5, 4);
  // E hint when the visitor is close
  if (st.lastVisitorNear && Math.floor(now / 450) % 2 === 0) {
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(x - 7, y - 56, 14, 14);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 7, y - 56, 14, 14);
    ctx.fillStyle = '#f3d37a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', x, y - 48);
    ctx.textAlign = 'left';
  }
}

function drawVillager(ctx, v, now) {
  const pt = isoFn(v.gx, v.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const moving = v.moving;
  const bob = moving ? (v.walkFrame % 2 === 0 ? 0 : 1) : 0;
  const Y = y + bob;
  const frame = moving ? (v.walkFrame % 4) : 0;
  const vertical = (v.facing === 'up' || v.facing === 'down');

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 4, y + 17, 20, 4);

  let leftY = Y + 10, rightY = Y + 10, leftH = 8, rightH = 8;
  if (frame === 1) { leftY = Y + 9; rightY = Y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = Y + 11; rightY = Y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = Y + 12; rightY = Y + 9; leftH = 5; rightH = 8; }
  if (vertical) { leftY = Y + 10; rightY = Y + 10; leftH = 7; rightH = 7; }

  ctx.fillStyle = '#3f3f46';
  if (v.facing === 'left') {
    ctx.fillRect(x + 10, leftY, 4, leftH);
    ctx.fillRect(x + 2, rightY, 4, rightH);
  } else if (v.facing === 'right') {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  } else if (v.facing === 'up') {
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 11, rightY, 3, rightH);
  } else {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  }

  ctx.fillStyle = v.robe;
  ctx.fillRect(x + 1, Y - 2, 14, 12);
  ctx.fillStyle = '#e8b88a';
  ctx.fillRect(x + 3, Y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, Y - 8, 2, 2);
  ctx.fillRect(x + 9, Y - 8, 2, 2);
  ctx.fillStyle = '#5b4636';
  ctx.fillRect(x + 4, Y - 12, 8, 2);
}

function drawBubble(ctx, v, now) {
  if (!v.bubble) return;
  const age = now - v.bubble.start;
  if (age < 0 || age >= v.bubble.duration) { v.bubble = null; return; }
  const alpha = (v.bubble.duration - age < 700) ? Math.max(0, (v.bubble.duration - age) / 700) : 1;
  const pt = isoFn(v.gx, v.gy);
  const cx = Math.round(pt.x) + 7;
  const tipY = Math.round(pt.y) - 20;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = (v.bubble.long ? '10px' : '9px') + ' monospace';
  const text = fitFn(v.bubble.text, 150);
  const tw = ctx.measureText(text).width;
  const bw = Math.max(40, Math.round(tw + 12));
  const bh = v.bubble.long ? 18 : 15;
  let bx = cx - Math.round(bw * 0.5);
  let by = tipY - bh - 6;
  // tip
  ctx.fillStyle = 'rgba(250,250,240,0.95)';
  ctx.beginPath();
  ctx.moveTo(cx - 3, by + bh);
  ctx.lineTo(cx + 3, by + bh);
  ctx.lineTo(cx, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(250,250,240,0.95)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#6b4a2d';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#3b2a15';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, bx + 6, by + bh * 0.5 + 1);
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play' || !st.stall) return;
  const now = nowFn();
  drawStall(ctx, st, Vv, now);
  for (let i = 0; i < st.villagers.length; i++) {
    drawVillager(ctx, st.villagers[i], now);
  }
  for (let i = 0; i < st.villagers.length; i++) {
    drawBubble(ctx, st.villagers[i], now);
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildMarketRow) window.GuildMarketRow = createState();
  window.GuildMarketRow.update = update;
  window.GuildMarketRow.draw = draw;
  window.GuildMarketRow.__probe = function () {
    const st = window.GuildMarketRow;
    return {
      stall: st.stall ? { gx: st.stall.gx, gy: st.stall.gy } : null,
      villagers: st.villagers.map(function (v) {
        return { gx: v.gx, gy: v.gy, tx: v.tx, ty: v.ty, moving: v.moving, bubble: v.bubble ? v.bubble.text : null };
      })
    };
  };
  window.GuildMarketRow.__rawUpdate = update;
  if (!window.__mrListeners) {
    window.__mrListeners = true;
    window.addEventListener('keydown', onKeydown);
  }
}

export {};
