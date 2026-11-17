// CROWNBOUND — main. Fixed 60Hz sim step, render each animation frame,
// screens (title / play / relic draft / win / lose), autopilot for
// verification (?auto=1 / ?auto=lazy), screenshot staging (?shot=...).
import { createRun, startRun, step, chooseRelic, autoInput, targetPin } from './sim.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { audio } from './audio.js';

const params = new URLSearchParams(location.search);
const autoMode = params.get('auto'); // '1' | 'lazy' | null
const shotMode = params.get('shot'); // cover | play | title | victory | null
const seedParam = parseInt(params.get('seed') || '1', 10);

const canvas = document.getElementById('game');
const input = createInput(canvas);
const renderer = createRenderer(canvas, './assets/king.png');

const overlays = {
  title: document.getElementById('ov-title'),
  relic: document.getElementById('ov-relic'),
  win: document.getElementById('ov-win'),
  lose: document.getElementById('ov-lose'),
  relicChoices: document.getElementById('relic-choices'),
  winStats: document.getElementById('win-stats'),
  loseStats: document.getElementById('lose-stats'),
  loseReason: document.getElementById('lose-reason'),
};

let state = createRun(seedParam, { lazy: autoMode === 'lazy' });
let lastScreen = state.screen;
let lastStage = state.stageIdx;
let lastSigil = -1;
let lastHp = 100;
let lastTopples = 0;
let lastScore = 0;
let relicOffered = false;

function showOnly(name) {
  for (const [k, el] of Object.entries(overlays)) {
    if (el && (k === 'title' || k === 'relic' || k === 'win' || k === 'lose')) {
      el.style.display = (k === name) ? 'flex' : 'none';
    }
  }
}

function startGame() {
  audio.unlock();
  audio.click();
  startRun(state);
  showOnly(null);
  renderer.setStage(state.stageIdx, state);
  renderer.setCamMode('follow');
}

function showRelicDraft() {
  const offer = state.draft || [];
  if (offer.length === 0) { state.screen = 'play'; return; }
  overlays.relicChoices.innerHTML = '';
  for (const r of offer) {
    const btn = document.createElement('button');
    btn.className = 'relic-btn';
    btn.innerHTML = '<b>' + r.name + '</b><span>' + r.desc + '</span>';
    btn.addEventListener('click', () => {
      audio.relic();
      chooseRelic(state, r.id);
      showOnly(null);
      renderer.setStage(state.stageIdx, state);
    });
    overlays.relicChoices.appendChild(btn);
  }
  showOnly('relic');
}

function showEnd(win) {
  const el = win ? overlays.win : overlays.lose;
  const statsEl = win ? overlays.winStats : overlays.loseStats;
  const s = state.stats;
  statsEl.innerHTML =
    'SCORE <b>' + state.score.toLocaleString('en-US') + '</b> &nbsp;·&nbsp; ' +
    'PINS <b>' + s.pins + '</b> &nbsp;·&nbsp; TOPPLES <b>' + s.topples + '</b> &nbsp;·&nbsp; ' +
    'COMBOS <b>' + s.combos + '</b> &nbsp;·&nbsp; TIME <b>' + s.time.toFixed(1) + 's</b><br>' +
    'STAGES <b>' + s.stages + '/6</b> &nbsp;·&nbsp; RELICS <b>' + (s.relics.join(', ') || 'none') + '</b>';
  if (!win) overlays.loseReason.textContent = state.loseReason || '';
  showOnly(win ? 'win' : 'lose');
  if (win) audio.win(); else audio.lose();
}

