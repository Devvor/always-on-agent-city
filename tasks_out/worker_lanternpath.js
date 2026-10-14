const root = () => (typeof window !== 'undefined') ? window : null;
const getV = () => { const w = root(); return w && w.V; };
const getG = () => { const w = root(); if (!w || !w.GuildLanternPath) return null; return w.GuildLanternPath; };
function createState() { return { posts: [], _sig: null }; }
function nowFn() { return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }
function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}
function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ensurePosts(S, Vv) {
  if (!S || !Vv) return;
  const s = Math.floor(Number(Vv.growthStep) == null ? 0 : Number(Vv.growthStep));
  const ml = Math.floor(Number(Vv.mapLevel) == null ? 1 : Number(Vv.mapLevel));
  const sig = s * 1000 + ml;
  if (S.posts && S.posts.length === 5 && S._sig === sig) return;
  const props = [];
  props.push({ gx: -2, gy: 0 }, { gx: 0, gy: -2 }, { gx: 1, gy: 0 }, { gx: 0, gy: 1 });
  props.push({ gx: -1, gy: -1 }, { gx: 1, gy: -1 }, { gx: -1, gy: 1 }, { gx: 1, gy: 1 });
  props.push({ gx: 0, gy: -1 });
  if (ml >= 3) props.push({ gx: 1, gy: -1 });
  if (ml >= 5) props.push({ gx: -1, gy: 1 });
  if (ml >= 7) props.push({ gx: 1, gy: 0 });
  function clampIsland(gx, gy) {
    const minC = -2 - s;
    const maxC = 1 + s;
    let x = clamp(gx, minC, maxC);
    let y = clamp(gy, minC, maxC);
    let guard = 0;
    while (tileRing(x, y) > s && guard < 100) {
      if (x > 0) x -= 0.1;
      else if (x < 0) x += 0.1;
      if (y > 0) y -= 0.1;
      else if (y < 0) y += 0.1;
      x = clamp(x, minC, maxC);
      y = clamp(y, minC, maxC);
      guard++;
    }
    return { gx: x, gy: y };
  }
  const posts = [];
  const sx = 1.5, sy = 1.5;
  const ex = 5, ey = -2;
  let tc = 0.42;
  for (let i = 0; i < 5; i++) {
    let t = tc;
    let guard = 0;
    while (t <= 0.98 && guard < 500) {
      const gx = sx + (ex - sx) * t;
      const gy = sy + (ey - sy) * t;
      let ok = true;
      for (let p = 0; p < props.length; p++) {
        if (Math.hypot(gx - props[p].gx, gy - props[p].gy) < 2) { ok = false; break; }
      }
      if (ok) break;
      t += 0.02;
      guard++;
    }
    if (t > 0.98) t = 0.98;
    const gx = sx + (ex - sx) * t;
    const gy = sy + (ey - sy) * t;
    const cl = clampIsland(gx, gy);
    posts.push({ gx: cl.gx, gy: cl.gy, phase: (i + 1) * 1.17 + i * 0.43 });
    tc = t + 0.12;
  }
  S.posts = posts;
  S._sig = sig;
}
function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const S = getG();
  const Vv = getV();
  if (!S || !Vv) return;
  ensurePosts(S, Vv);
}
function drawPost(ctx, post, Vv, now) {
  if (!ctx || !post) return;
  const pt = isoFn(post.gx, post.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);
  ctx.fillStyle = '#475569';
  ctx.fillRect(x - 5, y + 2, 10, 3);
  ctx.fillRect(x - 2, y - 11, 4, 13);
  const night = Number(Vv && Vv.daylight) < 0.35;
  const rain = !!(Vv && String(Vv.weather) === 'RAIN');
  if (night) {
    let alpha = 0.10 + 0.12 * (0.5 + 0.5 * Math.sin(now * 0.002 + post.phase));
    if (rain) alpha = Math.min(0.44, alpha * 2);
    const radius = 26;
    if (typeof ctx.createRadialGradient === 'function' && typeof ctx.arc === 'function') {
      const g = ctx.createRadialGradient(x, y - 16, 1, x, y - 16, radius);
      g.addColorStop(0, 'rgba(251,191,36,' + alpha + ')');
      g.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 16, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - 4, y - 19, 8, 6);
  } else {
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 4, y - 19, 8, 6);
  }
}
function draw(ctx) {
  const S = getG();
  const Vv = getV();
  if (!S || !Vv || Vv.gameState !== 'play') return;
  const now = nowFn();
  const posts = (S.posts && Array.isArray(S.posts)) ? S.posts : [];
  for (let i = 0; i < posts.length; i++) {
    try { drawPost(ctx, posts[i], Vv, now); } catch (e) {}
  }
}
if (typeof window !== 'undefined') {
  if (!window.GuildLanternPath) window.GuildLanternPath = createState();
  window.GuildLanternPath.update = update;
  window.GuildLanternPath.draw = draw;
  window.GuildLanternPath.__probe = function () {
    const S = getG();
    return { posts: (S && S.posts && S.posts.length) ? S.posts.length : 0 };
  };
  window.GuildLanternPath.__rawUpdate = update;
}
export {};
