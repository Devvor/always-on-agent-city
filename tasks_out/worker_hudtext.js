const PALETTE = {
  parchment: '#d9c8a3',
  parchmentDark: '#f3e6bf',
  border: '#6b4a2b',
  ink: '#2b1d0e',
  accent: '#d4af37',
  faint: 'rgba(0,0,0,0.25)'
};

const HUD_SELECTORS = [
  '.ledger-line',
  '.ledger-entry',
  '.ledger-ticker-line',
  '.ticker-line',
  '.hud-ledger-line',
  '.quest-log-line',
  '.quest-log-entry',
  '.quest-line',
  '.quest-entry',
  '.questlog-line',
  '.hud-questlog-line',
  '[data-hud-text]',
  '[data-ledger-line]',
  '[data-quest-log-line]',
  '[data-quest-entry]'
];

let initialized = false;
let tooltipEl = null;
let hideTimer = null;
let currentHover = null;
let lastTarget = null;

function root() { return (typeof window !== 'undefined') ? window : null; }
function getV() { const w = root(); return w && w.V; }
function hasContract() {
  const w = root();
  return !!w && !!w.V;
}

function isoFn(gx, gy) {
  const w = root();
  if (w && typeof w.iso === 'function') return w.iso(gx, gy);
  const Vv = getV();
  const g = Vv && Vv.grid;
  if (g) return { x: g.originX + (gx - gy) * g.tileW * 0.5, y: g.originY + (gx + gy) * g.tileH * 0.5 };
  return { x: 0, y: 0 };
}

function measureText(ctx, text) {
  if (!ctx || !ctx.measureText) return String(text == null ? '' : text).length * 8;
  try { return ctx.measureText(String(text == null ? '' : text)).width; } catch (e) { return String(text == null ? '' : text).length * 8; }
}

function localFitText(text, maxW) {
  const Vv = getV();
  const ctx = Vv && Vv.ctx ? Vv.ctx : (typeof document !== 'undefined' ? (document.createElement('canvas').getContext('2d')) : null);
  text = (text == null ? '' : String(text));
  if (!ctx) return text;
  if (!isFinite(maxW) || maxW <= 0) return '';
  if (measureText(ctx, text) <= maxW) return text;
  const ell = '\u2026';
  for (let i = text.length; i > 0; i--) {
    const cand = text.slice(0, i) + ell;
    if (measureText(ctx, cand) <= maxW) return cand;
  }
  return measureText(ctx, ell) <= maxW ? ell : '';
}

function fitTextFn(text, maxW) {
  const w = root();
  if (w && typeof w.fitText === 'function') return w.fitText(text, maxW);
  return localFitText(text, maxW);
}

function cueFn(name) {
  const w = root();
  if (w && typeof w.cue === 'function') {
    try { w.cue(name); } catch (e) {}
  }
}

function allTasksFn() {
  const w = root();
  if (Array.isArray(w && w.allTasks)) return w.allTasks;
  const Vv = getV();
  if (Vv && Array.isArray(Vv.allTasks)) return Vv.allTasks;
  return [];
}

function classString(el) {
  if (!el) return '';
  try {
    if (typeof el.className === 'string') return el.className;
    if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
  } catch (e) {}
  return '';
}

function getFullText(el) {
  if (!el) return '';
  const attrs = ['data-full-text', 'data-hud-full-text', 'data-original-text', 'data-full', 'data-tooltip-text'];
  for (let i = 0; i < attrs.length; i++) {
    try {
      const v = el.getAttribute && el.getAttribute(attrs[i]);
      if (typeof v === 'string' && v.length) return v;
    } catch (e) {}
  }
  const ds = el.dataset || {};
  if (typeof ds.fullText === 'string' && ds.fullText.length) return ds.fullText;
  if (typeof ds.hudFullText === 'string' && ds.hudFullText.length) return ds.hudFullText;
  if (typeof ds.originalText === 'string' && ds.originalText.length) return ds.originalText;
  if (typeof ds.full === 'string' && ds.full.length) return ds.full;
  if (typeof el._fullText === 'string' && el._fullText.length) return el._fullText;
  return (el.textContent == null ? '' : String(el.textContent));
}

function storeFullText(el, full) {
  if (!el) return;
  const value = (full == null ? '' : String(full));
  el._fullText = value;
  try { if (typeof el.setAttribute === 'function') el.setAttribute('data-full-text', value); } catch (e) {}
  if (!el.dataset) el.dataset = {};
  el.dataset.fullText = value;
  el.dataset.hudFullText = value;
  el.dataset.originalText = value;
  el.dataset.full = value;
}

function isTruncated(el) {
  if (!el) return false;
  const full = getFullText(el);
  return Boolean(full) && String(el.textContent == null ? '' : el.textContent) !== full;
}

