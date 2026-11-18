# CROWNBOUND — Anchor & Topple

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Moodymue2903/best-game-5/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Moodymue2903/best-game-5/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Entered on [make.fun](https://make.fun/bounty/best-game-01) — the "Make the best game" bounty, $1,000 in USDC.

**make.fun best-game-01, round 5.** Six colossi march on the Sanctuary Altar.
You are the Ape King — small, crowned, and very stubborn. Throw golden chains
around the giants' limbs, haul them taut, topple them, vault onto their
shoulders and shatter the heart-sigil on their chest. One slam per topple —
they buck you off and rise again. Hold the altar.

## The verb: ANCHOR & TOPPLE

- **Aim** at a glowing pin on a colossus (mouse) and **left-click** to throw a chain.
- A chain's far end snaps to the nearest pylon — or, if you throw again, to a
  second pin, so one chain can bind two limbs of the same giant, or two giants
  to each other (they trip each other).
- **Hold F / right-click** to haul: every attached chain cinches. When a giant
  has 2 limbs taut (1 for the boss's crown phase), it topples.
- **SPACE** near a toppled giant vaults you onto its shoulder. **Left-click**
  while riding slams the heart-sigil. One slam per topple — the giant bucks
  you off and rises. A sigil needs 3 slams (4 for Aurelius's crown phase).
  The TITAN-GRIP relic deals double slam damage, so 2 slams suffice then
  (2 for the crown phase).
- Clear a stage to draft 1 of 3 Royal Relics (8 total). Six stages, from the
  Sunken Crystal Cavern to the Floating Castle Citadel, ending with Aurelius,
  the Crowned Titan.

## Hazards

Shockwaves, falling crystal shards, scarabs, abyss pits (stages 2 and 5),
beam rings (stage 2, jump them), and Aurelius's meteor slams (stage 6) and
the rotating shield (stage 4, Ringed Moon Observatory — pins are only
targetable from the blind spot behind the shield).

## Scoring

Score = pins×150 + topples×1000 + combos×300 + shards×25 + scarab kills×25
  + ember-pylon detonations×500 + staggers×100
  + ceil(remaining siege seconds)×15 per stage cleared (6 stages, boss win included).
Seed-1 autopilot hand check: 77×150 + 25×1000 + 37×300 + 38×25 + 0×25 + 3×500
  + 0×100 + (1230+1230+1065+1215+1215+1125)
  = 11,550 + 25,000 + 11,100 + 950 + 0 + 1,500 + 0 + 7,080 = 57,180. ✓

## Controls

WASD / arrows — move · Mouse — aim · Left-click — throw chain / slam ·
SPACE — jump / vault · F or right-click — haul · M — mute · R — restart

## Run it

```sh
node serve.ts --port 8102   # serves game/ at http://127.0.0.1:8102/
```

## Verify it

```sh
node tests/auto.mjs          # Node autopilot: seed 1 twice identical, seeds 2-5 win, lazy loses
node tests/relic_smoke.mjs   # every relic drafted + exercised (Node sim only)
node tools/auto.mjs          # browser autopilot (?auto=1), must match Node exactly
node tools/auto.mjs lazy     # browser lazy (?auto=lazy), must lose
node tools/playtest.mjs      # live playtest with a real mouse
node tools/shot.mjs          # 4 screenshots -> screenshots/
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # dossier build
```

## Layout

- `game/index.html` — page, HUD, overlays
- `game/src/config.js` — 6 stages, rules, 8 relics, palettes, pin layouts
- `game/src/random.js` — mulberry32
- `game/src/sim.js` — the whole game: deterministic 60 Hz simulation + autopilot
- `game/src/render.js` — three.js scene (vendored), procedural colossi, King sprite
- `game/src/input.js`, `game/src/audio.js`, `game/src/main.js`, `game/src/shots.js`
- `game/vendor/three.module.min.js` — three@0.160.0 ESM
- `game/assets/king.png` — the Ape King (the v4 cutout; the King is never redrawn in code)
- `game/assets/ref-*.jpg` — the user's 5 reference vistas as distant backdrop planes:
  ref-cave (stage 1), ref-coral (stage 3), ref-nebula (stage 4), ref-colossus (stage 5),
  ref-castle (stage 6, also the cover sky). The 7 later refs (ref6–ref12) are
  reference only and are NOT vendored — the colossus is modelled after ref12
  procedurally, never copied.
- `tests/relic_smoke.mjs` — relic smoke test: every relic drafted and exercised at least once
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `main.ts` — entrypoint: copies game/ + screenshots/, writes dossier.json

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=XSCZ-RCXQ&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
