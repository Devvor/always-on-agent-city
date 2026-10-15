(function () {
  if (typeof window === 'undefined') return;

  function root() { return window; }
  function getV() { const w = root(); return w && w.V ? w.V : null; }
  function isoFn(gx, gy) {
    const w = root();
    if (w && typeof w.iso === 'function') return w.iso(gx, gy);
    const Vv = getV();
    const g = Vv && Vv.grid;
    if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
    return { x: 0, y: 0 };
  }
  function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
  function normKey(e) {
    if (!e) return '';
    if (e.key === ' ') return ' ';
    return String(e.key || '').toLowerCase();
  }

  function randRefillMs() {
    return (8 + Math.random() * 4) * 60000;
  }

  function createState() {
    return {
      pools: [
        { id: 0, gx: 1, gy: 6, cap: 1, shells: 1, refillDue: null },
        { id: 1, gx: 2, gy: 7, cap: 2, shells: 2, refillDue: null },
        { id: 2, gx: 3, gy: 6, cap: 1, shells: 1, refillDue: null }
      ],
      floaters: [],
      eHeld: false,
      lastNow: null
    };
  }

  const STATE = (typeof window.GuildTidepools !== 'undefined' && window.GuildTidepools)
    ? window.GuildTidepools
    : createState();

  function getState() { return STATE; }

  function update(now) {
    try {
      if (typeof now !== 'number') now = nowFn();
      const s = getState();
      const Vv = getV();
      if (!s || !Array.isArray(s.pools)) return;
      if (s.lastNow === null) s.lastNow = now;
      s.lastNow = now;
      if (!Vv || Vv.gameState !== 'play') return;

      for (let i = 0; i < s.pools.length; i++) {
        const p = s.pools[i];
        if (!p) continue;
        if (p.shells < p.cap && p.refillDue == null) p.refillDue = now + randRefillMs();
        if (p.shells < p.cap && p.refillDue != null && now >= p.refillDue) {
          p.shells = Math.min(p.cap, p.shells + 1);
          if (p.shells < p.cap) p.refillDue = now + randRefillMs();
          else p.refillDue = null;
        }
      }

      const kept = [];
      for (let i = 0; i < s.floaters.length; i++) {
        const f = s.floaters[i];
        f.t = (now - f.born) / 1000;
        if (!isFinite(f.t) || f.t < 0 || f.t >= f.life) continue;
        kept.push(f);
      }
      s.floaters = kept;
    } catch (e) {}
  }

  function tryOpen(gx, gy) {
    try {
      const s = getState();
      if (!s || !Array.isArray(s.pools) || !s.pools.length) return false;
      let x = gx;
      let y = gy;
      if (!isFinite(x) || !isFinite(y)) {
        const gv = window.GuildVisitor;
        if (gv && isFinite(gv.gx) && isFinite(gv.gy)) {
          x = gv.gx;
          y = gv.gy;
        } else {
          return false;
        }
      }
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < s.pools.length; i++) {
        const p = s.pools[i];
        if (!p || !p.shells || p.shells <= 0) continue;
        const d = Math.hypot(p.gx - x, p.gy - y);
        if (d <= 1.05 && d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      if (best < 0) return false;
      const p = s.pools[best];
      const amount = p.shells > 0 ? p.shells : 1;
      p.shells = 0;
      if (p.refillDue == null) p.refillDue = nowFn() + randRefillMs();

      const Vv = getV();
      if (Vv && Object.prototype.hasOwnProperty.call(Vv, 'purse') && typeof Vv.purse === 'number') {
        Vv.purse += amount;
      } else {
        s.floaters.push({
          gx: p.gx,
          gy: p.gy,
          amount: amount,
          born: nowFn(),
          life: 1.4
        });
      }
      if (typeof window.cue === 'function') {
        try { window.cue('gold'); } catch (e) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function drawPool(ctx, pool, now) {
    try {
      const center = isoFn(pool.gx, pool.gy);
      const x = Math.round(center.x);
      const y = Math.round(center.y);
      const tw = 8;
      ctx.fillStyle = 'rgba(70,110,138,0.72)';
      ctx.fillRect(x - tw, y - 4, tw * 2, 8);
      ctx.fillStyle = 'rgba(120,175,205,0.42)';
      ctx.fillRect(x - tw + 1, y - 3, tw * 2 - 2, 3);

      if (pool.shells > 0) {
        for (let i = 0; i < pool.shells; i++) {
          const offX = (i === 0 ? -3 : 3);
          const glint = Math.sin(now * 0.004 + pool.id + i) > 0.82 ? 1 : 0;
          ctx.fillStyle = '#d4af37';
          ctx.fillRect(x + offX - 2, y - 2, 4, 3);
          ctx.fillStyle = '#8b6a18';
          ctx.fillRect(x + offX - 2, y + 1, 4, 1);
          if (glint) {
            ctx.fillStyle = '#f7e7a8';
            ctx.fillRect(x + offX, y - 1, 1, 1);
          }
        }
      } else {
        const phase = ((now % 1800) / 1800);
        const r = 3 + phase * 5;
        const a = 0.45 * (1 - phase);
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    } catch (e) {}
  }

  function drawFloaters(ctx, now) {
    try {
      const s = getState();
      if (!s || !Array.isArray(s.floaters)) return;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < s.floaters.length; i++) {
        const f = s.floaters[i];
        const age = f.t != null ? f.t : (now - f.born) / 1000;
        if (!isFinite(age) || age < 0 || age >= f.life) continue;
        const pos = isoFn(f.gx, f.gy);
        const x = Math.round(pos.x);
        const y = Math.round(pos.y - 12 - age * 24);
        const alpha = Math.max(0, 1 - age / f.life);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#d4af37';
        ctx.fillText('+' + f.amount, x, y);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left';
    } catch (e) {}
  }

  function draw(ctx) {
    try {
      if (!ctx) return;
      const Vv = getV();
      if (!Vv || Vv.gameState !== 'play') return;
      if (!(Vv.daylight > 0.4)) return;
      const now = nowFn();
      const s = getState();
      if (!s || !Array.isArray(s.pools)) return;
      for (let i = 0; i < s.pools.length; i++) {
        const p = s.pools[i];
        if (p) drawPool(ctx, p, performanceNow(now));
      }
      drawFloaters(ctx, now);
    } catch (e) {}
  }

  function performanceNow(now) {
    return typeof now === 'number' ? now : nowFn();
  }

  function __probe() {
    try {
      const s = getState();
      const count = (s && Array.isArray(s.pools))
        ? s.pools.reduce(function (sum, p) { return sum + (p && isFinite(p.shells) ? p.shells : 0); }, 0)
        : 0;
      return { pools: s && Array.isArray(s.pools) ? s.pools.length : 0, shellsOpen: count };
    } catch (e) {
      return { pools: 0, shellsOpen: 0 };
    }
  }

  function onKeydown(e) {
    try {
      const k = normKey(e);
      if (k !== 'e' && k !== ' ') return;
      const s = getState();
      if (!s) return;
      if (s.eHeld) return;
      s.eHeld = true;
      const Vv = getV();
      const vis = (typeof window.GuildVisitor !== 'undefined') ? window.GuildVisitor : null;
      let gx, gy;
      if (vis && isFinite(vis.gx) && isFinite(vis.gy)) {
        gx = vis.gx;
        gy = vis.gy;
      }
      tryOpen(gx, gy);
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
    } catch (e) {}
  }

  function onKeyup(e) {
    try {
      const k = normKey(e);
      if (k !== 'e' && k !== ' ') return;
      const s = getState();
      if (s) s.eHeld = false;
    } catch (e) {}
  }

  if (!window.GuildTidepools) window.GuildTidepools = STATE;
  const G = window.GuildTidepools;
  G.update = update;
  G.draw = draw;
  G.tryOpen = tryOpen;
  G.__probe = __probe;

  if (!window.__gtListeners) {
    window.__gtListeners = true;
    try {
      window.addEventListener('keydown', onKeydown);
      window.addEventListener('keyup', onKeyup);
    } catch (e) {}
  }
})();

export {};
