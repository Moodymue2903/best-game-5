// CROWNBOUND — screenshot staging. Chooses the frame each named shot shows:
//   cover   — stage 6 Floating Castle Citadel at sunset: the King hauling
//             two taut gold chains up at Aurelius, over-the-shoulder hero
//             camera, castle backdrop, CROWNBOUND wordmark top-left
//   play    — stage 4 Ringed Moon Observatory: the King at the apex of the
//             golden vault arc, about to slam the exposed Heart-Sigil
//   title   — the title screen over the crystal cave (unchanged)
//   victory — the win screen after a full autopilot victory; the King stands
//             on the fallen Titan's crown, stats box at 0.6 opacity
// The actual staging runs in main.js (?shot=...); this module only exposes
// the shot list for the tooling. Files are JPEG (1280x720, q85).
export const SHOTS = ['cover', 'play', 'title', 'victory'];
export const SHOT_FILES = {
  cover: '1-cover.jpg',
  play: '2-play.jpg',
  title: '3-title.jpg',
  victory: '4-victory.jpg',
};
