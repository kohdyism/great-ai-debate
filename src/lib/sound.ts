// ─────────────────────────────────────────────────────────────
// Sound kit (Web Audio) — everything is synthesised live:
// original music loops, stings and a soundboard. No audio files,
// works offline. Optional: the host can upload their own songs
// (stored in this browser's IndexedDB) for walk-in / celebration.
// ─────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let unlocked = false;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let revSend: GainNode | null = null;

export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(comp);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.5;
      musicBus.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Small hall reverb (generated impulse) shared by music and crowd sounds.
      const len = Math.floor(ctx.sampleRate * 2.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      revSend = ctx.createGain();
      revSend.gain.value = 0.22;
      revSend.connect(conv).connect(comp);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    unlocked = true;
  } catch {
    unlocked = false;
  }
  return unlocked;
}
export const audioUnlocked = () => unlocked && !!ctx && ctx.state === 'running';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, when = 0, slideTo?: number, out?: AudioNode | null, at?: number) {
  if (!ctx || !unlocked) return;
  const t0 = at ?? ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out ?? sfxBus!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.15, when = 0, freq = 1200, type: BiquadFilterType = 'bandpass', out?: AudioNode | null, at?: number) {
  if (!ctx || !unlocked || !noiseBuf) return;
  const t0 = at ?? ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out ?? sfxBus!);
  src.start(t0, Math.random() * 1.5, dur + 0.05);
}

// ── crowd voices (formant-filtered oscillators) ───────────────
function voice(f0: number, t: number, dur: number, formants: [number, number], vol: number, opts: { glide?: number; vib?: number; attack?: number; type?: OscillatorType } = {}) {
  if (!ctx || !sfxBus) return;
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sawtooth';
  osc.frequency.setValueAtTime(f0, t);
  if (opts.glide) osc.frequency.linearRampToValueAtTime(f0 * opts.glide, t + dur);
  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.frequency.value = 4 + Math.random() * 2.5;
  lfoG.gain.value = f0 * (opts.vib ?? 0.015);
  lfo.connect(lfoG).connect(osc.frequency);
  const g = ctx.createGain();
  const a = opts.attack ?? 0.02;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + Math.max(a, dur * 0.6));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [i, f] of formants.entries()) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 7;
    const fg = ctx.createGain();
    fg.gain.value = i === 0 ? 1 : 0.6;
    osc.connect(bp).connect(fg).connect(g);
  }
  g.connect(sfxBus);
  if (revSend) g.connect(revSend);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

/** Sitcom-style crowd laugh: lots of "ha-ha-ha" voices at different pitches and speeds. */
function laughTrack(sec = 3.2, people = 16) {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  for (let p = 0; p < people; p++) {
    const female = Math.random() < 0.5;
    const f0 = female ? 230 + Math.random() * 120 : 120 + Math.random() * 70;
    const rate = 4.2 + Math.random() * 2.4; // syllables per second
    const start = Math.random() * 0.5;
    const n = 4 + Math.floor(Math.random() * (sec * rate - 4));
    const loud = 0.035 + Math.random() * 0.035;
    for (let i = 0; i < n; i++) {
      const t = t0 + start + i / rate + (Math.random() - 0.5) * 0.03;
      if (t > t0 + sec) break;
      const fade = 1 - i / (n + 2);
      const fp = f0 * (1.12 - (i / n) * 0.18) * (1 + (Math.random() - 0.5) * 0.06);
      voice(fp, t, 0.13 + Math.random() * 0.05, [750 + Math.random() * 200, 1150 + Math.random() * 300], loud * fade, { attack: 0.012, vib: 0.03 });
      noise(0.09, 0.012 * fade, t - ctx.currentTime, 1600);
    }
  }
}

