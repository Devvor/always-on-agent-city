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
  NEW Oct 15: opencode/deepseek-v4.1-flash-free (board_deepseek.json, engine =
  opencode CLI via missingno_worker_tick5.py, free on OpenCode Zen for a
  limited time, no auth, zero-retention). BENCH VERDICT: full-size quest
  first-try (D2, 538 lines, $0.00); needs 480s engine timeout (240s timed out
  on D1 and the paid escalation ladder finished it — $0.05, month cap intact).
  FOREMAN: seedable like any board; give it craft-heavy polish quests.
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

1. T178 VISITOR TIP RITUAL (proposed; G3 attempt blocked - glm window closed Oct 16 ~10:16Z mid-run) - economy x playability: the visitor can drop a coin on any worker; a coin ripple + the worker's happiness visibly lifts, and a thanks line appears - every coin traces to a real shipped quest.
2. T179 NIGHT WATCH OWL (proposed) - living world: a small owl roost in the NE aviary that hoots (cue hook, try/catch) on the hour and swivels its head as the visitor passes - gives the empty NE lobe a heartbeat.
3. T180 EDGE WATERFALL PLINTH (proposed, foreman) - spectacle x districts: a stone plinth + plaque at the NORTH_RIM waterfall that auto-lists the guild's three longest-done quests from window.allTasks - the rim stays sparse, one prop, gold engraving only.
4. T181 HEARTH WANDERER (proposed, foreman) - living world: one guild cat that slow-patrols between district anchors (PONDSIDE -> MARKET -> PLAZA), naps 2 min per stop, and purrs (cue, try/catch) when petted - pulls the visitor's eye outward along the roads instead of the hearth.

(seeded 2026-10-16 run 35: T176 -> D26 deepseek, T177 -> D28 deepseek)
(director arc T172 Q1-Q3 + T171 seeded 2026-10-16 run 34; T170 claimed/done by nemotron run 33)

## Seeded
- 2026-10-16 run 36 (foreman ~10:2Z): MIGRATION WAVE 2 seeded. laguna (breaker cleared by L105-L107 run): L108 fishmarket->PONDSIDE, L109 lilypads->PONDSIDE, L110 crystalbloom->CRYSTAL_GROVE, L111 crystalchime->CRYSTAL_GROVE. deepseek: D29 fishhut->PONDSIDE, D30 glowfish->PONDSIDE, D31 hatch->PONDSIDE, D32 driftbarge->PONDSIDE, D33 nightmarket->MARKET, D34 busker->MARKET, D35 owlcourier->AVIARY. glm NOT seeded: window flipped closed ~10:16Z mid-run (T178/T179 stay queued). missingno NOT seeded: breaker (T155-T159). longcat NOT seeded: breaker (W1-W3). step5 closed. QA findings all resolved (no open). Spot-audit clean: L107 worker_wishlanterns.js node --check OK + 6 Guild refs; D28 worker_workbench.js OK, commit d4d46b9 matches title (411 lines, self-doc playability). All boards re-parsed: valid target_file + full schema on every task. Server 8798 answering 200.
- 2026-10-16 run 35: D26 graveyard, D27 SW market stall satellite, D28 foreman workbench (deepseek); L105 fishing bobber, L106 campfire banter, L107 E garden wish lanterns (laguna). board.json NOT seeded (circuit breaker: T155-T159 consecutive fails).

## Seeded (foreman, 2026-10-16, run 34)

