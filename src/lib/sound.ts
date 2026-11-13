// Tiny synthesised sound kit (Web Audio) — no audio files to load, works offline.
let ctx: AudioContext | null = null;
let unlocked = false;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    unlocked = true;
  } catch {
    unlocked = false;
  }
  return unlocked;
}
export const audioUnlocked = () => unlocked && !!ctx && ctx.state === 'running';

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, when = 0, slideTo?: number) {
  if (!ctx || !unlocked) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.15, when = 0, filterFreq = 1200) {
  if (!ctx || !unlocked) return;
  const t0 = ctx.currentTime + when;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);
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
    for (let i = 0; i < sec * 14; i++) noise(0.05, 0.05 + (i / (sec * 14)) * 0.12, i / 14, 2000);
  },
};
