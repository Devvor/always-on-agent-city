# tasks_out/guild_arrivals.js
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
function fitFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return String(text == null ? '' : text);
}
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') { try { w.cue(name); } catch (e) {} }
}
function questBoardTile() {
  const w = root();
  const qb = w && w.GuildQuestBoard;
  if (qb && typeof qb.gx === 'number' && typeof qb.gy === 'number') return { gx: qb.gx, gy: qb.gy };
  return { gx: -1.6, gy: 4.2 };
}
function pendingCount(Vv) {
  if (!Vv || !Array.isArray(Vv.allTasks)) return 0;
  let n = 0;
  for (let i = 0; i < Vv.allTasks.length; i++) {
    const t = Vv.allTasks[i];
    if (t && t.status === 'pending') n++;
  }
  return n;
}
function latestPendingId(Vv) {
  if (!Vv || !Array.isArray(Vv.allTasks)) return null;
  for (let i = Vv.allTasks.length - 1; i >= 0; i--) {
    const t = Vv.allTasks[i];
    if (t && t.status === 'pending') return (t.id != null ? t.id : (t.title != null ? t.title : null));
  }
  return null;
}
function createState() {
  return { lastPending: -1, pigeon: null, notice: null };
}
function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const w = root();
  if (!w) return;
  if (!w.GuildArrivals) w.GuildArrivals = createState();
  const st = w.GuildArrivals;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;

  const cur = pendingCount(Vv);
  if (st.lastPending < 0) {
    st.lastPending = cur;
  } else if (cur > st.lastPending) {
    const qid = latestPendingId(Vv);
    if (!st.pigeon && !st.notice) {
      st.pigeon = { t0: now, dur: 6000, questId: qid };
      cue('alert');
    } else if (st.pigeon) {
      st.pigeon.questId = qid;
    }
  }
  st.lastPending = cur;

  if (st.pigeon) {
    const p = st.pigeon;
    const elapsed = now - p.t0;
    if (elapsed >= p.dur) {
      st.pigeon = null;
      st.notice = { t0: now, questId: p.questId };
      cue('alert');
    }
  }

  if (st.notice) {
    const n = st.notice;
    if (now - n.t0 >= 60000) {
      st.notice = null;
    }
  }
}
function drawPigeon(ctx, p, Vv, now) {
  if (!ctx || !p) return;
  const qb = questBoardTile();
  const start = isoFn(-2.6, 3.0);
  const end = isoFn(qb.gx, qb.gy);
  const elapsed = now - p.t0;
  const t = Math.max(0, Math.min(1, elapsed / p.dur));
  const x = start.x + (end.x - start.x) * t;
  const y = start.y + (end.y - start.y) * t;
  const flap = (t * 12) % 2 < 1 ? 0 : 1;
  const bx = Math.round(x);
  const by = Math.round(y);
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.ellipse(bx, by, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b7280';
  const wingY = by - 2 + (flap === 0 ? -1 : 2);
  ctx.beginPath();
  ctx.ellipse(bx - 3, wingY, 2, 0.8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bx + 3, wingY, 2, 0.8, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(bx + 5, by - 2, 3, 1);
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(bx + 8, by - 4, 5, 3);
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 8, by - 4, 5, 3);
}
function drawNotice(ctx, n, Vv, now) {
  if (!ctx || !n) return;
  const qb = questBoardTile();
  const pt = isoFn(qb.gx, qb.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  const age = now - n.t0;
  const fade = Math.max(0, 1 - (age / 60000));
  const bob = Math.sin(now * 0.002) * 1.5;
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(x - 14, y - 16 + bob, 28, 16);
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 14, y - 16 + bob, 28, 16);
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = 'NEW QUEST ' + String(n.questId == null ? '' : n.questId);
  ctx.fillText(fitFn(label, 24), x, y - 8 + bob);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
function draw(ctx) {
  const w = root();
  if (!w) return;
  const st = w.GuildArrivals;
  if (!st) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  if (st.pigeon) drawPigeon(ctx, st.pigeon, Vv, n);
  if (st.notice) drawNotice(ctx, st.notice, Vv, n);
}
if (typeof window !== 'undefined') {
  if (!window.GuildArrivals) window.GuildArrivals = createState();
  window.GuildArrivals.update = update;
  window.GuildArrivals.draw = draw;
  window.GuildArrivals.__probe = function () {
    const st = window.GuildArrivals;
    return { pigeon: !!st.pigeon, notice: !!st.notice, lastPending: st.lastPending };
  };
}

export {};