function restart() {
  audio.unlock();
  state = createRun(seedParam, { lazy: autoMode === 'lazy' });
  lastScreen = state.screen;
  lastStage = state.stageIdx;
  lastSigil = -1; lastHp = 100; lastTopples = 0; lastScore = 0;
  relicOffered = false;
  startRun(state);
  showOnly(null);
  renderer.setStage(state.stageIdx, state);
  renderer.setCamMode('follow');
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart-win').addEventListener('click', restart);
document.getElementById('btn-restart-lose').addEventListener('click', restart);
document.getElementById('btn-title').addEventListener('click', () => {
  state = createRun(seedParam, { lazy: autoMode === 'lazy' });
  showOnly('title');
  renderer.setCamMode('title');
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') audio.toggleMute();
  if (e.code === 'Enter' && state.screen === 'title') startGame();
  if (e.code === 'KeyR' && (state.screen === 'win' || state.screen === 'lose')) restart();
});

function sfxForEvents() {
  const k = state.king;
  if (k.hp < lastHp) audio.hurt();
  if (state.topples > lastTopples) audio.topple();
  if (state.pins > lastScore) audio.snap();
  lastHp = k.hp;
  lastTopples = state.topples;
  lastScore = state.pins;
  // sigil crack
  let sigil = 0;
  for (const c of state.colossi) sigil += c.sigilHp;
  if (lastSigil >= 0 && sigil < lastSigil) audio.slam();
  lastSigil = sigil;
}

// ---- autopilot (verification) ----
// Runs the sim as fast as the frame allows (up to 120 steps/frame) so the
// browser result does not depend on the software renderer's frame rate.
// The sim is deterministic, so the numbers must match Node exactly.
let autoDone = false;
function runAutoStep() {
  if (state.screen === 'title') startGame();
  let n = 0;
  while ((state.screen === 'play' || state.screen === 'relic') && n < 120) {
    n += 1;
    if (state.screen === 'relic') { chooseRelic(state, 0); continue; }
    step(state, autoInput(state));
  }
  if (state.screen === 'win' || state.screen === 'lose') {
    if (!autoDone) {
      autoDone = true;
      window.__autoResult = {
        screen: state.screen,
        loseReason: state.loseReason,
        stats: state.stats,
        score: state.score,
      };
      window.__shotReady = true;
    }
  }
}

// ---- screenshot staging ----
// __shotReady is set by the frame loop only once the shot is staged AND
// every backdrop texture has loaded (renderer.backdropsReady()), so a shot
// never captures a half-loaded vista.
let shotStaged = false;
function stageShot() {
  if (shotMode === 'title') {
    showOnly('title');
    renderer.setCamMode('title');
    renderer.setStage(0, state);
    shotStaged = true;
  } else if (shotMode === 'cover') {
    // Cover: stage 6 Floating Castle Citadel at sunset — the King hauling
    // a taut gold chain diagonally up at Aurelius, over-the-shoulder hero
    // camera, castle backdrop behind. Fast-forward the autopilot to stage 6,
    // then step only until the FIRST chain attaches. (Two earlier attempts
    // staged on two chains — "two attached with one taut", then "two
    // attached" — and BOTH caught Aurelius toppled. The reason: the second
    // chain goes taut in its attach step (the King throws from a few metres,
    // the chain is short, the slack is already gone), so the topple fires
    // inside the same step the second chain appears. There is no step
    // boundary at which two chains are attached and Aurelius is upright in
    // stage 6 — two taut limbs IS the topple. One attached chain (possibly
    // taut, one limb) guarantees zero stage-6 topples: Aurelius is upright
    // and marching. The cover therefore shows ONE gold chain, not two.)
    startRun(state);
    let guard = 0;
    while (state.stageIdx < 5 && state.screen !== 'lose' && guard < 60 * 400) {
      if (state.screen === 'relic') { chooseRelic(state, 0); }
      else if (state.screen === 'play') { step(state, autoInput(state)); }
      else break;
      guard += 1;
    }
    let n = 0;
    while (n < 60 * 6) {
      if (state.screen !== 'play') break;
      step(state, autoInput(state));
      n += 1;
      if (state.chains.length >= 1) break;
    }
    renderer.setStage(5, state);
    renderer.setCamMode('cover', state);
    showOnly(null);
    const w = document.getElementById('ov-cover-wordmark');
    if (w) w.style.display = 'block';
    shotStaged = true;
  } else if (shotMode === 'play') {
    // Play: stage 4 Ringed Moon Observatory — the King on the golden vault
    // arc, about to slam the exposed Heart-Sigil. Caught early in the vault
    // (vaultT in (0.35, 0.45); the vault lasts 0.6s, King ~6m up) so the
    // King, the fallen giant and the sigil share the frame — the apex
    // (vaultT 0.3, King ~12m) put the King alone in empty sky.
    startRun(state);
    let guard = 0;
    while (state.stageIdx < 3 && state.screen !== 'lose' && guard < 60 * 400) {
      if (state.screen === 'relic') { chooseRelic(state, 0); }
      else if (state.screen === 'play') { step(state, autoInput(state)); }
      else break;
      guard += 1;
    }
    let n = 0;
    while (n < 60 * 60) {
      if (state.screen !== 'play') break;
      step(state, autoInput(state));
      n += 1;
      if (state.vaultT > 0.35 && state.vaultT < 0.45) break;
    }
    renderer.setStage(3, state);
    renderer.setCamMode('playshot', state);
    showOnly(null);
    shotStaged = true;
  } else if (shotMode === 'victory') {
    // fast-forward the autopilot to a win
    startRun(state);
    let guard = 0;
    while (state.screen !== 'win' && guard < 60 * 400) {
      if (state.screen === 'relic') { chooseRelic(state, 0); }
      else if (state.screen === 'play') { step(state, autoInput(state)); }
      else break;
      guard += 1;
    }
    if (state.screen === 'win') showEnd(true);
    renderer.setCamMode('victory', state);
    shotStaged = true;
  }
}

// ---- main loop ----
const DT = 1 / 60;
let acc = 0;
let lastT = performance.now();
let frames = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - lastT) / 1000);
  lastT = now;
  frames += 1;

  if (shotMode) {
    if (frames === 2) stageShot();
    renderer.update(state, DT, input);
    if (shotStaged && renderer.backdropsReady()) window.__shotReady = true;
    requestAnimationFrame(frame);
    return;
  }

  if (autoMode) {
    runAutoStep();
    renderer.update(state, DT, input);
    requestAnimationFrame(frame);
    return;
  }

  // live play: real-time accumulator, up to 5 sim steps per frame
  acc += elapsed;
  let n = 0;
  while (acc >= DT && n < 5) {
    acc -= DT;
    n += 1;
    if (state.screen === 'play') {
      const inp = input.consume();
      // aim: the pointer's ground position; the sim resolves it to the
      // nearest targetable pin within 2.4m (state.aim drives the aim line).
      state.aim = null;
      if (inp.pointer && inp.pointer.inside) {
        inp.aim = { x: inp.pointer.groundX, z: inp.pointer.groundZ };
        state.aim = targetPin(state, inp.pointer.groundX, inp.pointer.groundZ);
      }
      step(state, inp);
      sfxForEvents();
    } else if (state.screen === 'relic') {
      if (!relicOffered) { relicOffered = true; showRelicDraft(); }
    }
  }
  if (acc > DT * 5) acc = 0;

  // screen transitions
  if (state.screen !== lastScreen) {
    if (state.screen === 'relic') { relicOffered = false; }
    if (state.screen === 'win') showEnd(true);
    if (state.screen === 'lose') showEnd(false);
    if (state.screen === 'play' && lastScreen === 'relic') {
      renderer.setStage(state.stageIdx, state);
    }
    lastScreen = state.screen;
  }
  if (state.stageIdx !== lastStage) {
    lastStage = state.stageIdx;
    renderer.setStage(state.stageIdx, state);
    audio.clear();
  }

  renderer.update(state, DT, input);
  requestAnimationFrame(frame);
}

showOnly('title');
renderer.setStage(0, state);
renderer.setCamMode('title');
window.__shotReady = false;
// live state for the playtest tool (getter: state is reassigned on restart)
window.__crown = { get state() { return state; } };
requestAnimationFrame(frame);
