// CROWNBOUND — screenshot staging. Chooses the frame each named shot shows:
//   cover   — stage 6 Floating Castle Citadel at sunset: the King staged in
//             front of the colossus's legs, centred under the heart-sigil,
//             hauling a gold chain arc up at Aurelius (cover-only staging
//             decal from his hand to the sigil; the sim holds exactly ONE
//             chain, HUD CHAINS 1/2 — two taut limb-chains IS the topple,
//             so no second limb-chain exists while Aurelius stands),
//             castle backdrop, CROWNBOUND wordmark top-left
//   play    — stage 4 Ringed Moon Observatory: the King hauling a taut
//             gold chain at the UPRIGHT colossus (fix round 5 mid-haul
//             swap — the old vault frame showed the fallen giant as
//             rubble, a build cap; the upright colossus reads as a figure
//             and the taut chain makes the haul verb visible)
//   title   — the title screen over the crystal cave (unchanged)
//   victory — the win screen after a full autopilot victory; the King stands
//             in the left third, clear of the PLAY AGAIN button, stats box
//             at 0.6 opacity
// The actual staging runs in main.js (?shot=...); this module only exposes
// the shot list for the tooling. Files are JPEG (1280x720, q85).
export const SHOTS = ['cover', 'play', 'title', 'victory'];
export const SHOT_FILES = {
  cover: '1-cover.jpg',
  play: '2-play.jpg',
  title: '3-title.jpg',
  victory: '4-victory.jpg',
};
