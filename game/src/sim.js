// CROWNBOUND — the simulation. Pure logic, no THREE, no DOM: the same file
// runs in the browser and in Node, so the autopilot's numbers are the
// game's numbers. Fixed 60 Hz steps; every random choice comes from the
// seeded generator, so one seed always plays the same run.
//
// The King moves on the (x, z) arena floor. Colossi march toward the
// Sanctuary Altar (z = ALTAR_Z). The King throws golden chains at glowing
// Seal-Pins; a chain's far end snaps to the nearest Grounding Pylon — or,
// on a second throw, to another pin, so one chain can bind two limbs.
// Hauling (Shift / Right mouse) pulls a chain taut; two taut limbs topple
// a colossus. Vault (Space) inside the golden ring onto its back, then
// slam the Heart-Sigil to shatter it. Clear all colossi to clear the stage.

import {
  STEP, ARENA_HALF_X, ARENA_HALF_Z, ALTAR_Z, ALTAR_STRUCT_Z, THROW_RANGE,
  PYLON_RANGE, SIEGE_TIME, CROWNBOUND_RULES, CROWNBOUND_STAGES, BOSS_PHASES,
  CROWNBOUND_RELICS, pinLayout,
} from './config.js';
import { makeRng, range, shuffle } from './random.js';

const R = CROWNBOUND_RULES;

/** Start a fresh run. opts: { seed, lazy } — lazy plays badly on purpose. */
export function createRun(seed, opts = {}) {
  const rng = makeRng(seed);
  return {
    seed,
    lazy: !!opts.lazy,
    rng,
    screen: 'title', // title | play | relic | win | lose
    time: 0,
    stageIdx: 0,
    stageTime: 0,
    siege: SIEGE_TIME,
    king: { x: 0, z: 12, y: 0, vx: 0, vz: 0, vy: 0, hp: R.startHp, invuln: 0, jumpsUsed: 0 },
    colossi: [],
    chains: [],
    pylons: [],
    pits: [],
    shockwaves: [], // {x, z, r}
    shardTele: [], // {x, z, t}
    beam: null, // {z, dir} — sweeping beam ring (stage 2)
    beamTimer: 0,
    meteors: [], // {x, z, t}
    scarabs: [], // {x, z}
    shockTimer: 0, shardTimer: 0, scarabTimer: 0, meteorTimer: 0,
    vaultT: 0, vaultFrom: null, vaultTo: null,
    onTopOf: null, // colossus id the King stands on
    slamCooldown: 0, throwCooldown: 0,
    mantleTimer: 0,
    score: 0,
    pins: 0, topples: 0, combos: 0, shards: 0, scarabKills: 0,
    throws: 0, vaults: 0, slams: 0,
    lastTautAt: -100,
    relics: [], relicFlags: {},
    draft: null, draftStage: -1,
    bossPhase: 0,
    lastEvent: '',
    loseReason: '',
    stats: null,
  };
}

function stage(state) {
  return CROWNBOUND_STAGES[state.stageIdx];
}

function hasRelic(state, id) {
  return state.relicFlags[id] === true;
}

function kingSpeed(state) {
  return R.kingSpeed * (hasRelic(state, 'boots') ? 1.3 : 1);
}

export function maxChains(state) {
  return hasRelic(state, 'twinspool') ? 3 : 2;
}

function pylonRange(state) {
  return hasRelic(state, 'magnet') ? 40 : PYLON_RANGE;
}

/** Build the current stage's arena: colossi, pylons, pits, timers. */
function buildStage(state) {
  const st = stage(state);
  state.colossi = [];
  state.chains = [];
  state.pylons = st.pylons.map(([x, z]) => ({ x, z, ember: false }));
  for (const [x, z] of st.emberPylons) state.pylons.push({ x, z, ember: true });
  state.pits = st.pits.map(([x, z]) => ({ x, z, r: 2.5 }));
  state.shockwaves = [];
  state.shardTele = [];
  state.beam = null;
  state.beamTimer = 6;
  state.meteors = [];
  state.scarabs = [];
  state.shockTimer = 4;
  state.shardTimer = 3;
  state.scarabTimer = 5;
  state.meteorTimer = 4;
  state.vaultT = 0;
  state.vaultFrom = null;
  state.vaultTo = null;
  state.onTopOf = null;
  state.slamCooldown = 0;
  state.throwCooldown = 0;
  state.siege = SIEGE_TIME;
  state.stageTime = 0;
  state.bossPhase = 0;
  let n = 0;
  for (const c of st.colossi) {
    const layout = pinLayout(c.boss ? 'boss' : 'std');
    const pinIds = c.boss ? BOSS_PHASES[0].pins : c.pins;
    const col = {
      id: n,
      name: c.name,
      size: c.size,
      x: c.x, z: c.z,
      baseSpeed: c.speed,
      boss: !!c.boss,
      state: 'march', // march | toppled | shattered
      pins: pinIds.map((id) => ({ id, ...layout[id], state: 'free', chainId: null })),
      sigilHp: c.boss ? BOSS_PHASES[0].sigilHp : R.sigilHp,
      sigilMax: c.boss ? BOSS_PHASES[0].sigilHp : R.sigilHp,
      plateHp: 6,
      staggered: false, staggerT: 0,
      toppleT: 0, buckT: 0,
      walkPhase: range(state.rng, 0, 6),
      shieldAngle: range(state.rng, 0, 6.28),
      toppleFlash: 0,
    };
    state.colossi.push(col);
    n += 1;
  }
}

