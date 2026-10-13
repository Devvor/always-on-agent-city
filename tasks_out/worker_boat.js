// worker_boat.js — periodic SKY-BOAT COURIER event for the 2D guild client
(function () {
  'use strict';

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

  function createState() {
    return {
      phase: 'idle',
      t: 0,
      boatX: 0,
      courier: { x: 0, y: 0, frame: 0, walkTimer: 0, facing: 'down', state: 'idle' },
      delivery: null,
      dockX: 0,
      dockY: 0,
      idleTimer: 20 + Math.random() * 5,
      approachStart: 0,
      departStart: 0,
      ladderProgress: 0,
      courierProgress: 0,
      holdStart: 0,
      propellerFrame: 0,
      propellerTimer: 0,
      startPos: { x: 0, y: 0 }
    };
  }

  function latestTick() {
    const Vv = getV();
    const metas = Array.isArray(Vv && Vv.workers) ? Vv.workers : [];
    const meta = metas[0] || {};
    const ticks = Array.isArray(meta.recent_ticks) ? meta.recent_ticks : (Array.isArray(meta.recentTicks) ? meta.recentTicks : []);
    if (!ticks.length) return 'A courier hands you a fresh dispatch.';
    const last = ticks[ticks.length - 1];
    let line = '';
    if (typeof last === 'string') line = last;
    else if (last && typeof last === 'object') {
      line = last.message || last.text || last.msg || last.line || last.event || last.status || '';
    }
    line = String(line == null ? '' : line).trim();
    if (line.length > 80) line = line.slice(0, 80);
    return line || 'A courier hands you a fresh dispatch.';
  }

  function worker0Pos() {
    const Vv = getV();
    const ws = Array.isArray(Vv && Vv.workerStates) ? Vv.workerStates : [];
    const w0 = ws[0] || {};
    return { x: w0.x || 0, y: w0.y || 0 };
  }

  function update(now) {
    const st = getState();
    if (!st) return;
    const Vv = getV();
    if (!Vv || Vv.gameState !== 'play') return;
    if (typeof now !== 'number') now = nowFn();

    const dt = (st._last === null || st._last === undefined) ? 0 : (now - st._last) / 1000;
    st._last = now;
    if (!isFinite(dt) || dt < 0) { st._last = now; return; }
    const capped = Math.min(dt, 0.12);

    st.propellerTimer += capped;
    if (st.propellerTimer >= 0.15) {
      st.propellerFrame = (st.propellerFrame + 1) % 2;
      st.propellerTimer -= 0.15;
    }

    if (st.phase === 'idle') {
      st.idleTimer -= capped;
      if (st.idleTimer <= 0) {
        const dock = isoFn(6.5, -1.5);
        st.dockX = Math.round(dock.x);
        st.dockY = Math.round(dock.y);
        st.phase = 'approach';
        st.approachStart = now;
        st.boatX = -120;
        st.startPos = { x: -120, y: st.dockY };
        st.courier.state = 'idle';
        st.courierProgress = 0;
        st.ladderProgress = 0;
        st.delivery = null;
      }
      return;
    }

    if (st.phase === 'approach') {
      const elapsed = (now - st.approachStart) / 1000;
      const dur = 4;
      let p = elapsed / dur;
      if (p >= 1) {
        p = 1;
        st.phase = 'docked';
        cue('alert');
        st.dockedStart = now;
        st.courier.state = 'descend';
        st.courierProgress = 0;
        st.ladderProgress = 0;
      }
      const eased = 1 - Math.pow(1 - p, 3);
      st.boatX = st.startPos.x + (st.dockX - st.startPos.x) * eased;
      return;
    }

    if (st.phase === 'docked') {
      if (st.courier.state === 'descend') {
        st.ladderProgress += capped / 1.2;
        if (st.ladderProgress >= 1) {
          st.ladderProgress = 1;
          st.courier.state = 'walk';
          st.courierProgress = 0;
        }
      } else if (st.courier.state === 'walk') {
        const target = worker0Pos();
        const dx = target.x - st.dockX;
        const dy = target.y - st.dockY;
        const dist = Math.hypot(dx, dy);
        const speed = 48;
        const moveDist = speed * capped;
        if (dist <= 24 || st.courierProgress >= 1) {
          st.courierProgress = 1;
          st.courier.x = target.x - 12;
          st.courier.y = target.y;
          st.courier.state = 'deliver';
          st.delivery = { text: latestTick(), start: now };
          st.holdStart = now;
        } else {
          const ratio = Math.min(1, moveDist / dist);
          st.courierProgress += ratio;
          st.courier.x = st.dockX + dx * st.courierProgress;
          st.courier.y = st.dockY + dy * st.courierProgress;
        }
      } else if (st.courier.state === 'deliver') {
        if (now - st.holdStart >= 6000) {
          st.courier.state = 'return';
          st.courierProgress = 0;
        }
      } else if (st.courier.state === 'return') {
        const dx = st.dockX - st.courier.x;
        const dy = st.dockY - st.courier.y;
        const dist = Math.hypot(dx, dy);
        const speed = 60;
        const moveDist = speed * capped;
        if (dist <= 4) {
          st.courier.state = 'climb';
          st.courierProgress = 0;
          st.ladderProgress = 1;
        } else {
          const ratio = Math.min(1, moveDist / dist);
          st.courierProgress += ratio;
          st.courier.x = st.courier.x + dx * ratio;
          st.courier.y = st.courier.y + dy * ratio;
        }
      } else if (st.courier.state === 'climb') {
        st.ladderProgress -= capped / 1.0;
        if (st.ladderProgress <= 0) {
          st.ladderProgress = 0;
          st.phase = 'depart';
          st.departStart = now;
          st.boatX = st.dockX;
        }
      }
      return;
    }

    if (st.phase === 'depart') {
      const elapsed = (now - st.departStart) / 1000;
      const dur = 3;
      let p = elapsed / dur;
      if (p >= 1) {
        p = 1;
        st.phase = 'idle';
        st.idleTimer = 20 + Math.random() * 10;
        st._last = now;
      }
      const eased = Math.pow(p, 2);
      st.boatX = st.dockX + (st.dockX + 120) * eased;
      return;
    }
  }

  function draw(ctx) {
    const st = getState();
    if (!st) return;
    const Vv = getV();
    if (!Vv || Vv.gameState !== 'play') return;
    if (!ctx) return;
    const c = (ctx.canvas) ? ctx.canvas : (Vv && Vv.canvas);
    if (!c) return;

    if (st.phase === 'idle' || st.phase === 'approach' || st.phase === 'docked' || st.phase === 'depart') {
      drawBoat(ctx, st, c);
    }
  }

  function drawBoat(ctx, st, c) {
    const bx = Math.round(st.boatX);
    const by = Math.round(st.dockY);

    ctx.fillStyle = '#3b3358';
    ctx.fillRect(bx - 28, by - 10, 56, 14);
    ctx.fillRect(bx - 20, by - 18, 40, 8);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(bx - 28, by - 10, 56, 2);
    ctx.fillRect(bx - 20, by - 18, 40, 2);
    ctx.fillRect(bx - 2, by - 22, 4, 4);

    ctx.fillStyle = '#d4af37';
    const pf = st.propellerFrame;
    if (pf === 0) {
      ctx.fillRect(bx - 30, by - 4, 6, 4);
      ctx.fillRect(bx - 30, by + 2, 6, 4);
    } else {
      ctx.fillRect(bx - 32, by - 3, 8, 4);
      ctx.fillRect(bx - 32, by + 1, 8, 4);
    }

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 28, by - 10);
    ctx.lineTo(bx - 28, by + 4);
    ctx.stroke();

    ctx.fillStyle = '#5a4a78';
    ctx.fillRect(bx + 20, by - 16, 10, 6);
    ctx.strokeStyle = '#d4af37';
    ctx.strokeRect(bx + 20, by - 16, 10, 6);

    if (st.phase === 'docked' || st.phase === 'approach' || st.phase === 'depart') {
      drawLadder(ctx, st);
    }

    if (st.phase === 'docked') {
      drawCourier(ctx, st);
    }

    if (st.delivery) {
      drawBubble(ctx, st, c);
    }
  }

  function drawLadder(ctx, st) {
    const px = Math.round(st.dockX);
    const topY = Math.round(st.dockY - 10);
    const bottomY = Math.round(st.dockY + 20);
    const prog = st.ladderProgress;
    const len = (bottomY - topY) * prog;
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, topY);
    ctx.lineTo(px, topY + len);
    ctx.stroke();
    const rungCount = 6;
    for (let i = 1; i <= rungCount; i++) {
      const ry = topY + (len * i / rungCount);
      if (ry > topY + len) continue;
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px - 6, ry);
      ctx.lineTo(px + 6, ry);
      ctx.stroke();
    }
  }

  function drawCourier(ctx, st) {
    const cx = Math.round(st.courier.x);
    const cy = Math.round(st.courier.y);
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(cx - 4, cy - 10, 8, 12);
    ctx.fillRect(cx - 6, cy - 2, 12, 4);
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(cx - 3, cy - 8, 6, 4);
    ctx.fillStyle = '#3b3358';
    ctx.fillRect(cx - 4, cy + 2, 8, 6);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(cx - 2, cy - 6, 4, 2);
  }

  function drawBubble(ctx, st, c) {
    const d = st.delivery;
    if (!d) return;
    const text = String(d.text || '');
    const maxW = Math.min(c.width - 40, 420);
    const maxH = 72;
    ctx.font = 'bold 10px monospace';
    const lines = wrapText(ctx, text, maxW - 16);
    const boxW = maxW;
    const boxH = Math.min(maxH, lines.length * 14 + 16);
    const bx = Math.round((c.width - boxW) * 0.5);
    const by = Math.round(c.height - boxH - 20);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, boxW, boxH);
    ctx.clip();

    ctx.fillStyle = 'rgba(10,10,12,0.90)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#e8e6df';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + 8, by + 8 + i * 14);
    }
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text == null ? '' : text).split(/\s+/);
    const lines = [];
    let current = '';
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;
      const test = current ? (current + ' ' + word) : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function getState() { const w = root(); return w && w.GuildBoat; }

  if (typeof window !== 'undefined') {
    if (!window.GuildBoat) window.GuildBoat = createState();
    window.GuildBoat.update = update;
    window.GuildBoat.draw = draw;
    window.GuildBoat.__probe = function () {
      const st = getState();
      return { phase: st ? st.phase : 'idle', delivery: st ? st.delivery : null };
    };
  }
})();
