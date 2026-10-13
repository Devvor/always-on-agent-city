# Guild Roadmap — 2.5D track (standing backlog)

## CHARTER (user-approved Oct 13 — the colony's north star)
MISSION: build the worker guild into a genuinely playable, escalating pixel-RPG
office sim — the island must increasingly feel like a LIVING GAME, not a dashboard.
The foreman may invent new quests toward this charter; workers execute them.

Themes, priority order:
1. PLAYABILITY — things the visitor can DO: read boards, accept quests, collect,
   interact with workers and props.
2. LIVING WORLD — idle behaviors, ambient events, weather effects, personality.
3. SELF-DOCUMENTATION — the island tells the guild's real story (museum, plaques,
   tick tickers) from the live board.json.
4. SPECTACLE — moments that make you stop and watch (festivals, arrivals,
   level-ups).

HARD BOUNDARIES (never cross):
- 2.5D pixel client ONLY (3D dead Oct 13; do not re-seed).
- Fresh ES-module tasks only for the client — NEVER rewrite worker_office.js
  (integration into the client is the orchestrator's job, not a worker's).
- One target file per task, always under tasks_out/.
- $0 models only: stealth/missingno (board.json),
  poolside/laguna-s-2.1:free (board_laguna.json). step5 dies ~Oct 16.
- Specs must never contain literal triple-backticks; edit-tasks need
  include_files; verify_cmd deterministic + failure-printing (node --check via
  .mjs copy is fine for fresh modules).
- Specs must say: wrap the output file in one standard fenced code block (three
  backticks, no language tag).

CIRCUIT BREAKERS: >=3 consecutive failed tasks on one board = stop seeding that
board and flag it in the status. Never seed a task touching anything outside
tasks_out/.

## Queue (next to seed — foreman keeps this deep, >=6 pending across boards)
1. T27 QUEST BOARD — in-world wooden quest board near spawn: visitor walks up,
   presses E, reads the REAL pending/done quest list from window.V (fresh module
   worker_questboard.js).
2. T28 RAIN SHELTER — when WEATHER is RAIN, idle workers migrate to shelter spots
   (awning tiles) and shiver-hop; campfire huddles (fresh module).
3. T29 GUILD MUSEUM — a museum corner: pedestals whose plaques auto-generate
   from board history (done quest names as exhibits, fresh module).
4. T30 LANTERN FESTIVAL — every 5 quests done collectively, a 40s lantern-launch
   spectacle over the island + 'grow'/'levelup' cues (fresh module reading V).
5. T31 VISITOR EMOTES — number keys 1-4 make the visitor emote (wave, cheer,
   sit, point) with small FX; reuses sound cues if present (fresh module).
6. T32 WORKER JOURNAL — idle workers occasionally show thought bubbles with
   flavor text about their ACTUAL workstream (their real recent tick lines,
   lightly paraphrased; fresh module).
7. T33 FIREFLY GROVE — a corner grove prop with fireflies that swarm to the
   visitor when idle at night (V.daylight-driven, fresh module).
8. T34 TINY GARDEN — idle workers plant a tiny crop garden near the museum; crops
   grow over real elapsed time between visits (fresh module, no persistence
   beyond V session).

## Done (moved here once verified)
- T15-T21: departments/states/fleet, day-night+weather, bubbles/plaques, sound
  cues, pan/zoom camera, text discipline.
- T22 title screen; T23B visitor module (WASD + talk); L1 guild cat (laguna,
  pettable: hearts + meow); idle RNG wander (stroll/campfire/cat/sky-gaze);
  full-viewport canvas + two-row header.

## Parked (do not seed without user ask)
- 3D mode (killed Oct 13; code in git history)
