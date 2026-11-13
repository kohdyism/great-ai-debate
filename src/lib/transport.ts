import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';
import type { PublicState } from './types';
import { safeJson, safeSet, uid } from './util';

export type ConnStatus = 'connecting' | 'online' | 'offline' | 'local';

export type VoteResult =
  | { ok: true; option: string }
  | { ok: false; reason: 'closed' | 'duplicate' | 'invalid' | 'not_joined' | 'no_event' | 'network' | 'no_host'; option?: string };

export interface Tally {
  counts: Record<string, number>;
  total: number;
}
export interface ShiftCounts {
  both: number;
  changed: number;
  toBan: number;
  toEmbrace: number;
  other: number;
}

/**
 * One interface, two implementations:
 *  - DemoTransport: BroadcastChannel + localStorage. Syncs windows of the SAME browser
 *    on the SAME computer only (Host ↔ Stage on the event laptop). Not multi-device.
 *  - SupabaseTransport: Postgres + Realtime. Votes are validated server-side by RPCs.
 */
export interface Transport {
  kind: 'demo' | 'supabase';
  status: ConnStatus;
  onStatus(cb: (s: ConnStatus) => void): () => void;
  // ── viewers (stage + audience)
  fetchState(room: string): Promise<PublicState | null>;
  subscribe(room: string, cb: (s: PublicState) => void): () => void;
  /** Estimated (server clock − local clock) in ms; null if unavailable. */
  clockOffset(): Promise<number | null>;
  // ── audience
  join(room: string, participantId: string): Promise<{ ok: boolean; reason?: string }>;
  vote(room: string, participantId: string, pollId: string, option: string): Promise<VoteResult>;
  // ── host
  createEvent(room: string, hostKey: string, state: PublicState): Promise<{ ok: boolean; reason?: string }>;
  pushState(room: string, hostKey: string, state: PublicState): Promise<boolean>;
  tallies(room: string, hostKey: string, pollId: string): Promise<Tally | null>;
  participantCount(room: string, hostKey: string): Promise<number | null>;
  shift(room: string, hostKey: string, a: string, b: string): Promise<ShiftCounts | null>;
  resetPoll(room: string, hostKey: string, pollId: string): Promise<boolean>;
}

// ═════════════════════════════════════════════════════════════
// DEMO (same-browser) transport
// ═════════════════════════════════════════════════════════════

const DEMO_CHANNEL = 'gad-demo-v1';
const DEMO_STATE_KEY = 'gad:demo:public';

export type DemoRequest =
  | { type: 'join'; reqId: string; participantId: string }
  | { type: 'vote'; reqId: string; participantId: string; pollId: string; option: string }
  | { type: 'cmd'; reqId: string; cmd: 'start' };

type DemoMsg =
  | { type: 'state'; state: PublicState }
  | DemoRequest
  | { type: 'reply'; reqId: string; payload: any }
  | { type: 'hello' };

/** Host side registers this to answer demo audience requests. */
export type DemoHandler = (req: DemoRequest) => any;

class DemoTransport implements Transport {
  kind = 'demo' as const;
  status: ConnStatus = 'local';
  private bc: BroadcastChannel | null = null;
  private handler: DemoHandler | null = null;
  private waiters = new Map<string, (p: any) => void>();
  private stateCbs = new Set<(s: PublicState) => void>();

