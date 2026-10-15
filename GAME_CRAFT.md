# GAME_CRAFT — the Guild's design canon
Distilled, actionable game-design principles. The DIRECTOR critiques every new build
against this file. When a critique and this file disagree, this file wins; when this
file is proven wrong by a shipped build, the director proposes an amendment.

## 1. THE FIVE-SECOND TEST (the player's eye path)
Open the game cold. In five seconds the player must be able to answer: where am I,
what can I do, what invites me? On a screenshot: trace the eye path — the brightest,
highest-contrast, most-animated pixel cluster wins the eye. Is that cluster the most
important thing? If the eye lands on a status bar before it lands on the world, the
shot fails. Test every new prop: does it help or steal the eye path?

## 2. THE CORE LOOP (goal -> act -> feedback -> reward -> new goal)
Every feature must either FEED the loop or BE the loop. The visitor's loop today:
see a spark of curiosity -> walk to it -> interact (E) -> get feedback (coins, rep,
sound, animation) -> see the next spark. A feature that doesn't connect to this chain
is decoration. Ask of any proposal: what does the player DO with it, and what do they
GET for doing it? If the answer is "watch", it is a screensaver, not a feature.

## 3. JUICE — every action deserves a response
No silent actions. Petting the cat gives hearts AND a sound; shipping a quest gives
mint text AND a statue gleam. The hierarchy of feedback: motion > particles > sound >
text. When adding a feature, budget the juice FIRST (what happens on success? on
failure? on repeat?), then the mechanics. A boring mechanic with great juice beats a
great mechanic with no juice.

## 4. LEGIBILITY — the world must be readable at a glance
- Sightlines: the player should see a POI (point of interest) from wherever they
  stand; if something is hidden behind buildings or off-island, it does not exist.
- Districts: each zone has ONE identity (market, grove, plaza). Two props with the
  same identity within 2 tiles of each other read as clutter, not content.
- Color discipline: max ~3 accent colors on screen at once beyond the base palette.
  Every new module adding a new accent color raises the noise floor — a new color
  must EARN its place by marking something the player must find.
- Text floor: nothing smaller than ~8px rendered; plaques fail if they need zoom to
  read. Sign text fails if it overlaps another sprite.
- Empty space is not a bug — it is pacing. But >20% of the visible floor being
  featureless IS a bug.

## 5. ONBOARDING — teach by doing, never by reading
The controls card is the LAST resort, not the first. Any new mechanic must be
discoverable: something visibly calls to the player (spark, NPC pointing, sound),
one interaction teaches it, the reward confirms it. If a mechanic needs a paragraph
of text to explain, redesign the mechanic.

## 6. PACING — tension and release
Alternate busy and calm: a dense arcade beat (minigame, delivery run) should be
followed by a calm one (campfire, fishing). Day/night is the macro rhythm (night =
wonder: fireflies, stars, crystals; day = work: builds, market). Never stack two
demanding activities in the same place at the same time.

## 7. ECONOMY — faucets, sinks, and the sink test
Every coin minted (faucet: quest wages, minigame, tips) needs somewhere to go (sink:
stall, wishes, decorations). A currency with no sink inflates into noise. The sink
test: can a player who plays for an hour name at least two things they WANT to buy?
If not, add sinks before adding faucets.

## 8. GENRE MASHUPS — the pattern library
One loop from each genre, tied by a shared currency and a shared world:
- idle/management + life-sim: autonomous workers whose life the player curates
- collection + arcade: fast repeatable beats (fishing, orb-catch) feeding a collection
  (museum, fish-dex, sticker book)
- roguelite + economy: risk/reward runs (deliveries through rain, timed runs) paying
  into permanent progression (rep ranks, district unlocks)
- mystery + exploration: hidden interactions with hint trails (the wishing well, the
  owl, crystals at night) that reward the curious, never the busy
Mashup rule: steal ONE core loop per genre, not two. Two loops from one genre fight
each other; one from each supports the others.

## 9. FUN SKELETON — why does anyone play?
Four needs, in order of importance for us: CURIOSITY (what is that? -> go look),
MASTERY (get better at the loop), EXPRESSION (leave a mark — endorsements, garden,
wishes), STATUS (ranks, statues, ledger). Every proposed feature must name which need
it serves. Features serving none are cut.

## 9b. LABEL DISCIPLINE (text is UI, treat it like one)
- One floating label per prop, one name tag per character. If two labels would overlap on screen, the more important one wins (speaker > visitor > acting worker > prop sign); the loser is NOT drawn.
- Status bubbles sit ABOVE name tags with clear separation — never on top of them.
- Boards show at most 3 lines of standing text; detail lines (counts, moods, hints) appear only when the visitor is near.
- Quests must not draw their own task IDs (T12, L4...) as world text — visitors can't read shorthand.

## 10. THE REVIEW RUBRIC — how the director critiques a screenshot
1. Trace the eye path. Where does the eye land first? Should it?
2. Count POIs visible: fewer than 4 = too sparse, more than 9 = noise.
3. Empty-floor ratio: >20% featureless = flag it.
4. Clumps: any content cluster denser than its surroundings 3:1 = distribute.
5. Color count: accent colors on screen; more than 4 = flag the weakest.
6. HUD: read every label at 100% zoom; any overlap or cut-off = flag.
7. Motion: in a live check, is anything moving when idle? The world must breathe.
8. Name THE single worst thing. One fix per review, not ten.

## 11. THE AMBITION ENGINE — proposing a lofty goal (blue-sky arcs)
One arc active at a time; an arc must SHIP END-TO-END before the next starts.
Template for a proposal:
- PITCH: one sentence a player would repeat to a friend.
- LOOP: which core loop it adds or feeds (must connect to the visitor loop).
- NEED: which of the four fun-needs it serves.
- ARC: 3-6 quests, each shippable in one tick, ending in a moment of spectacle.
- RISK: what could break (legibility? pacing? color budget?) and the guard.
Examples of arc-shaped ideas (park until chosen): seasons system; a night market that
only opens in RAIN; a visitor reputation-driven district unlock; a fishing-dex
collection book; a worker RPG stat sheet (visible moods driving wander choices); a
hidden cave under the island with one secret.
