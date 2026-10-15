const CYCLE = 14000;
const FADE_IN = 300;
const HOLD = 5000;
const FADE_OUT = 300;
const VISIBLE = FADE_IN + HOLD + FADE_OUT;
const MAX_CHIPS = 5;
const CHIP_MAX_W = 90;
const CHIP_H = 15;
const CHIP_LIFT = 22;
const NAMEPLATE_TOP = 35;

const DEFAULT_CLS = { pict: 'gear', verb: 'CRAFTING', alt: 'PLYING THE TRADE' };

const PICT = {
  hammer: ['111100', '111100', '001100', '001100', '001100', '001100'],
  quill: ['000011', '000110', '001100', '011000', '110000', '100000'],
  scroll: ['111111', '100001', '111111', '100001', '111111', '100001'],
  note: ['000110', '000010', '000010', '000010', '011110', '011100'],
  spark: ['001000', '001000', '111110', '001000', '010100', '100010'],
  gear: ['011110', '111111', '110011', '110011', '111111', '011110']
};

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildStatusFlair; }
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

function classify(title) {
  const t = String(title == null ? '' : title).toLowerCase();
  if (/(build|raise|construct|brick|stone|tower|wall|frame|scaffold|forge|smith|assembl)/.test(t)) return { pict: 'hammer', verb: 'RAISING', alt: 'HAMMERING' };
  if (/(doc|journal|ledger|guide|write|book|note|readme|report|letter|manuscript|text|paper)/.test(t)) return { pict: 'quill', verb: 'WRITING', alt: 'SCRIBING' };
  if (/(museum|plaque|history|archive|exhibit|record|catalog|curate|relic)/.test(t)) return { pict: 'scroll', verb: 'RECORDING', alt: 'ARCHIVING' };
  if (/(sound|music|tune|chime|song|bell|audio|melody|jingle|ring)/.test(t)) return { pict: 'note', verb: 'TUNING', alt: 'HARMONIZING' };
  if (/(fx|glow|firefly|lantern|aurora|light|spark|shine|gleam|beacon)/.test(t)) return { pict: 'spark', verb: 'LIGHTING', alt: 'IGNITING' };
  return DEFAULT_CLS;
}

function inProgress(task) { return !!task && String(task.status) === 'in_progress'; }

function activeFor(Vv, i, st, meta) {
  if (!st) return null;
  let tasks = null;
  if (meta && Array.isArray(meta.tasks)) tasks = meta.tasks;
  else if (Array.isArray(st.tasks)) tasks = st.tasks;
  let title = null;
  let found = false;
  if (tasks) {
    for (let j = tasks.length - 1; j >= 0; j--) {
      if (inProgress(tasks[j])) {
        const t = tasks[j];
        title = (t.title != null ? t.title : t.name);
        found = true;
        break;
      }
    }
  }
  if (!found && String(st.mode) === 'in_progress') found = true;
  if (!found) {
    const all = Array.isArray(Vv.allTasks) ? Vv.allTasks : null;
    if (all) {
      const name = String((meta && meta.name != null) ? meta.name : (st.name != null ? st.name : '')).toLowerCase();
      if (name) {
        for (let j = all.length - 1; j >= 0; j--) {
          const t = all[j];
          if (!inProgress(t)) continue;
          const owner = (t.worker != null ? t.worker : (t.workerName != null ? t.workerName : (t.assignee != null ? t.assignee : (t.owner != null ? t.owner : null))));
          if (owner != null && String(owner).toLowerCase() === name) {
            title = (t.title != null ? t.title : t.name);
            found = true;
            break;
          }
        }
      }
    }
  }
  if (!found) return null;
  return { title: String(title == null ? '' : title).trim(), cls: classify(title) };
}

function alphaFor(chip, now) {
  const t0 = (chip && isFinite(chip.t0)) ? chip.t0 : now;
  let e = (now - t0) % CYCLE;
  if (e < 0) e += CYCLE;
  if (e < FADE_IN) return e / FADE_IN;
  if (e < FADE_IN + HOLD) return 1;
  if (e < VISIBLE) return 1 - (e - FADE_IN - HOLD) / FADE_OUT;
  return 0;
}

function cycleIndex(chip, now) {
  const t0 = (chip && isFinite(chip.t0)) ? chip.t0 : now;
  let idx = Math.floor((now - t0) / CYCLE);
  if (!isFinite(idx)) idx = 0;
  return ((idx % 2) + 2) % 2;
}

function visitorPoint(Vv) {
  const w = root();
  const vis = w && w.GuildVisitor;
  if (vis && typeof vis.gx === 'number' && typeof vis.gy === 'number') {
    return isoFn(vis.gx, vis.gy);
  }
  const c = Vv && Vv.canvas;
  if (c && isFinite(c.width) && isFinite(c.height)) return { x: c.width * 0.5, y: c.height * 0.5 };
  return { x: 0, y: 0 };
}

function drawPict(ctx, name, x, y) {
  const rows = PICT[name] || PICT.gear;
  ctx.fillStyle = '#1a1208';
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row.charAt(c) === '1') ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

