// CROWNBOUND — relic smoke test (Node, sim only; no gameplay change).
// The autopilot always takes draft option 0, so the other relic choices
// are untested by tests/auto.mjs. This test:
//   (1) Coverage: for each of the 8 relics, seeds 1-16 with the policy
//       "pick the target if offered, else pick 0" — records drafted?,
//       won?, stage 6 reached?
//   (2) Synthetic effect checks: each relic's effect is exercised directly
//       on a manipulated state object via the exported sim functions.
// Exit 0 iff every check passes.
import { createRun, startRun, step, chooseRelic, autoInput, maxChains, pinGround } from '../game/src/sim.js';
import { CROWNBOUND_RELICS } from '../game/src/config.js';

const RELICS = CROWNBOUND_RELICS.map((r) => r.id);
const IDLE = { moveX: 0, moveZ: 0, jump: false, haul: false, act: false, aimX: 0, aimZ: 0 };
let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined ? ' — ' + detail : ''));
  if (!cond) failures += 1;
}
function fresh(seed = 1) {
  const s = createRun(seed, {});
  startRun(s);
  return s;
}
function give(state, id) {
  state.relicFlags[id] = true;
  const r = CROWNBOUND_RELICS.find((x) => x.id === id);
  if (r) state.relics.push(r);
}
function ankle(state) {
  const col = state.colossi[0];
  const pin = col.pins.find((p) => p.id === 'ankleL');
  return { col, pin, g: pinGround(state, col, pin) };
}

// ---- (1a) coverage, fast path (no per-step instrumentation) ----
function coverageRunFast(target, seed) {
  const state = fresh(seed);
  let drafted = false;
  let stage6 = false;
  let guard = 0;
  while (state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') {
      const idx = state.draft.findIndex((r) => r.id === target);
      if (idx >= 0) drafted = true;
      chooseRelic(state, idx >= 0 ? idx : 0);
      continue;
    }
    if (state.stageIdx >= 5) stage6 = true;
    step(state, autoInput(state));
  }
  return { seed, drafted, won: state.screen === 'win', stage6: stage6 || state.stageIdx >= 5 };
}

// ---- (1b) coverage, instrumented path (crownfirst: shard + Nova watch) ----
function coverageRunCrownReal(target, seed) {
  const state = fresh(seed);
  const rec = { seed, drafted: false, won: false, stage6: false, novaSeen: 0, novaTopples: 0, shardPairs: [] };
  let guard = 0;
  while (state.screen !== 'win' && state.screen !== 'lose' && guard < 60 * 400) {
    guard += 1;
    if (state.screen === 'relic') {
      const idx = state.draft.findIndex((r) => r.id === target);
      if (idx >= 0) rec.drafted = true;
      chooseRelic(state, idx >= 0 ? idx : 0);
      continue;
    }
    if (state.stageIdx >= 5) rec.stage6 = true;
    const before = {
      shards: state.shards, topples: state.topples, scarabs: state.scarabKills,
      chains: new Map(state.chains.map((c) => [c.id, c.state])),
      owned: !!state.relicFlags.crownfirst,
    };
    step(state, autoInput(state));
    let nTaut = 0;
    for (const c of state.chains) {
      if (c.state === 'taut' && before.chains.get(c.id) === 'attached') nTaut += 1;
    }
    if (nTaut > 0) rec.shardPairs.push({ n: nTaut, d: state.shards - before.shards, owned: before.owned });
    if (state.topples > before.topples && before.owned) {
      rec.novaTopples += 1;
      if (state.lastEvent.includes('GOLDEN NOVA') || state.scarabKills > before.scarabs) rec.novaSeen += 1;
    }
  }
  rec.won = state.screen === 'win';
  rec.stage6 = rec.stage6 || state.stageIdx >= 5;
  return rec;
}

// ---- (1) run coverage for all 8 relics ----
const coverage = {};
for (const target of RELICS) {
  const runs = [];
  for (let seed = 1; seed <= 16; seed += 1) {
    runs.push(target === 'crownfirst' ? coverageRunCrownReal(target, seed) : coverageRunFast(target, seed));
  }
  const drafted = runs.filter((r) => r.drafted);
  const wins = drafted.filter((r) => r.won).length;
  const s6 = drafted.filter((r) => r.stage6).length;
  coverage[target] = { runs, drafted: drafted.map((r) => r.seed), wins, s6 };
  console.log(`COVER ${target}: drafted seeds [${drafted.map((r) => r.seed).join(',')}] (${drafted.length}/16), won ${wins}/${drafted.length}, stage6 ${s6}/${drafted.length}`);
  check(`coverage ${target} drafted at least once`, drafted.length >= 1, `${drafted.length}/16 seeds`);
  check(`coverage ${target} wins at least once with it drafted`, wins >= 1, `${wins}/${drafted.length} won`);
}