/** Crowd cheering: "wooo!"/"yeah!" voices rising, whistles, and applause underneath. */
function crowdCheer(sec = 3.5, people = 24) {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  for (let p = 0; p < people; p++) {
    const female = Math.random() < 0.5;
    const f0 = female ? 280 + Math.random() * 160 : 150 + Math.random() * 90;
    const start = Math.random() * 0.6;
    const ee = Math.random() < 0.5;
    voice(f0, t0 + start, 0.9 + Math.random() * 1.1, ee ? [500, 1900] : [380, 900], 0.04 + Math.random() * 0.025, { glide: 1.25 + Math.random() * 0.2, vib: 0.04, attack: 0.08 });
    if (Math.random() < 0.5) voice(f0 * 1.1, t0 + start + 1.3 + Math.random() * 0.8, 0.8, [450, 1700], 0.03, { glide: 1.2, vib: 0.04, attack: 0.08 });
  }
  for (let w = 0; w < 4; w++) {
    const t = Math.random() * 1.5;
    tone(2200 + Math.random() * 600, 0.35, 'sine', 0.05, t, 3200 + Math.random() * 400);
    tone(3000, 0.5, 'sine', 0.04, t + 0.38, 2400);
  }
  applause(sec);
}

/** Big crowd boo: many low "oooo" voices sliding down. */
function crowdBoo(sec = 2.2, people = 26) {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  for (let p = 0; p < people; p++) {
    const f0 = 85 + Math.random() * 110;
    const start = Math.random() * 0.45;
    voice(f0, t0 + start, sec - start * 0.5 + Math.random() * 0.4, [300 + Math.random() * 60, 780 + Math.random() * 120], 0.045 + Math.random() * 0.03, {
      glide: 0.86 + Math.random() * 0.06,
      vib: 0.025,
      attack: 0.25,
    });
  }
  noise(sec, 0.04, 0, 250, 'lowpass');
}

/** Crowd "ooooh!" — rising vowel. */
function crowdOoh(sec = 1.6, people = 18) {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  for (let p = 0; p < people; p++) {
    const f0 = (Math.random() < 0.5 ? 200 : 120) + Math.random() * 90;
    const start = Math.random() * 0.2;
    voice(f0, t0 + start, sec, [330 + Math.random() * 60, 820 + Math.random() * 100], 0.04 + Math.random() * 0.02, { glide: 1.25, vib: 0.02, attack: 0.15 });
  }
}

/** Crowd "awww". */
function crowdAww(sec = 1.6, people = 18) {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  for (let p = 0; p < people; p++) {
    const f0 = (Math.random() < 0.5 ? 230 : 140) + Math.random() * 80;
    voice(f0, t0 + Math.random() * 0.2, sec, [680 + Math.random() * 80, 1100 + Math.random() * 120], 0.04, { glide: 0.8, vib: 0.02, attack: 0.12 });
  }
}

// ── sound effects ─────────────────────────────────────────────
function applause(sec = 3.5) {
  if (!ctx) return;
  const claps = Math.floor(sec * 90);
  for (let i = 0; i < claps; i++) {
    const t = Math.random() * sec;
    const fade = t > sec * 0.6 ? 1 - (t - sec * 0.6) / (sec * 0.4) : Math.min(1, t * 3 + 0.3);
    noise(0.05 + Math.random() * 0.04, (0.05 + Math.random() * 0.08) * fade, t, 1500 + Math.random() * 2500);
  }
  noise(sec, 0.04, 0, 2500);
}