/** Begin play from the title screen. */
export function startRun(state) {
  state.screen = 'play';
  state.time = 0;
  state.stageIdx = 0;
  buildStage(state);
}

/** Ground position of a pin (the point the mouse aims at). */
export function pinGround(state, col, pin) {
  const s = col.size / 14;
  return { x: col.x + pin.dx * s, z: col.z + pin.dz * s, y: pin.dy * s };
}

function colossusById(state, id) {
  return state.colossi.find((c) => c.id === id);
}

/** Taut limbs on one colossus (pins whose chain is taut). */
function tautLimbs(state, col) {
  let n = 0;
  for (const p of col.pins) {
    if (p.state === 'chained' && p.chainId !== null) {
      const ch = state.chains.find((c) => c.id === p.chainId);
      if (ch && ch.state === 'taut') n += 1;
    }
  }
  return n;
}

/** Is a pin targetable right now? (Stage 4 blind-spot rule included.) */
function pinTargetable(state, col, pin) {
  if (pin.state !== 'free') return false;
  if (col.state !== 'march') return false;
  if (stage(state).blindSpot) {
    // The Titan's shield-plates rotate; pins are only exposed when the
    // King stands in the blind arc behind the shield angle.
    const bearing = Math.atan2(state.king.x - col.x, state.king.z - col.z);
    const blindDir = col.shieldAngle + Math.PI;
    let diff = bearing - blindDir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 0.9) return false;
  }
  return true;
}

/** Nearest free, targetable pin to the aim point, in throw range. */
export function targetPin(state, aimX, aimZ) {
  let best = null;
  let bestD = 1e9;
  for (const col of state.colossi) {
    if (col.state !== 'march') continue;
    for (const pin of col.pins) {
      if (!pinTargetable(state, col, pin)) continue;
      const g = pinGround(state, col, pin);
      const dAim = Math.hypot(g.x - aimX, g.z - aimZ);
      const dKing = Math.hypot(g.x - state.king.x, g.z - state.king.z);
      if (dAim < 2.4 && dKing <= THROW_RANGE && dAim < bestD) {
        bestD = dAim;
        best = { col, pin, g };
      }
    }
  }
  return best;
}

function nearestPylon(state, x, z, maxD) {
  let best = null;
  let bestD = 1e9;
  for (const p of state.pylons) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return bestD <= maxD ? best : null;
}

/** Throw a chain at the pin under the aim point. */
function throwChain(state, aimX, aimZ) {
  if (state.throwCooldown > 0) return;
  const t = targetPin(state, aimX, aimZ);
  if (!t) return;
  const { col, pin, g } = t;
  // A chain with a pylon end has a free end to re-anchor.
  let chain = state.chains.find((c) => c.b && c.b.type === 'pylon');
  const isBossCrown = col.boss && state.bossPhase === 2 && pin.id === 'crown';
  if (!chain) {
    if (state.chains.length >= maxChains(state)) {
      state.lastEvent = 'CHAIN LIMIT — haul the chains taut first!';
      return;
    }
    chain = { id: state.chains.length ? Math.max(...state.chains.map((c) => c.id)) + 1 : 0, a: null, b: null, tautness: 0, state: 'attached' };
    state.chains.push(chain);
    chain.a = { colossusId: col.id, pinId: pin.id };
    if (isBossCrown) {
      chain.b = { type: 'altar', x: 0, z: ALTAR_STRUCT_Z };
    } else {
      const py = nearestPylon(state, g.x, g.z, pylonRange(state));
      if (!py) {
        state.chains.pop();
        state.lastEvent = 'NO PYLON IN RANGE — move closer to a pylon!';
        return;
      }
      chain.b = { type: 'pylon', x: py.x, z: py.z, ember: py.ember };
    }
  } else {
    // Re-anchor the chain's far end from its pylon to this pin.
    chain.b = isBossCrown
      ? { type: 'altar', x: 0, z: ALTAR_STRUCT_Z }
      : { colossusId: col.id, pinId: pin.id };
    chain.tautness = 0;
    chain.state = 'attached';
  }
  pin.state = 'chained';
  pin.chainId = chain.id;
  state.pins += 1;
  state.score += R.pinScore;
  state.throws += 1;
  state.throwCooldown = R.chainThrowCooldown;
  state.lastEvent = 'SEAL-PIN DRIVEN +150';
}

