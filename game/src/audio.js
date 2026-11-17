// CROWNBOUND — audio. Tiny WebAudio synth; no assets. A single AudioContext
// is created lazily on the first user gesture; every call is guarded so the
// game runs silently when audio is unavailable.
function makeAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.5, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }
  function noise(dur, vol, freq) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 1200;
      const g = c.createGain();
      g.gain.value = vol || 0.4;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
    } catch (e) { /* audio is best-effort */ }
  }
  const api = {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { tone(660, 0.07, 'triangle', 0.35); },
    throwChain() { noise(0.18, 0.35, 2600); tone(520, 0.16, 'sine', 0.3, 900); },
    snap() { tone(220, 0.1, 'square', 0.3, 140); noise(0.08, 0.25, 900); },
    taut() { tone(440, 0.12, 'triangle', 0.4, 660); tone(880, 0.2, 'sine', 0.25, 1320); },
    topple() { noise(0.6, 0.5, 500); tone(90, 0.7, 'sawtooth', 0.45, 40); },
    vault() { tone(330, 0.18, 'sine', 0.35, 660); },
    slam() { noise(0.25, 0.55, 800); tone(160, 0.3, 'square', 0.4, 60); },
    shatter() { noise(0.5, 0.5, 3000); tone(1200, 0.4, 'triangle', 0.3, 200); tone(600, 0.5, 'sine', 0.3, 100); },
    hurt() { tone(140, 0.25, 'sawtooth', 0.5, 70); },
    coin() { tone(990, 0.09, 'sine', 0.35); tone(1320, 0.14, 'sine', 0.3); },
    relic() { tone(523, 0.15, 'triangle', 0.4); tone(659, 0.15, 'triangle', 0.4); tone(784, 0.3, 'triangle', 0.4); },
    clear() { tone(523, 0.12, 'triangle', 0.4); tone(659, 0.12, 'triangle', 0.4); tone(784, 0.12, 'triangle', 0.4); tone(1047, 0.35, 'triangle', 0.45); },
    lose() { tone(392, 0.3, 'sawtooth', 0.35, 370); tone(311, 0.4, 'sawtooth', 0.35, 290); tone(233, 0.7, 'sawtooth', 0.4, 200); },
    win() { tone(523, 0.15, 'triangle', 0.4); tone(659, 0.15, 'triangle', 0.4); tone(784, 0.15, 'triangle', 0.4); tone(1047, 0.5, 'triangle', 0.5); },
    warn() { tone(220, 0.15, 'square', 0.3); tone(220, 0.15, 'square', 0.3); },
  };
  return api;
}
export const audio = makeAudio();