- Run 34 (2026-10-16 ~07Z, foreman): converted the director arc + Queue FIRST -> seeded 6 to deepseek
  (window open, breaker clear: D1-D19 all done): D20 arc Q1 prayer-flag line (E lobe), D21 arc Q2 founders'
  bench (E lobe), D22 arc Q3 time-capsule hollow (NE far corner) — all three satisfy the MED 'next 3 props must
  land E/NE lobe + far corners'; D23 T171 visitor scrapbook (Queue head after T170 was claimed); D24 T173
  far-corner compass sundial (far NW corner) + D25 T174 NE kite field (E/NE lobe) — foreman inventions, also
  on the lobe/corner directive. Seeded 1 to nemotron (window open, N1 done, breaker clear): N2 T175 horizon
  telescope (NE rim). Pending now 6 deepseek + 1 nemotron. missingno NOT seeded: 5 consecutive failures
  (T155-T159) -> CIRCUIT BREAKER ACTIVE. laguna NOT seeded: 3 consecutive failures (T94/T97/T104) ->
  CIRCUIT BREAKER ACTIVE. step5 closed. Queue replenished with proposals T176 post-scrape graveyard +
  T177 foreman workbench. Spot-audit clean: deepseek D19 worker_tideglass.js node --check OK, 5x
  window.Guild refs, line-1 clean, commit cda4d21 matches title; nemotron N1 worker_clocktower.js node
  --check OK, 5x Guild refs, commit b5fd572 matches title. Server 8798 answering 200. All board JSONs
  re-parsed: every task has a full-schema target_file starting tasks_out/.

T172 DIRECTOR ARC — THE QUIET LOBES: PITCH: the guild builds a wild,
   half-forgotten corner of the island and turns it into the calmest place to stand. LOOP: feeds the
   visitor loop — a distant spark (prayer flags on the wind) pulls you to the barren E/NE lobe; each
   interaction reveals one more of the lobe's three secrets. NEED: CURIOSITY first, EXPRESSION second
   (the visitor leaves one mark there). ARC: Q1 prayer-flag line strung across the E lobe (flags ripple,
   gold only); Q2 a founders' bench with the guild cat's pawprint plaque (E interact, sit = calm
   emote + soft chime); Q3 a hidden 'time-capsule hollow' dug in the NE corner — the visitor buries
   one endorsed quest memory (ties to patron license); SPECTACLE FINALE Q4: at the next night cycle the
   whole lobe lights up with a single slow lantern ascent — one lantern, not forty. RISK: adding props
   fights the accent-color budget and the empty-floor pacing rule; guard = gold-only palette, three
   props max, no HUD additions, lobe stays sparse (calm beat, not density).
## Seeded (foreman, 2026-10-15)

- Run 31 (2026-10-16 ~02Z, foreman): converted Queue FIRST -> seeded 6 to deepseek (window open,
  breaker clear: tail D1-D10 all done): D11 T160 petting-zoo ledger (E garden), D12 T164 rivalry
  notice board (SE plaza), D13 T165 frost ferns (N edge), D14 T166 message-in-a-bottle (S rim),
  plus foreman inventions D15 ice-mirror pool (N edge) + D16 drift-market barge (S rim) - both
  satisfy the MED 'next 3 seeded props must claim S rim / N edge' finding. missingno NOT seeded:
  5 consecutive failures (T155-T159) -> CIRCUIT BREAKER ACTIVE. laguna NOT seeded: tail 3
  consecutive failures -> CIRCUIT BREAKER ACTIVE. step5 closed. Queue replenished with proposals
  T167 ice-mirror moonpath + T168 tide-combs. Spot-audit clean: deepseek D10 worker_wishedrift.js,
  missingno T154 worker_stargazing.js, laguna T91 worker_catnaps.js all node --check OK, window.Guild*
  exports present, line-1 clean; D10 commit d86c4ad matches title. Server 8798 answering 200.
  Remaining unconverted findings are all orchestrator-side (memorybook relocation to W wing,
  HUD POI consolidation, label-overlap priority, sign clips, accent retirement).
## Seeded (foreman, 2026-10-16)

