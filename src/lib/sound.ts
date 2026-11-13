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

// ── sound effects ─────────────────────────────────────────────
function applause(sec = 3.5) {
  if (!ctx) return;
  const claps = Math.floor(sec * 45);
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
    applause(6);
    sfx.fanfare();
  },
  airhorn: () => {
    [0, 0.32, 0.64].forEach((t, i) => {
      const len = i === 2 ? 0.7 : 0.22;
      [415, 420, 830].forEach((f) => tone(f, len, 'sawtooth', 0.09, t, f * 0.97));
    });
  },
  boo: () => {
    for (let i = 0; i < 6; i++) tone(140 + Math.random() * 60, 1.4, 'sawtooth', 0.04, i * 0.05, 90);
    noise(1.4, 0.06, 0, 500);
  },
  gasp: () => {
    noise(0.7, 0.12, 0, 1500, 'bandpass');
    tone(300, 0.6, 'sine', 0.05, 0, 600);
  },
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

export type SfxName = 'applause' | 'bigApplause' | 'airhorn' | 'boo' | 'gasp' | 'drumroll' | 'fanfare' | 'correct' | 'wrong' | 'buzzer' | 'suspenseHit' | 'showOpen';
export function playSfx(name: SfxName) {
  if (name === 'drumroll') return sfx.drumroll(3);
  (sfx as any)[name]?.();
}

// ── music: original synthesised loops ────────────────────────
export type TrackId = 'lobby' | 'suspense' | 'celebrate';
interface Track {
  bpm: number;
  bars: number;
  /** chord roots (MIDI) per bar + quality */
  chords: { root: number; minor: boolean }[];
  step: (bar: number, s: number, t: number, ch: { root: number; minor: boolean }, out: AudioNode) => void;
}

const chordNotes = (c: { root: number; minor: boolean }) => [c.root, c.root + (c.minor ? 3 : 4), c.root + 7];

const drums = {
  kick: (t: number, out: AudioNode, v = 0.7) => tone(150, 0.35, 'sine', v, 0, 45, out, t),
  snare: (t: number, out: AudioNode, v = 0.22) => {
    noise(0.18, v, 0, 1800, 'bandpass', out, t);
    tone(190, 0.1, 'triangle', v * 0.5, 0, undefined, out, t);
  },
  clap: (t: number, out: AudioNode, v = 0.2) => [0, 0.012, 0.024].forEach((d) => noise(0.08, v, 0, 1500, 'bandpass', out, t + d)),
  hat: (t: number, out: AudioNode, v = 0.05) => noise(0.04, v, 0, 7000, 'highpass', out, t),
};

const TRACKS: Record<TrackId, Track> = {
  // Upbeat gameshow walk-in: minor-key drive, 4-on-the-floor.
  lobby: {
    bpm: 118,
    bars: 4,
    chords: [
      { root: 57, minor: true },
      { root: 53, minor: false },
      { root: 48, minor: false },
      { root: 55, minor: false },
    ],
    step: (bar, s, t, ch, out) => {
      const sx = 60 / 118 / 4;
      if (s % 4 === 0) drums.kick(t, out);
      if (s === 4 || s === 12) drums.snare(t, out);
      if (s % 2 === 1) drums.hat(t, out, 0.045);
      if (bar === 3 && s >= 12) drums.snare(t, out, 0.12);
      // bass: root on 8ths with octave jumps
      if (s % 2 === 0) tone(mtof(ch.root - 24 + (s % 8 === 6 ? 12 : 0)), sx * 1.8, 'sawtooth', 0.11, 0, undefined, out, t);
      // offbeat chord stabs
      if (s === 2 || s === 6 || s === 10 || s === 14) chordNotes(ch).forEach((m) => tone(mtof(m), sx * 1.4, 'square', 0.022, 0, undefined, out, t));
      // arpeggio lead
      const arp = [...chordNotes(ch), ch.root + 12];
      if (s % 2 === 0) tone(mtof(arp[(s / 2) % 4] + 12), sx * 1.6, 'triangle', 0.045, 0, undefined, out, t);
    },
  },
  // Tense, ticking pulse for the wheel and the verdict.
  suspense: {
    bpm: 96,
    bars: 2,
    chords: [
      { root: 50, minor: true },
      { root: 51, minor: false },
    ],
    step: (bar, s, t, ch, out) => {
      const sx = 60 / 96 / 4;
      if (s === 0 || s === 10) drums.kick(t, out, 0.6);
      drums.hat(t, out, s % 4 === 0 ? 0.05 : 0.025);
      if (s % 4 === 0) tone(mtof(ch.root - 24), sx * 3.5, 'sawtooth', 0.12, 0, undefined, out, t);
      if (s === 0) [ch.root + 12, ch.root + 15].forEach((m) => tone(mtof(m), sx * 15, 'sine', 0.03, 0, undefined, out, t));
      if (s % 8 === 4) tone(mtof(ch.root + 24 + (bar ? 1 : 0)), sx * 0.8, 'square', 0.025, 0, undefined, out, t);
    },
  },
  // Bright, major-key celebration for results and the champion.
  celebrate: {
    bpm: 128,
    bars: 4,
    chords: [
      { root: 60, minor: false },
      { root: 55, minor: false },
      { root: 57, minor: true },
      { root: 53, minor: false },
    ],
    step: (_bar, s, t, ch, out) => {
      const sx = 60 / 128 / 4;
      if (s % 4 === 0) drums.kick(t, out);
      if (s === 4 || s === 12) drums.clap(t, out);
      drums.hat(t, out, s % 2 ? 0.05 : 0.025);
      if (s % 2 === 1) tone(mtof(ch.root - 24), sx * 1.6, 'sawtooth', 0.1, 0, undefined, out, t);
      if (s % 4 === 2) chordNotes(ch).forEach((m) => tone(mtof(m + 12), sx * 2, 'sawtooth', 0.02, 0, undefined, out, t));
      const arp = [...chordNotes(ch), ch.root + 12, ch.root + 16, ch.root + 19, ch.root + 12, ch.root + 7];
      tone(mtof(arp[s % 8] + 12), sx * 0.9, 'square', 0.025, 0, undefined, out, t);
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
    this.nextTime = ctx.currentTime + 0.05;
    this.stepIdx = 0;
    const out = this.gain;
    const sx = 60 / track.bpm / 4;
    this.timer = setInterval(() => {
      if (!ctx) return;
      while (this.nextTime < ctx.currentTime + 0.2) {
        const total = this.stepIdx % (track.bars * 16);
        const bar = Math.floor(total / 16);
        const s = total % 16;
        track.step(bar, s, this.nextTime, track.chords[bar % track.chords.length], out);
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
