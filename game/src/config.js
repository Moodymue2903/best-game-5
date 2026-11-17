// CROWNBOUND — the Ape King anchors colossi with golden chains and topples
// them. Every tuning number, colour and rule in one place. The simulation
// lives on the (x, z) arena floor and moves at the King's pace; the renderer
// sells the 3D scale. Nothing in here depends on the screen size or the
// frame rate.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Arena half-extents the King can move inside. */
export const ARENA_HALF_X = 26;
export const ARENA_HALF_Z = 18;

/** The altar line: a colossus crossing this z breaches the sanctuary. */
export const ALTAR_Z = -14;
/** The altar structure itself sits a little behind the line. */
export const ALTAR_STRUCT_Z = -16.5;

/** Throw range (King to pin ground position), in metres. */
export const THROW_RANGE = 20;
/** Pylon snap range from a pin (40 with Grounding Magnet). */
export const PYLON_RANGE = 25;

/** Siege timer per stage, in seconds. */
export const SIEGE_TIME = 90;

export const CROWNBOUND_RULES = {
  startHp: 100,
  kingSpeed: 8,
  kingAccel: 42,
  jumpVy: 9.5,
  gravity: 22,
  maxChains: 2,
  haulRate: 1.0,
  chainThrowCooldown: 0.35,
  slamCooldown: 0.5,
  sigilHp: 3,
  bossSigilHp: 4,
  toppleNeed: 2, // taut limbs on one colossus to topple it
  vaultRadius: 6,
  vaultTime: 0.6,
  toppleGetUp: 25, // seconds a toppled colossus waits before rising again
  pinScore: 150,
  toppleScore: 1000,
  comboScore: 300,
  shardScore: 25,
  scarabScore: 25,
  emberScore: 500,
  staggerScore: 100,
  shockDamage: 12,
  shardDamage: 10,
  beamDamage: 10,
  scarabDamage: 8,
  meteorDamage: 15,
  pitDamage: 20,
  invulnAfterHit: 1.0,
};

/** Pin layouts, as fractions of colossus height. Offsets are in metres at
// the reference height of 14 (scaled by size / 14). */
export function pinLayout(kind) {
  if (kind === 'boss') {
    return {
      footL: { dx: -3.4, dy: 1.1, dz: 2.2 },
      footR: { dx: 3.4, dy: 1.1, dz: 2.2 },
      turbineL: { dx: -4.0, dy: 13.6, dz: -0.5 },
      turbineR: { dx: 4.0, dy: 13.6, dz: -0.5 },
      crown: { dx: 0, dy: 19.4, dz: 0 },
    };
  }
  return {
    ankleL: { dx: -2.4, dy: 0.7, dz: 1.6 },
    ankleR: { dx: 2.4, dy: 0.7, dz: 1.6 },
    kneeL: { dx: -2.2, dy: 4.5, dz: 0.8 },
    kneeR: { dx: 2.2, dy: 4.5, dz: 0.8 },
    shoulderL: { dx: -2.8, dy: 8.7, dz: -0.6 },
    shoulderR: { dx: 2.8, dy: 8.7, dz: -0.6 },
    crown: { dx: 0, dy: 12.3, dz: 0 },
  };
}

