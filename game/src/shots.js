// CROWNBOUND — screenshot staging. Chooses the frame each named shot shows:
//   cover   — mid-action on stage 1 (autopilot ~14s in, chains flying)
//   play    — live play on stage 1 (autopilot ~14s in, follow camera)
//   title   — the title screen over the crystal cave
//   victory — the win screen after a full autopilot victory
// The actual staging runs in main.js (?shot=...); this module only exposes
// the shot list for the tooling.
export const SHOTS = ['cover', 'play', 'title', 'victory'];
export const SHOT_FILES = {
  cover: '1-cover.png',
  play: '2-play.png',
  title: '3-title.png',
  victory: '4-victory.png',
};