export const sfx = {
  tick: () => tone(1200, 0.05, 'square', 0.06),
  tickLow: () => tone(700, 0.08, 'square', 0.08),
  wheelTick: () => tone(1800, 0.025, 'triangle', 0.05),
  ding: () => {
    tone(880, 0.35, 'sine', 0.2);
    tone(1320, 0.4, 'sine', 0.12, 0.05);
  },
  /** One incoming audience vote: short bright ding, slightly varied pitch. */
  voteDing: (when = 0) => {
    const f = 1568 * (1 + (Math.random() - 0.5) * 0.06);
    tone(f, 0.28, 'sine', 0.16, when);
    tone(f * 1.5, 0.22, 'sine', 0.06, when + 0.02);
  },
  points: () => {
    tone(660, 0.12, 'triangle', 0.18);
    tone(990, 0.2, 'triangle', 0.18, 0.1);
  },
  buzzer: () => {
    tone(160, 0.6, 'sawtooth', 0.15);
    tone(165, 0.6, 'square', 0.08);
  },
  whoosh: () => noise(0.6, 0.25, 0, 800),
  reveal: () => {
    noise(0.4, 0.2, 0, 3000);
    tone(220, 0.6, 'sawtooth', 0.08, 0, 880);
  },
  boom: () => {
    tone(90, 0.9, 'sine', 0.5, 0, 40);
    noise(0.5, 0.3, 0, 300);
  },
  fanfare: () => {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => tone(n, i === notes.length - 1 ? 0.9 : 0.18, 'triangle', 0.2, i * 0.14));
    notes.forEach((n, i) => tone(n / 2, i === notes.length - 1 ? 0.9 : 0.18, 'sawtooth', 0.05, i * 0.14));
  },
  drumroll: (sec: number) => {
    for (let i = 0; i < sec * 16; i++) noise(0.05, 0.05 + (i / (sec * 16)) * 0.14, i / 16, 2000);
  },
  /** Big TV "show open": riser + hits + brass chord. */
  showOpen: () => {
    if (!ctx) return;
    noise(1.6, 0.12, 0, 600, 'highpass');
    tone(110, 1.6, 'sawtooth', 0.06, 0, 880);
    [0, 0.25, 0.5].forEach((t) => {
      tone(70, 0.4, 'sine', 0.6, 1.6 + t, 40);
      noise(0.15, 0.25, 1.6 + t, 2500);
    });
    [60, 64, 67, 72].forEach((m) => {
      tone(mtof(m), 1.4, 'sawtooth', 0.06, 2.4);
      tone(mtof(m + 12), 1.4, 'square', 0.025, 2.4);
    });
    tone(mtof(36), 1.6, 'sine', 0.4, 2.4);
  },
  /** Round intro: drum fill → boom → stab. */
  roundSting: () => {
    for (let i = 0; i < 8; i++) noise(0.08, 0.12 + i * 0.02, i * 0.07, 1800);
    tone(80, 1, 'sine', 0.6, 0.6, 40);
    noise(0.4, 0.3, 0.6, 400);
    [57, 60, 64].forEach((m) => tone(mtof(m), 0.8, 'sawtooth', 0.07, 0.6));
  },
  /** Speaker starts. */
  go: () => {
    tone(mtof(76), 0.12, 'square', 0.08);
    tone(mtof(83), 0.25, 'square', 0.08, 0.1);
  },
  applause: () => applause(3.5),
  bigApplause: () => {
    crowdCheer(5, 30);
    applause(6);
    sfx.fanfare();
  },
  airhorn: () => {
    [0, 0.32, 0.64].forEach((t, i) => {
      const len = i === 2 ? 0.7 : 0.22;
      [415, 420, 830].forEach((f) => tone(f, len, 'sawtooth', 0.09, t, f * 0.97));
    });
  },
  boo: () => crowdBoo(2.4),
  gasp: () => {
    crowdOoh(1.6);
    noise(0.5, 0.05, 0, 1500, 'bandpass');
  },
  laugh: () => laughTrack(3.2),
  bigLaugh: () => {
    laughTrack(4.5, 26);
    applause(3);
  },
  aww: () => crowdAww(1.8),
  cheer: () => crowdCheer(3.5),
  wrong: () => {
    tone(330, 0.25, 'square', 0.1);
    tone(220, 0.5, 'square', 0.1, 0.25);
  },
  correct: () => {
    tone(mtof(72), 0.12, 'triangle', 0.15);
    tone(mtof(76), 0.12, 'triangle', 0.15, 0.1);
    tone(mtof(79), 0.35, 'triangle', 0.15, 0.2);
  },
  suspenseHit: () => {
    tone(55, 2.5, 'sawtooth', 0.12, 0, 52);
    tone(58, 2.5, 'sawtooth', 0.08);
    noise(2.5, 0.05, 0, 200, 'lowpass');
  },
};

export type SfxName = 'applause' | 'bigApplause' | 'airhorn' | 'boo' | 'gasp' | 'drumroll' | 'fanfare' | 'correct' | 'wrong' | 'buzzer' | 'suspenseHit' | 'showOpen' | 'laugh' | 'bigLaugh' | 'aww' | 'cheer';
export function playSfx(name: SfxName) {
  if (name === 'drumroll') return sfx.drumroll(3);
  (sfx as any)[name]?.();
}