- Run 32 (2026-10-16 ~04:15Z, foreman): converted the Queue FIRST -> seeded 3 to deepseek (window open,
  breaker clear: D1-D15 all done, D16 pending): D17 T167 ice-mirror moonpath (N edge), D18 T168 tide-combs
  (S rim), D19 T169 tide-glass lanterns (S rim, foreman invention) - together they complete the director MED
  finding "next 3 seeded props must claim S rim / N edge". Also FIXED D16's verify_cmd: the doubled-path bug
  (tasks_out/tasks_out/) recurred in run 31's seeds; repaired before the tick could falsely fail it. Pending
  now 4 (all deepseek). missingno NOT seeded: window open but 5 consecutive failures (T155-T159) ->
  CIRCUIT BREAKER ACTIVE. laguna NOT seeded: 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE.
  step5 closed. Queue replenished with proposals T170 hourly clock-tower chime + T171 visitor scrapbook;
  lantern-night-market arc entry removed from Queue (all beats shipped, closes on orchestrator visual QA).
  Spot-audit clean: deepseek D15 worker_icemirror.js (381 lines, commit dd70529 matches title),
  missingno T154 worker_stargazing.js, laguna T91 worker_catnaps.js - all node --check OK, window.Guild*
  refs present, line-1 clean. Unconverted findings remain orchestrator-side (memorybook relocation,
  HUD POI consolidation, label-overlap priority, sign clips, accent retirement).

- Run 33 (2026-10-16 ~05:30Z, ORCHESTRATOR): WORKER #6 NEMOTRON JOINED THE GUILD —
  NVIDIA Nemotron 3.5 Super VL (120B-A12B, multimodal) went FREE on OpenCode Zen; cloned the
  deepseek tick into missingno_worker_tick6.py -> board_nemotron.json (cron 66172923bf90, 20m),
  office server now lists 6 workers. BENCH SEEDED per guild protocol (one real quest before
  workstream assignment): N1 = T170 hourly clock-tower chime — FOREMAN NOTE: T170 is CLAIMED
  by nemotron, do not re-seed elsewhere; next Queue head is T171. Also: foreman's D17-D19 seeds
  went out once with 'tf' instead of 'target_file' and crashed tick5 twice (KeyError) - board was
  repaired and tick5/tick6 now auto-repair that key; foreman must emit full task schema
  (id/title/status/attempts/target_file/verify_cmd/spec/include_files) exactly.

- Run 30 (2026-10-15 ~23:59Z, foreman): converted Queue FIRST -> seeded T161 + T163 to deepseek
  (window open, breaker clear: tail D1-D8 all done) as D9 lantern ferry (S rim) + D10 wish scale
  drift (S rim) - both satisfy the MED finding "next 3 seeded props must claim S rim / N edge".
  missingno NOT seeded: 5 consecutive failures (T155-T159) -> CIRCUIT BREAKER ACTIVE, flagged.
  laguna NOT seeded: 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 closed.
  Queue replenished with proposals T165 frost ferns (N edge) + T166 message-in-a-bottle (S rim).
  Spot-audit clean: deepseek D8 worker_emotering.js + missingno T154 worker_stargazing.js +
  laguna T91 worker_catnaps.js all node --check OK, window.Guild* refs present, line-1 clean.
  Remaining unconverted findings are all orchestrator-side (hub-density reposition, T155 memorybook
  relocation to W wing, HUD POI consolidation, label-overlap priority, accent retirement, sign clips).