function dropShard(state, x, z) {
  const n = hasRelic(state, 'crownfirst') ? 2 : 1;
  state.shards += n;
  state.score += R.shardScore * n;
}

/** A chain just went taut: combo check, plate snap, topple checks. */
function onChainTaut(state, chain) {
  chain.state = 'taut';
  if (state.time - state.lastTautAt < 5 && state.lastTautAt > 0) {
    state.combos += 1;
    state.score += R.comboScore;
    state.lastEvent = 'MULTI-CHAIN COMBO +300';
  }
  state.lastTautAt = state.time;
  const g = chainEndGround(state, chain.a);
  if (g) dropShard(state, g.x, g.z);
  // Ember-Pylon detonation: a taut chain crossing an ember pylon blows it.
  if (chain.b && chain.b.type === 'pylon' && chain.b.ember) {
    state.score += R.emberScore;
    state.lastEvent = 'EMBER-PYLON DETONATION +500';
  }
  // Cross-colossus trip (stage 3 twin rule): a taut chain linking two
  // colossi trips them both at once.
  const aCol = chain.a ? colossusById(state, chain.a.colossusId) : null;
  const bCol = chain.b && chain.b.colossusId !== undefined ? colossusById(state, chain.b.colossusId) : null;
  if (aCol && bCol && aCol.id !== bCol.id) {
    if (aCol.state === 'march') toppleColossus(state, aCol);
    if (bCol.state === 'march') toppleColossus(state, bCol);
    return;
  }
  // Normal topple check on the colossus this chain belongs to.
  if (aCol && aCol.state === 'march') {
    const need = aCol.boss && state.bossPhase === 2 ? 1 : R.toppleNeed;
    if (tautLimbs(state, aCol) >= need) toppleColossus(state, aCol);
  }
  if (bCol && bCol.state === 'march' && bCol.id !== (aCol && aCol.id)) {
    if (tautLimbs(state, bCol) >= R.toppleNeed) toppleColossus(state, bCol);
  }
}

/** Ground position of a chain end (pin or pylon/altar). */
function chainEndGround(state, end) {
  if (!end) return null;
  if (end.type === 'pylon' || end.type === 'altar') return { x: end.x, z: end.z };
  const col = colossusById(state, end.colossusId);
  if (!col) return null;
  const pin = col.pins.find((p) => p.id === end.pinId);
  if (!pin) return null;
  return pinGround(state, col, pin);
}

function toppleColossus(state, col) {
  col.state = 'toppled';
  col.toppleT = 0;
  col.toppleFlash = 1;
  state.topples += 1;
  state.score += R.toppleScore;
  state.lastEvent = col.name + ' TOPPLED! +1000 — vault the ring!';
  if (hasRelic(state, 'crownfirst')) {
    // Golden Nova: scarabs near the colossus burst, shards already doubled.
    for (const s of state.scarabs) {
      if (Math.hypot(s.x - col.x, s.z - col.z) < 12) {
        s.dead = true;
        state.scarabKills += 1;
        state.score += R.scarabScore;
      }
    }
    state.scarabs = state.scarabs.filter((s) => !s.dead);
    state.lastEvent = 'GOLDEN NOVA! ' + col.name + ' TOPPLED! +1000';
  }
}

/** Break every chain touching a colossus (get-up / phase change / shatter).
// Frees the pins on BOTH ends, even when a chain links two colossi. */
function breakChainsOf(state, col) {
  const deadIds = new Set();
  for (const ch of state.chains) {
    const touchesA = ch.a && ch.a.colossusId === col.id;
    const touchesB = ch.b && ch.b.colossusId === col.id;
    if (touchesA || touchesB) { ch.dead = true; deadIds.add(ch.id); }
  }
  state.chains = state.chains.filter((c) => !c.dead);
  for (const c of state.colossi) {
    for (const p of c.pins) {
      if (p.state === 'chained' && deadIds.has(p.chainId)) { p.state = 'free'; p.chainId = null; }
    }
  }
}

