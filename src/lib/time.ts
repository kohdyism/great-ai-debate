import type { TimerState } from './types';

// All shared timestamps are in *server* time. Each client estimates its clock offset
// from the server once (Supabase mode) so timers line up across devices; in demo
// mode every window runs on the same machine so the offset is 0.
let offset = 0;
export const setClockOffset = (ms: number) => {
  offset = ms;
};
export const now = () => Date.now() + offset;

/** Remaining ms, derived from timestamps — never from a decrementing counter. */
export function timerRemaining(t: TimerState, at = now()): number {
  if (t.status === 'running' && t.startedAt != null) return Math.max(0, t.baseMs - (at - t.startedAt));
  return Math.max(0, t.baseMs);
}

export const fmtClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
};

export const fmtClockFull = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