// ── music: original synthesised tracks ────────────────────────
export type TrackId = 'lobby' | 'suspense' | 'celebrate';

interface Bus {
  out: GainNode; // everything
  pump: GainNode; // chords + bass, ducked by the kick (sidechain pump)
}
type Note = [step: number, midi: number, len: number];
interface Track {
  bpm: number;
  bars: number;
  step: (bar: number, s: number, t: number, sx: number, bus: Bus) => void;
}

function supersaw(midis: number[], t: number, dur: number, vol: number, out: AudioNode, cutoff = 2400, attack = 0.03) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + dur * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(out);
  if (revSend) g.connect(revSend);
  for (const m of midis)
    for (const det of [-14, -5, 5, 14]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
}
function pluck(midi: number, t: number, dur: number, vol: number, out: AudioNode, type: OscillatorType = 'square', bright = 5000) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = mtof(midi);
  const o2 = ctx.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = mtof(midi);
  o2.detune.value = 8;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  o2.connect(f);
  f.connect(g).connect(out);
  if (revSend) g.connect(revSend);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.05);
  o2.stop(t + dur + 0.05);
}
function bassNote(midi: number, t: number, dur: number, vol: number, out: AudioNode, cutoff = 700) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = mtof(midi);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = mtof(midi - 12);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff * 2, t);
  f.frequency.exponentialRampToValueAtTime(cutoff * 0.6, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  sub.connect(g);
  f.connect(g).connect(out);
  o.start(t);
  sub.start(t);
  o.stop(t + dur + 0.05);
  sub.stop(t + dur + 0.05);
}
const kit = {
  kick: (t: number, bus: Bus, v = 0.9) => {
    tone(160, 0.32, 'sine', v, 0, 42, bus.out, t);
    tone(1200, 0.015, 'square', 0.08, 0, undefined, bus.out, t);
    // sidechain pump on chords/bass
    bus.pump.gain.cancelScheduledValues(t);
    bus.pump.gain.setValueAtTime(0.25, t);
    bus.pump.gain.linearRampToValueAtTime(1, t + 0.22);
  },
  clap: (t: number, bus: Bus, v = 0.28) => {
    [0, 0.011, 0.023].forEach((d) => noise(0.12, v, 0, 1400, 'bandpass', bus.out, t + d));
    if (revSend) noise(0.25, v * 0.6, 0, 1400, 'bandpass', revSend, t);
  },
  hat: (t: number, bus: Bus, v = 0.05) => noise(0.035, v, 0, 8000, 'highpass', bus.out, t),
  openHat: (t: number, bus: Bus, v = 0.06) => noise(0.16, v, 0, 7000, 'highpass', bus.out, t),
  tom: (t: number, bus: Bus, f = 90, v = 0.6) => {
    tone(f, 0.5, 'sine', v, 0, f * 0.55, bus.out, t);
    noise(0.12, 0.12, 0, 600, 'lowpass', bus.out, t);
  },
  crash: (t: number, bus: Bus) => noise(1.6, 0.09, 0, 6000, 'highpass', bus.out, t),
  riser: (t: number, len: number, bus: Bus) => {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(8000, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + len);
    src.connect(f).connect(g).connect(bus.out);
    src.start(t);
    src.stop(t + len);
  },
};
const melodyAt = (mel: Note[][], bar: number, s: number) => mel[bar % mel.length].find((n) => n[0] === s);
const triad = (root: number, minor: boolean) => [root, root + (minor ? 3 : 4), root + 7];

