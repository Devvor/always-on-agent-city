const AVIARY_ZONE = (typeof window !== 'undefined' && window.GuildZones && window.GuildZones.AVIARY) || { gx: -6, gy: -12 };  // LAYOUT.md AVIARY ROOSTS district
const NEST_POSITIONS = [{gx: AVIARY_ZONE.gx - 1, gy: AVIARY_ZONE.gy}, {gx: AVIARY_ZONE.gx, gy: AVIARY_ZONE.gy - 1}, {gx: AVIARY_ZONE.gx - 2, gy: AVIARY_ZONE.gy}];
const PERCH = {gx: AVIARY_ZONE.gx + 1, gy: AVIARY_ZONE.gy + 1};

let nests = [];
let pigeon = null;

function createState() {
  nests = NEST_POSITIONS.map(function (p, i) {
    return {
      gx: p.gx,
      gy: p.gy,
      index: i,
      bird: { state: 'sleeping', triggered: false, stirUntil: 0 }
    };
  });
  pigeon = { state: 'away', gx: AVIARY_ZONE.gx - 2, gy: AVIARY_ZONE.gy - 2, peckCount: 0, peckPhase: 0 };
  return {
    nests: nests,
    pigeon: pigeon,
    pigeonState: pigeon.state,
    update: update,
    draw: draw,
    __probe: probe
  };
}

function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function getV() {
  const w = root();
  return w && w.V;
}

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

function getState() {
  const w = root();
  return w && w.GuildAviary;
}

function createPigeon() {
  return { state: 'away', gx: AVIARY_ZONE.gx - 2, gy: AVIARY_ZONE.gy - 2, peckCount: 0, peckPhase: 0 };
}

function updatePigeon(pg, now) {
  if (!pg) return;
  const cycle = ((now % 40000) + 40000) % 40000;
  const t = cycle / 1000;
  const start = {gx: AVIARY_ZONE.gx - 2, gy: AVIARY_ZONE.gy - 2};
  const land = {gx: AVIARY_ZONE.gx + 1, gy: AVIARY_ZONE.gy + 1.3};
  if (t < 30) {
    pg.state = 'away';
    pg.gx = start.gx;
    pg.gy = start.gy;
    pg.peckCount = 0;
    pg.peckPhase = 0;
  } else if (t < 31) {
    const p = t - 30;
    pg.state = 'arriving';
    pg.gx = start.gx + (land.gx - start.gx) * p;
    pg.gy = start.gy + (land.gy - start.gy) * p;
    pg.peckCount = 0;
    pg.peckPhase = 0;
  } else if (t < 35) {
    const local = t - 31;
    pg.state = 'pecking';
    pg.peckCount = Math.min(5, Math.floor(local / 0.8) + 1);
    pg.peckPhase = (local % 0.8) / 0.8;
    pg.gx = land.gx;
    pg.gy = land.gy;
  } else if (t < 36) {
    const p = t - 35;
    pg.state = 'leaving';
    pg.gx = land.gx + (start.gx - land.gx) * p;
    pg.gy = land.gy + (start.gy - land.gy) * p;
    pg.peckCount = 5;
    pg.peckPhase = 0;
  } else {
    pg.state = 'away';
    pg.gx = start.gx;
    pg.gy = start.gy;
    pg.peckCount = 0;
    pg.peckPhase = 0;
  }
}

function probe() {
  const st = getState();
  const ns = (st && Array.isArray(st.nests)) ? st.nests : nests;
  const pg = (st && st.pigeon) ? st.pigeon : pigeon;
  return {
    nests: ns,
    pigeonState: String(pg && pg.state != null ? pg.state : 'away')
  };
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  if (!st) return;
  if (!Array.isArray(st.nests)) st.nests = nests.length ? nests : (nests = NEST_POSITIONS.map(function (p, i) {
    return { gx: p.gx, gy: p.gy, index: i, bird: { state: 'sleeping', triggered: false, stirUntil: 0 } };
  }));
  nests = st.nests;
  if (!st.pigeon || typeof st.pigeon !== 'object') st.pigeon = pigeon || createPigeon();
  pigeon = st.pigeon;

  const Vv = getV();
  let visitor = null;
  const w = root();
  if (Vv && Vv.gameState === 'play' && w && w.GuildVisitor) {
    const gv = w.GuildVisitor;
    if (gv && isFinite(gv.gx) && isFinite(gv.gy)) visitor = gv;
  }

  for (let i = 0; i < nests.length; i++) {
    const nest = nests[i];
    if (!nest || !nest.bird) continue;
    const close = !!(visitor && Math.hypot(nest.gx - visitor.gx, nest.gy - visitor.gy) <= 1.5);
    const bird = nest.bird;
    if (close && !bird.triggered) {
      bird.triggered = true;
      bird.stirUntil = now + 900;
      try {
        if (w && typeof w.cue === 'function') w.cue('chirp');
      } catch (e) {}
    }
    if (!close) bird.triggered = false;
    bird.state = (close || now < bird.stirUntil) ? 'stirred' : 'sleeping';
  }

  updatePigeon(pigeon, now);
  st.pigeonState = String(pigeon.state);
}

