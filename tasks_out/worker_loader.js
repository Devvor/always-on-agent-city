// Guild module loader — fetches the live module manifest from the office server
// and imports EVERY worker-built module that exists on disk. New modules go live
// on the next page load with zero wiring. Classic scripts (worker_office.js,
// worker_office_sound.js) are excluded server-side; this file skips itself.
const FALLBACK = [
  'worker_visitor.js', 'worker_cat.js', 'worker_trail.js', 'worker_questboard.js',
  'worker_boat.js', 'worker_emotes.js', 'worker_journal.js', 'worker_personality.js',
  'worker_museum.js', 'worker_purpose.js', 'worker_ledger.js', 'worker_controls.js',
  'worker_guides.js', 'worker_minigame.js', 'worker_shelter.js', 'worker_fireflies.js',
  'worker_garden.js', 'worker_lanterns.js', 'worker_economy.js', 'worker_banter.js',
];
const SELF = 'worker_loader.js';
let mods = FALLBACK;
try {
  const res = await fetch('./api/modules', { cache: 'no-store' });
  if (res.ok) {
    const list = await res.json();
    if (Array.isArray(list) && list.length) mods = list;
  }
} catch (e) {
  // server manifest unavailable — fall back to the known core set
}
for (const m of mods) {
  if (m === SELF) continue;
  try {
    await import('./' + m);
  } catch (e) {
    // not built yet, or module errored on import — the Guild* discovery loop
    // in the client only wires globals that actually exist, so stay quiet.
  }
}
