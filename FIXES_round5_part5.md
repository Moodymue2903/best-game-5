# CROWNBOUND — fix round 5 (final fixes before submission)

Parent commit: `f1bebbf` (fix round 4). Dossier md5 before:
`d619b2947039ed10d1fec90304f11da7`. Dossier md5 after:
**`659b0075dbd467651174d4475954de4d`** (820,759 B, byte-identical twice).

Authorized by the user 2026-11-18 07:56 IST ("Fix all the bugs before
submitting"), after re-vote #3 came back 4x (a) SUBMIT AS-IS — plus the
user's own two cover bug reports, sent with the cover image at 07:59 IST:
"The monkey King is half under the ground which is the bug the colossal
also have a missing body where is the mid body?"

Scope: `game/src/render.js`, `game/src/shots.js`, `game/src/main.js`
(shot-staging + one visual-only build change, bug 2). `sim.js`
**UNTOUCHED** — md5 `9c53a92959194f5635efd9416ac7ff9b` before and after.
No bundle / check / submit in this round.

## Bug 1 — cover King half under the ground (USER-REPORTED) — FIXED

Root cause: in the cover branch the staged King sprite (6.8x5.1) was
centred at `k.y + 0.78` with the sim King on the ground (`k.y = 0`), so
his feet sat at `0.78 - 0.46*5.1 = -1.57 m` — 1.57 m UNDER the floor.
The round-4 probe ("projected feet 673") measured screen projection,
not occlusion, and missed it: the feet project to y=673 on screen but
the ground plane at that screen position is higher, so the floor cut
him in half. Probe numbers are not evidence for this bug; the visual
read is.

Fix (`render.js`): the cover branch of `stagedKingY` now returns
`0.46 * COVER_KING_SCALE[1]` — feet exactly ON the ground plane
(sprite bottom at y=0), ground-based, not sim-based (the staged height
must not depend on the sim King's hop). The cover decal hand also
tracks the STAGED King (`stagedKingY(state) + 0.35`) instead of
`k.y + 1.3`, which would have started the arc at his belly.

Evidence (viewed, full size + 320 px): the King's FULL figure — crown,
head, red robe, arms, legs, feet — stands on the floor at bottom-left;
nothing is cut by the floor. Strict red-robe pixel mask: feet y=613,
crown top y=507, on the floor line. PASS.

## Bug 2 — colossus mid-body missing (USER-REPORTED) — FIXED

Root cause (confirmed by measurement): the torso chunks taper to a
point at y≈2.6 while the thighs only reach y≈3.45 at x=±1.15, so the
centreline between chest and legs showed bare purple backdrop (the
teal rune bar floated in it).

Fix (`render.js`, `buildColossus`): ONE belly slab fused into the
torso — `[2.0, 0, 4.3, 0.2, 0, 0, 0, 1.4, 1.05, 0.75, stoneMat]`,
existing slate material, no new lights, no new textures. It rotates
with the body when toppled, so the fallen giant gains mass too.
Visual-only: no hitbox, pin, sigil-logic or sim change. Cheap by
design — the live playtest sim time was exactly 3.0 (zero margin), so
one simple mesh was the whole budget.

Evidence: the colossus reads as ONE continuous figure — crown, head,
torso, legs — at full size AND at 320 px. Pixel check on the old gap
band (x 430-640, y 380-480): purple-backdrop fraction 0.016, down from
~0.85 bare backdrop in f1bebbf. The teal rune bar now sits on the
belly instead of floating in purple. PASS. Playtest still passes
(sim time 3.7, see Verification) — the fill cost nothing measurable.

## Bug 3 — cover King size (DeepSeek tension vs Gemini counter-view) — KEPT, WITH EVIDENCE

After the feet fix, the cover King scale was cut from 6.8x5.1 to
`COVER_KING_SCALE = [4.0, 3.0]` (shared constant, used by the scale
set AND by `stagedKingY`, so the two can never drift apart again),
and the halo was rescaled with him (`(4.0 * 1.32) / 9`).

Measured visible King height (strict red-robe mask): **107 px =
14.9%**, feet y=613, crown top y=507, crown headroom ≥18 px. That is
just under the ~15% trigger for a further cut, and well under the 18%
DeepSeek flagged as a size war — so no further shrink. The visual
read settles it: the King reads as the protagonist, the colossus reads
as the giant, the chain-to-sigil line is legible, the cover is
stronger than f1bebbf (Gemini's counter-view holds — the feet fix
alone improved the read; shrinking further would have traded the
protagonist for a speck). PASS — kept at 4.0x3.0 with evidence, not
shrunk blindly.

## Bug 4 — victory King contrast (GLM, re-vote #3) — FIXED (visual); RGB bar proven unreachable

The real victory defect (GLM's pixel scan): the 0.55-opacity dark navy
overlay (`rgba(8, 16, 48, 0.55)`, `index.html` line 43) crushed the
King's max RGB to [121, 99, 119]; at 320 px he was a dark blob, crown
invisible.

Fix (`render.js`): in the victory camMode branch, the King sprite
material is overbrightened in victory mode only and reset to (1,1,1)
elsewhere (the material is shared across modes). First attempt 1.5x
reached only [138, 134, 133]; raised to **2.2x**. Gemini's nudge
(king.y +0.6 / king.z +0.5) was NOT applied — it addressed an
occlusion GLM's pixel scan proved does not exist.

Honest measurement: victory King max RGB is now **[141, 132, 136]**
(up from [121, 99, 119]), and a gold cluster registers under his feet
(73 px, loose gold mask). The [170, 140, 170] bar in the brief is NOT
reached — and the saturation test proves it cannot be reached by the
sprite alone: 1.5x → [138, 134, 133], 2.2x → [141, 132, 136]. The
King's brightest canvas pixels are already saturated; the 0.55 overlay
caps the final value. GLM's [180, 148, 178] estimate assumed the
overlay would not bite — it does. The only remaining lever is lowering
the win overlay's opacity, which changes the LIVE win screen (and
risks the gold title's contrast) — out of this round's scope, flagged
for the user, not done silently.

Visual verdict (the decider): at full size the King is a clear crowned
figure — red robe, face, crown, arms — standing on the crown with
gold spikes around him, zero overlap with the stats box / PLAY AGAIN.
At 320 px he reads as a distinct figure on the gold crown, not a blob.
PASS on the visual read; the RGB number is reported honestly above.

## Bug 5 — play frame mid-haul swap (DeepSeek, re-vote #3) — SWAPPED, AFTER ONE FAILED ATTEMPT

Attempt 1 FAILED and was rejected on the visual read (not shipped):
catching the first chain attach and forcing it taut, with the old
vault camera (k.x+13, 4.5, k.z+7, look y=3.5), produced a giant dark
wall — the colossus's head and crown cut at the top edge, the King a
60 px ape half-hidden behind a leg slab, the ankle→pylon chain a thick
pale bar along the floor. Root cause: the sim King stands at the
colossus's feet, INSIDE the belly/leg silhouette, so every angle
occludes him; and the ankle pin makes a low rope, not a haul.

Attempt 2 (shipped) — three staging changes, all in shot code:
- `stagedKingPos` gains a playshot branch: the King is staged at
  (col.x+6, col.z+4) — right-front of the colossus, clear of the body,
  beside the taut chain's path (same class of staging as the cover's
  col.x-3.8, col.z+4.5). Stage 4 has no pits, so he stands on solid
  floor.
- `playshotTarget` frames the STAGED King and the upright colossus:
  camera (skx+12, 6.5, skz+10), look at the midpoint, y=5 — pulled
  back and up so the full 0-14 m figure, the chain and the King fit.
- `main.js` play branch re-anchors the caught chain's pin end to
  `shoulderR` (dy 8.7 m) and pulls it taut, resetting the old ankle
  pin to free. A taut chain on ONE pin does not topple (toppleNeed is
  2), and a player can throw at the shoulder and haul it — a real
  reachable state, a more photogenic instance of it (the same staging
  class as the cover's decal chain, which depicts a chain that does
  not exist in the sim at all).

Evidence (viewed, full size + 320 px): the colossus reads as a figure
— head with cyan eyes, shoulders, torso with the big gold sigil,
belly, legs, feet; the taut chain is a clear diagonal from his
shoulder to the right edge; the sigil glows; the King stands clear at
bottom-centre (~72 px, full figure, shadow under him); the nebula
backdrop reads. At 320 px the verb (taut chain = haul), the figure and
the King all still read. This frame is verifiably BETTER than the old
rubble frame on every acceptance point (verb visible, colossus a
figure, King mid-pull clear) — the swap is kept. PASS. (One honest
limit: the sprite is a static billboard, so the King reads as standing
at the haul, not in a pulling pose — there is no pulling pose in the
asset.)

## Not fixed (per brief)

- Play top-left G=49.1 vs 50 — negligible, image-capped, untouched.
- Title shot — untouched (its bytes moved 134,512 → 134,303 only
  because the pulsing sigil/gem phase differs per render; the frame
  is the same).
- `featherCanvas` fw 0.22 / fh 0.18 — unchanged globally.
- No `?cover17=1` path (still deleted).

## Verification (all recorded, all green)

- `sim.js` md5 `9c53a92959194f5635efd9416ac7ff9b` — unchanged.
- Node autopilot (`tests/auto.mjs`): seed 1 twice byte-identical WIN
  **57,180** (pins 77, topples 25, combos 37, shards 38, time 71.5s);
  seeds 2–5 WIN (55,350 / 46,205 / 68,250 / 49,430); lazy seed 7 LOSE
  (0, hp 22). ALL NODE CHECKS PASS.
- Browser autopilot (`tools/auto.mjs`): WIN 57,180, stats identical to
  Node, zero console/page errors.
- Live playtest (`tools/playtest.mjs`): PASS — state advanced (play,
  sim time **3.7**, king moved), zero console/page errors. The torso
  fill did not dip the playtest: 3.7 is above the 3.0 bar (round 4 was
  exactly 3.0).
- Relic smoke (`tests/relic_smoke.mjs`): ALL RELIC SMOKE CHECKS PASS.
- Screenshots (`tools/shot.mjs`): 1-cover 134,081 B; 2-play 115,809 B;
  3-title 134,303 B; 4-victory 111,303 B — all 1280×720 JPEG, all
  <256 KiB, zero console/page errors.
- Dossier (`MAKEFUN_OUTPUT_DIR=out node main.ts`, twice): md5
  **`659b0075dbd467651174d4475954de4d`**, 820,759 B, byte-identical
  twice; 16 game files, 3,278,406 B; dossier text 155,713 B (cap
  163,840). All 4 dossier image hashes match the current screenshots
  exactly: 1-cover `603230d5…`, 2-play `32fbf8c5…`, 3-title
  `dfc79ba1…`, 4-victory `36ee71b6…` (full hashes in `out/dossier.json`).
- Measurements on the shipped screenshots: cover King visible 107 px
  (14.9%), feet y=613 on the floor line; cover mid-body purple
  fraction 0.016 (was ~0.85); victory King max RGB [141, 132, 136]
  (was [121, 99, 119]), gold under feet 73 px; play King 72 px, clear.

## Honest frame read (all 4 frames, full size + 320 px)

- **Cover:** the colossus is one continuous figure, gold sigil
  prominent, crown with headroom, the King a clear crowned ape
  standing on the floor at bottom-left (107 px), the chain arc
  diagonal against sky to the sigil. Best cover yet. The two
  user-reported bugs are gone.
- **Play:** the King stands clear at the taut chain's foot, the
  upright colossus reads as a figure with the glowing sigil, the
  nebula backdrop is gorgeous. The fallen giant is gone from the
  frame by design — the build cap is sidestepped, not solved.
  The brazier in the right foreground is large but does not block
  the King or the colossus.
- **Title:** unchanged, excellent.
- **Victory:** the King stands on the Titan's crown at frame centre,
  a clear crowned figure at full size (red robe, face, crown), clear
  of the title above and the stats/PLAY AGAIN below; at 320 px he is
  a small distinct figure on the gold crown. The Titan is still a
  dark mass behind him — the crown and the King carry the read.
