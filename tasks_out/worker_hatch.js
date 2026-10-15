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
function getState() { const w = root(); return w && w.GuildHatch; }

function createState() {
  return { gx: 5.5, gy: 2.5, open: false, near: false, wheelSpin: 0, entries: [], total: 0 };
}

function hashId(str) {
  let h = 0;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0) % 4 + 1;
}

function computeEntries(Vv) {
  const out = [];
  const tasks = (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks : [];
  let total = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || t.status !== 'done') continue;
    const id = String(t.id != null ? t.id : ('task_' + i));
    const title = String(t.title != null ? t.title : id);
    const wage = hashId(id);
    total += wage;
    out.push({ id: id, title: title, wage: wage });
  }
  return { entries: out, total: total };
}

function visitorDistance() {
  const w = root();
  const vis = w && w.GuildVisitor;
  const st = getState();
  if (!vis || !st) return Infinity;
  const dx = vis.gx - st.gx;
  const dy = vis.gy - st.gy;
  return Math.hypot(dx, dy);
}

function onKeydown(e) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  if (st.open) {
    st.open = false;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    return;
  }
  if (visitorDistance() <= 1.5) {
    const k = String((e && e.key) || '').toLowerCase();
    if (k === 'e') {
      const res = computeEntries(Vv);
      st.entries = res.entries;
      st.total = res.total;
      st.open = true;
      if (w && typeof w.cue === 'function') { try { w.cue('done'); } catch (err) {} }
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    }
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  st.near = visitorDistance() <= 1.5;
  st.wheelSpin += 0.002;
  if (st.open) {
    const res = computeEntries(Vv);
    st.entries = res.entries;
    st.total = res.total;
  }
}

function drawHatch(ctx, st, now) {
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  if (ctx.ellipse) {
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 14, y - 2, 28, 8);
  }
  ctx.fillStyle = '#3a3a42';
  if (ctx.ellipse) {
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 15, y - 12, 30, 16);
  }
  ctx.fillStyle = '#4b4b55';
  if (ctx.ellipse) {
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 12, y - 11, 24, 12);
  }
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y - 5, 9, 0, Math.PI * 2);
  ctx.stroke();
  const spin = st.wheelSpin;
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const a = spin + k * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 7, y - 5 - Math.sin(a) * 4);
    ctx.lineTo(x + Math.cos(a) * 7, y - 5 + Math.sin(a) * 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 2, y - 7, 4, 4);
  if (st.near && !st.open) {
    const label = 'E: VAULT AUDIT';
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText(label).width;
    const pw = Math.round(tw) + 8;
    const ph = 12;
    const px = x - Math.round(pw * 0.5);
    const py = y - 34;
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitFn(label, pw - 4), px + pw * 0.5, py + ph * 0.5 + 1);
    ctx.textAlign = 'left';
  }
}

function drawPanel(ctx, st, Vv) {
  const canvas = (ctx && ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
  if (!canvas) return;
  const boxW = Math.min(canvas.width - 40, 380);
  const rowH = 14;
  const maxRows = 10;
  const rows = Math.min(st.entries.length, maxRows);
  const boxH = 46 + rows * rowH + 26;
  const bx = Math.round((canvas.width - boxW) * 0.5);
  const by = Math.round((canvas.height - boxH) * 0.5);
  ctx.fillStyle = '#d9c8a3';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, boxW, boxH);
  ctx.fillStyle = '#4a2f16';
  ctx.fillRect(bx + 4, by + 4, boxW - 8, 22);
  ctx.fillStyle = '#f3e6bf';
  ctx.font = 'bold 13px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(fitFn('VAULT AUDIT', boxW - 24), bx + boxW * 0.5, by + 15);
  ctx.textAlign = 'left';
  ctx.font = '10px monospace';
  let y = by + 38;
  for (let i = 0; i < rows; i++) {
    const en = st.entries[i];
    const line = String(en.id) + '  ' + String(en.title);
    ctx.fillStyle = '#2b1d0e';
    ctx.fillText(fitFn(line, boxW - 60), bx + 10, y + rowH * 0.5);
    ctx.fillStyle = '#854d0e';
    ctx.textAlign = 'right';
    ctx.fillText(fitFn(en.wage + ' GC', 44), bx + boxW - 10, y + rowH * 0.5);
    ctx.textAlign = 'left';
    y += rowH;
  }
  if (st.entries.length > maxRows) {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillText(fitFn('(+' + (st.entries.length - maxRows) + ' more)', boxW - 20), bx + 10, y + rowH * 0.5);
    y += rowH;
  }
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + 8, y + 2);
  ctx.lineTo(bx + boxW - 8, y + 2);
  ctx.stroke();
  y += 8;
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#2b1d0e';
  ctx.fillText(fitFn('TOTAL', boxW - 70), bx + 10, y + 6);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#854d0e';
  let totalLine = st.total + ' GC';
  const w = root();
  const eco = w && w.GuildEconomy;
  if (eco) {
    let ledger = null;
    if (typeof eco.treasury === 'number') ledger = eco.treasury;
    else if (eco.state && typeof eco.state.treasury === 'number') ledger = eco.state.treasury;
    if (ledger != null) totalLine += ' (ledger: ' + ledger + ')';
  }
  ctx.fillText(fitFn(totalLine, boxW - 70), bx + boxW - 10, y + 6);
  ctx.textAlign = 'left';
  ctx.font = '9px monospace';
  ctx.fillStyle = '#6b4a2b';
  ctx.textAlign = 'center';
  ctx.fillText(fitFn('press any key to close', boxW - 20), bx + boxW * 0.5, by + boxH - 10);
  ctx.textAlign = 'left';
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !ctx) return;
  const n = nowFn();
  drawHatch(ctx, st, n);
  if (st.open) drawPanel(ctx, st, Vv);
}

if (typeof window !== 'undefined') {
  if (!window.GuildHatch) window.GuildHatch = createState();
  window.GuildHatch.update = update;
  window.GuildHatch.draw = draw;
  window.GuildHatch.__probe = function () {
    const st = getState();
    return { open: !!(st && st.open), entries: (st && st.entries) ? st.entries.slice() : [] };
  };
  if (!window.__ghListeners) {
    window.__ghListeners = true;
    window.addEventListener('keydown', onKeydown);
  }
}

export {};