  constructor() {
    try {
      this.bc = new BroadcastChannel(DEMO_CHANNEL);
      this.bc.onmessage = (e) => this.onMsg(e.data as DemoMsg);
    } catch {
      this.bc = null;
    }
    // Fallback path when BroadcastChannel is unavailable: storage events.
    window.addEventListener('storage', (e) => {
      if (e.key === DEMO_STATE_KEY && e.newValue) {
        try {
          const s = JSON.parse(e.newValue) as PublicState;
          this.stateCbs.forEach((cb) => cb(s));
        } catch {
          /* ignore */
        }
      }
    });
  }
  private post(m: DemoMsg) {
    try {
      this.bc?.postMessage(m);
    } catch {
      /* ignore */
    }
  }
  private onMsg(m: DemoMsg) {
    if (m.type === 'state') this.stateCbs.forEach((cb) => cb(m.state));
    else if (m.type === 'reply') {
      const w = this.waiters.get(m.reqId);
      if (w) {
        this.waiters.delete(m.reqId);
        w(m.payload);
      }
    } else if (m.type === 'join' || m.type === 'vote' || m.type === 'cmd') {
      if (this.handler) {
        const payload = this.handler(m);
        this.post({ type: 'reply', reqId: m.reqId, payload });
      }
    } else if (m.type === 'hello') {
      const s = safeJson<PublicState>(DEMO_STATE_KEY);
      if (s && this.handler) this.post({ type: 'state', state: s });
    }
  }
  private request<T>(req: DemoRequest, timeoutMs = 2500): Promise<T | null> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.waiters.delete(req.reqId);
        resolve(null);
      }, timeoutMs);
      this.waiters.set(req.reqId, (p) => {
        clearTimeout(t);
        resolve(p as T);
      });
      this.post(req);
    });
  }
  setHandler(h: DemoHandler | null) {
    this.handler = h;
  }
  sendCommand(cmd: 'start') {
    return this.request<{ ok: boolean }>({ type: 'cmd', reqId: uid('c'), cmd });
  }
  onStatus(cb: (s: ConnStatus) => void) {
    cb(this.status);
    return () => {};
  }
  async fetchState() {
    return safeJson<PublicState>(DEMO_STATE_KEY);
  }
  subscribe(_room: string, cb: (s: PublicState) => void) {
    this.stateCbs.add(cb);
    this.post({ type: 'hello' });
    return () => {
      this.stateCbs.delete(cb);
    };
  }
  async clockOffset() {
    return 0;
  }
  async join(_room: string, participantId: string) {
    const r = await this.request<{ ok: boolean; reason?: string }>({ type: 'join', reqId: uid('j'), participantId });
    return r ?? { ok: false, reason: 'no_host' };
  }
  async vote(_room: string, participantId: string, pollId: string, option: string): Promise<VoteResult> {
    const r = await this.request<VoteResult>({ type: 'vote', reqId: uid('v'), participantId, pollId, option });
    return r ?? { ok: false, reason: 'no_host' };
  }
  async createEvent() {
    return { ok: true };
  }
  async pushState(_room: string, _key: string, state: PublicState) {
    safeSet(DEMO_STATE_KEY, JSON.stringify(state));
    this.post({ type: 'state', state });
    return true;
  }
  async tallies() {
    return null; // host computes demo tallies locally
  }
  async participantCount() {
    return null;
  }
  async shift() {
    return null;
  }
  async resetPoll() {
    return true;
  }
}

// ═════════════════════════════════════════════════════════════
// SUPABASE transport
// ═════════════════════════════════════════════════════════════

