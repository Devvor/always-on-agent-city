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
4. SPECTACLE — THE GREAT BUILDOUT (user directive Oct 14: 'make the world more creative, really build it out'): the world must never look plain. Sky isles and clouds-below, crystal groves, edge waterfalls, fauna (birds/butterflies/owl), festival bunting, hero statues — every empty corner gets a reason to exist. Plus moments that make you stop and watch (festivals, arrivals, level-ups).
5. DISTRICTS (user directive Oct 14: "everything is centred, no one can see anything — distribute"):
   the island is 20x20 tiles and the content must use it. Anchor new content to ZONES, not the center:
   NW (-6..-4, -4..-1) = crystal grove/mystic quarter; NE (-4..-1, -6..-4) = aviary/bird roosts;
   SW (-1..2, 4..6) = market row + treasury plaza; SE (4..6, -3..-1) = heroes' plaza (statues);
   S rim (2..4, south edge) = waterfall + fishing; W (-6..-4, 2..5) = museum wing; E (4..6, 0..3) =
   garden + wishes. The campfire/forge zone stays the social hearth, but NEW props must claim a zone
   and stand apart. If a quest's visual can share a zone with an existing one, offset it 2+ tiles
   from any existing prop.
6. ECONOMY (user directive Oct 13: "build an economy, see how they react") —
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

## ROLE: THE DIRECTOR (user directive Oct 14: "who determines the fix on an overall basis?")
The design conscience of the colony — a 6h cron that looks at the live game and judges it
against GAME_CRAFT.md (the canon). It captures a screenshot (design_inbox/), reviews it with
the rubric in GAME_CRAFT.md section 10, appends concrete findings to DESIGN_FINDINGS.md as
quest seeds, and advances ONE blue-sky arc at a time (GAME_CRAFT.md section 11 template).
It NEVER builds, NEVER edits boards or worker files — it sees, judges, and proposes.
The foreman converts its findings into quests; the orchestrator wires what ships; the
gates verify. Chain of design authority: GAME_CRAFT.md (canon) -> director (critique) ->
foreman (seeding) -> workers (build) -> gates (verify) -> orchestrator (wiring + visual QA).

## Queue (next to seed - foreman keeps this deep, >=6 pending across boards)

1. T61 LIVING WORLD - NIGHT CAMPFIRE CIRCLE: at night, 2-3 workers drift to the campfire and trade one-liner story bubbles flavored by their personality voices, drawn from real journal/history; spark FX, brighter flicker on a good story. Rationale: living world - idle workers gathering and telling their REAL story is living-world x self-documentation in one cheap module.
2. T69 PLAYABILITY - BURIED TREASURE HUNT: five glinting dirt mounds across the island, E to dig (dirt + sparkle + coin to the visitor), progress chip, golden finale at 5/5. Rationale: playability first - a new thing the visitor can DO that compounds the economy (the visitor earns coins).
3. T70 LIVING WORLD - WORKER DAYDREAM BUBBLES: idle workers think one personality-flavored line about their REAL next quest from board state; eager daydream when a new quest lands. Rationale: living world x self-documentation in one cheap module.
## Seeded (foreman, 2026-10-13)
- Run 11 (2026-10-14 ~09Z, foreman): pending across both boards was 1 (missingno T68 only) - Queue was stale (T61/T62 listed but already seeded run 10). Proposed T69 treasure hunt + T70 daydream bubbles, both seeded to missingno (proven builder; laguna cumulative 6/10 first-try, kept idle). pending now 3/6 - shortfall flagged; laguna NOT seeded. step5 NOT seeded - window dies ~Oct 16. Spot-audit clean: missingno T65 worker_waterfall.js + laguna T67 worker_banners.js node --check OK, line 1 clean, window.Guild* exports present, diffs match titles. T65 + T67 + T63/T64 ready to wire.
- Run 10 (2026-10-14, foreman): both boards at 0 pending, both windows open, no tail breakers. Seeded to missingno -
  T59 pond fishing (RE-ROUTED from laguna after its failure, spec unchanged, attempts reset) + T62 level-up ceremony
  (foreman proposal); to laguna - T61 night campfire circle (foreman proposal, simple living-world genre). step5 NOT
  seeded - window dies ~Oct 16. Spot-audit clean: T57 worker_snackrun.js + T60 worker_market.js node --check OK,
  diffs match titles; both export window.Guild* globals. T57 + T60 + T58 ready to wire.
- Run 9 (2026-10-14, foreman): Queue was empty - proposed T59 pond fishing, T60 stall market
  chalkboard and seeded BOTH to laguna (window open, breaker cleared; missingno window CLOSED -
  not seeded; step5 not seeded, dies ~Oct 16). Spot-audit clean: T58 worker_fauna.js + T57
  worker_snackrun.js node --check OK, diffs match titles.
- Run 8 (2026-10-14, foreman): restocked (both boards were at 0 pending). Seeded to missingno - T55 quest
  acceptance ritual, T57 snack order+delivery (foreman proposal); to laguna - T56 weather moods (from Queue),
  T58 courtyard pigeons (foreman proposal, deliberately the simple-FX job: laguna trails 2 consecutive failures
  T52/T54, one more trips the breaker, so it got its strongest genre). step5 NOT seeded - window dies ~Oct 16.
  Queue now empty; replenish next run. Spot-audit clean: T53 worker_tips.js + T50 worker_carver.js node --check OK.
- Run 7 (2026-10-14, foreman): seeded to missingno - T53 visitor tips; to laguna - T54 guild
  parade (both from Queue; both windows open, no tail breakers: missingno 0 consecutive,
  laguna 1 trailing failure T52 - under the breaker). Queue replenished with foreman
  proposals T55 quest acceptance ritual, T56 weather moods.
- Run 6 (2026-10-13 ~23Z): seeded to missingno - T51 shooting-star wishes; to
  laguna - T52 arrival pigeon (both from Queue; both windows open, no tail
  breakers: missingno 0 consecutive, laguna 0 since T50 done). Queue was empty
  so replenished with foreman proposals T53 visitor tips, T54 guild parade.
- Run 5 (2026-10-14 ~21Z): seeded to missingno - T48 scroll run (RE-ROUTED from
  laguna after its failure; spec unchanged, attempts reset), T49 snack stall;
  to laguna - T50 plaque carver (laguna tail breaker cleared: only 1 trailing
  failure T48; window open). Queue replenished with T51 shooting-star wishes,
  T52 arrival pigeon (foreman proposals).
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
