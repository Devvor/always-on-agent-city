# THE MASTER LAYOUT — the island's town plan (authoritative coordinates)
GREAT RESIZE (Oct 14): floor is now **48×48 tiles** — gx,gy in [-24, 23] at 110+ quests done
(mapLevel 23 = MAX). Screen: gx-gy grows right, gx+gy grows down. Districts sit **12–15 tiles
from the hearth**; minimum separation between any two district anchors is **6 tiles**.

| district | anchor (gx, gy) | contents | notes |
|---|---|---|---|
| HEARTH (center) | 0, 0 | buildings x4, campfire, forge, cat, spar, banter | client-fixed; no new props within 3 tiles |
| QUEST ANNEX | -4, 10 | walk-up quest board | relocated Oct 14 |
| ARCHIVES ROUTE | -7, 7 | lectern, scrolls | on the path hearth→museum |
| RAIN SHELTERS | ±7, 8.5 | two shelter tiles | pair flanks the market route |
| MARKET ROW | 6.5, 14 | snack stall, price board (5, 15.5) | arcade sign at 11, 14 |
| PONDSIDE | ~SE corner | fishing pond + dock (self-anchors to map bounds) | waterfall pours nearby on the S rim |
| MUSEUM ROW | -13..-8, 10..12 | 8 exhibit pedestals | relocated Oct 14 |
| GARDEN | 15, 3 | crop plots | east edge |
| MAP POSTER WALL | -3, -15 | guild map poster | north district |
| CRYSTAL GROVE | -15..-10, -10..-4 | crystal clusters | NW |
| HEROES' PLAZA | 10..14, -7..-3 | 4 golden statues | SE; lantern path connects from hearth |
| SHRINE (N) | 0, -12 | wishing well area | future quests |
| AVIARY ROOSTS (NE) | -10..-3, -15..-10 | bird landings | future quests |
| S RIM WATERFALL | south edge, gx 3 | waterfall + mist (self-anchors) | tracks map edge |

RULES (enforced by the director's reviews):
- One prop identity per district; two same-identity props within 4 tiles = a clump, relocate one.
- New props claim an EMPTY district or found a new one 6+ tiles from all existing anchors.
- The hearth stays social: no new permanent props within 3 tiles of (0,0).
- Lantern/path modules should span between district anchors, not ring the hearth.
- LABEL DISCIPLINE (GAME_CRAFT §9b): one floating label per prop, colliding labels suppressed.

REGISTRY (Oct 16): worker_office.js now publishes window.GuildZones — the runtime source of
truth for every district anchor above. New modules READ their anchor from the registry instead
of hardcoding; the foreman is contractually required to name a district in every new quest spec.

MIGRATION STATUS (Oct 16, wave 1 DONE + committed 9a6b974): aviary + birdsong + birdjournal ->
AVIARY; clocktower -> NORTH_RIM; marketrow stalls -> MARKET ROW; windchimes -> CRYSTAL_GROVE.
Wave 2 (foreman seeds as edit tasks, priority order): harbor cluster (lighthouse, fishmarket,
fishhut, glowfish, hatch, driftbarge) -> PONDSIDE; crystalbloom + crystalchime -> CRYSTAL_GROVE;
nightmarket + busker -> MARKET; owlcourier -> AVIARY; lilypads -> PONDSIDE.