class SupabaseTransport implements Transport {
  kind = 'supabase' as const;
  status: ConnStatus = 'connecting';
  private sb: SupabaseClient;
  private statusCbs = new Set<(s: ConnStatus) => void>();

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
    window.addEventListener('offline', () => this.setStatus('offline'));
    window.addEventListener('online', () => this.setStatus('connecting'));
  }
  private setStatus(s: ConnStatus) {
    this.status = s;
    this.statusCbs.forEach((cb) => cb(s));
  }
  onStatus(cb: (s: ConnStatus) => void) {
    this.statusCbs.add(cb);
    cb(this.status);
    return () => {
      this.statusCbs.delete(cb);
    };
  }
  async fetchState(room: string) {
    const { data, error } = await this.sb.from('events').select('state').eq('room_code', room).maybeSingle();
    if (error) {
      this.setStatus('offline');
      return null;
    }
    if (this.status !== 'online') this.setStatus('online');
    return (data?.state as PublicState) ?? null;
  }
  subscribe(room: string, cb: (s: PublicState) => void) {
    let channel: RealtimeChannel | null = null;
    let closed = false;
    let poller: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (closed) return;
      channel = this.sb
        .channel(`room-${room}-${uid()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events', filter: `room_code=eq.${room}` },
          (payload: any) => {
            const s = payload?.new?.state as PublicState | undefined;
            if (s) cb(s);
          },
        )
        .subscribe((st) => {
          if (st === 'SUBSCRIBED') {
            this.setStatus('online');
            // Catch up on anything missed while disconnected.
            void this.fetchState(room).then((s) => s && cb(s));
          } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
            if (!closed) {
              this.setStatus('offline');
              // Reconnect with a fresh channel after a short delay.
              setTimeout(() => {
                if (closed) return;
                if (channel) void this.sb.removeChannel(channel);
                connect();
              }, 2500);
            }
          }
        });
    };
    connect();
    // Safety net: lightweight polling in case realtime silently stalls.
    poller = setInterval(() => {
      void this.fetchState(room).then((s) => s && cb(s));
    }, 8000);

    return () => {
      closed = true;
      if (poller) clearInterval(poller);
      if (channel) void this.sb.removeChannel(channel);
    };
  }
  async clockOffset() {
    // Best of 3 round trips: the shortest RTT gives the most accurate estimate.
    let best: { rtt: number; off: number } | null = null;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const { data, error } = await this.sb.rpc('server_now');
      const t1 = Date.now();
      if (error || data == null) continue;
      const server = Number(data);
      const off = server - (t0 + t1) / 2;
      if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, off };
    }
    return best ? best.off : null;
  }
  async join(room: string, participantId: string) {
    const { data, error } = await this.sb.rpc('join_event', { p_room: room, p_participant: participantId });
    if (error) return { ok: false, reason: 'network' };
    return data as { ok: boolean; reason?: string };
  }
  async vote(room: string, participantId: string, pollId: string, option: string): Promise<VoteResult> {
    const { data, error } = await this.sb.rpc('cast_vote', {
      p_room: room,
      p_participant: participantId,
      p_poll: pollId,
      p_option: option,
    });
    if (error) return { ok: false, reason: 'network' };
    return data as VoteResult;
  }
  async createEvent(room: string, hostKey: string, state: PublicState) {
    const { data, error } = await this.sb.rpc('create_event', { p_room: room, p_host_key: hostKey, p_state: state });
    if (error) return { ok: false, reason: error.message };
    return data as { ok: boolean; reason?: string };
  }
  async pushState(room: string, hostKey: string, state: PublicState) {
    const { data, error } = await this.sb.rpc('host_update_state', { p_room: room, p_host_key: hostKey, p_state: state });
    if (error || !(data as any)?.ok) {
      this.setStatus('offline');
      return false;
    }
    if (this.status !== 'online') this.setStatus('online');
    return true;
  }
  async tallies(room: string, hostKey: string, pollId: string) {
    const { data, error } = await this.sb.rpc('host_poll_tally', { p_room: room, p_host_key: hostKey, p_poll: pollId });
    if (error || !(data as any)?.ok) return null;
    return { counts: (data as any).counts ?? {}, total: (data as any).total ?? 0 };
  }
  async participantCount(room: string, hostKey: string) {
    const { data, error } = await this.sb.rpc('host_participant_count', { p_room: room, p_host_key: hostKey });
    if (error || !(data as any)?.ok) return null;
    return (data as any).count as number;
  }
  async shift(room: string, hostKey: string, a: string, b: string) {
    const { data, error } = await this.sb.rpc('host_opinion_shift', {
      p_room: room,
      p_host_key: hostKey,
      p_initial: a,
      p_final: b,
    });
    if (error || !(data as any)?.ok) return null;
    const d = data as any;
    return { both: d.both, changed: d.changed, toBan: d.to_ban, toEmbrace: d.to_embrace, other: d.other };
  }
  async resetPoll(room: string, hostKey: string, pollId: string) {
    const { data, error } = await this.sb.rpc('host_reset_poll', { p_room: room, p_host_key: hostKey, p_poll: pollId });
    return !error && !!(data as any)?.ok;
  }
}

let singleton: Transport | null = null;
export function getTransport(): Transport {
  if (singleton) return singleton;
  const cfg = getSupabaseConfig();
  singleton = cfg ? new SupabaseTransport(cfg.url, cfg.anonKey) : new DemoTransport();
  return singleton;
}

/** Same-browser command/handler bus — used in BOTH modes so the projector window's
 *  START THE SHOW button can reach the host window on the event laptop. */
let demoBus: DemoTransport | null = null;
export function getLocalBus(): DemoTransport {
  const t = getTransport();
  if (t instanceof DemoTransport) return t;
  if (!demoBus) demoBus = new DemoTransport();
  return demoBus;
}
export type { DemoTransport };