function shatterColossus(state, col) {
  col.state = 'shattered';
  state.onTopOf = null;
  state.king.y = 0;
  // Step off the fallen giant, back toward the arena centre.
  const dx = 0 - col.x;
  const dz = 12 - col.z;
  const len = Math.hypot(dx, dz) || 1;
  state.king.x = Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, col.x + (dx / len) * 6));
  state.king.z = Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, col.z + (dz / len) * 6));
  state.lastEvent = col.name + ' SHATTERED!';
  breakChainsOf(state, col);
  if (col.boss) {
    if (state.bossPhase < 2) {
      state.bossPhase += 1;
      const ph = BOSS_PHASES[state.bossPhase];
      const layout = pinLayout('boss');
      col.pins = ph.pins.map((id) => ({ id, ...layout[id], state: 'free', chainId: null }));
      col.sigilHp = ph.sigilHp;
      col.sigilMax = ph.sigilHp;
      col.plateHp = 6;
      col.staggered = false;
      col.state = 'march';
      col.toppleT = 0;
      state.lastEvent = 'AURELIUS STAGGERS — ' + ph.name;
      return;
    }
    state.score += Math.ceil(state.siege) * 15;
    endRun(state, 'win', '');
    return;
  }
  checkStageClear(state);
}

function checkStageClear(state) {
  if (state.colossi.every((c) => c.state === 'shattered')) {
    state.score += Math.ceil(state.siege) * 15;
    if (state.stageIdx >= CROWNBOUND_STAGES.length - 1) {
      endRun(state, 'win', '');
    } else {
      offerDraft(state);
    }
  }
}

function offerDraft(state) {
  const owned = new Set(state.relics.map((r) => r.id));
  const pool = CROWNBOUND_RELICS.filter((r) => !owned.has(r.id));
  shuffle(state.rng, pool);
  state.draft = pool.slice(0, 3);
  state.draftStage = state.stageIdx;
  state.screen = 'relic';
}

/** Pick draft[i] and advance to the next stage. */
export function chooseRelic(state, i) {
  if (state.screen !== 'relic' || !state.draft) return;
  const relic = state.draft[i] || state.draft[0];
  state.relics.push(relic);
  state.relicFlags[relic.id] = true;
  state.draft = null;
  state.stageIdx += 1;
  state.screen = 'play';
  state.king.x = 0;
  state.king.z = 12;
  state.king.y = 0;
  state.king.vx = 0;
  state.king.vz = 0;
  state.king.vy = 0;
  buildStage(state);
}

function endRun(state, screen, reason) {
  state.screen = screen;
  state.loseReason = reason || '';
  state.stats = {
    score: state.score, pins: state.pins, topples: state.topples, combos: state.combos,
    shards: state.shards, scarabKills: state.scarabKills, throws: state.throws,
    vaults: state.vaults, slams: state.slams, hp: Math.max(0, Math.round(state.king.hp)),
    time: Math.round(state.time * 10) / 10, stages: state.stageIdx + 1,
    relics: state.relics.map((r) => r.id),
  };
}

