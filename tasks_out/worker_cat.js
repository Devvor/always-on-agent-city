worker_cat.js
```javascript
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
function getState() { const w = root(); return w && w.GuildVisitor; }

function tileRing(gx, gy) {
  function coordLayer(v) {
    if (v >= -2 && v <= 1) return 0;
    if (v < -2) return -2 - v;
    return v - 1;
  }
  return Math.max(coordLayer(gx), coordLayer(gy));
}

function isBuildingTile(gx, gy) {
  const rx = Math.round(gx);
  const ry = Math.round(gy);
  for (let i = 0; i < BUILDINGS.length; i++) {
    if (rx === BUILDINGS[i].gx && ry === BUILDINGS[i].gy) return true;
  }
  return false;
}

function tileDistance(sx, sy, vx, vy, g) {
  if (!g) return Infinity;
  const dx = sx - vx;
  const dy = sy - vy;
  const dgx = dx / g.tileW + dy / g.tileH;
  const dgy = dy / g.tileH - dx / g.tileW;
  return Math.hypot(dgx, dgy);
}

function createState() {
  return { gx: 1.8, gy: 3.6, state: 'sleep', stateT: 0, petCount: 0, cooldown: 0, hearts: [], bubble: null, lastBreath: 0 };
}

let ePressedFlag = false;
let eListenerAttached = false;

function onKeydownE(e) {
  if (!e) return;
  const k = String(e.key || '').toLowerCase();
  if (k === 'e') {
    ePressedFlag = true;
  }
}

function attachEListener() {
  if (eListenerAttached) return;
  eListenerAttached = true;
  const w = root();
  if (w && typeof w.addEventListener === 'function') {
    w.addEventListener('keydown', onKeydownE);
  }
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const cat = root() && root().GuildCat;
  if (!cat) return;
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') return;

  attachEListener();

  const dt = (cat.lastBreath === 0) ? 0 : (now - cat.lastBreath) / 1000;
  cat.lastBreath = now;
  let safeDt = dt;
  if (!isFinite(safeDt) || safeDt < 0) safeDt = 0;
  if (safeDt > 0.12) safeDt = 0.12;

  if (cat.cooldown > 0) cat.cooldown = Math.max(0, cat.cooldown - safeDt);

  const vis = getState();
  let dist = Infinity;
  if (vis && Vv.grid) {
    dist = tileDistance(cat.gx, cat.gy, vis.gx, vis.gy, Vv.grid);
  }

  if (cat.state === 'petted') {
    if (cat.bubble && (now - cat.bubble.start) >= 2000) cat.bubble = null;
    if (cat.stateT > 0) {
      cat.stateT = Math.max(0, cat.stateT - safeDt);
    } else {
      cat.state = 'sleep';
      cat.stateT = 0;
    }
  } else if (cat.state === 'alert') {
    if (dist > 1.5 || !vis) {
      cat.state = 'sleep';
      cat.stateT = 0;
    }
  } else {
    if (vis && dist <= 1.5) {
      cat.state = 'alert';
      cat.stateT = 0;
    }
  }

  if (cat.state === 'sleep') {
    cat.stateT += safeDt;
  }

  if (cat.cooldown <= 0 && vis && dist <= 1.2 && ePressedFlag) {
    ePressedFlag = false;
    cat.state = 'petted';
    cat.stateT = 2.5;
    cat.cooldown = 4;
    cat.petCount += 1;
    cat.bubble = { text: 'prrrrr...', start: now };
    for (let i = 0; i < 5; i++) {
      cat.hearts.push({ x: 0, y: 0, life: 1.2, age: 0, drift: (i - 2) * 0.3 });
    }
    const w = root();
    if (w && typeof w.cue === 'function') {
      try { w.cue('meow'); } catch (e) {}
    }
  }
  ePressedFlag = false;

  const nextHearts = [];
  for (let i = 0; i < cat.hearts.length; i++) {
    const h = cat.hearts[i];
    h.age += safeDt;
    if (h.age >= h.life) continue;
    nextHearts.push(h);
  }
  cat.hearts = nextHearts;
}

function drawCat(ctx, cat, Vv, now) {
  if (!ctx || !cat) return;
  const pt = isoFn(cat.gx, cat.gy);
  const x = Math.round(pt.x);
  const y = Math.round(pt.y);

  const breath = 1 + Math.sin(now * 0.002) * 0.04;
  const scale = (cat.state === 'sleep') ? breath : 1;
  const tailFlick = Math.sin(now * 0.0013 + 1.7) > 0.93;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-8, 14, 20, 4);

  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(-7, -8, 14, 10);

  ctx.fillStyle = '#d4af37';
  ctx.fillRect(-6, -6, 12, 3);

  ctx.fillStyle = '#6b7280';
  ctx.fillRect(-7, -8, 3, 5);
  ctx.fillRect(4, -8, 3, 5);

  if (cat.state === 'alert') {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-6, -10, 3, 3);
    ctx.fillRect(3, -10, 3, 3);
    ctx.fillStyle = '#111827';
    ctx.fillRect(-4, -5, 2, 2);
    ctx.fillRect(2, -5, 2, 2);
  } else {
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-5, -6, 3, 1);
    ctx.fillRect(2, -6, 3, 1);
  }

  ctx.fillStyle = '#6b7280';
  if (tailFlick) {
    ctx.fillRect(6, -2, 5, 2);
    ctx.fillRect(10, -3, 3, 2);
  } else {
    ctx.fillRect(6, -1, 4, 2);
  }

  ctx.restore();

  for (let i = 0; i < cat.hearts.length; i++) {
    const h = cat.hearts[i];
    const lifeRatio = Math.max(0, 1 - (h.age / h.life));
    const hx = x + 4 + Math.round(h.drift * 3);
    const hy = y - 10 - Math.round((h.age / h.life) * 20);
    ctx.fillStyle = 'rgba(248,113,113,' + lifeRatio + ')';
    ctx.fillRect(hx, hy, 3, 3);
    ctx.fillRect(hx + 3, hy, 3, 3);
    ctx.fillRect(hx + 1, hy - 2, 3, 3);
    ctx.fillRect(hx + 1, hy + 2, 3, 3);
  }

  if (cat.bubble) {
    const text = cat.bubble.text || '';
    const shown = fitFn(text, 120);
    const tw = ctx.measureText(shown).width;
    const bw = Math.round(tw) + 10;
    const bh = 14;
    const bx = x - Math.round(bw * 0.5);
    const by = y - 34;
    ctx.fillStyle = 'rgba(10,10,12,0.88)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(shown, bx + bw * 0.5, by + bh * 0.5);
    ctx.textAlign = 'left';
  }
}

function draw(ctx) {
  const w = root();
  if (!w) return;
  const cat = w.GuildCat;
  const Vv = getV();
  if (!cat || !Vv || Vv.gameState !== 'play') return;
  const n = nowFn();
  drawCat(ctx, cat, Vv, n);
}

if (typeof window !== 'undefined') {
  if (!window.GuildCat) window.GuildCat = createState();
  window.GuildCat.update = update;
  window.GuildCat.draw = draw;
  window.GuildCat.__probe = function () {
    const cat = window.GuildCat;
    return { state: cat.state, petCount: cat.petCount, hearts: cat.hearts.length };
  };
}

export {};
```
