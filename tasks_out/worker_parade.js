# tasks_out/guild_parade.py
"""Guild Parade ES-module plugin for the 2D guild client.

Self-installing ES module (no imports, no top-level DOM access). Mirrors the
conventions of tasks_out/worker_visitor.js: state object on a window global,
update(now)/draw(ctx) hooks attached to it, plus __probe for testing.

The client calls update/draw every frame when V.gameState === 'play'.
"""

import json
import math
import os
import re
import sys

# ---------------------------------------------------------------------------
# The actual ES-module source. We keep it as a raw string so the Python file
# is trivially valid, and we emit it verbatim when run as a script.
# ---------------------------------------------------------------------------

ES_MODULE = r"""
const PARADE_DURATION = 12000;
const PARADE_MIDPOINT = 6000;
const CONFETTI_COUNT = 20;
const GHOST_ALPHA = 0.65;
const BANNER_SWAY_AMPL = 3;
const BANNER_CLOTH_W = 22;
const BANNER_CLOTH_H = 12;
const BANNER_POLE_H = 16;
const LABEL_COLOR = '#d4af37';
const LABEL_FONT = '10px monospace';
const CONFETTI_COLORS = ['#facc15', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b'];

function root() {
  return (typeof window !== 'undefined') ? window : null;
}

function getV() {
  const w = root();
  return w && w.V;
}

function nowFn() {
  return (typeof performance !== 'undefined') ? performance.now() : Date.now();
}

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

function cue(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}

function campfireBase() {
  const Vv = getV();
  if (!Vv || !Vv.grid) return { x: 0, y: 0 };
  const base = isoFn(0, -1);
  return { x: Math.round(base.x + 12), y: Math.round(base.y + 22) };
}

function countDone(Vv) {
  const arr = Array.isArray(Vv && Vv.allTasks) ? Vv.allTasks : [];
  let n = 0;
  for (let i = 0; i < arr.length; i++) {
    const t = arr[i];
    if (t && t.status === 'done') n++;
  }
  return n;
}

function workerScreenPos(Vv, i) {
  const ws = Array.isArray(Vv.workerStates) ? Vv.workerStates : [];
  const w = ws[i];
  if (!w) return null;
  const gx = (typeof w.x === 'number') ? w.x : 0;
  const gy = (typeof w.y === 'number') ? w.y : 0;
  const pt = isoFn(gx, gy);
  return { x: pt.x, y: pt.y };
}

function workerMeta(Vv, i) {
  const metas = Array.isArray(Vv.workers) ? Vv.workers : [];
  return metas[i] || {};
}

function workerColor(index, name) {
  const n = String(name || '').toLowerCase();
  return (index === 1 || n.indexOf('step') !== -1) ? '#a78bfa' : '#facc15';
}

function drawWorkerGhost(ctx, w, meta, i, now, paradePos) {
  if (!ctx || !w) return;
  const index = (w.index != null ? w.index : i);
  const isStep = index === 1 || String(meta.name || '').toLowerCase().indexOf('step') !== -1;
  const robeColor = isStep ? '#7c3aed' : '#9a6334';
  const legColor = isStep ? '#4c1d95' : '#26323f';
  const x = Math.round(paradePos.x);
  const y = Math.round(paradePos.y);
  const bob = Math.round(Math.sin(now * 0.004 + i * 0.7) * 1.2);
  const Y = y + bob;
  const frame = Math.floor((now * 0.006 + i * 0.3) % 4);
  const facing = w.facing || 'down';
  const vertical = (facing === 'up' || facing === 'down');

  ctx.save();
  ctx.globalAlpha = GHOST_ALPHA;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - 4, Y + 17, 20, 4);

  let leftY = Y + 10, rightY = Y + 10, leftH = 8, rightH = 8;
  if (frame === 1) { leftY = Y + 9; rightY = Y + 12; leftH = 8; rightH = 5; }
  else if (frame === 2) { leftY = Y + 11; rightY = Y + 11; leftH = 6; rightH = 6; }
  else if (frame === 3) { leftY = Y + 12; rightY = Y + 9; leftH = 5; rightH = 8; }
  if (vertical) { leftY = Y + 10; rightY = Y + 10; leftH = 7; rightH = 7; }

  ctx.fillStyle = legColor;
  if (facing === 'left') {
    ctx.fillRect(x + 10, leftY, 4, leftH);
    ctx.fillRect(x + 2, rightY, 4, rightH);
  } else if (facing === 'right') {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  } else if (facing === 'up') {
    ctx.fillRect(x + 3, leftY, 3, leftH);
    ctx.fillRect(x + 11, rightY, 3, rightH);
  } else {
    ctx.fillRect(x + 2, leftY, 4, leftH);
    ctx.fillRect(x + 10, rightY, 4, rightH);
  }

  ctx.fillStyle = robeColor;
  ctx.fillRect(x + 1, Y - 2, 14, 12);
  ctx.fillStyle = isStep ? '#ddd6fe' : '#f1c9a5';
  ctx.fillRect(x + 3, Y - 11, 10, 9);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x + 5, Y - 8, 2, 2);
  ctx.fillRect(x + 9, Y - 8, 2, 2);
  ctx.fillStyle = isStep ? '#8b5cf6' : '#7c4a24';
  ctx.fillRect(x + 4, Y - 12, 8, 2);
  ctx.globalAlpha = GHOST_ALPHA;
  ctx.restore();
}

function drawBanner(ctx, x, y, now) {
  if (!ctx) return;
  const sway = Math.round(Math.sin(now * 0.003) * BANNER_SWAY_AMPL);
  ctx.save();
  ctx.fillStyle = '#5a3f25';
  ctx.fillRect(x + sway, y - BANNER_POLE_H, 2, BANNER_POLE_H);
  ctx.fillStyle = '#7a1620';
  ctx.fillRect(x - Math.round(BANNER_CLOTH_W * 0.5) + sway, y - BANNER_POLE_H, BANNER_CLOTH_W, BANNER_CLOTH_H);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(x - 4 + sway, y - BANNER_POLE_H + 3, 8, 3);
  ctx.fillRect(x - 3 + sway, y - BANNER_POLE_H + 8, 6, 2);
  ctx.restore();
}

function makeConfetti() {
  const base = campfireBase();
  const parts = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    parts.push({
      x: base.x + (Math.random() - 0.5) * 80,
      y: base.y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 14,
      vy: 10 + Math.random() * 18,
      size: 2 + Math.random() * 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      sway: Math.random() * Math.PI * 2
    });
  }
  return parts;
}

function updateConfetti(parts, dt) {
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.x += p.vx * dt + Math.sin(p.sway + dt * 3) * 6 * dt;
    p.y += p.vy * dt;
    p.vy += 12 * dt;
    if (p.y > campfireBase().y + 120) {
      p.y = campfireBase().y - 20;
      p.vy = 10 + Math.random() * 18;
    }
  }
}

function drawConfetti(ctx, parts, now) {
  if (!ctx || !parts.length) return;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const bob = Math.sin(now * 0.002 + p.sway) * 1.5;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x + bob), Math.round(p.y), p.size, p.size);
  }
}

function drawLabel(ctx, Vv, count) {
  if (!ctx || !Vv || !Vv.canvas) return;
  const c = Vv.canvas;
  const text = 'GUILD PARADE - ' + count + ' SHIPPED';
  const maxW = Math.min(c.width - 40, 360);
  const shown = fitFn(text, maxW);
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(shown);
  const x = Math.round(c.width * 0.5);
  const y = 22;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x - Math.round(metrics.width * 0.5) - 4, y - 8, Math.round(metrics.width) + 8, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = LABEL_COLOR;
  ctx.fillText(shown, x, y);
  ctx.textAlign = 'left';
  ctx.restore();
}

function createState() {
  return { lastDone: 0, parade: null, confetti: null, initialized: false };
}

function getState() {
  const w = root();
  return w && w.GuildParade;
}

function update(now) {
  if (typeof now !== 'number') now = nowFn();
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play') return;

  const count = countDone(Vv);

  if (!st.initialized) {
    st.initialized = true;
    st.lastDone = count;
    return;
  }

  if (st.parade) {
    const elapsed = now - st.parade.t0;
    if (elapsed >= st.parade.dur) {
      st.parade = null;
      st.confetti = null;
      return;
    }
    if (st.confetti) {
      const dt = (now - (st._lastNow || now)) / 1000;
      const safeDt = (isFinite(dt) && dt >= 0 && dt <= 0.2) ? dt : 0.016;
      updateConfetti(st.confetti, safeDt);
    }
    st._lastNow = now;
    return;
  }

  if (count > st.lastDone) {
    const prevMultiple = Math.floor(st.lastDone / 10);
    const newMultiple = Math.floor(count / 10);
    if (newMultiple > prevMultiple) {
      st.parade = { t0: now, dur: PARADE_DURATION, done: count };
      st.confetti = makeConfetti();
      st._lastNow = now;
      cue('levelup');
    }
    st.lastDone = count;
  }
}

function draw(ctx) {
  const st = getState();
  const Vv = getV();
  if (!st || !Vv || Vv.gameState !== 'play' || !st.parade) return;
  if (!ctx) return;

  const now = nowFn();
  const elapsed = now - st.parade.t0;
  const progress = elapsed / st.parade.dur;

  if (elapsed >= PARADE_MIDPOINT && !st._midpointCued) {
    st._midpointCued = true;
    cue('done');
  }

  const ws = Array.isArray(Vv.workers) ? Vv.workers : [];
  const base = campfireBase();
  const leaderX = base.x;
  const leaderY = base.y - 24;

  drawBanner(ctx, leaderX, leaderY, now);

  const spacing = 26;
  for (let i = 0; i < ws.length; i++) {
    const meta = ws[i] || {};
    const pos = workerScreenPos(Vv, i);
    if (!pos) continue;
    const offsetX = -Math.round((i + 1) * spacing * 0.5);
    const offsetY = Math.round((i + 1) * spacing * 0.4);
    const paradePos = { x: leaderX + offsetX, y: leaderY + offsetY };
    drawWorkerGhost(ctx, Vv.workerStates[i], meta, i, now, paradePos);
  }

  if (st.confetti) {
    drawConfetti(ctx, st.confetti, now);
  }

  drawLabel(ctx, Vv, st.parade.done);
}

function probe() {
  const st = getState();
  return { parade: !!(st && st.parade) };
}

if (typeof window !== 'undefined') {
  if (!window.GuildParade) window.GuildParade = createState();
  window.GuildParade.update = update;
  window.GuildParade.draw = draw;
  window.GuildParade.__probe = probe;
}

export {};
"""


def main():
    """Emit the ES-module source to stdout (or a target path)."""
    target = sys.argv[1] if len(sys.argv) > 1 else None
    src = ES_MODULE.strip("\n")
    if target:
        os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            fh.write(src)
            fh.write("\n")
    else:
        sys.stdout.write(src)
        sys.stdout.write("\n")


if __name__ == "__main__":
    main()
