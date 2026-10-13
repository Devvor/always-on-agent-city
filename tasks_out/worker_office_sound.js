let ctx = null, soundOn = false, btn = null;

function tone(ctx, type, freq, dur, when, gain = 0.12, end = null) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (end != null && end !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), when + dur);
  }
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + Math.min(0.015, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.03);
}

export function installSound(bar) {
  btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'SOUND: OFF';
  const s = btn.style;
  s.fontFamily = 'monospace';
  s.fontWeight = 'bold';
  s.color = '#d4af37';
  s.background = '#0d1324';
  s.border = '1px solid #3a342f';
  s.cursor = 'pointer';
  s.padding = '4px 8px';

  btn.addEventListener('click', async () => {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!soundOn) {
      if (!ctx && AC) ctx = new AC();
      if (!ctx) return;
      soundOn = true;
      btn.textContent = 'SOUND: ON';
      btn.style.borderColor = '#d4af37';
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
        await ctx.resume();
      }
    } else {
      soundOn = false;
      btn.textContent = 'SOUND: OFF';
      btn.style.borderColor = '#3a342f';
      if (ctx && typeof ctx.suspend === 'function') {
        await ctx.suspend();
      }
    }
  });

  bar.appendChild(btn);
}

export function cue(name) {
  if (!soundOn || !ctx) return;
  const c = ctx;
  const t = c.currentTime;

  if (name === 'done') {
    tone(c, 'square', 523.25, 0.09, t, 0.12);
    tone(c, 'square', 659.25, 0.09, t + 0.1, 0.12);
  } else if (name === 'levelup') {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(c, 'square', f, 0.08, t + i * 0.1, 0.12);
    });
  } else if (name === 'failed') {
    tone(c, 'square', 196.0, 0.06, t, 0.12);
    tone(c, 'square', 196.0, 0.06, t + 0.12, 0.12);
  } else if (name === 'grow') {
    tone(c, 'triangle', 220.0, 0.2, t, 0.1, 440.0);
  } else if (name === 'alert') {
    for (let i = 0; i < 3; i += 1) {
      tone(c, 'square', 220.0, 0.06, t + i * 0.1, 0.13);
    }
  } else if (name === 'meow') {
    tone(c, 'triangle', 659.25, 0.07, t, 0.11, 523.25);
    tone(c, 'triangle', 523.25, 0.07, t + 0.09, 0.11, 523.25);
  }
}
