# CROWNBOUND — Fix round 4 (final round; then submit)

Parent commit: `a2e228d` (fix round 3). This round: `game/src/render.js`,
`game/src/main.js` (shot-staging only). `sim.js` UNTOUCHED
(md5 `9c53a92959194f5635efd9416ac7ff9b` before and after).
No colossus build change, no bundle/check/submit in this round.

Re-vote #2 on `a2e228d` was 1x (a) Gemini, 3x (b) DeepSeek / GLM / Qwen.
The gate (3 models at top-5 40–50%) was NOT met and the auditors' own
post-fix estimates top out at ~17–26%. The user decided: run this ONE
tight fix round 4, then submit. This is the last fix round.

## 1. VICTORY KING LEGIBILITY (priority) — DONE, camera (b) shipped

The King was ~40 px on the chest sigil, invisible at 320 px thumbnail.
All three fix voters agreed this was fixable in-scope.

**What changed (render.js):**
- Crown exposed at build: the crown + 5 spikes now live in a `crownGroup`
  at (0, 10.7*s, 0), the crown mesh inside it at local (0,0,0) — same
  world position as before — and `g.userData.crown` / `crownGroup` are set.
  The crown material is a per-crown clone of `goldMat`, so the victory
  emissive boost touches no other gold mesh.
- `stagedKingPos` (victory): anchors to the CROWN via
  `g.userData.crown.getWorldPosition(sp)` → `[sp.x, sp.z]`; fallback to
  the sigil, then `[col.x, col.z - 12]`.
- `stagedKingY` (victory): feet plant on the crown TOP —
  `sp.y + 1.5 * size * 1.4 + 0.46 * VICTORY_KING_SCALE[1]`
  (the crown is a horizontal tube once the body lies flat; its top is its
  centre + its radius, x1.4 for the victory crown emphasis).
- Titan tilt (victory only): `ud.body.rotation.x = -Math.PI/2 + 0.22`
  in the shattered-freeze branch, lifting the head/crown end ~12.6°
  toward the camera so the spikes show. The playshot topple stays
  exactly −π/2.
- Crown emphasis (GLM): `crownGroup` scale 1.4 + crown emissive 1.5 in
  victory camMode only (0.25 elsewhere).