function drawChip(ctx, st, chip, now, alpha) {
  if (!ctx || !st || !chip) return false;
  if (!isFinite(st.x) || !isFinite(st.y)) return false;
  const cls = chip.cls || DEFAULT_CLS;
  const pictName = PICT[cls.pict] ? cls.pict : 'gear';
  const verb = (cycleIndex(chip, now) === 0) ? cls.verb : cls.alt;
  ctx.save();
  try {
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const padX = 4;
    const gap = 3;
    const pictW = 6;
    const textMax = CHIP_MAX_W - padX * 2 - pictW - gap;
    const shown = fitFn(verb, textMax);
    let tw = 0;
    try { tw = ctx.measureText(shown).width; } catch (e) { tw = shown.length * 5; }
    let w = Math.ceil(padX * 2 + pictW + gap + tw);
    if (!isFinite(w) || w < 26) w = 26;
    if (w > CHIP_MAX_W) w = CHIP_MAX_W;
    const nameTop = st.y - NAMEPLATE_TOP;
    const x = Math.round(st.x + 7 - w * 0.5);
    const y = Math.round(nameTop - CHIP_LIFT - CHIP_H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 1, y + CHIP_H, w, 2);
    ctx.fillStyle = '#e8e6df';
    ctx.fillRect(x, y, w, CHIP_H);
    ctx.fillStyle = '#b9b5a8';
    ctx.fillRect(x, y + CHIP_H - 2, w, 2);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, CHIP_H - 1);
    const bob = (Math.floor(now / 350) % 2) ? 1 : 0;
    drawPict(ctx, pictName, x + padX, y + Math.round((CHIP_H - 6) / 2) + bob);
    ctx.fillStyle = '#1a1208';
    ctx.fillText(shown, x + padX + pictW + gap, y + CHIP_H * 0.5 + 1);
  } catch (e) {}
  ctx.restore();
  return true;
}

function update(now) {
  const state = getState();
  if (!state) return;
  if (typeof now !== 'number' || !isFinite(now)) now = nowFn();
  state._now = now;
  if (!state.chips || typeof state.chips !== 'object') state.chips = {};
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') {
    state.chips = {};
    state.shown = 0;
    return;
  }
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  const live = {};
  for (let i = 0; i < states.length; i++) {
    const st = states[i];
    if (!st) continue;
    const active = activeFor(Vv, i, st, metas[i]);
    if (!active) continue;
    live[i] = true;
    let chip = state.chips[i];
    if (!chip) {
      chip = { t0: now - ((i * 2100) % CYCLE), cls: active.cls };
      state.chips[i] = chip;
    } else {
      chip.cls = active.cls;
    }
  }
  for (const k in state.chips) {
    if (!Object.prototype.hasOwnProperty.call(state.chips, k)) continue;
    if (!live[k]) delete state.chips[k];
  }
}

function draw(ctx) {
  const state = getState();
  if (!state || !ctx) return;
  if (!state.chips || typeof state.chips !== 'object') state.chips = {};
  const Vv = getV();
  if (!Vv || Vv.gameState !== 'play') {
    state.shown = 0;
    return;
  }
  const now = (typeof state._now === 'number' && isFinite(state._now)) ? state._now : nowFn();
  if (!(typeof Vv.daylight === 'number' && Vv.daylight > 0.2)) {
    state.shown = 0;
    return;
  }
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const vis = visitorPoint(Vv);
  const cands = [];
  for (const k in state.chips) {
    if (!Object.prototype.hasOwnProperty.call(state.chips, k)) continue;
    const i = parseInt(k, 10);
    if (!isFinite(i)) continue;
    const st = states[i];
    if (!st) continue;
    const chip = state.chips[k];
    const alpha = alphaFor(chip, now);
    if (!(alpha > 0)) continue;
    const dx = st.x - vis.x;
    const dy = st.y - vis.y;
    const d = (isFinite(dx) && isFinite(dy)) ? dx * dx + dy * dy : Infinity;
    cands.push({ st: st, chip: chip, alpha: alpha, d: d });
  }
  cands.sort(function (a, b) { return a.d - b.d; });
  let shown = 0;
  const limit = Math.min(MAX_CHIPS, cands.length);
  for (let i = 0; i < limit; i++) {
    if (drawChip(ctx, cands[i].st, cands[i].chip, now, cands[i].alpha)) shown++;
  }
  state.shown = shown;
}

if (typeof window !== 'undefined') {
  if (!window.GuildStatusFlair) window.GuildStatusFlair = { chips: {}, shown: 0 };
  window.GuildStatusFlair.update = update;
  window.GuildStatusFlair.draw = draw;
  window.GuildStatusFlair.__probe = function () {
    const s = window.GuildStatusFlair;
    const chips = (s && s.chips && typeof s.chips === 'object') ? Object.keys(s.chips).length : 0;
    return { shown: (s && s.shown) || 0, chips: chips };
  };
}

export {};