function draw(ctx) {
  const st = getState();
  if (!ctx || !st) return;
  const Vv = getV();
  const hasIso = (root() && typeof root().iso === 'function') || (Vv && Vv.grid);
  if (!hasIso) return;

  nests = (Array.isArray(st.nests) ? st.nests : nests);
  pigeon = (st.pigeon && typeof st.pigeon === 'object') ? st.pigeon : pigeon;
  const now = nowFn();

  for (let i = 0; i < nests.length; i++) {
    const nest = nests[i];
    if (!nest) continue;
    const pt = isoFn(nest.gx, nest.gy);
    const x = Math.round(pt.x);
    const y = Math.round(pt.y);
    const bird = nest.bird || {state: 'sleeping'};

    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(x - 4, y + 1, 8, 2);

    ctx.fillStyle = '#5a3f25';
    ctx.fillRect(x - 1, y - 9, 2, 10);

    ctx.fillStyle = '#6b4a2d';
    ctx.fillRect(x - 5, y - 13, 10, 5);
    ctx.fillStyle = '#4b321f';
    ctx.fillRect(x - 4, y - 14, 8, 1);
    ctx.fillRect(x - 5, y - 12, 2, 1);
    ctx.fillRect(x + 3, y - 12, 2, 1);

    if (bird.state === 'stirred') {
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(x - 1, y - 19, 3, 2);
      ctx.fillRect(x - 2, y - 18, 1, 1);
      ctx.fillRect(x + 2, y - 18, 1, 1);
      if (now < (nest.bird && nest.bird.stirUntil ? nest.bird.stirUntil : 0)) {
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(x + 4, y - 21, 1, 1);
        ctx.fillRect(x - 5, y - 20, 1, 1);
      }
    } else {
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(x - 1, y - 17, 3, 2);
      ctx.fillRect(x, y - 18, 2, 1);
    }
  }

  const pPt = isoFn(PERCH.gx, PERCH.gy);
  const px = Math.round(pPt.x);
  const py = Math.round(pPt.y);

  ctx.fillStyle = '#4b3320';
  ctx.fillRect(px - 14, py - 22, 28, 3);

  ctx.fillStyle = '#8b643f';
  ctx.fillRect(px - 1, py - 21, 2, 12);

  ctx.fillStyle = '#6b5a45';
  ctx.fillRect(px - 4, py - 10, 8, 7);
  ctx.fillStyle = '#4b3e2f';
  ctx.fillRect(px - 3, py - 9, 6, 5);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(px - 1, py - 9, 2, 2);

  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(px - 10, py - 4, 20, 2);

  if (pigeon && pigeon.state !== 'away') {
    const bPt = isoFn(pigeon.gx, pigeon.gy);
    let bx = Math.round(bPt.x);
    let by = Math.round(bPt.y);
    if (pigeon.state === 'pecking') by += Math.round(Math.sin(pigeon.peckPhase * Math.PI) * 4);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(bx - 1, by - 4, 3, 2);
    ctx.fillRect(bx + 1, by - 5, 1, 1);
  }

  st.pigeonState = String(pigeon && pigeon.state != null ? pigeon.state : 'away');
}

if (typeof window !== 'undefined') {
  if (!window.GuildAviary) window.GuildAviary = createState();
  window.GuildAviary.update = update;
  window.GuildAviary.draw = draw;
  window.GuildAviary.__probe = probe;
}

export {};