function applyHit(state, dmg, label) {
  if (state.king.invuln > 0) return;
  if (hasRelic(state, 'mantle') && state.mantleTimer <= 0) {
    state.mantleTimer = 12;
    state.lastEvent = 'VELVET MANTLE absorbed the blow!';
    state.king.invuln = 0.6;
    return;
  }
  state.king.hp -= dmg;
  state.king.invuln = R.invulnAfterHit;
  state.lastEvent = label + ' -' + dmg;
  if (state.king.hp <= 0) {
    state.king.hp = 0;
    endRun(state, 'lose', 'Royal Vitality reached 0 — the King falls');
  }
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

/** One fixed step. input: {moveX, moveZ, jump, haul, act, aimX, aimZ}. */
export function step(state, input) {
  if (state.screen === 'title' || state.screen === 'win' || state.screen === 'lose' || state.screen === 'relic') return;
  const dt = STEP;
  state.time += dt;
  state.stageTime += dt;
  state.siege -= dt;
  if (state.siege <= 0) {
    endRun(state, 'lose', 'The siege timer expired — the altar fell');
    return;
  }
  const st = stage(state);
  const k = state.king;
  if (state.throwCooldown > 0) state.throwCooldown -= dt;
  if (state.slamCooldown > 0) state.slamCooldown -= dt;
  if (k.invuln > 0) k.invuln -= dt;
  if (state.mantleTimer > 0) state.mantleTimer -= dt;

  // --- Vault in progress: ride the Bezier arc, then stand on the giant. ---
  if (state.vaultT > 0) {
    state.vaultT -= dt;
    const f = 1 - Math.max(0, state.vaultT) / R.vaultTime;
    const from = state.vaultFrom;
    const to = state.vaultTo;
    k.x = from.x + (to.x - from.x) * f;
    k.z = from.z + (to.z - from.z) * f;
    k.y = from.y + (to.y - from.y) * f + Math.sin(f * Math.PI) * 4;
    if (state.vaultT <= 0) {
      k.y = to.y;
      state.onTopOf = state.vaultTo.colossusId;
      state.vaultFrom = null;
      state.vaultTo = null;
    }
    return; // nothing else moves while the King is mid-vault
  }

  // --- King movement (ground only; onTop the King stands on the giant). ---
  if (state.onTopOf === null) {
    const speed = kingSpeed(state);
    const tx = (input.moveX || 0) * speed;
    const tz = (input.moveZ || 0) * speed;
    if (k.vx < tx) k.vx = Math.min(tx, k.vx + R.kingAccel * dt);
    else k.vx = Math.max(tx, k.vx - R.kingAccel * dt);
    if (k.vz < tz) k.vz = Math.min(tz, k.vz + R.kingAccel * dt);
    else k.vz = Math.max(tz, k.vz - R.kingAccel * dt);
    k.x += k.vx * dt;
    k.z += k.vz * dt;
    if (k.x < -ARENA_HALF_X) { k.x = -ARENA_HALF_X; k.vx = Math.max(0, k.vx); }
    if (k.x > ARENA_HALF_X) { k.x = ARENA_HALF_X; k.vx = Math.min(0, k.vx); }
    if (k.z < -ARENA_HALF_Z) { k.z = -ARENA_HALF_Z; k.vz = Math.max(0, k.vz); }
    if (k.z > ARENA_HALF_Z) { k.z = ARENA_HALF_Z; k.vz = Math.min(0, k.vz); }

    // Jump, or vault if inside a toppled colossus's golden ring.
    if (input.jump && k.y === 0) {
      const ring = state.colossi.find((c) => c.state === 'toppled' && Math.hypot(k.x - c.x, k.z - c.z) <= R.vaultRadius);
      if (ring) {
        const s = ring.size / 14;
        state.vaultFrom = { x: k.x, z: k.z, y: 0 };
        state.vaultTo = { x: ring.x, z: ring.z - 1, y: 0.62 * ring.size, colossusId: ring.id };
        state.vaultT = R.vaultTime;
        state.vaults += 1;
        state.lastEvent = 'VAULT! Onto ' + ring.name + '!';
        return;
      }
      k.vy = R.jumpVy * (hasRelic(state, 'boots') ? 11 / 9.5 : 1);
      k.jumpsUsed = 1;
    }
    if (k.y > 0 || k.vy > 0) {
      k.vy -= R.gravity * dt;
      k.y += k.vy * dt;
      if (k.y <= 0) { k.y = 0; k.vy = 0; k.jumpsUsed = 0; }
    }

    // Pits: an abyss fall costs 20 HP and respawns the King at the edge.
    for (const pit of state.pits) {
      if (k.y <= 0.05 && Math.hypot(k.x - pit.x, k.z - pit.z) < pit.r) {
        k.x = 0;
        k.z = 12;
        k.vx = 0;
        k.vz = 0;
        applyHit(state, R.pitDamage, 'ABYSS FALL');
        if (state.screen !== 'play') return;
        break;
      }
    }
  }

  // --- Left-click: throw a chain, or slam the Heart-Sigil on top. ---
  if (input.act) {
    if (state.onTopOf !== null) {
      if (state.slamCooldown <= 0) {
        const col = colossusById(state, state.onTopOf);
        if (col && col.state === 'toppled') {
          state.slamCooldown = R.slamCooldown;
          state.slams += 1;
          col.sigilHp -= hasRelic(state, 'titangrip') ? 2 : 1;
          if (hasRelic(state, 'titangrip')) {
            k.hp = Math.min(R.startHp, k.hp + 15);
          }
          state.lastEvent = col.sigilHp > 0 ? 'HEART-SIGIL CRACKED!' : 'HEART-SIGIL SHATTERED!';
          if (col.sigilHp <= 0) {
            shatterColossus(state, col);
          } else {
            // One slam per topple: the colossus bucks the King off and
            // rises again — the player must re-anchor for the next slam.
            const dx = 0 - col.x;
            const dz = 12 - col.z;
            const len = Math.hypot(dx, dz) || 1;
            state.onTopOf = null;
            k.y = 0;
            k.x = Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, col.x + (dx / len) * 6));
            k.z = Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, col.z + (dz / len) * 6));
            k.invuln = Math.max(k.invuln, 1.0);
            col.buckT = 1.2;
            state.lastEvent = 'BUCKED OFF! Re-anchor for the next slam!';
          }
          if (state.screen !== 'play') return;
        }
      }
    } else {
      throwChain(state, input.aimX ?? 0, input.aimZ ?? 0);
      if (state.screen !== 'play') return;
    }
  }

  // --- Hauling: pull attached chains taut. ---
  if (input.haul) {
    for (const ch of state.chains) {
      if (ch.state === 'attached') {
        ch.tautness += R.haulRate * (hasRelic(state, 'heavyanchor') ? 1.45 : 1) * dt;
        if (ch.tautness >= 1) {
          ch.tautness = 1;
          onChainTaut(state, ch);
          if (state.screen !== 'play') return;
        }
      }
    }
  }

  // --- Heavy Anchor: taut chains rattle a colossus's plates loose. ---
  if (hasRelic(state, 'heavyanchor')) {
    for (const col of state.colossi) {
      if (col.state !== 'march' || col.staggered) continue;
      const n = tautLimbs(state, col);
      if (n > 0) {
        col.plateHp -= n * dt;
        if (col.plateHp <= 0) {
          col.staggered = true;
          col.staggerT = 3;
          col.plateHp = 6;
          state.score += R.staggerScore;
          state.lastEvent = 'PLATES SHATTERED — ' + col.name + ' STAGGERS! +100';
        }
      }
    }
  }

  // --- Sunfire: scarabs crossing a taut chain burn. ---
  if (hasRelic(state, 'sunfire')) {
    for (const ch of state.chains) {
      if (ch.state !== 'taut') continue;
      const a = chainEndGround(state, ch.a);
      const b = chainEndGround(state, ch.b);
      if (!a || !b) continue;
      for (const s of state.scarabs) {
        if (!s.dead && distToSegment(s.x, s.z, a.x, a.z, b.x, b.z) < 1.6) {
          s.dead = true;
          state.scarabKills += 1;
          state.score += R.scarabScore;
        }
      }
    }
    state.scarabs = state.scarabs.filter((s) => !s.dead);
  }

  // --- Colossi march, topple timers, shield rotation. ---
  for (const col of state.colossi) {
    if (col.toppleFlash > 0) col.toppleFlash -= dt;
    if (col.state === 'toppled') {
      col.toppleT += dt;
      if (col.buckT > 0) {
        col.buckT -= dt;
        if (col.buckT <= 0 && state.onTopOf !== col.id) {
          col.state = 'march';
          col.toppleT = 0;
          col.buckT = 0;
          breakChainsOf(state, col);
          state.lastEvent = col.name + ' RISES — CHAINS BROKEN!';
        }
        continue;
      }
      if (col.toppleT >= R.toppleGetUp && state.onTopOf !== col.id) {
        col.state = 'march';
        col.toppleT = 0;
        col.sigilHp = col.sigilMax;
        breakChainsOf(state, col);
        state.lastEvent = col.name + ' RISES — CHAINS BROKEN!';
      }
      continue;
    }
    if (col.state !== 'march') continue;
    col.walkPhase += dt * 2;
    if (st.blindSpot) col.shieldAngle += 0.35 * dt;
    let speed = col.baseSpeed;
    const taut = tautLimbs(state, col);
    speed *= Math.pow(0.55, taut);
    if (speed < 0.12) speed = 0.12;
    if (col.staggered) {
      col.staggerT -= dt;
      if (col.staggerT <= 0) col.staggered = false;
      speed = 0;
    }
    col.z -= speed * dt;
    if (col.z <= ALTAR_Z) {
      endRun(state, 'lose', 'The ' + col.name + ' reached the Sanctuary Altar');
      return;
    }
  }

  // --- Hazards. ---
  // Shockwaves: a marching colossus pulses a ring every shockEvery seconds.
  state.shockTimer -= dt;
  if (state.shockTimer <= 0) {
    state.shockTimer = st.shockEvery;
    for (const col of state.colossi) {
      if (col.state === 'march') state.shockwaves.push({ x: col.x, z: col.z, r: 1 });
    }
  }
  for (const w of state.shockwaves) {
    w.r += 10 * dt;
    if (state.onTopOf === null && k.y < 0.15 && Math.abs(Math.hypot(k.x - w.x, k.z - w.z) - w.r) < 1.3) {
      applyHit(state, R.shockDamage, 'SHOCKWAVE');
      if (state.screen !== 'play') return;
    }
  }
  state.shockwaves = state.shockwaves.filter((w) => w.r < 16);

  // Falling crystal shards: telegraphed, then they land.
  state.shardTimer -= dt;
  if (state.shardTimer <= 0 && st.shardEvery > 0) {
    state.shardTimer = st.shardEvery;
    for (let i = 0; i < st.shardCount; i++) {
      state.shardTele.push({
        x: Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, k.x + range(state.rng, -5, 5))),
        z: Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, k.z + range(state.rng, -5, 5))),
        t: 0.9,
      });
    }
  }
  for (const s of state.shardTele) {
    s.t -= dt;
    if (s.t <= 0 && state.onTopOf === null && k.y < 0.15 && Math.hypot(k.x - s.x, k.z - s.z) < 1.6) {
      applyHit(state, R.shardDamage, 'CRYSTAL SHARD');
      if (state.screen !== 'play') return;
    }
  }
  state.shardTele = state.shardTele.filter((s) => s.t > 0);

  // Beam rings (stage 2): a glowing ring sweeps the arena; jump it.
  if (st.beamEvery > 0) {
    state.beamTimer -= dt;
    if (state.beamTimer <= 0 && !state.beam) {
      state.beam = { z: ARENA_HALF_Z, dir: -1 };
      state.beamTimer = st.beamEvery;
    }
    if (state.beam) {
      state.beam.z += state.beam.dir * 6 * dt;
      if (state.onTopOf === null && k.y < 0.15 && Math.abs(k.z - state.beam.z) < 1.3) {
        applyHit(state, R.beamDamage, 'BEAM RING');
        if (state.screen !== 'play') return;
      }
      if (state.beam.z < -ARENA_HALF_Z) state.beam = null;
    }
  }

  // Scarabs: small shadow-creatures that walk at the King.
  state.scarabTimer -= dt;
  if (state.scarabTimer <= 0 && st.scarabEvery > 0 && state.scarabs.length < st.scarabMax) {
    state.scarabTimer = st.scarabEvery;
    const ang = range(state.rng, 0, Math.PI * 2);
    state.scarabs.push({
      x: Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, k.x + Math.cos(ang) * 18)),
      z: Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, k.z + Math.sin(ang) * 12)),
    });
  }
  for (const s of state.scarabs) {
    const dx = k.x - s.x;
    const dz = k.z - s.z;
    const d = Math.hypot(dx, dz) || 1;
    s.x += (dx / d) * 2.6 * dt;
    s.z += (dz / d) * 2.6 * dt;
    if (state.onTopOf === null && !s.dead && d < 1.3) {
      s.dead = true;
      applyHit(state, R.scarabDamage, 'SCARAB BITE');
      if (state.screen !== 'play') return;
    }
  }
  state.scarabs = state.scarabs.filter((s) => !s.dead);

  // Meteor slams (boss phase 2): telegraphed circles, then impact.
  state.meteorTimer -= dt;
  if (state.meteorTimer <= 0 && st.meteorEvery > 0) {
    state.meteorTimer = st.meteorEvery;
    state.meteors.push({
      x: Math.max(-ARENA_HALF_X, Math.min(ARENA_HALF_X, k.x + range(state.rng, -6, 6))),
      z: Math.max(-ARENA_HALF_Z, Math.min(ARENA_HALF_Z, k.z + range(state.rng, -6, 6))),
      t: 1.2,
    });
  }
  for (const m of state.meteors) {
    m.t -= dt;
    if (m.t <= 0 && state.onTopOf === null && k.y < 0.15 && Math.hypot(k.x - m.x, k.z - m.z) < 3) {
      applyHit(state, R.meteorDamage, 'METEOR SLAM');
      if (state.screen !== 'play') return;
    }
  }
  state.meteors = state.meteors.filter((m) => m.t > 0);
}

