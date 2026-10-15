const STATE_DEFAULTS = { gx: -5, gy: 3, moving: false, facing: 'up', nearPlaque: false, era: 'early builds', nearStartedAt: null, nextCueAt: null, lastCueAt: null, caption: null, captionUntil: 0, glintUntil: 0 };

function createState() {
  return Object.assign({}, STATE_DEFAULTS);
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
function getState() { const w = root(); return w && w.GuildAudioguide; }
function visitorFn() { const w = root(); return w && w.GuildVisitor; }

function allTaskCount(Vv) { return (Vv && Array.isArray(Vv.allTasks)) ? Vv.allTasks.length : 0; }
function eraKeyFor(Vv) {
  const n = allTaskCount(Vv);
  if (n <= 20) return 'early';
  if (n <= 40) return 'building';
  return 'current';
}
function eraLabelFor(key) {
  if (key === 'early') return 'early builds';
  if (key === 'building') return 'building-out';
  return 'current';
}

function isNearPlaque(st) {
  const v = visitorFn();
  if (!v || !st || !isFinite(v.gx) || !isFinite(v.gy)) return false;
  const dx = Number(v.gx) - Number(st.gx);
  const dy = Number(v.gy) - Number(st.gy);
  return Math.hypot(dx, dy) <= 3;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;

  st.nearPlaque = isNearPlaque(st);
  st.era = Vv ? eraLabelFor(eraKeyFor(Vv)) : st.era;

  if (!Vv || Vv.gameState !== 'play') {
    st.nearStartedAt = null;
    st.nextCueAt = null;
    return;
  }

  if (st.nearPlaque) {
    if (st.nearStartedAt === null) {
      st.nearStartedAt = now;
      st.nextCueAt = now + 10000;
    }
    if (st.nextCueAt !== null && now >= st.nextCueAt) {
      const mayCue = (st.lastCueAt === null) || (now - st.lastCueAt >= 8000);
      if (mayCue) {
        const key = eraKeyFor(Vv);
        st.lastCueAt = now;
        st.era = eraLabelFor(key);
        st.caption = st.era;
        st.captionUntil = now + 2200;
        st.glintUntil = now + 700;
        try {
          const w = root();
          if (w && typeof w.cue === 'function') w.cue('audioguide-' + key);
        } catch (e) {}
      }
      st.nextCueAt = Math.max(st.nextCueAt + 10000, now + 10000);
    }
  } else {
    st.nearStartedAt = null;
    st.nextCueAt = null;
  }
}

function draw(ctx) {
  if (!ctx) return;
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const now = nowFn();
  const pt = isoFn(st.gx, st.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x - 5, y - 1, 10, 4);
  ctx.fillStyle = '#6b4a2d';
  ctx.fillRect(x - 2, y - 25, 4, 24);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 3, y - 31, 6, 6);
  ctx.fillStyle = '#4b321f';
  ctx.fillRect(x - 1, y - 25, 2, 3);

  if (now < st.glintUntil) {
    const start = st.glintUntil - 700;
    const alpha = Math.max(0, 1 - ((now - start) / 700));
    if (alpha > 0) {
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(x - 1, y - 34, 2, 2);
      ctx.fillRect(x + 2, y - 37, 2, 2);
      ctx.fillRect(x - 3, y - 36, 2, 2);
      ctx.globalAlpha = 1;
    }
  }

  if (st.caption && now < st.captionUntil) {
    const alpha = Math.max(0, 1 - ((now - (st.captionUntil - 2200)) / 2200) * 0.35);
    const shown = fitFn(String(st.caption), 92);
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText ? ctx.measureText(shown).width : (shown.length * 6);
    const bw = Math.max(44, Math.round(tw + 10));
    const bh = 13;
    const bx = Math.round(x - bw * 0.5);
    const by = y - 46;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(10,10,12,0.90)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#f3d37a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shown, bx + bw * 0.5, by + bh * 0.5 + 1);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildAudioguide) window.GuildAudioguide = createState();
  window.GuildAudioguide.update = update;
  window.GuildAudioguide.draw = draw;
  window.GuildAudioguide.__probe = function () {
    const st = getState();
    return {
      nearPlaque: !!(st && st.nearPlaque),
      era: String(st && st.era ? st.era : 'early builds')
    };
  };
  window.GuildAudioguide.__rawUpdate = update;
}

export {};