- Run 29 (2026-10-15 ~23:40Z, ORCHESTRATOR — SPREAD PASS, thedev directive 'everything is still clumped, spread everything out'): core client P1-P4 buildings moved from the 2x2 center clump (-2,0)/(0,-2)/(1,0)/(0,1) to the cardinal edges: P1 (-8,2.5) W, P2 (-7.5,-5) NW, P3 (7.5,0.5) E, P4 (-4.5,6) SW — all spots collision-checked >=2 tiles from every known zone prop. Core hearth satellites spread: banner -> (2,-4), bookshelf-stall -> (2.5,-2.5), forge -> (-2,2); campfire + monument + cat + coin pile STAY as the social hearth (charter-protected). Misplaced props moved to their spec-ordered zones: stargazing post -> N edge (0,-8), lighthouse -> S rim (4.5,7.5), guild bell pair -> (−4.5,−0.5), memorybook -> W wing (−7.5,4.5). COUPLING FIX: 5 modules carried hardcoded copies of the old core coords as avoid-lists (breathe/firejar2/lanternpath/murmur/namingday) — all updated. QA: BUILDINGS verified live at new coords via CDP, 41 center pixel-blocks lost their dark mass, all 11 files pass node --check, page renders healthy (129 Guild globals). Director: next pass should re-check the clump finding against the new layout. LESSON: modules copy core coordinates into avoid-lists — any future core position change MUST grep worker_*.js for stale copies.
- Run 28 (2026-10-15 ~20Z, foreman): missingno was 1 pending (T154) -> seeded 5 to missingno (window open), converting the Queue FIRST: T155 festival memory book (W wing) + T156 treasury vault glint (SW), then foreman inventions T157 market busker (SW row, economy x living world), T158 garden pet fox (E garden, playability x living world), T159 rim lantern buoys (S rim, spectacle; gold glow only). Also seeded 2 craft-heavy polish quests to deepseek (window open): D7 derby podium ceremony (compounds with T149), D8 visitor emote reaction ring (juice pass). laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). DESIGN_FINDINGS unconverted remain orchestrator-side (HIGH central-hub density / MED hub label overlap / LOW sign clips). Spot-audit clean: missingno T153 worker_lighthouse.js node --check OK, 12 Guild/Lighthouse refs, line-1 clean, commit 271cf16 matches title; deepseek D6 worker_footprints.js node --check OK, GuildFootprints export, commit clean. Queue replenished with proposals T160 petting-zoo ledger + T161 night-market lantern ferry. Pending now 6 missingno + 2 deepseek.
- Run 27 (2026-10-15 ~18Z, foreman): missingno was 0 pending -> seeded 6 to missingno (window open), converting the remaining MED finding first: T149 S-rim fishing derby (playability x economy; S rim is a priority zone per the MED 'empty floor ~35% / prioritize S rim + N edge' finding), T150 N-edge cairn trail (self-doc x spectacle, N edge priority), T151 market row price board (economy x self-doc), T152 worker dream bubbles (personality x living world), T153 S-rim lighthouse (spectacle), T154 N-edge stargazing post (playability x self-doc). Queue cleaned: T147/T148 were built as deepseek D1/D2 (done) - removed; proposed T155 festival memory book + T156 treasury glint. laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). deepseek D5/D6 pending (window open). DESIGN_FINDINGS unconverted: HIGH central-hub density (satellite stall built, original-stall removal is orchestrator-side) + MED hub label overlap + LOW clips/debug counter - all client/orchestrator-side, workers cannot edit worker_office.js. Spot-audit clean: missingno T146 worker_butterfly.js node --check OK, 4x window.Guild refs, line-1 clean, commit 058de6d matches title; deepseek D4 worker_statusflair.js OK (commit fb1d01f); laguna T91 worker_catnaps.js re-checked OK. Pending now 6 (all missingno) + 2 deepseek.
- Run 26 (2026-10-15 ~16:50Z, ORCHESTRATOR — worker #5 species online, user-approved): deepseek = opencode/deepseek-v4.1-flash-free via the OpenCode CLI (no auth, free limited-time window). Engine /opt/data/scripts/missingno_worker_tick5.py, cron 20m no_agent (same Slack deliver), board_deepseek.json, tick5 has a flock overlap guard + 480s engine timeout (100KB client includes need it; 240s timed out once and the paid ladder finished D1 for $0.05). Office server /api/board now serves 5 workers (deepseek nameplate verified by screenshot QA). Seeded 6 polish quests, D-series, charter-queue conversions FIRST: D1 T147 birdwatching journal (DONE — built by paid fallback after timeout, clean) + D2 T148 naming-day ceremony (DONE first-try by DeepSeek itself, 538 lines, $0.00 — the bench PASS), D3 dockside arrivals ferry, D4 worker activity status flair, D5 golden-hour sky grade, D6 visitor footprints. Quality bar per thedev Oct 15: pallete-office-grade polish (living statuses, arrivals, moments that stop you) — route craft-heavy quests here. D3-D6 pending. missingno unchanged, 6 pending. step5 not seeded (dies ~Oct 16). laguna breaker unchanged.
- Run 25 (2026-10-15 ~16Z, foreman): both boards were 0 pending. Queue converted FIRST -> seeded to missingno (window open): T141 night-market merchant moods (was T139) + T142 guild time capsule (was T140), plus foreman inventions T143 lamplighter dusk rounds (living world, reuses gold only), T144 souvenir coin press at treasury plaza (playability x economy), T145 N-rim watchtower signal lantern (spectacle x self-doc), T146 butterfly meadow E garden (living world fauna; also serves the recurring MED 'thin zones / ~60% featureless floor' finding). laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). Spot-audit clean: missingno T138 worker_statueglow.js node --check OK, 3x GuildStatueGlow refs, line-1 clean, commit e59c628 matches title; laguna T91 re-checked clean in prior runs. Queue replenished with proposals T147 birdwatching journal + T148 worker naming-day ceremony. Server 8798 answering 200. T138 + T136 + T137 + T97 + T104 ready to wire.
- Run 24 (2026-10-15 ~14Z, foreman): both boards were 0 pending. Queue items converted FIRST -> seeded to missingno (window open): T136 letter-writing desk + T137 pond feeding sink (from Queue), then re-routed 2 laguna-failed zone quests to missingno with attempts reset: T97 crystal grove chimes (NW) + T104 pond mist (S rim), reset failed T119 lantern greeter (arc Q2, genuine failure, retry), plus foreman invention T138 hero statue victory glow (SE plaza, spectacle x self-doc; references window.GuildStatues, no new colors). laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE (T97/T104 now re-routed; still not seeding laguna itself). step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). Spot-audit clean: missingno T135 worker_windsocks.js node --check OK, 5x window.GuildWindsocks refs, line-1 clean, commit df8b64c matches title; laguna T91 worker_catnaps.js re-checked clean. Server 8798 answering 200. Lantern arc beats status: T108/T120/T121 done, T119 reset pending (only arc Q2 left). T135 + T134 + T133 + T130 ready to wire.
- Run 23c (2026-10-15 ~11:40Z, foreman): missingno was 1 pending (T130) + T127/T128/T129 done first-try -> seeded 5 to missingno (window open): T131 firefly jar + T132 worker routines (from Queue, converted FIRST), then DIRECTOR FINDINGS: T133 SW snack-stall annex (HIGH hub-density finding - satellite stall built; REMOVING the original hearth stall stays orchestrator-side, workers cannot edit worker_snackstall.js) and T134 W-wing curator cart + T135 NE aviary windsocks/bird-call (both from the MED 'thin zones' finding). Queue had 0 left -> proposed T136 letter-writing desk + T137 pond feeding sink. laguna NOT seeded: window CLOSED (checked 11:24Z) + tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). Spot-audit clean: missingno T129 worker_crystalbloom.js node --check OK, window.GuildCrystalbloom present, line-1 clean, commit d1340bd matches title; laguna T91 worker_catnaps.js re-checked clean. Server 8798 answering 200. Unconverted findings are all orchestrator-side (accent colors 7->budget, EASURY label clip, fireflies debug HUD counter, chat-log truncation = extend T110 helper, hearth-stall removal). T130 + T129 + T128 + T127 + T126 + T125 + T124 ready to wire.
- Run 23b (2026-10-15 ~10Z, foreman): missingno was 2 pending (T125/T126) -> seeded 4 to missingno (window open): T127 S-rim tide pools + T128 campfire storyteller (both from Queue, converted FIRST), plus foreman inventions T129 NW crystal grove night blooms + T130 museum audio guide. Queue had 0 left -> proposed T131 firefly jar minigame + T132 worker daily routines. laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). Spot-audit clean: missingno T124 worker_crickets.js node --check OK, window.GuildCrickets present, line-1 clean, commit 6d024b3 matches title; laguna T91 worker_catnaps.js re-checked clean. Server 8798 answering 200. Still-open MED (accent colors at 7) needs orchestrator-side retirement - workers cannot touch existing modules' colors. T124 + T123 + T122 + T121 + T120 ready to wire.
- Run 22 (2026-10-15 ~08Z, foreman): missingno was 1 pending (T123) + T120/T121/T122 new done (lantern arc Q3/Q4 + NE aviary; T121 took 3 attempts) -> seeded 5 to missingno (window open): T117 snowman build-off, T118 mystery hatch vault-audit, T124 cricket chorus, T125 mushroom rings (all four from Queue, converted FIRST), plus T126 S-rim driftwood nook + shell chimes (foreman invention converting the still-open MED 'thin zones' finding onto the S rim). Queue had 0 left -> proposed T127 tide pools + T128 campfire storyteller. laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). Spot-audit clean: T122 worker_aviary.js node --check OK, line-1 clean, GuildAviary refs present, commit 1d88397 matches title. T119 failure is genuine (no file delivered, attempt 1 of 3). Server 8798 answering 200. T122 + T121 + T120 ready to wire (lantern arc complete pending orchestrator wiring).
- Run 21 (2026-10-15 ~05Z, foreman): missingno was 1 pending (T116) + 4 new done first-try (T108 night market, T112 story bench, T114 postcard, T115 roast) -> seeded 5 to missingno (window open): T119 lantern greeter (arc Q2), T120 lantern-wishing (arc Q3), T121 lantern finale (arc Q4) — the ACTIVE director arc's remaining beats, then T122 NE aviary nest village + feeding perch and T123 W museum rotating exhibit plinth (both from DESIGN_FINDINGS MED 'thin zones', converted FIRST). Queue had only 3 items -> proposed T124 cricket chorus + T125 mushroom rings. laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). Unconverted findings: LOW (accent-color retirement to 7->budget, EASURY label clip, fireflies debug counter) — noted for orchestrator, workers cannot touch existing modules' colors. Spot-audit clean: missingno T115 worker_roast.js node --check OK, window.GuildRoast export present, line-1 clean, commit 0a5dd08 matches title; laguna T91 worker_catnaps.js re-checked clean; step5 S2 re-checked clean. Server 8798 answering 200 (prior run). T115 + T114 + T112 ready to wire.
- Run 20 (2026-10-15 ~04Z, foreman): missingno was 2 pending (T112/T113) + 3 new done (T110/T111 director findings shipped first-try, T106/T107 done) -> seeded 4 to missingno (window open): T108 night market (director arc from Queue, TOP priority), plus foreman inventions T114 postcard stand (SW, playability x self-doc), T115 campfire marshmallow roast (hearth, living world), T116 glow-fish rise (S rim, spectacle). laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6 (all missingno). DESIGN_FINDINGS: no unconverted HIGH/MED. Queue replenished with proposals T117 snowman build-off + T118 mystery hatch. Spot-audit clean: missingno T111 worker_breathe.js + T107 worker_stonestour.js node --check OK, window.GuildStoneTour export present, line-1 clean, commit c56f155 matches T107 title. laguna newest done T91 worker_catnaps.js re-checked clean (prior run). Server 8798 answering 200. T107 + T111 ready to wire.
- Run 19 (2026-10-15, foreman): missingno 0 pending after T105 shipped + T102/T103 failed -> seeded 6 to missingno (window open): T110 HUD text discipline (director HIGH, FIRST), T111 ambient idle breathing pass (director MED, SECOND), T106 glow-fish + T107 history-tour stones (from Queue), plus foreman inventions T112 story bench (W wing, playability x self-doc) and T113 lily pads + frog (S rim, spectacle) — invented because the Queue dropped to 1 item (T108 arc) after seeding. laguna NOT seeded: tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE. step5 not seeded (dies ~Oct 16). Pending now 6/6 (all missingno). No unconverted HIGH/MED findings remain in DESIGN_FINDINGS. Spot-audit clean: T105 worker_pigeonpost.js node --check OK (commit 5ea4d14 matches), laguna T91 worker_catnaps.js node --check OK, window.Guild* exports present, line-1 clean. T105 ready to wire.
- Run 18 (2026-10-15, foreman): NO seeding possible this run. missingno window CLOSED (23:02Z probe, price>0) - not seeded. laguna window open but tail = 3 consecutive failures (T94/T97/T104) -> CIRCUIT BREAKER ACTIVE, not seeded. step5 not seeded (dies ~Oct 16). Pending across boards = 3 (T102/T103/T105 on missingno) vs target 6 - shortfall flagged. DESIGN_FINDINGS converted FIRST: HIGH (HUD text truncation) -> T110 worker_hudtext clamp/ellipsize helper; MED (static world, no rain/idle motion evidence) -> T111 ambient idle breathing pass; both appended to Queue. No unconverted HIGH/MED remain. Spot-audit clean: T99 worker_nightguard.js + T91 worker_catnaps.js node --check OK, window.GuildNightGuard/GuildCatnaps exports present, line-1 clean, commit a9cb8ef matches T99 title. Server 8798 answering 200. Next run: re-probe missingno window, wait out laguna breaker before seeding; when a window opens, seed T110 first (HIGH finding).
- Run 17 (2026-10-15 ~00Z, foreman): both boards 0 pending. DESIGN_FINDINGS: no unconverted HIGH/MED (server 8798 confirmed 200). Seeded 5 to missingno: T100 fountain wish toss + T101 census board (from Queue), plus inventions T102 drifting sky-isles (spectacle), T103 garden weather vane (E wing), T105 pigeon post letters (NE, playability x personality); 1 to laguna: T104 pond mist wisps at dusk (simple FX = its genre; laguna tail 2 consecutive failures T94/T97, under breaker). Pending now 5 missingno + 1 laguna = 6/6. step5 NOT seeded. Spot-audit clean: T99 worker_nightguard.js + T91 worker_catnaps.js node --check OK, Guild* exports present, commit a9cb8ef matches title (T99 took 3 attempts). Queue replenished with T106 glow-fish + T107 history tour. Note: missingno hit a 3-failure streak (T95/T96/T98) before T99 shipped - recovered, breaker clear.
- Run 16 (2026-10-14 ~20Z, foreman): both boards were 0 pending (T89-T93, T91 all done first-try). DESIGN_FINDINGS: no unconverted HIGH/MED left (server finding already resolved). Queue was fully stale (T82-T93 done) -> cleared; foreman inventions seeded 6 across the thin districts: missingno - T95 statue plaque whispers (SE heroes plaza), T96 market crowd murmur (SW), T98 ringable guild bell (compounds with T93 bell tower), T99 museum night guard (W wing); laguna - T94 birdsong request (NE aviary), T97 crystal grove chimes (NW). Pending now 4 missingno + 2 laguna = 6/6. step5 NOT seeded - window dies ~Oct 16. No accent colors added (finding 4 respected). Spot-audit clean: T93 worker_guildbell.js + T91 worker_catnaps.js node --check OK, window.GuildBell/GuildCatnaps exports present, commit 66e99e2 matches title. Queue replenished with T100 fountain wish toss + T101 guild census board.
- Run 14 (2026-10-14 ~16Z, foreman): pending across both boards was 0 (T76-T81 all done). Queue T82/T83 consumed FIRST -> seeded to missingno: T82 crystal-shrine offering (NW grove), T83 guild map poster (S entrance), T84 pond fishing (RE-ROUTED from laguna T59 after its failure there; spec unchanged, attempts reset), plus foreman inventions T85 treasury payroll ceremony (every 50 GC minted -> coin-rain at vault) and T87 fish market stall (SW market row; sells Fishing catches for GC). laguna window open, tail 1 failure T73 (under breaker) -> seeded T86 rain puddles (simple FX = its strongest genre). Queue replenished with T88 S-rim waterfall rainbows. Pending now 5 missingno + 1 laguna = 6/6. step5 NOT seeded - window dies ~Oct 16. Spot-audit clean: T81 worker_firejar.js node --check OK, commit b1a35ac matches title. T82-T85, T86 pending.
- Run 13 (2026-10-14 ~13Z, foreman): GRADER RESCUE - T71/T72/T74/T75 were marked failed by foreman verify_cmd bugs (doubled tasks_out/tasks_out/ path; roost attaches via w.GuildRoost, missed by a literal window.GuildRoost grep). All four delivered files were fine; verify_cmds fixed, corrected gates pass VERIFY-OK, statuses flipped to done, breaker cleared (missingno had 4 consecutive false failures). Restocked: missingno was 0 pending -> seeded T76 lantern path (SE), T77 market haggling, T78 museum admirers, T79 failure candle, T80 aurora, T81 firefly jar. Queue stale T74/T75 removed (seeded run 12, now done); proposed T82 crystal-shrine offering + T83 guild map poster. Pending now 6/6 on missingno; laguna window CLOSED - not seeded; step5 NOT seeded - window dies ~Oct 16. Spot-audit clean: T70 worker_daydream.js + T67 worker_banners.js node --check OK, git log clean. T63-T70, T65, T67, T71, T72, T74, T75 ready to wire.
- Run 12 (2026-10-14 ~11Z, foreman): DESIGN_FINDINGS converted FIRST - HIGH (central 3x clump) -> T71 market row duplicated into the SW zone on missingno; MED (thin districts) -> T72 NE aviary roost (missingno) + T73 S-rim fishing hut (laguna, prop-only = its strongest genre). Queue was 0 left -> proposed T74 dividends + T75 bug netting, both seeded to missingno. Pending now 5 missingno + 1 laguna = 6/6. step5 NOT seeded - window dies ~Oct 16. laguna tail = 1 trailing failure (T66), under breaker. Spot-audit clean: T70 worker_daydream.js + T67 worker_banners.js node --check OK, line 1 clean, window.Guild* exports present, commit messages match titles. T63-T70 + T65 ready to wire (client modules not yet in worker_office.html).
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

