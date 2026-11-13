import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getEngine } from './engine';
import { now, setClockOffset } from './time';
import { getTransport, type ConnStatus } from './transport';
import type { PublicState } from './types';

/** Host: subscribe to the engine snapshot. */
export function useHost() {
  const e = getEngine();
  return useSyncExternalStore(e.subscribe, e.getSnapshot);
}

/** Stage + Audience: read-only, realtime view of the public state. */
export function useViewerState(room: string | null) {
  const t = getTransport();
  const [state, setState] = useState<PublicState | null>(null);
  const [conn, setConn] = useState<ConnStatus>(t.status);
  const [loaded, setLoaded] = useState(false);
  const last = useRef({ at: -1, v: -1, room: '' });

  useEffect(() => {
    if (t.kind === 'supabase' && !room) return;
    let alive = true;
    const accept = (s: PublicState) => {
      if (!alive) return;
      if (t.kind === 'supabase' && room && s.roomCode !== room) return;
      const l = last.current;
      // Newest state wins; never go backwards on out-of-order delivery.
      if (s.roomCode === l.room && (s.updatedAt < l.at || (s.updatedAt === l.at && s.v <= l.v))) return;
      last.current = { at: s.updatedAt, v: s.v, room: s.roomCode };
      setState(s);
    };
    void t.clockOffset().then((off) => off != null && setClockOffset(off));
    void t.fetchState(room ?? '').then((s) => {
      if (s) accept(s);
      if (alive) setLoaded(true);
    });
    const unsub = t.subscribe(room ?? '', accept);
    const unsubS = t.onStatus(setConn);
    return () => {
      alive = false;
      unsub();
      unsubS();
    };
  }, [room, t]);

  return { state, conn, loaded };
}

/** Re-render on every animation frame while `active` (for timers / countdowns). */
export function useNow(active = true, fps = 20) {
  const [t, setT] = useState(now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(now()), 1000 / fps);
    return () => clearInterval(id);
  }, [active, fps]);
  return t;
}

/** Smoothly animates a number towards its target. */
export function useAnimatedNumber(target: number, ms = 900) {
  const [val, setVal] = useState(target);
  const from = useRef(target);
  const start = useRef(0);
  useEffect(() => {
    from.current = val;
    start.current = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start.current) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(from.current + (target - from.current) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);
  return val;
}
