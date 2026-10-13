// worker_rain.js — rain ripple effects on the island floor
// Self-installing ES module; no imports; safe under `node --check`.

const GuildRain = {
  ripples: [],
  nextDrop: 0,
  __probe: function () {
    return { ripples: GuildRain.ripples.length };
  }
};

GuildRain.update = function (now) {
  if (typeof window === 'undefined') return;
  const V = window.V;
  if (typeof V === 'undefined' || V.gameState !== 'play' || V.weather !== 'RAIN') return;
  const iso = window.iso;
  if (typeof iso !== 'function') return;

  // Prune expired ripples (900 ms life)
  const LIFE = 900;
  for (let i = GuildRain.ripples.length - 1; i >= 0; i--) {
    if (now - GuildRain.ripples[i].t > LIFE) {
      GuildRain.ripples.splice(i, 1);
    }
  }

  // Spawn a new ripple every 120-260 ms
  if (now >= GuildRain.nextDrop) {
    const gx = Math.floor(Math.random() * 9) - 5; // -5..3
    const gy = Math.floor(Math.random() * 9) - 5; // -5..3
    const p = iso(gx + 0.5, gy + 0.5);
    if (typeof p === 'object' && p !== null && typeof p.y === 'number') {
      const canvas = window.HTMLCanvasElement ? null : null;
      const height = (typeof document !== 'undefined' && document.body) ? document.body.clientHeight : 0;
      if (p.y >= 120 && p.y <= height - 90) {
        GuildRain.ripples.push({ x: p.x, y: p.y, t: now });
        if (GuildRain.ripples.length > 24) {
          GuildRain.ripples.shift();
        }
      }
    }
    GuildRain.nextDrop = now + 120 + Math.random() * 140;
  }
};

GuildRain.draw = function (ctx) {
  if (typeof window === 'undefined') return;
  const V = window.V;
  if (typeof V === 'undefined' || V.gameState !== 'play' || V.weather !== 'RAIN') return;
  if (!ctx) return;

  const LIFE = 900;
  const ripples = GuildRain.ripples;
  for (let i = 0; i < ripples.length; i++) {
    const r = ripples[i];
    const age = (performance.now ? performance.now() : Date.now()) - r.t;
    if (age < 0 || age > LIFE) continue;
    const frac = age / LIFE;
    const radius = 2 + frac * 7; // 2..9
    const alpha = 0.5 * (1 - frac);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, radius, radius / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
};

if (typeof window !== 'undefined') {
  window.GuildRain = GuildRain;
}