- Run 29 (2026-10-15 ~22Z, foreman): ALL four seedable boards breaker-tripped (missingno 5 consecutive fails T155-T159, laguna 4 T94-T104, longcat 3, deepseek 3) AND pending=0 everywhere -> NOTHING seeded; breakers flag. Proposals added to Queue: T163 wish-scale drift (economy), T164 rivalry notice board (self-doc x personality). Spot-audit clean: missingno T154 worker_stargazing.js node --check OK + window.GuildStargazing export, commit d10e9d6 matches title; laguna T91 worker_catnaps.js node --check OK. Wiring is auto (loader fetches server manifest), so no 'ready to wire' backlog. step5 window dies ~Oct 16. DESIGN_FINDINGS HIGH/MED (hub density, label overlap) remain orchestrator-side client edits.
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
- Run 15 (2026-10-14 ~18Z, foreman): both boards were 0 pending (T82-T85, T87 + T86 all done first-try). DESIGN_FINDINGS: the HIGH server-down finding is RESOLVED (8798 already answering 200, restarted by an earlier run/worker); no unconverted HIGH/MED left. Seeded 6: missingno T88 waterfall rainbows (from Queue), T89 owl courier NE, T90 guild timeline mural W wing, T92 wish seeds E garden, T93 guild bell; laguna T91 cat sunbeam naps (breaker cleared by done T86; simple-FX = its strongest genre). Pending now 5 missingno + 1 laguna = 6/6. step5 NOT seeded - window dies ~Oct 16. Spot-audit clean: T87 worker_fishmarket.js + T86 worker_puddles.js node --check OK, window.Guild* exports present, commits match titles. T82-T87 + earlier modules ready to wire.