/** The autopilot: anchor, haul, vault, slam — and dodge what it can. */
export function autoInput(state) {
  const input = { moveX: 0, moveZ: 0, jump: false, haul: false, act: false, aimX: 0, aimZ: 0 };
  if (state.screen === 'relic') return input;
  if (state.lazy) return input; // lazy play: never moves, never throws
  const k = state.king;

  // On top of a colossus: slam the Heart-Sigil.
  if (state.onTopOf !== null) {
    if (state.slamCooldown <= 0) input.act = true;
    return input;
  }
  // Mid-vault: ride it out.
  if (state.vaultT > 0) return input;

  // --- Movement target, with hazard repulsion folded in. ---
  let tx = null;
  let tz = null;

  // Dodge: step out of meteor / shard telegraphs covering the King.
  let dodgeX = 0;
  let dodgeZ = 0;
  for (const m of state.meteors) {
    if (Math.hypot(k.x - m.x, k.z - m.z) < 3.4) {
      dodgeX += (k.x - m.x);
      dodgeZ += (k.z - m.z);
    }
  }
  for (const s of state.shardTele) {
    if (s.t < 0.7 && Math.hypot(k.x - s.x, k.z - s.z) < 2.2) {
      dodgeX += (k.x - s.x);
      dodgeZ += (k.z - s.z);
    }
  }
  // Scarabs closing in: back away.
  for (const s of state.scarabs) {
    const d = Math.hypot(k.x - s.x, k.z - s.z);
    if (d < 2.2) {
      dodgeX += (k.x - s.x) / (d || 1);
      dodgeZ += (k.z - s.z) / (d || 1);
    }
  }
  // Pits: steer around them.
  for (const pit of state.pits) {
    const d = Math.hypot(k.x - pit.x, k.z - pit.z);
    if (d < 4.5) {
      dodgeX += (k.x - pit.x) / (d || 1) * 1.5;
      dodgeZ += (k.z - pit.z) / (d || 1) * 1.5;
    }
  }

  // Jump an incoming beam ring or shockwave.
  if (k.y === 0) {
    if (state.beam && Math.abs(k.z - state.beam.z) < 3.2) input.jump = true;
    for (const w of state.shockwaves) {
      const d = Math.hypot(k.x - w.x, k.z - w.z);
      if (Math.abs(d - w.r) < 2.4 && w.r < d) { input.jump = true; break; }
    }
  }

  // A toppled colossus: go to its vault ring and leap on (but not while it
  // is bucking the King off — it is about to rise again).
  const toppled = state.colossi.find((c) => c.state === 'toppled' && c.buckT <= 0);
  if (toppled) {
    const d = Math.hypot(k.x - toppled.x, k.z - toppled.z);
    if (d <= R.vaultRadius - 0.5 && k.y === 0) {
      input.jump = true;
      return input;
    }
    tx = toppled.x;
    tz = toppled.z;
  } else {
    // Pick the marching colossus with the fewest taut limbs, then its
    // nearest free ankle pin (lowest pins are the quickest to reach).
    let target = null;
    for (const col of state.colossi) {
      if (col.state !== 'march') continue;
      const taut = tautLimbs(state, col);
      const freePins = col.pins.filter((p) => pinTargetable(state, col, p));
      if (!freePins.length) continue;
      if (!target || taut < target.taut) target = { col, taut, freePins };
    }
    if (target) {
      const { col, freePins } = target;
      // Prefer the lowest pin (ankle first), then the nearest.
      freePins.sort((a, b) => (a.dy - b.dy) || (Math.hypot(pinGround(state, col, a).x - k.x, pinGround(state, col, a).z - k.z) - Math.hypot(pinGround(state, col, b).x - k.x, pinGround(state, col, b).z - k.z)));
      const pin = freePins[0];
      const g = pinGround(state, col, pin);
      const dKing = Math.hypot(g.x - k.x, g.z - k.z);
      if (dKing <= THROW_RANGE - 1) {
        input.aimX = g.x;
        input.aimZ = g.z;
        input.act = true;
      } else {
        tx = g.x;
        tz = g.z;
      }
    } else {
      // No pin targetable (stage 4 blind spot): move to the blind point
      // behind the Titan's rotating shield.
      const col = state.colossi.find((c) => c.state === 'march');
      if (col) {
        const blindDir = col.shieldAngle + Math.PI;
        tx = col.x + Math.sin(blindDir) * 10;
        tz = col.z + Math.cos(blindDir) * 10;
      }
    }
  }

  // Haul whenever a chain is attached but not yet taut.
  if (state.chains.some((c) => c.state === 'attached')) input.haul = true;

  // Steer toward the target, folded with the dodge vectors.
  if (tx !== null && tz !== null) {
    let mx = tx - k.x;
    let mz = tz - k.z;
    mx += dodgeX;
    mz += dodgeZ;
    const len = Math.hypot(mx, mz);
    if (len > 0.1) {
      input.moveX = Math.max(-1, Math.min(1, mx / len));
      input.moveZ = Math.max(-1, Math.min(1, mz / len));
    }
  } else if (dodgeX !== 0 || dodgeZ !== 0) {
    const len = Math.hypot(dodgeX, dodgeZ);
    input.moveX = Math.max(-1, Math.min(1, dodgeX / len));
    input.moveZ = Math.max(-1, Math.min(1, dodgeZ / len));
  }
  return input;
}

/** Run a whole autopilot game in Node (no rendering). Returns the stats. */
export function runAuto(seed, opts = {}) {
  const state = createRun(seed, opts);
  startRun(state);
  let guard = 0;
  while (state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') {
      chooseRelic(state, 0);
      continue;
    }
    step(state, autoInput(state));
  }
  return { screen: state.screen, loseReason: state.loseReason, stats: state.stats, guard };
}
