function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function getState() { const w = root(); return w && w.GuildPersonality; }
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
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function tickText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.msg === 'string') return value.msg;
    if (typeof value.line === 'string') return value.line;
    if (typeof value.event === 'string') return value.event;
    if (typeof value.status === 'string') return value.status;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value);
}
function latestTickForWorker(worker) {
  const ticks = Array.isArray(worker && worker.recentTicks) ? worker.recentTicks : [];
  const name = String(worker && worker.name != null ? worker.name : '').trim();
  let chosen = null;
  for (let i = ticks.length - 1; i >= 0; i--) {
    const line = tickText(ticks[i]);
    if (!line) continue;
    if (name && line.toLowerCase().indexOf(name.toLowerCase()) !== -1) { chosen = line; break; }
  }
  if (!chosen && ticks.length) chosen = tickText(ticks[ticks.length - 1]);
  return chosen ? String(chosen).trim() : '';
}
function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function makeStyle(lines) {
  const out = lines.slice();
  out.lines = out;
  out.templates = out;
  return out;
}
function voiceKeyForName(name) {
  const n = String(name == null ? '' : name).toLowerCase();
  const keys = ['missingno', 'step5', 'laguna', 'longcat'];
  for (let i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) !== -1) return keys[i];
  return null;
}
function voiceColor(key) {
  if (key === 'missingno') return '#facc15';
  if (key === 'step5') return '#a78bfa';
  if (key === 'laguna') return '#34d399';
  if (key === 'longcat') return '#94a3b8';
  return '#ffffff';
}
function voiceLines(voice) {
  if (!voice) return [];
  if (Array.isArray(voice.style)) return voice.style;
  if (voice.style && Array.isArray(voice.style.lines)) return voice.style.lines;
  if (Array.isArray(voice.lines)) return voice.lines;
  return [];
}
const VOICES = {
  missingno: {
    style: makeStyle([
      'glitch: {line} 01101',
      '{line}?? no, better 01101',
      'swap {line} around 01101',
      'lol {line} but wrong',
      'look— {line} 01101',
      '{line}!! totally real (not)',
      'ha, {line} (swapped) 01101'
    ]),
    decorate: function (text) {
      const s = String(text == null ? '' : text);
      const chars = s.split('');
      for (let i = 0; i + 1 < chars.length; i += 5) {
        if (/[A-Za-z]/.test(chars[i]) && /[A-Za-z]/.test(chars[i + 1])) {
          const tmp = chars[i];
          chars[i] = chars[i + 1];
          chars[i + 1] = tmp;
        }
      }
      let out = chars.join('');
      if (out.length % 2 === 0 && !/01101\s*$/.test(out)) out += ' 01101';
      return out;
    }
  },
  step5: {
    style: makeStyle([
      'rain over {line} / wait / asphalt',
      'not {line}, but close',
      '{line} in lowercase rivers',
      'soft letter: {line}',
      'echo {line}',
      '{line}... maybe',
      'another gray morning: {line}'
    ]),
    decorate: function (text) {
      let s = String(text == null ? '' : text).toLowerCase();
      s = s.replace(/\s+/g, ' ').trim();
      const words = s.split(' ');
      if (words.length > 7) s = words.slice(0, 7).join(' ') + '...';
      return s;
    }
  },
  laguna: {
    style: makeStyle([
      'first try! {line}!!',
      '{line}!! i did it!!',
      'new plan: {line}!!',
      'found {line} first try!!',
      'whoa {line}!!',
      '{line} (first try!)',
      'quest complete? {line}!!'
    ]),
    decorate: function (text) {
      let s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
      if (!/[!]/.test(s)) s += '!!';
      else if (!/!!/.test(s)) s = s.replace(/!+$/, '!!');
      if (s.toLowerCase().indexOf('first try') < 0 && Math.random() < 0.6) s = s.replace(/!!$/, ' first try!!');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  },
  longcat: {
    style: makeStyle([
      '{line}... maybe... always...',
      'calm... {line}... calm...',
      '... {line} ...',
      'a long thought... {line}...',
      '{line}... nothing rushes...',
      'listen... {line}...',
      'silence... then {line}...'
    ]),
    decorate: function (text) {
      let s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
      const words = s.split(' ');
      if (words.length >= 4) {
        const mid = Math.floor(words.length / 2);
        words.splice(mid, 0, '...');
        s = words.join(' ');
      }
      if (!/\.{3}/.test(s)) s += '...';
      return s;
    }
  }
};

function say(name, text) {
  const voice = (function () {
    const key = voiceKeyForName(name);
    return key ? VOICES[key] : null;
  })();
  if (!voice) return String(text == null ? '' : text);
  const lines = voiceLines(voice);
  let template = '{line}';
  if (lines.length) template = lines[Math.floor(Math.random() * lines.length)];
  const out = template.replace(/\{line\}/g, String(text == null ? '' : text));
  try { return voice.decorate(out); } catch (e) { return out; }
}

function expireBubbles(state, now) {
  if (!state || !Array.isArray(state.bubbles)) return;
  state.bubbles = state.bubbles.filter(function (b) {
    if (!b || typeof b.start !== 'number') return false;
    const age = (now - b.start) / 1000;
    const dur = typeof b.duration === 'number' ? b.duration : 5;
    return isFinite(age) && age >= 0 && age < dur;
  });
}

function pickBubble(now) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;
  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  if (!workers.length) return;
  const active = {};
  for (let i = 0; i < st.bubbles.length; i++) active[st.bubbles[i].workerIndex] = true;
  const candidates = [];
  for (let i = 0; i < workers.length; i++) {
    if (!workers[i]) continue;
    if (active[i]) continue;
    candidates.push(i);
  }
  if (!candidates.length) return;
  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  const worker = workers[idx] || {};
  const text = latestTickForWorker(worker);
  if (!text) return;
  const color = workerColor(idx, worker.name);
  const line = say(worker.name, text);
  st.bubbles = st.bubbles.filter(function (b) { return b.workerIndex !== idx; });
  st.bubbles.push({ workerIndex: idx, color: color, text: line, start: now, duration: 5 });
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st) return;
  if (!Array.isArray(st.bubbles)) st.bubbles = [];
  if (st.nextAt == null) st.nextAt = now + 14000 + Math.random() * 8000;
  if (!Vv || Vv.gameState !== 'play') {
    st.now = now;
    return;
  }
  st.now = now;
  expireBubbles(st, now);
  if (now >= st.nextAt) {
    st.nextAt = now + 14000 + Math.random() * 8000;
    try { pickBubble(now); } catch (e) {}
  }
}