// Walk-in: driving electro-pop in A minor, 8-bar build → hook.
const LOBBY_CHORDS = [
  [57, true],
  [53, false],
  [48, false],
  [55, false],
] as [number, boolean][];
const LOBBY_HOOK: Note[][] = [
  [[0, 76, 2], [3, 74, 1], [4, 72, 2], [6, 69, 2], [10, 72, 2], [12, 74, 3]],
  [[0, 72, 2], [3, 69, 1], [4, 72, 2], [6, 77, 2], [8, 76, 4], [12, 72, 3]],
  [[0, 76, 2], [3, 74, 1], [4, 72, 2], [6, 67, 2], [10, 72, 2], [12, 76, 3]],
  [[0, 74, 3], [4, 71, 2], [6, 74, 2], [8, 79, 4], [12, 76, 2], [14, 74, 2]],
];
// Celebration: bright C major anthem.
const CEL_CHORDS = [
  [60, false],
  [55, false],
  [57, true],
  [53, false],
] as [number, boolean][];
const CEL_HOOK: Note[][] = [
  [[0, 79, 2], [2, 76, 2], [4, 79, 2], [6, 84, 2], [8, 83, 2], [10, 79, 2], [12, 76, 4]],
  [[0, 79, 2], [2, 74, 2], [4, 79, 2], [6, 83, 2], [8, 86, 4], [12, 83, 4]],
  [[0, 81, 2], [2, 76, 2], [4, 81, 2], [6, 84, 2], [8, 83, 2], [10, 81, 2], [12, 76, 4]],
  [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2], [8, 79, 4], [12, 77, 2], [14, 79, 2]],
];

const TRACKS: Record<TrackId, Track> = {
  lobby: {
    bpm: 124,
    bars: 8,
    step: (bar, s, t, sx, bus) => {
      const [root, minor] = LOBBY_CHORDS[bar % 4];
      const full = bar >= 4; // second half: full drums + hook
      if (s === 0 && bar === 0) kit.crash(t, bus);
      if (s % 4 === 0) kit.kick(t, bus);
      if (s === 4 || s === 12) kit.clap(t, bus, full ? 0.28 : 0.18);
      if (s % 4 === 2) kit.openHat(t, bus, full ? 0.07 : 0.04);
      else if (full) kit.hat(t, bus, s % 2 ? 0.04 : 0.025);
      if (s === 0) supersaw(triad(root, minor).map((m) => m + 12), t, sx * 16, full ? 0.035 : 0.028, bus.pump, full ? 3000 : 1800);
      if (s % 4 === 2 || s === 15) bassNote(root - 24, t, sx * 1.6, 0.22, bus.pump);
      if (full) {
        const n = melodyAt(LOBBY_HOOK, bar, s);
        if (n) pluck(n[1], t, sx * n[2] * 1.1, 0.085, bus.out);
      } else if (s % 2 === 0) pluck([...triad(root, minor), root + 12][(s / 2) % 4] + 12, t, sx * 1.4, 0.03, bus.out, 'triangle', 3000);
      if (bar === 7 && s === 0) kit.riser(t, sx * 16, bus);
      if (bar === 7 && s >= 12) kit.clap(t, bus, 0.12 + (s - 12) * 0.05);
    },
  },
  // Cinematic tension: taiko toms, ticking clock, swelling strings, pulsing bass.
  suspense: {
    bpm: 100,
    bars: 4,
    step: (bar, s, t, sx, bus) => {
      const root = bar % 2 === 0 ? 50 : 51; // D → Eb, unsettled
      if (s === 0 || s === 6 || s === 10) kit.tom(t, bus, s === 0 ? 75 : 95, s === 0 ? 0.7 : 0.45);
      if (bar === 3 && s >= 12) kit.tom(t, bus, 110 + (s - 12) * 8, 0.35);
      if (s % 2 === 0) kit.hat(t, bus, s % 4 === 0 ? 0.06 : 0.03);
      if (s % 2 === 1) bassNote(root - 24, t, sx * 0.9, 0.16, bus.pump, 350);
      if (s === 0) supersaw([root, root + 3, root + 7].map((m) => m + 12), t, sx * 16, 0.03, bus.pump, bar % 2 ? 1400 : 900, 0.6);
      if (s === 8 && bar % 2 === 1) pluck(root + 31, t, sx * 3, 0.05, bus.out, 'triangle', 2500);
      if (s === 0 && bar === 0) noise(1.2, 0.05, 0, 200, 'lowpass', bus.out, t);
    },
  },
  celebrate: {
    bpm: 128,
    bars: 4,
    step: (bar, s, t, sx, bus) => {
      const [root, minor] = CEL_CHORDS[bar % 4];
      if (s === 0 && bar === 0) kit.crash(t, bus);
      if (s % 4 === 0) kit.kick(t, bus);
      if (s === 4 || s === 12) kit.clap(t, bus, 0.3);
      if (s % 4 === 2) kit.openHat(t, bus, 0.07);
      else kit.hat(t, bus, 0.03);
      if (s % 4 === 2) supersaw(triad(root, minor).map((m) => m + 12), t, sx * 2.5, 0.045, bus.pump, 3500, 0.01);
      if (s % 2 === 0) bassNote(root - 24 + (s % 8 === 6 ? 12 : 0), t, sx * 1.6, 0.2, bus.pump);
      const n = melodyAt(CEL_HOOK, bar, s);
      if (n) pluck(n[1], t, sx * n[2] * 1.1, 0.08, bus.out);
    },
  },
};