function truncateChars(text, maxChars) {
  const full = (text == null ? '' : String(text));
  let limit = Number(maxChars);
  if (!isFinite(limit) || limit <= 0) return '';
  limit = Math.floor(limit);
  if (full.length <= limit) return full;
  const ellipsis = '\u2026';
  let content = full.slice(0, Math.max(0, limit - 1));
  const boundary = Math.max(
    content.lastIndexOf(' '),
    content.lastIndexOf('\t'),
    content.lastIndexOf('\n'),
    content.lastIndexOf('-'),
    content.lastIndexOf('/'),
    content.lastIndexOf('_')
  );
  if (boundary > 0) content = content.slice(0, boundary);
  content = content.replace(/[\s\-_\/.,;:!?]+$/g, '');
  if (!content) content = full.slice(0, Math.max(0, limit - 1));
  return content + ellipsis;
}

function truncatePixels(text, maxW) {
  const full = (text == null ? '' : String(text));
  let limit = Number(maxW);
  if (!isFinite(limit) || limit <= 0) return '';
  if (measureText(getV() && getV().ctx ? getV().ctx : null, full) <= limit) return full;
  const fitted = fitTextFn(full, limit);
  const ellipsis = '\u2026';
  if (!String(fitted).endsWith(ellipsis)) return String(fitted == null ? '' : fitted);
  const base = String(fitted).slice(0, -1);
  const idx = Math.max(
    base.lastIndexOf(' '),
    base.lastIndexOf('\t'),
    base.lastIndexOf('\n'),
    base.lastIndexOf('-'),
    base.lastIndexOf('/'),
    base.lastIndexOf('_')
  );
  if (idx >= 0) {
    let candidate = full.slice(0, idx + 1).replace(/[\s\-_\/.,;:!?]+$/g, '');
    if (candidate) {
      candidate += ellipsis;
      const ctx = getV() && getV().ctx ? getV().ctx : null;
      if (!ctx || measureText(ctx, candidate) <= limit) return candidate;
    }
  }
  return String(fitted);
}

function defaultLimit(el) {
  const classes = classString(el).toLowerCase();
  let width = 0;
  try {
    width = (el && typeof el.clientWidth === 'number') ? el.clientWidth : 0;
    if (!width && el && typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      width = rect && isFinite(rect.width) ? rect.width : 0;
    }
    if (!width && el && el.style && el.style.width) {
      const parsed = parseFloat(el.style.width);
      if (isFinite(parsed)) width = parsed;
    }
  } catch (e) {}
  if (isFinite(width) && width > 0) return Math.max(40, Math.floor(width));
  if (classes.indexOf('ledger') !== -1) return 280;
  if (classes.indexOf('quest') !== -1) return 200;
  return 240;
}

function ensureTooltip() {
  if (typeof document === 'undefined') return null;
  if (tooltipEl && document.body && document.body.contains && document.body.contains(tooltipEl)) return tooltipEl;
  if (!document.body) return null;
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'guild-hud-text-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.style.position = 'fixed';
  tooltipEl.style.zIndex = '2147483647';
  tooltipEl.style.maxWidth = '340px';
  tooltipEl.style.padding = '6px 8px';
  tooltipEl.style.border = '2px solid ' + PALETTE.border;
  tooltipEl.style.background = PALETTE.parchment;
  tooltipEl.style.color = PALETTE.ink;
  tooltipEl.style.font = '12px monospace';
  tooltipEl.style.lineHeight = '1.35';
  tooltipEl.style.display = 'none';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.whiteSpace = 'pre-wrap';
  tooltipEl.style.wordBreak = 'break-word';
  tooltipEl.style.boxShadow = '2px 2px 0 ' + PALETTE.faint;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function positionTooltip(anchor) {
  const tip = ensureTooltip();
  if (!tip || !anchor || typeof anchor.getBoundingClientRect !== 'function') return;
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  let top = rect.top - tip.offsetHeight - margin;
  if (top < margin) top = rect.bottom + margin;
  let left = rect.left;
  const maxLeft = Math.max(margin, (window.innerWidth || 800) - tip.offsetWidth - margin);
  if (left > maxLeft) left = maxLeft;
  if (left < margin) left = margin;
  tip.style.left = Math.round(left) + 'px';
  tip.style.top = Math.round(top) + 'px';
}

function showTooltip(anchor, full) {
  if (typeof document === 'undefined') return;
  const tip = ensureTooltip();
  if (!tip) return;
  const text = (full == null ? '' : String(full));
  if (!text) return;
  currentHover = anchor || currentHover;
  if (anchor) lastTarget = anchor;
  tip.textContent = text;
  tip.style.display = 'block';
  positionTooltip(anchor || (lastTarget));
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideTooltip, 2500);
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = 'none';
  clearTimeout(hideTimer);
  hideTimer = null;
}