/** The six stages. dur is the siege timer (same 90s for all); spawn numbers
// are per stage. colossi: [{name, size, speed, pins: [pin ids], x, z}]. */
export const CROWNBOUND_STAGES = [
  {
    name: 'THE SUNKEN CRYSTAL CAVERN',
    sub: 'GEODE STRIDER',
    sky: ['#0b132b', '#16224e', '#3a2a6e', '#ff3b8e'],
    fog: '#0b132b', fogNear: 55, fogFar: 150,
    ground: '#1a2440', groundTrim: '#00f0ff',
    colossi: [{ name: 'GEODE STRIDER', size: 14, speed: 0.45, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR', 'crown'], x: 0, z: 12 }],
    pylons: [[-22, -10], [22, -10], [-22, 10], [22, 10], [0, -12]],
    emberPylons: [],
    pits: [],
    shockEvery: 7, shardEvery: 5, shardCount: 2, beamEvery: 0, scarabEvery: 0, scarabMax: 0, meteorEvery: 0,
    blindSpot: false, twin: false,
  },
  {
    name: 'SUNSET SKY-BRIDGE',
    sub: 'SOLARIS WARDEN',
    sky: ['#2b193d', '#7a2a4d', '#ff6b35', '#ffc53d'],
    fog: '#2b193d', fogNear: 55, fogFar: 150,
    ground: '#4a2c3a', groundTrim: '#ffc53d',
    colossi: [{ name: 'SOLARIS WARDEN', size: 14, speed: 0.55, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR', 'crown'], x: 0, z: 12 }],
    pylons: [[-22, -10], [22, -10], [-22, 10], [22, 10], [0, -12]],
    emberPylons: [],
    pits: [[-14, 4], [14, -4]],
    shockEvery: 8, shardEvery: 5, shardCount: 2, beamEvery: 9, scarabEvery: 0, scarabMax: 0, meteorEvery: 0,
    blindSpot: false, twin: false,
  },
  {
    name: 'THE CORAL ABYSSAL TRENCH',
    sub: 'BRINE & PEARL',
    sky: ['#073b4c', '#0a5a6e', '#35d0ba', '#ff6b9e'],
    fog: '#073b4c', fogNear: 50, fogFar: 140,
    ground: '#0a3a44', groundTrim: '#35d0ba',
    colossi: [
      { name: 'BRINE', size: 11, speed: 0.5, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'], x: -8, z: 12 },
      { name: 'PEARL', size: 11, speed: 0.5, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'], x: 8, z: 12 },
    ],
    pylons: [[-22, -10], [22, -10], [-22, 10], [22, 10], [0, -12]],
    emberPylons: [],
    pits: [],
    shockEvery: 8, shardEvery: 6, shardCount: 2, beamEvery: 0, scarabEvery: 6, scarabMax: 3, meteorEvery: 0,
    blindSpot: false, twin: true,
  },
  {
    name: 'RINGED MOON OBSERVATORY',
    sub: 'ASTROLABE TITAN',
    sky: ['#1a1440', '#3a2a6e', '#6b3fa0', '#ffb703'],
    fog: '#1a1440', fogNear: 55, fogFar: 160,
    ground: '#2a2450', groundTrim: '#ffb703',
    colossi: [{ name: 'ASTROLABE TITAN', size: 14, speed: 0.5, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR', 'crown'], x: 0, z: 12 }],
    pylons: [[-22, -10], [22, -10], [-22, 10], [22, 10], [0, -12]],
    emberPylons: [],
    pits: [],
    shockEvery: 7, shardEvery: 4, shardCount: 3, beamEvery: 0, scarabEvery: 7, scarabMax: 2, meteorEvery: 0,
    blindSpot: true, twin: false,
  },
  {
    name: 'CALDERA FOUNDRY VIADUCT',
    sub: 'CINDER-HULK & MAGMA-HOUND',
    sky: ['#2b0f0a', '#5a1a0a', '#ff6b35', '#ffc53d'],
    fog: '#2b0f0a', fogNear: 50, fogFar: 140,
    ground: '#3a1a10', groundTrim: '#ff6b35',
    colossi: [
      { name: 'CINDER-HULK', size: 12, speed: 0.6, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'], x: -8, z: 12 },
      { name: 'MAGMA-HOUND', size: 12, speed: 0.6, pins: ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'], x: 8, z: 12 },
    ],
    pylons: [[-22, -10], [22, -10], [-22, 10], [22, 10], [0, -12]],
    emberPylons: [[-12, 0], [12, 0], [0, 6]],
    pits: [[-14, -6], [14, 6]],
    shockEvery: 7, shardEvery: 5, shardCount: 3, beamEvery: 0, scarabEvery: 5, scarabMax: 4, meteorEvery: 0,
    blindSpot: false, twin: false,
  },
  {
    name: 'THE FLOATING CASTLE CITADEL',
    sub: 'AURELIUS, THE ETERNAL BASTION',
    sky: ['#1a0f3d', '#3a0ca3', '#ff7b00', '#ffc53d'],
    fog: '#1a0f3d', fogNear: 55, fogFar: 160,
    ground: '#241a4d', groundTrim: '#ffc53d',
    colossi: [{ name: 'AURELIUS', size: 22, speed: 0.4, pins: [], x: 0, z: 12, boss: true }],
    pylons: [[-22, -10], [22, -10], [-22, 10], [22, 10], [0, -12]],
    emberPylons: [],
    pits: [],
    shockEvery: 8, shardEvery: 4, shardCount: 3, beamEvery: 0, scarabEvery: 6, scarabMax: 3, meteorEvery: 5,
    blindSpot: false, twin: false,
  },
];

/** Boss phases: which pins are live, and the sigil HP for the phase. */
export const BOSS_PHASES = [
  { name: 'PHASE 1 — ANCHOR THE FEET', pins: ['footL', 'footR'], sigilHp: 3 },
  { name: 'PHASE 2 — SHATTER THE STORM-TURBINES', pins: ['turbineL', 'turbineR'], sigilHp: 3 },
  { name: 'PHASE 3 — THE CROWN-SIGIL', pins: ['crown'], sigilHp: 4 },
];

export const CROWNBOUND_RELICS = [
  { id: 'twinspool', name: 'TWIN-SPOOL GAUNTLETS', desc: 'Carry 3 golden chains at once, not 2.' },
  { id: 'heavyanchor', name: "SOVEREIGN'S HEAVY ANCHOR", desc: 'Chains pull 45% faster; taut chains rattle plates loose.' },
  { id: 'boots', name: 'AETHER-SPRING BOOTS', desc: '+30% sprint speed, higher leap.' },
  { id: 'sunfire', name: 'SUNFIRE CHAIN-LINKS', desc: 'Taut chains burn molten gold — scarabs that touch them die.' },
  { id: 'titangrip', name: 'TITAN-GRIP FOREARMS', desc: 'Slam deals double damage and heals +15 HP.' },
  { id: 'magnet', name: 'GROUNDING MAGNET', desc: 'Chains snap to pylons from 40m, not 25m.' },
  { id: 'mantle', name: 'VELVET MANTLE WARD', desc: 'A golden aura absorbs 1 hit every 12 seconds.' },
  { id: 'crownfirst', name: 'CROWN OF THE FIRST KING', desc: 'Toppling a Colossus triggers a Golden Nova and double shards.' },
];

export const PALETTE = {
  gold: '#ffc53d',
  goldBright: '#ffd23f',
  cyan: '#00f0ff',
  cyanSoft: '#5ef2ff',
  crystalCyan: '#35d0ba',
  crystalMagenta: '#ff3b8e',
  coral: '#ff6b4a',
  ember: '#ff6b35',
  violet: '#6b3fa0',
  planetGold: '#ffb703',
  danger: '#ff4d5e',
  hudGold: '#ffc53d',
  hudPanel: '#141a3d',
  text: '#fff5e0',
  kingFur: '#b5651d',
  robe: '#b3122e',
  altarGold: '#ffd23f',
};