class MusicPlayer {
  private current: TrackId | null = null;
  private gain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private stepIdx = 0;
  private custom: HTMLAudioElement | null = null;
  private customUrl: string | null = null;
  volume = 0.5;

  setVolume(v: number) {
    this.volume = v;
    if (musicBus && ctx) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    if (this.custom) this.custom.volume = Math.min(1, v * 1.4);
  }
  get playing() {
    return this.current;
  }
  async play(id: TrackId | null) {
    if (id === this.current) return;
    this.stop();
    this.current = id;
    if (!id || !ctx || !unlocked || !musicBus) return;
    // Host-uploaded song for this slot?
    const blob = await loadCustomTrack(id).catch(() => null);
    if (this.current !== id) return;
    if (blob) {
      this.customUrl = URL.createObjectURL(blob);
      const a = new Audio(this.customUrl);
      a.loop = true;
      a.volume = 0;
      this.custom = a;
      void a.play().catch(() => {});
      let v = 0;
      const target = Math.min(1, this.volume * 1.4);
      const fade = setInterval(() => {
        v = Math.min(target, v + target / 15);
        if (this.custom === a) a.volume = v;
        if (v >= target || this.custom !== a) clearInterval(fade);
      }, 50);
      return;
    }
    const track = TRACKS[id];
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.8);
    this.gain.connect(musicBus);
    const pump = ctx.createGain();
    pump.connect(this.gain);
    const bus: Bus = { out: this.gain, pump };
    this.nextTime = ctx.currentTime + 0.05;
    this.stepIdx = 0;
    const sx = 60 / track.bpm / 4;
    this.timer = setInterval(() => {
      if (!ctx) return;
      while (this.nextTime < ctx.currentTime + 0.2) {
        const total = this.stepIdx % (track.bars * 16);
        track.step(Math.floor(total / 16), total % 16, this.nextTime, sx, bus);
        this.nextTime += sx;
        this.stepIdx++;
      }
    }, 40);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.gain && ctx) {
      const g = this.gain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value || 1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      setTimeout(() => g.disconnect(), 800);
    }
    this.gain = null;
    if (this.custom) {
      const a = this.custom;
      const url = this.customUrl;
      this.custom = null;
      this.customUrl = null;
      let v = a.volume;
      const fade = setInterval(() => {
        v = Math.max(0, v - 0.08);
        a.volume = v;
        if (v <= 0) {
          clearInterval(fade);
          a.pause();
          if (url) URL.revokeObjectURL(url);
        }
      }, 50);
    }
    this.current = null;
  }
}
export const music = new MusicPlayer();

// ── host-uploaded songs (IndexedDB, same browser as the stage window) ──
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('gad-media', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('tracks');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveCustomTrack(id: TrackId, file: Blob | null) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    if (file) tx.objectStore('tracks').put(file, id);
    else tx.objectStore('tracks').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function loadCustomTrack(id: TrackId): Promise<Blob | null> {
  const db = await idb();
  return new Promise((resolve) => {
    const req = db.transaction('tracks').objectStore('tracks').get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => resolve(null);
  });
}
if (typeof window !== 'undefined') (window as any).__gadMusic = music;