- `VICTORY_KING_SCALE = [4.6, 3.45]` (Qwen's start), a module constant
  shared by the sprite scale, `stagedKingY`, and the shadow offset, so
  the three can never drift apart. The 4.6×3.45 scale was KEPT — see the
  camera trials below; no increase toward GLM's 7.2×5.4 was needed.
- `kingGlow`: 18/14 in victory mode too (was 12/12; cover stays 20/16).
- `kingShadow` in victory sits at `ky - 0.46 * VICTORY_KING_SCALE[1]`
  (was the hard-coded 1.09 for the old 2.4 scale).

**Camera trials (all measured with a temporary probe hook that projected
the King sprite's feet/head to screen px; the hook was removed before
commit — `__dbgKing` is gone from the shipped code):**
- (a) Qwen `(k.x+6, k.y+16, k.z+16)`, look
  `((k.x+col.x)/2 - 2, 14, (k.z+col.z)/2 - 7)` — FAILED. King 62.6 px at
  screen (750, 420–483), directly behind the PLAY AGAIN button
  (y 445–505). The crown anchor moved him to the far −z end, which the
  (a) framing puts mid-frame behind the DOM.
- (b) DeepSeek `(k.x+3, k.y+5, k.z+6)`, look at the staged King's centre
  (crown anchor) — SHIPPED. King **85.0 px** at screen (641, 295–380):
  centred horizontally, 7 px below the subtitle (ends ~288), 138 px
  above the stats box (starts ~518), 260 px above PLAY AGAIN.
  The stats overlay was moved to the bottom third in the `?shot=victory`
  branch of `main.js` only (live play's win screen untouched):
  `overlays.win` `justify-content: flex-start`, `padding-top: 190px`,
  `#win-stats` `margin-top: auto` + background `rgba(16,37,94,0.75)`.
  From the low angle the crown under his feet reads as a gold shape
  rather than a spiky crown, and the Titan is a foreground pile with the
  castle vista mostly hidden — but the King is the biggest and clearest
  of the three trials.
- (c) GLM `(k.x+4, k.y+14, k.z+12)`, (a) look — TRIED, REJECTED. King
  71.9 px at (757, 447–519): feet touch the stats-box top (518), the
  crown is half-hidden behind the stats box, and the Titan is mostly out
  of the bottom of the frame. Smaller King, worse crown read, worse
  composition than (b).

**Acceptance — victory:**
- Visible ape **85 px** at 1280×720 (probe, exact projection) — PASS (≥70).
- Crown/spikes behind/under him — PARTIAL. The gold crown is under his
  feet and the sigil diamond sits below it, but the spikes do not
  distinctly resolve from this low angle; the "crowned figure" read comes
  mostly from the King's own crown + the gold under him. This is the one
  soft item that did not fully land.
- At 320 px thumbnail he is a ~21 px crowned figure on the Titan, not a
  speck — PASS (borderline; clearly a figure, though small).
- Zero overlap with the stats box / PLAY AGAIN — PASS (138 px / 260 px
  clear; 7 px below the subtitle — clear but tight).
- Titan still a fallen mass — PASS (dark slabs + gold plates + teal
  crystals, spanning the lower frame).
- Teal pixels — scene-only **0.0%** (the wedge is gone; no teal in the
  3D scene). Whole-frame 0.062% is the cyan DOM subtitle text
  ("AURELIUS IS SHATTERED", #5ef2ff), not scene teal.
- The 4 m camera-proximity hide stays (`render.js` ~1628, untouched):
  crystal cones hidden + any decor mesh within 4 m hidden in victory
  mode. The victory camera is ~28 m from the King, so the hide never
  touches him.

## 2. PLAY FALLEN GIANT — two attempts, then STOP — DONE, frame kept

- (a) GLM Fix A steps 3–4: `body.rotation.y = Math.PI/4` when toppled in
  playshot ONLY (gated on `camMode === 'playshot'`; live play and the
  victory Titan untouched), and the sigil emissive floor raised to 1.8
  while toppled in the playshot (implemented as the floor in the existing
  sigil-pulse line — the sigil material is shared, so a separate
  assignment would have been dead code overwritten by the pulse).
  GLM's steps 1–2 (Gemini's camera) were already applied in `a2e228d`
  and were NOT re-applied. GLM's look change `(col.x, 1.5, col.z)` was
  TRIED and REVERTED: it pushed the King to the top of the frame
  (overlapping COMBOS) and the giant off the right edge, breaking the
  vault/sigil read. The midpoint look
  `((k.x+col.x)/2, 3.5, (k.z+col.z)/2)` is restored.
- (b) Qwen rim backlight: `fallenRim = new THREE.DirectionalLight
  (0xffd43b, 0)` at (−14, 10, −18), intensity 1.6 + `visible = true`
  when a colossus is toppled in the playshot, else 0 + `visible = false`
  (the round-3 SwiftShader rule). `fallenLight` 2.0 / `fallenFill` 0.8
  unchanged; `playshotTarget` unchanged for this fix.

**Acceptance — play:**
- Body outline separates from the floor — PASS (marginally better than
  round 3: the warm rim light lifts the right side of the floor and the
  dark slabs contrast against it).
- Span stays ~50% — PASS. Sigil clear and on the vault arc — PASS (the
  bright gold diamond sits at the end of the chain from the vaulting
  King). Top-left quadrant mean **(73.8, 49.1, 103.7)** — same as round 3
  (73.7, 49.0, 103.8); G = 49.1 vs the 50 bar, accepted as-is per the
  brief (negligible, image-capped).
- Honest limit, as the brief predicted: the figure still does NOT resolve
  into head/torso/limbs — it reads as dark slabs + gold rings + teal
  crystals. That is the build cap. Accepted, stop.
- **Play frame NOT swapped.** DeepSeek's conditional fallback (a mid-haul
  shot of the upright colossus) was considered and NOT attempted: the
  current frame carries the game's defining verb (topple + vault onto the
  fallen giant + shatter the sigil) clearly, and a mid-haul shot would
  trade that verb for an unproven composition. The giant's figure-read
  is the acknowledged build cap, not a framing problem.

## 3. COVER CROWN HEADROOM — DONE, look 7.6 shipped