// crownfirst: shard doubling + Golden Nova, from the instrumented runs
{
  const pairs = coverage.crownfirst.runs.flatMap((r) => r.shardPairs);
  const owned = pairs.filter((p) => p.owned);
  const clean = pairs.filter((p) => !p.owned);
  check('crownfirst shards doubled once owned', owned.length >= 1 && owned.every((p) => p.d === 2 * p.n),
    `${owned.length} owned pairs, e.g. ${owned.slice(0, 3).map((p) => `${p.n}->${p.d}`).join(', ')}`);
  check('crownfirst shards single when not owned', clean.every((p) => p.d === p.n), `${clean.length} unowned pairs`);
  const nt = coverage.crownfirst.runs.reduce((a, r) => a + r.novaTopples, 0);
  const ns = coverage.crownfirst.runs.reduce((a, r) => a + r.novaSeen, 0);
  check('crownfirst Golden Nova seen on a topple', nt === 0 || ns > 0, `${ns}/${nt} topples showed Nova`);
}

// ---- (2a) twinspool: maxChains 3 vs 2 ----
{
  const c0 = fresh();
  const c1 = fresh();
  give(c1, 'twinspool');
  check('twinspool maxChains 3 with flag', maxChains(c1) === 3, `got ${maxChains(c1)}`);
  check('twinspool maxChains 2 control', maxChains(c0) === 2, `got ${maxChains(c0)}`);
}

// ---- (2b) boots: +30% speed and higher leap ----
{
  const run = (withBoots) => {
    const s = fresh();
    s.shockTimer = 99;
    if (withBoots) give(s, 'boots');
    const x0 = s.king.x;
    for (let i = 0; i < 60; i += 1) step(s, { ...IDLE, moveX: 1 });
    return s.king.x - x0;
  };
  const dControl = run(false);
  const dBoots = run(true);
  const ratio = dBoots / dControl;
  check('boots 60-step displacement ~1.3x control', ratio >= 1.2 && ratio <= 1.35,
    `control ${dControl.toFixed(3)}m, boots ${dBoots.toFixed(3)}m, ratio ${ratio.toFixed(3)}`);
  const vy = (withBoots) => {
    const s = fresh();
    s.shockTimer = 99;
    if (withBoots) give(s, 'boots');
    step(s, { ...IDLE, jump: true });
    return s.king.vy;
  };
  const v0 = vy(false);
  const v1 = vy(true);
  check('boots jump velocity +1.5 (9.5 -> 11)', Math.abs((v1 - v0) - 1.5) < 0.01,
    `control vy ${v0.toFixed(3)}, boots vy ${v1.toFixed(3)}`);
}

// ---- (2c) heavyanchor: 45% faster haul + plates rattle loose ----
{
  const inject = (withAnchor) => {
    const s = fresh();
    s.shockTimer = 99;
    if (withAnchor) give(s, 'heavyanchor');
    const { col } = ankle(s);
    s.chains = [{ id: 0, a: { colossusId: col.id, pinId: 'ankleL' }, b: { type: 'pylon', x: 0, z: 0, ember: false }, tautness: 0, state: 'attached' }];
    return s;
  };
  const haul = (withAnchor) => {
    const s = inject(withAnchor);
    for (let i = 0; i < 10; i += 1) step(s, { ...IDLE, haul: true });
    return s.chains[0].tautness;
  };
  const t0 = haul(false);
  const t1 = haul(true);
  check('heavyanchor haul tautness 0.2417 vs 0.1667 control', Math.abs(t0 - 10 / 60) < 0.002 && Math.abs(t1 - 14.5 / 60) < 0.002,
    `control ${t0.toFixed(4)}, anchor ${t1.toFixed(4)}`);
  const plate = (withAnchor) => {
    const s = inject(withAnchor);
    const { col, pin } = ankle(s);
    s.chains[0].state = 'taut';
    pin.state = 'chained';
    pin.chainId = 0;
    const hp0 = col.plateHp;
    for (let i = 0; i < 60; i += 1) step(s, IDLE);
    return { hp0, hp1: col.plateHp };
  };
  const p0 = plate(false);
  const p1 = plate(true);
  check('heavyanchor plateHp falls below 6 after 60 taut steps', p1.hp1 < 6 && Math.abs(p1.hp1 - 5) < 0.1,
    `plateHp ${p1.hp0} -> ${p1.hp1.toFixed(2)}`);
  check('heavyanchor plateHp untouched without flag', p0.hp1 === 6, `plateHp ${p0.hp0} -> ${p0.hp1}`);
}

