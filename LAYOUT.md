# THE MASTER LAYOUT — the island's town plan (authoritative coordinates)
Floor: growth-step 8 -> gx,gy in [-10, 9]. Screen: gx-gy grows right, gx+gy grows down.
Districts are 4+ tiles apart on purpose; every prop must sit inside its district.

| district | anchor (gx, gy) | contents | owner quests |
|---|---|---|---|
| HEARTH (center) | 0, 0 | buildings x4, campfire, forge, cat, spar, banter | client-fixed |
| QUEST ANNEX (S of hearth) | -1.6, 4.2 | walk-up quest board | T27 (fixed) |
| MARKET ROW (S band, E side) | 2.5, 6 | snack stall + price board, arcade sign | T49/T57 (relocated Oct 14) |
| PONDSIDE (SE rim) | 5, 5.5 | fishing dock + pond (waterfall lands S of it) | T59 (relocated Oct 14) |
| MUSEUM ROW (SW band) | -5..-2, 4..5 | exhibit pedestals + plaques | T36 (fixed Oct 13) |
| GARDEN (E edge) | 6, 1 | crop plots, butterflies visit here | T34 (pinned Oct 14 — was init-order-stranded at -9,-9) |
| CRYSTAL GROVE (NW) | -6..-4, -4..-1 | glowing crystal clusters | T64 (pending) |
| HEROES' PLAZA (SE) | 4..6, -3..-1 | 4 golden worker statues | T68 (pending) |
| AVIARY ROOSTS (NE) | -4..-1, -6..-4 | bird landings, night owl | T66 (pending) |
| S RIM WATERFALL | 2..4, south edge | waterfall + mist + spring | T65 (pending) |
| SHRINE (N) | 0, -5 | wishing well / shooting-star wishes | T51 (locate if pinned) |

RULES (enforced by the director's reviews):
- One prop identity per district; two same-identity props within 2 tiles = a clump, relocate one.
- New props claim an EMPTY district or found a new one 4+ tiles from all existing anchors.
- ROADS (quest pending): cobblestone paths connect HEARTH -> each district anchor.
- The hearth stays social: no new permanent props within 2 tiles of (0,0).