Qwen Fix 3 said look y 7 → 6.4. The 6.4 probe moved the crown NOWHERE
(still ~10 px from the top, same as round 3): lowering the look tilts
the camera down, which pushes the crown UP — the wrong direction for
headroom. Raising the look pushes the crown DOWN into the frame: the
8.5 probe put the crown spikes at ~60 px (clear) but pushed the King
to the bottom edge (projected feet 704). 7.6 is the calibrated middle
(probe: the King's projected feet move ~34 px per 1.0 of look):
crown spikes ~25 px from the top, King projected feet 673, head 510.
`coverTarget` look is now `(col.x + 2.5, 7.6, col.z)`.

**Acceptance — cover:**
- Crown ≥18 px from top — PASS (~25 px, spikes clear of the edge).
- King — DEVIATION NOTED. Visible ape ~130 px (18%), above the
  ~107 px / 14.9% target. The look change moved him down enough that
  less of the sprite sits below the ground plane, so more of him shows.
  He is well above the 90 px floor, reads clearly (red robe, crown,
  halo), and the composition holds — accepted as the better trade for
  the crown headroom. The arc is still diagonal with sky behind.
- The SEAL-PIN HUD no longer grazes the colossus crown.

## 4. DO NOT FIX — accepted as-is (unchanged)

Play top-left G = 49.1 vs 50. Cover King now ~130 px (see §3). One gold
chain (sim-faithful). Title shot untouched. `featherCanvas` fw 0.22 /
fh 0.18 unchanged globally. No `?cover17=1` path (still deleted).

## Verification (all recorded, all green)

- `sim.js` md5 `9c53a92959194f5635efd9416ac7ff9b` — unchanged.
- Node autopilot (`tests/auto.mjs`): seed 1 twice byte-identical WIN
  **57,180** (pins 77, topples 25, combos 37, shards 38, time 71.5s);
  seeds 2–5 WIN (55,350 / 46,205 / 68,250 / 49,430); lazy seed 7 LOSE
  (0, hp 22). ALL NODE CHECKS PASS.
- Browser autopilot (`tools/auto.mjs`): WIN 57,180, stats identical to
  Node, zero console/page errors.
- Live playtest (`tools/playtest.mjs`): PASS — state advanced (play,
  sim time 3.0, king moved), zero console/page errors. (Sim time is
  exactly at the ≥3.0 bar; `fallenRim` is `visible = false` in live play
  — camMode is 'follow', not 'playshot' — so it costs nothing there.)
- Relic smoke (`tests/relic_smoke.mjs`): ALL RELIC SMOKE CHECKS PASS.
- Screenshots (`tools/shot.mjs`): 1-cover 137,583 B; 2-play 112,769 B;
  3-title 134,512 B; 4-victory 111,407 B — all 1280×720 JPEG, all
  <256 KiB, zero console/page errors.
- Dossier (`MAKEFUN_OUTPUT_DIR=out node main.ts`, twice): md5
  **`d619b2947039ed10d1fec90304f11da7`**, 816,087 B, byte-identical
  twice; 16 game files, 3,272,787 B. All 4 dossier image hashes match
  the current screenshots exactly:
  1-cover `7f78c4d2…`, 2-play `51fce539…`, 3-title `da8a8db0…`,
  4-victory `d16fa610…` (full hashes in `out/dossier.json`).
- Measurements on the shipped screenshots: victory King 85 px (probe,
  exact projection; the final JPEGs differ from the probe JPEGs only in
  the pulsing sigil/gem phase — the King/camera are steady-state);
  play top-left (73.8, 49.1, 103.7); victory scene-only teal 0.0%.

## Honest frame read (all 4 frames, full size + 320 px)

- **Cover:** the colossus is big and central, gold sigil prominent, the
  crown has headroom, the King is a clear crowned ape at the
  bottom-left (~130 px), the chain arc is diagonal against sky. Best
  cover yet. The King is bigger than the 11–13% band (18%) — a
  deliberate trade for the crown headroom, and he reads well.
- **Play:** the King mid-vault is the clear hero (red robe, crown),
  the gold chain runs diagonally to the bright sigil, the fallen giant
  is a dark mass with gold rings and teal crystals on a warm floor.
  The giant does not resolve into a figure — the build cap, accepted.
- **Title:** unchanged, excellent.
- **Victory:** the King (85 px) stands on the Titan's crown at frame
  centre, clear of the title above and the stats/PLAY AGAIN below; the
  Titan is a fallen mass beneath him; the teal wedge is gone. At 320 px
  he is a ~21 px crowned figure on the Titan — discernible, not a speck,
  though small. The crown's spikes do not distinctly resolve from this
  low angle (the one soft item that did not fully land). The King sits
  7 px below the subtitle — clear, but tight.

## What shipped

- Victory camera (b) DeepSeek `(k.x+3, k.y+5, k.z+6)`, look at the
  crown-anchored King; stats overlay moved to the bottom third in the
  victory shot branch only.
- Play frame KEPT (vault on the fallen giant); roll + rim + sigil 1.8
  kept, look reverted, mid-haul swap not attempted.
- Cover look 7.6 (calibrated between Qwen's 6.4 and the 8.5 probe).
- No further fix round after this one — the entry goes to submit next.