function drawFlourish(ctx, key, x, y, now, index, fallbackColor) {
  const color = voiceColor(key) || fallbackColor || '#ffffff';
  ctx.save();
  if (key === 'missingno') {
    const alpha = Math.sin(now * 0.019 + index * 2.1) > -0.2 ? 1 : 0.35;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 2, 3, 3);
    if (Math.sin(now * 0.037 + index) > 0.4) ctx.fillRect(x + 4, y, 2, 2);
    ctx.globalAlpha = 1;
  } else if (key === 'step5') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 4, y - 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y - 3, 2, 2);
  } else if (key === 'laguna') {
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y - 3, 2, 2);
    ctx.fillRect(x - 1, y, 6, 2);
    ctx.fillRect(x + 2, y + 2, 2, 2);
  } else if (key === 'longcat') {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 2, 2, 2);
    ctx.fillRect(x + 3, y - 2, 2, 2);
    ctx.fillRect(x + 3, y + 2, 2, 2);
    ctx.fillRect(x, y + 2, 2, 2);
    ctx.fillRect(x + 1, y, 2, 2);
  }
  ctx.restore();
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!ctx || !st || !Vv || Vv.gameState !== 'play') return;
  const now = (typeof st.now === 'number') ? st.now : nowFn();
  expireBubbles(st, now);
  const canvas = Vv.canvas || (ctx.canvas ? ctx.canvas : null);
  const workers = Array.isArray(Vv.workers) ? Vv.workers : [];
  const states = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const placed = [];

  for (let bi = 0; bi < st.bubbles.length; bi++) {
    const b = st.bubbles[bi];
    if (!b) continue;
    const age = (now - b.start) / 1000;
    const dur = typeof b.duration === 'number' ? b.duration : 5;
    if (!isFinite(age) || age < 0 || age >= dur) continue;
    const wst = states[b.workerIndex];
    if (!wst) continue;
    const wx = Number.isFinite(wst.x) ? wst.x : 0;
    const wy = Number.isFinite(wst.y) ? wst.y : 0;

    ctx.font = '10px monospace';
    let text = String(b.text == null ? '' : b.text);
    text = fitFn(text, 128);
    const textW = ctx.measureText(text).width;
    const bw = Math.max(44, Math.round(textW + 12));
    const bh = 16;
    let x = Math.round(wx + 8 - bw / 2);
    let y = Math.round(wy - 52);

    for (let tries = 0; tries < 8; tries++) {
      let hit = false;
      for (let p = 0; p < placed.length; p++) {
        const pp = placed[p];
        if (Math.abs(x - pp.x) < (bw + pp.bw) * 0.5 + 4 && Math.abs(y - pp.y) < bh + 8) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
      y += 18;
    }

    if (canvas) x = clamp(x, 4, canvas.width - bw - 4);
    if (canvas) {
      const cam = Vv.camera || { x: 0, y: 0, zoom: 1 };
      const z = cam.zoom || 1;
      const Cy = canvas.height * 0.5;
      const screenY = ((y - Cy + (cam.y || 0)) * z + Cy);
      if (screenY < 64) {
        y = Math.round((((64 - Cy) / z) - (cam.y || 0) + Cy));
      }
    }

    placed.push({ x: x, y: y, bw: bw });
    const alpha = age <= 4 ? 1 : Math.max(0, 1 - (age - 4) / 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    const tipX = Math.round(wx + 8);
    const tipY = Math.round(wy - 20);

    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.beginPath();
    ctx.moveTo(Math.round(x + bw * 0.5 - 3), y + bh);
    ctx.lineTo(Math.round(x + bw * 0.5 + 3), y + bh);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = b.color || workerColor(b.workerIndex, workers[b.workerIndex] && workers[b.workerIndex].name);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x + bw * 0.5 - 3), y + bh);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(Math.round(x + bw * 0.5 + 3), y + bh);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(10,10,12,0.92)';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = b.color || workerColor(b.workerIndex, workers[b.workerIndex] && workers[b.workerIndex].name);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, bw, bh);

    ctx.fillStyle = '#e8e6df';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 6, y + bh * 0.5);
    ctx.restore();
  }

  for (let i = 0; i < states.length; i++) {
    const w = states[i];
    if (!w) continue;
    const wx = Number.isFinite(w.x) ? w.x : 0;
    const wy = Number.isFinite(w.y) ? w.y : 0;
    const meta = workers[i] || {};
    const name = meta.name != null ? meta.name : (w.name != null ? w.name : '');
    const key = voiceKeyForName(name);
    if (!key) continue;

    const tagW = 76;
    const tagH = 12;
    const cx = Math.round(wx) + 7;
    const tagX = cx - Math.round(tagW * 0.5);
    const tagY = Math.round(wy) - 35;
    const gx = tagX + tagW + 3;
    const gy = tagY + Math.round(tagH * 0.5);
    drawFlourish(ctx, key, gx, gy, now, i, workerColor(i, name));
  }
}

if (typeof window !== 'undefined') {
  if (!window.GuildPersonality) {
    window.GuildPersonality = { voices: null, say: null, bubbles: [], nextAt: null, now: 0 };
  }
  const gp = window.GuildPersonality;
  if (!Array.isArray(gp.bubbles)) gp.bubbles = [];
  if (gp.nextAt === undefined) gp.nextAt = null;
  if (typeof gp.now !== 'number') gp.now = 0;
  gp.voices = VOICES;
  gp.say = say;
  gp.update = update;
  gp.draw = draw;
  gp.__probe = function () {
    return {
      bubbleCount: gp.bubbles.length,
      bubbleWorkers: gp.bubbles.map(function (b) { return b.workerIndex; }),
      nextAt: gp.nextAt,
      voiceKeys: Object.keys(VOICES)
    };
  };
}

export {};