function bindElement(el) {
  if (!el || typeof el.addEventListener !== 'function' || el.__hudTextBound) return;
  el.__hudTextBound = true;
  const enter = function () {
    currentHover = el;
    lastTarget = el;
    if (isTruncated(el)) showTooltip(el, getFullText(el));
  };
  const leave = function () {
    if (currentHover === el) currentHover = null;
    setTimeout(function () {
      if (tooltipEl && tooltipEl.style.display === 'block' && !currentHover) hideTooltip();
    }, 180);
  };
  const focus = function () {
    lastTarget = el;
    if (isTruncated(el)) showTooltip(el, getFullText(el));
  };
  const blur = function () { hideTooltip(); };
  el.addEventListener('mouseenter', enter);
  el.addEventListener('mouseleave', leave);
  el.addEventListener('focus', focus, true);
  el.addEventListener('blur', blur, true);
}

function fit(el, maxChars, opts) {
  if (!hasContract() || !el) return el;
  const full = getFullText(el);
  const forceChars = !!(opts && opts.chars === true);
  const forcePixels = !!(opts && opts.pixels === true);
  const provided = (maxChars == null ? null : Number(maxChars));
  const pixelMode = (provided == null)
    ? true
    : (forcePixels ? true : (forceChars ? false : !(Number(provided) <= 72)));
  const limit = (provided == null ? defaultLimit(el) : provided);
  const fitted = pixelMode ? truncatePixels(full, limit) : truncateChars(full, limit);
  storeFullText(el, full);
  if (typeof el.textContent !== 'undefined') el.textContent = fitted;
  bindElement(el);
  return el;
}

function findCandidates() {
  if (typeof document === 'undefined') return [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < HUD_SELECTORS.length; i++) {
    let selector = HUD_SELECTORS[i];
    try {
      const nodes = document.querySelectorAll(selector);
      for (let j = 0; j < nodes.length; j++) {
        if (!seen.has(nodes[j])) {
          seen.add(nodes[j]);
          out.push(nodes[j]);
        }
      }
    } catch (e) {}
  }
  try {
    const all = document.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (seen.has(el)) continue;
      const classes = classString(el).toLowerCase();
      const dataHud = !!(el.getAttribute && (el.getAttribute('data-hud-text') || el.getAttribute('data-ledger-line') || el.getAttribute('data-quest-log-line') || el.getAttribute('data-quest-entry')));
      const looksHud = classes.indexOf('ledger') !== -1 || classes.indexOf('quest') !== -1 || dataHud;
      const looksLine = classes.indexOf('line') !== -1 || classes.indexOf('entry') !== -1 ||
        classes.indexOf('item') !== -1 || classes.indexOf('row') !== -1 ||
        classes.indexOf('tick') !== -1 || classes.indexOf('card') !== -1 || dataHud;
      if (looksHud && looksLine) {
        seen.add(el);
        out.push(el);
      }
    }
  } catch (e) {}
  return out;
}

function sweep() {
  if (!hasContract()) return;
  const nodes = findCandidates();
  for (let i = 0; i < nodes.length; i++) fit(nodes[i], defaultLimit(nodes[i]));
}

function onKeyDown(e) {
  if (!hasContract() || typeof document === 'undefined') return;
  const key = (e && e.key != null) ? String(e.key).toLowerCase() : '';
  if (key !== 'e' && key !== ' ') return;
  const target = (lastTarget && isTruncated(lastTarget)) ? lastTarget : (currentHover && isTruncated(currentHover) ? currentHover : null);
  if (target) {
    showTooltip(target, getFullText(target));
    return;
  }
  const candidates = findCandidates();
  for (let i = 0; i < candidates.length; i++) {
    if (isTruncated(candidates[i])) {
      showTooltip(candidates[i], getFullText(candidates[i]));
      return;
    }
  }
}

function init() {
  if (initialized || !hasContract()) return;
  initialized = true;
  bindElement(document.documentElement);
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        ensureTooltip();
        sweep();
      }, { once: true });
    } else {
      ensureTooltip();
      sweep();
    }
  }
  const w = root();
  if (w && typeof w.addEventListener === 'function') w.addEventListener('keydown', onKeyDown, true);
}

const GuildHudText = {
  fit: fit,
  sweep: sweep,
  show: showTooltip,
  hide: hideTooltip,
  isTruncated: isTruncated,
  getFullText: getFullText,
  find: findCandidates
};

if (typeof window !== 'undefined') {
  window.GuildHudText = GuildHudText;
  init();
}

export {};