// ---- (2d) sunfire: scarabs crossing a taut chain burn ----
{
  const run = (withSun) => {
    const s = fresh();
    s.shockTimer = 99;
    if (withSun) give(s, 'sunfire');
    const { col, pin, g } = ankle(s);
    const py = s.pylons[0];
    s.chains = [{ id: 0, a: { colossusId: col.id, pinId: 'ankleL' }, b: { type: 'pylon', x: py.x, z: py.z, ember: py.ember }, tautness: 1, state: 'taut' }];
    pin.state = 'chained';
    pin.chainId = 0;
    s.scarabs = [{ x: (g.x + py.x) / 2, z: (g.z + py.z) / 2, dead: false }];
    step(s, IDLE);
    return s.scarabKills;
  };
  check('sunfire scarab on the chain line dies', run(true) === 1, `scarabKills ${run(true)}`);
  check('sunfire scarab survives without flag', run(false) === 0, `scarabKills ${run(false)}`);
}

// ---- (2e) titangrip: double slam damage + heal ----
{
  const run = (withGrip) => {
    const s = fresh();
    const col = s.colossi[0];
    col.state = 'toppled';
    col.sigilHp = 3;
    s.onTopOf = col.id;
    s.slamCooldown = 0;
    s.king.hp = 50;
    if (withGrip) give(s, 'titangrip');
    step(s, { ...IDLE, act: true });
    return { sigilHp: col.sigilHp, hp: s.king.hp };
  };
  const r1 = run(true);
  check('titangrip slam: sigil 3 -> 1, hp 50 -> 65', r1.sigilHp === 1 && r1.hp === 65, `sigilHp ${r1.sigilHp}, hp ${r1.hp}`);
  const r0 = run(false);
  check('titangrip control slam: sigil 3 -> 2, hp stays 50', r0.sigilHp === 2 && r0.hp === 50, `sigilHp ${r0.sigilHp}, hp ${r0.hp}`);
}

// ---- (2f) magnet: pylon snap range 25 -> 40 ----
{
  const s = fresh();
  s.pylons = [{ x: 30, z: 0, ember: false }];
  const { g } = ankle(s);
  const d = Math.hypot(g.x - 30, g.z - 0);
  check('magnet geometry: pin 25-40m from the lone pylon', d > 25 && d <= 40, `distance ${d.toFixed(2)}m`);
  const aim = { ...IDLE, act: true, aimX: g.x, aimZ: g.z };
  step(s, aim);
  check('magnet control: NO PYLON IN RANGE, no chain', s.chains.length === 0 && s.lastEvent.startsWith('NO PYLON IN RANGE'),
    `chains ${s.chains.length}, event "${s.lastEvent}"`);
  give(s, 'magnet');
  step(s, aim);
  check('magnet with flag: chain created', s.chains.length === 1 && s.pins === 1,
    `chains ${s.chains.length}, pins ${s.pins}`);
}

// ---- (2g) mantle: absorbs one hit every 12s ----
{
  const run = (withMantle) => {
    const s = fresh();
    s.shockTimer = 99;
    if (withMantle) give(s, 'mantle');
    s.king.hp = 100;
    s.king.invuln = 0;
    s.mantleTimer = 0;
    s.shockwaves = [{ x: s.king.x, z: s.king.z, r: 0.5 }];
    step(s, IDLE);
    return { hp: s.king.hp, ev: s.lastEvent, timer: s.mantleTimer };
  };
  const r1 = run(true);
  check('mantle absorbs the shockwave', r1.hp === 100 && r1.ev === 'VELVET MANTLE absorbed the blow!' && r1.timer === 12,
    `hp ${r1.hp}, event "${r1.ev}", timer ${r1.timer}`);
  const r0 = run(false);
  check('mantle control: shockwave deals 12', r0.hp === 88 && r0.ev === 'SHOCKWAVE -12',
    `hp ${r0.hp}, event "${r0.ev}"`);
}

// ---- (2h) crownfirst direct: first taut chain drops 2 shards, not 1 ----
{
  const firstTaut = (withCrown) => {
    const s = fresh(1);
    if (withCrown) give(s, 'crownfirst');
    for (let i = 0; i < 600; i += 1) {
      if (s.screen !== 'play') break;
      const beforeShards = s.shards;
      const before = new Map(s.chains.map((c) => [c.id, c.state]));
      step(s, autoInput(s));
      let nTaut = 0;
      for (const c of s.chains) if (c.state === 'taut' && before.get(c.id) === 'attached') nTaut += 1;
      if (nTaut > 0) return { nTaut, dShards: s.shards - beforeShards, steps: i };
    }
    return null;
  };
  const c1 = firstTaut(true);
  check('crownfirst first taut chain drops 2 shards', c1 !== null && c1.dShards === 2 * c1.nTaut,
    c1 ? `${c1.nTaut} taut -> +${c1.dShards} shards in ${c1.steps} steps` : 'no taut chain in 600 steps');
  const c0 = firstTaut(false);
  check('crownfirst control first taut chain drops 1 shard', c0 !== null && c0.dShards === c0.nTaut,
    c0 ? `${c0.nTaut} taut -> +${c0.dShards} shards in ${c0.steps} steps` : 'no taut chain in 600 steps');
}

console.log(failures === 0 ? 'ALL RELIC SMOKE CHECKS PASS' : `${failures} RELIC SMOKE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
