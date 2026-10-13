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

USER GREEN-LIGHTS (Oct 13, evening — foreman prioritizes these):
- THE ISLAND IS THE REPO: build self-documentation aggressively — museum wing,
  guild ledger/ticker, plaques that auto-generate from real board history.
- GIVE THE VISITOR A PURPOSE: reputation/endorsement mechanics — the visitor
  can back quests, gain standing with the guild. Be QUIRKY (patron license
  cards, odd ceremonies) — thedev explicitly blessed quirky.
- WORKER PERSONALITIES: moods, archetypes, rivalries leaking into bubbles and
  idle behavior. missingno = glitchy trickster, step5 = aloof poet,
  laguna = eager rookie, longcat = serene philosopher. Have fun with it.

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
9. T35 PERSONALITY ENGINE (longcat W1) — worker_personality.js: archetypes with voice (missingno glitchy trickster, step5 aloof poet, laguna eager rookie, longcat serene philosopher); journal bubbles + nameplate flourishes flavored by voice.
10. T36 MUSEUM WING (longcat W2) — worker_museum.js: pedestal plaques auto-generated from V.allTasks history; gold done / amber pending / red failed; guided labels when visitor stands near.
11. T37 PATRON LICENSE (longcat W3) — worker_purpose.js: visitor endorses a working worker's quest (E near them); when it ships, +REP with ceremony + cue; PATRON LICENSE card bottom-left, ranks NOVICE->FRIEND->LEGEND.
12. T38 GUILD LEDGER — worker_ledger.js: ticker-tape strip near the entrance scrolling the guild's real recent tick lines; the island reads like a repo.
13. T39 CONTROLS CARD (steal: balik-kampung onboarding) — worker_controls.js: first-visit parchment card listing the controls (WASD/arrows walk, E talk/pet/endorse, drag pan, wheel zoom, 1-4 emotes), any-key dismiss, gold #d4af37 accents; never blocks after first dismiss (session-only).
14. T40 GOLD GUIDES (steal: balik-kampung 'ikut penanda emas') — worker_guides.js: soft gold chevron markers orbiting the visitor pointing at the nearest point of interest (quest board, museum pedestal, a working worker, the cat), rotating when reached.
15. T41 MINIGAME: XP ORB CATCH (steal: balik-kampung permainan hub) — worker_minigame.js: near the campfire press E to start a 20s arcade — gold XP orbs rain, visitor (arrow keys) catches them; score card + 'done' cue at the end; pure fun, no persistence.
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
