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
5. ECONOMY (user directive Oct 13: "build an economy, see how they react") —
   the guild's labor mints real wealth: every done quest = wages to that
   worker's purse; wealth drives visible behavior — idle workers SPEND at the
   stall (snack in hand, happiness), broke workers look wistful, prices move
   with demand, the vault visibly grows with the treasury. The visitor earns
   coins too (minigame, patron dividends) and can tip workers. Every coin
   must trace to a REAL shipped quest — the economy is the board made visible.

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

## Queue (next to seed - foreman keeps this deep, >=6 pending across boards)
1. T48 SCROLL RUN - playability fetch quest: 3 glowing scrolls drop near random floor tiles every few minutes; the visitor picks one up by walking over it, and delivering it to the quest board earns +5 REP (via window.GuildPurpose if present, else own counter) with a small ceremony. Turns walking into purpose. Fresh module.

3. T49 ECONOMY - SNACK STALL (economy made visible): a stall prop near the campfire where IDLE workers with purse > 0 (window.GuildEconomy purses if present) occasionally walk over, buy a snack (coin FX leaves the purse chip, snack in hand 60s, tiny happiness hop), while broke workers linger looking wistful (gray '...' bubble); prices nudge up with session snack count. Rationale: makes theme-5 wealth drive visible behavior - playability + economy compounding. Fresh module worker_snackstall.js.
4. T50 SELF-DOCUMENTATION - GUILD PLAQUE CARVER (the island tells the guild's story): a stone-carver prop where the visitor can press E to engrave the newest milestone milestone (first five shipped, flawless streak, map level) onto a real plaque wall built from live board history (done/failed counts, mapLevel), each plaque dated. Rationale: deepens the user's aggressive self-documentation green-light with a hands-on ceremony. Fresh module worker_carver.js.
## Seeded (foreman, 2026-10-13)
- Run 4 (2026-10-13 evening): seeded to missingno - T45 guild archives, T46 spar
  break (both from Queue; laguna NOT seeded - circuit breaker still active from
  T38-T40; step5 not seeded, window dies ~Oct 16). Queue replenished with
  T47 snack stall, T48 scroll run (foreman proposals).
- Run 3 (2026-10-13 ~15Z): seeded to missingno - T43 wishing well, T44 storm
  chatter (both from Queue; laguna NOT seeded - 3 consecutive failures T38-T40,
  circuit breaker active; step5 not seeded, window dies ~Oct 16).
- Run 2 (12:25Z): seeded to missingno — T38 ledger, T39 controls, T40 guides
  (RE-ROUTED from laguna after 3 straight failures there; specs unchanged,
  attempts reset; laguna's broken leftovers in tasks_out get overwritten),
  plus T41 XP-orb minigame (queue top), T28 rain shelter (overlay-only: awnings
  + umbrellas + shiver; client owns positions), T30 lantern festival (every 5
  collective done, 40s), T33 firefly grove (night, swarm to resting visitor),
  T34 tiny garden (90s real-time growth near museum).
- T35 PERSONALITY ENGINE (longcat W1) — worker_personality.js: archetypes with voice (missingno glitchy trickster, step5 aloof poet, laguna eager rookie, longcat serene philosopher); journal bubbles + nameplate flourishes flavored by voice.
- T36 MUSEUM WING (longcat W2) — worker_museum.js: pedestal plaques auto-generated from V.allTasks history; gold done / amber pending / red failed; guided labels when visitor stands near.
- T37 PATRON LICENSE (longcat W3) — worker_purpose.js: visitor endorses a working worker's quest (E near them); when it ships, +REP with ceremony + cue; PATRON LICENSE card bottom-left, ranks NOVICE->FRIEND->LEGEND.
- T38 GUILD LEDGER — worker_ledger.js: ticker-tape strip near the entrance scrolling the guild's real recent tick lines; the island reads like a repo.
- T39 CONTROLS CARD (steal: balik-kampung onboarding) — worker_controls.js: first-visit parchment card listing the controls (WASD/arrows walk, E talk/pet/endorse, drag pan, wheel zoom, 1-4 emotes), any-key dismiss, gold #d4af37 accents; never blocks after first dismiss (session-only).
- T40 GOLD GUIDES (steal: balik-kampung 'ikut penanda emas') — worker_guides.js: soft gold chevron markers orbiting the visitor pointing at the nearest point of interest (quest board, museum pedestal, a working worker, the cat), rotating when reached.

## Done (moved here once verified)
- T27 quest board, T31 emotes, T32 journal (charter 1-3, missingno, all
  first-try). T29 (old museum sketch) superseded by T36 museum wing.
- T15-T21: departments/states/fleet, day-night+weather, bubbles/plaques, sound
  cues, pan/zoom camera, text discipline.
- T22 title screen; T23B visitor module (WASD + talk); L1 guild cat (laguna,
  pettable: hearts + meow); idle RNG wander (stroll/campfire/cat/sky-gaze);
  full-viewport canvas + two-row header.

## Parked (do not seed without user ask)
- 3D mode (killed Oct 13; code in git history)
