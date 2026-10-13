// Guild module loader — auto-imports any worker-built module that exists on disk.
// 404s (not built yet) are silently ignored; the next page load picks new files up.
const MODULES = [
  'worker_economy.js',
  'worker_rain.js',
  'worker_archives.js',
  'worker_spar.js',
  'worker_banter.js',
];
for (const m of MODULES) {
  try {
    await import('./' + m);
  } catch (e) {
    // not built yet, or module errored on import — the Guild* discovery loop
    // in the client only wires globals that actually exist, so stay quiet.
  }
}
