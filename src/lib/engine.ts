// ─────────────────────────────────────────────────────────────
// HostEngine — the single source of truth for the show.
// The host window owns the state; every change is versioned,
// saved locally (crash/refresh recovery) and pushed to the
// transport (BroadcastChannel in demo, Supabase in live mode).
// Stage and Audience are read-only views of PublicState.
// ─────────────────────────────────────────────────────────────
import { DEFAULT_CONTENT } from './content';
import { now, setClockOffset, timerRemaining } from './time';
import { getLocalBus, getTransport, type ConnStatus, type DemoRequest, type Transport, type VoteResult } from './transport';
import type {
  CardState,
  Content,
  PollOption,
  PollPurpose,
  PollResults,
  PollState,
  PollVisibility,
  PrivateState,
  PublicState,
  RoundId,
  RouletteState,
  ScreenId,
  ShiftData,
  ShiftSide,
  TeamId,
  TimerState,
} from './types';
import { TEAM_NAME, otherTeam, roundMeta } from './types';
import { clone, makeRoomCode, makeSecret, pick, safeJson, safeRemove, safeSet, uid } from './util';

const PUB_KEY = 'gad:host:public:v1';
const PRIV_KEY = 'gad:host:private:v1';

export const TEAM_OPTIONS: PollOption[] = [
  { id: 'embrace', label: 'Team Embrace', team: 'embrace' },
  { id: 'ban', label: 'Team Ban', team: 'ban' },
];
export const NEITHER_OPTION: PollOption = { id: 'neither', label: 'Neither / Both equally', team: null };
export const POSITION_OPTIONS: PollOption[] = [
  { id: 'embrace', label: 'NO — Embrace AI', team: 'embrace' },
  { id: 'ban', label: 'YES — Ban AI', team: 'ban' },
];
export const MOTION = 'AI should be banned from universities.';

const emptyCard = (): CardState => ({
  kind: 'none',
  id: null,
  text: '',
  answer: null,
  explanation: null,
  points: 0,
  locks: {},
  locksRevealed: false,
  revealedAt: 0,
});

const emptyTimer = (sec = 60, label = 'Timer'): TimerState => ({
  label,
  team: null,
  baseMs: sec * 1000,
  totalMs: sec * 1000,
  startedAt: null,
  status: 'idle',
});

const emptyRoulette = (): RouletteState => ({
  status: 'idle',
  spinId: null,
  startedAt: 0,
  durationMs: 0,
  fromDeg: 0,
  toDeg: 0,
  categoryIndex: null,
  question: null,
  team: null,
  stake: 0,
  points: 0,
});

export function initialPublic(roomCode: string, backend: 'demo' | 'supabase'): PublicState {
  return {
    v: 1,
    roomCode,
    backend,
    status: 'lobby',
    screen: 'home',
    round: 'pre',
    phase: 'Doors open',
    spotlight: null,
    scores: { embrace: 0, ban: 0 },
    roundScores: {},
    bonus: { embrace: 0, ban: 0 },
    scoreLog: [],
    timer: emptyTimer(60),
    poll: null,
    pollHistory: [],
    baselinePollId: null,
    finalPollId: null,
    card: emptyCard(),
    roulette: emptyRoulette(),
    wheel: DEFAULT_CONTENT.roulette.map(({ id, name, blurb, mode }) => ({ id, name, blurb, mode })),
    countdown: null,
    shift: null,
    verdictRevealed: false,
    championRevealed: false,
    message: null,
    sound: true,
    fx: null,
    showScoreboard: true,
    audience: { real: 0, simulated: 0 },
    updatedAt: Date.now(),
  };
}

function initialPrivate(content?: Content): PrivateState {
  return {
    hostKey: makeSecret(),
    content: content ? clone(content) : clone(DEFAULT_CONTENT),
    used: {},
    votes: {},
    remote: {},
    manual: {},
    localParticipants: {},
    simulatedParticipants: 0,
    remoteParticipants: 0,
  };
}

export const MAIN_SCREEN: Record<RoundId, ScreenId> = {
  pre: 'join',
  r1: 'teams',
  r2: 'fof',
  r3: 'hotseat',
  roulette: 'roulette',
  r4: 'devil',
  r5: 'final',
};

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'warn' | 'error' | 'ok';
}

export interface Snapshot {
  state: PublicState;
  priv: PrivateState;
  conn: ConnStatus;
  lastPushOk: boolean;
  ready: boolean;
  toasts: Toast[];
  busy: Record<string, boolean>;
}

export class HostEngine {
  state: PublicState;
  priv: PrivateState;
  transport: Transport;
  private conn: ConnStatus;
  private lastPushOk = true;
  private ready = false;
  private toasts: Toast[] = [];
  private busy: Record<string, boolean> = {};
  private listeners = new Set<() => void>();
  private snap!: Snapshot;
  private pushing = false;
  private pendingPush = false;
  private pushWaiters: (() => void)[] = [];
  private spinTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private loops: ReturnType<typeof setInterval>[] = [];

  constructor() {
    this.transport = getTransport();
    this.conn = this.transport.status;
    const savedPub = safeJson<PublicState>(PUB_KEY);
    const savedPriv = safeJson<PrivateState>(PRIV_KEY);
    const backend = this.transport.kind;
    if (savedPub && savedPriv && savedPub.backend === backend) {
      this.state = { ...initialPublic(savedPub.roomCode, backend), ...savedPub };
      this.priv = { ...initialPrivate(), ...savedPriv };
    } else {
      this.state = initialPublic(makeRoomCode(), backend);
      this.priv = initialPrivate(savedPriv?.content);
    }
    this.makeSnap();
  }

  // ── store plumbing ─────────────────────────────────────────
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  private makeSnap() {
    this.snap = {
      state: this.state,
      priv: this.priv,
      conn: this.conn,
      lastPushOk: this.lastPushOk,
      ready: this.ready,
      toasts: this.toasts,
      busy: this.busy,
    };
  }
  private emit() {
    this.makeSnap();
    this.listeners.forEach((l) => l());
  }
  private persist() {
    safeSet(PUB_KEY, JSON.stringify(this.state));
    safeSet(PRIV_KEY, JSON.stringify(this.priv));
  }
  toast(text: string, tone: Toast['tone'] = 'info') {
    const t = { id: uid('t'), text, tone };
    this.toasts = [...this.toasts.slice(-3), t];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.emit();
    }, tone === 'error' ? 7000 : 4000);
  }
  private setBusy(k: string, v: boolean) {
    this.busy = { ...this.busy, [k]: v };
    this.emit();
  }

  /** Apply a change to public (and optionally private) state, then save + broadcast. */
  update(fn: (s: PublicState, p: PrivateState) => void) {
    const s = clone(this.state);
    const p = { ...this.priv };
    fn(s, p);
    this.publishResults(s, p);
    s.wheel = p.content.roulette.map(({ id, name, blurb, mode }) => ({ id, name, blurb, mode }));
    s.v = this.state.v + 1;
    s.updatedAt = now();
    this.state = s;
    this.priv = p;
    this.persist();
    this.emit();
    this.schedulePush();
  }
  updatePriv(fn: (p: PrivateState) => void) {
    const p = { ...this.priv };
    fn(p);
    this.priv = p;
    this.persist();
    this.emit();
  }

  private schedulePush() {
    if (this.pushing) {
      this.pendingPush = true;
      return;
    }
    void this.doPush();
  }
  private async doPush(): Promise<void> {
    this.pushing = true;
    this.pendingPush = false;
    const ok = await this.transport.pushState(this.state.roomCode, this.priv.hostKey, this.state);
    if (ok !== this.lastPushOk) {
      this.lastPushOk = ok;
      this.emit();
    }
    this.pushing = false;
    if (this.pendingPush) return this.doPush();
    if (!ok) {
      // Retry until the backend is back; the newest state always wins.
      setTimeout(() => {
        if (!this.pushing) void this.doPush();
      }, 2000);
      return;
    }
    const w = this.pushWaiters;
    this.pushWaiters = [];
    w.forEach((f) => f());
  }
  /** Resolves once the current state has reached the backend (or after a timeout). */
  flush(timeoutMs = 4000) {
    if (!this.pushing && !this.pendingPush) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const t = setTimeout(resolve, timeoutMs);
      this.pushWaiters.push(() => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  // ── lifecycle ──────────────────────────────────────────────
  async init() {
    this.transport.onStatus((s) => {
      this.conn = s;
      this.emit();
    });
    if (this.transport.kind === 'supabase') {
      const off = await this.transport.clockOffset();
      if (off != null) setClockOffset(off);
      await this.ensureRemoteEvent();
    }
    // Same-browser bus: demo audience requests + START button on the projector window.
    getLocalBus().setHandler((req) => this.handleLocal(req));

    // Background loops: tallies + participant counts (live mode).
    this.loops.push(setInterval(() => void this.pollTallies(), 1500));
    this.loops.push(setInterval(() => void this.pollParticipants(), 5000));
    void this.pollParticipants();

    this.resumeScheduled();
    this.ready = true;
    this.emit();
    this.schedulePush();
  }
  destroy() {
    this.loops.forEach(clearInterval);
    getLocalBus().setHandler(null);
  }

  private async ensureRemoteEvent() {
    const remote = await this.transport.fetchState(this.state.roomCode);
    if (remote) {
      // Room exists — confirm we hold its key by pushing. Adopt the newer state.
      if (remote.v > this.state.v) this.state = { ...this.state, ...remote };
      const ok = await this.transport.pushState(this.state.roomCode, this.priv.hostKey, this.state);
      if (ok) return;
      this.toast('This room code belongs to another host. Creating a new room.', 'warn');
      this.state = { ...this.state, roomCode: makeRoomCode(), v: 1 };
    }
    for (let i = 0; i < 4; i++) {
      const r = await this.transport.createEvent(this.state.roomCode, this.priv.hostKey, this.state);
      if (r.ok) {
        this.persist();
        return;
      }
      if (r.reason === 'exists') {
        this.state = { ...this.state, roomCode: makeRoomCode() };
        continue;
      }
      this.toast(`Could not create the live room: ${r.reason ?? 'unknown error'}. Check Supabase setup.`, 'error');
      return;
    }
  }

  /** Re-arm timeouts (spin landing, verdict countdown) after a host page refresh. */
  private resumeScheduled() {
    const r = this.state.roulette;
    if (r.status === 'spinning') {
      const left = r.startedAt + r.durationMs - now();
      this.spinTimer = setTimeout(() => this.landSpin(r.spinId!), Math.max(0, left));
    }
    const c = this.state.countdown;
    if (this.state.screen === 'countdown' && c) {
      const left = c.startedAt + c.seconds * 1000 - now();
      this.countdownTimer = setTimeout(() => void this.revealVerdict(), Math.max(0, left));
    }
  }

  private handleLocal(req: DemoRequest): any {
    if (req.type === 'cmd') {
      if (req.cmd === 'start') this.startShow();
      return { ok: true };
    }
    if (this.transport.kind !== 'demo') return { ok: false, reason: 'no_host' };
    if (req.type === 'join') {
      this.updatePriv((p) => {
        p.localParticipants = { ...p.localParticipants, [req.participantId]: now() };
      });
      this.refreshAudience();
      return { ok: true };
    }
    if (req.type === 'vote') return this.recordLocalVote(req.participantId, req.pollId, req.option, false);
    return null;
  }

  /** Demo-mode vote validation (mirrors the SQL cast_vote function). */
  private recordLocalVote(pid: string, pollId: string, option: string, simulated: boolean): VoteResult {
    const poll = this.state.poll;
    if (!poll || poll.id !== pollId || poll.status !== 'open') return { ok: false, reason: 'closed' };
    if (!poll.options.some((o) => o.id === option)) return { ok: false, reason: 'invalid' };
    if (!simulated && !this.priv.localParticipants[pid]) return { ok: false, reason: 'not_joined' };
    const existing = this.priv.votes[pollId]?.[pid];
    if (existing) return { ok: false, reason: 'duplicate', option: existing.option };
    this.update((_s, p) => {
      p.votes = { ...p.votes, [pollId]: { ...(p.votes[pollId] ?? {}), [pid]: { participantId: pid, option, simulated, at: now() } } };
    });
    return { ok: true, option };
  }

  private refreshAudience() {
    const real =
      this.transport.kind === 'demo' ? Object.keys(this.priv.localParticipants).length : this.priv.remoteParticipants;
    const simulated = this.priv.simulatedParticipants;
    if (real !== this.state.audience.real || simulated !== this.state.audience.simulated) {
      this.update((s) => {
        s.audience = { real, simulated };
      });
    }
  }

  private async pollParticipants() {
    if (this.transport.kind !== 'supabase') return;
    const n = await this.transport.participantCount(this.state.roomCode, this.priv.hostKey);
    if (n != null && n !== this.priv.remoteParticipants) {
      this.priv = { ...this.priv, remoteParticipants: n };
      this.refreshAudience();
    }
  }

  private async pollTallies(force = false) {
    if (this.transport.kind !== 'supabase') return;
    const poll = this.state.poll;
    if (!poll) return;
    const recentlyClosed = poll.closedAt != null && now() - poll.closedAt < 8000;
    if (!force && poll.status !== 'open' && !recentlyClosed) return;
    await this.fetchRemoteTally(poll.id);
  }
  private async fetchRemoteTally(pollId: string) {
    const t = await this.transport.tallies(this.state.roomCode, this.priv.hostKey, pollId);
    if (!t) return;
    const prev = this.priv.remote[pollId] ?? {};
    const changed = JSON.stringify(prev) !== JSON.stringify(t.counts);
    if (changed) {
      this.update((_s, p) => {
        p.remote = { ...p.remote, [pollId]: t.counts };
      });
    }
  }

  // ── results ────────────────────────────────────────────────
  computeResults(pollId: string, options: PollOption[], p: PrivateState = this.priv): PollResults {
    const zero = () => Object.fromEntries(options.map((o) => [o.id, 0])) as Record<string, number>;
    const real = zero();
    const simulated = zero();
    const manual = zero();
    for (const v of Object.values(p.votes[pollId] ?? {})) {
      const bucket = v.simulated ? simulated : real;
      if (v.option in bucket) bucket[v.option]++;
    }
    for (const [k, n] of Object.entries(p.remote[pollId] ?? {})) if (k in real) real[k] += n;
    for (const [k, n] of Object.entries(p.manual[pollId] ?? {})) if (k in manual) manual[k] += Math.max(0, n | 0);
    const counts = zero();
    for (const k of Object.keys(counts)) counts[k] = real[k] + simulated[k] + manual[k];
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    return {
      counts,
      real,
      simulated,
      manual,
      total: sum(counts),
      realTotal: sum(real),
      simulatedTotal: sum(simulated),
      manualTotal: sum(manual),
    };
  }

  /** Only copies results into public state when the host has allowed them to be seen. */
  private publishResults(s: PublicState, p: PrivateState) {
    const apply = (poll: PollState) => {
      const r = this.computeResults(poll.id, poll.options, p);
      poll.voteCount = r.total;
      const visible = poll.revealed || poll.visibility === 'live';
      poll.results = visible ? r : null;
    };
    if (s.poll) apply(s.poll);
    s.pollHistory.forEach(apply);
  }

  // ── event controls ─────────────────────────────────────────
  startShow = () => {
    this.update((s) => {
      s.status = 'live';
      s.screen = 'join';
      s.round = 'pre';
      s.phase = 'Audience joining';
      s.fx = { id: uid(), kind: 'flash' };
    });
  };
  pauseShow = () =>
    this.update((s) => {
      if (s.timer.status === 'running') {
        s.timer = { ...s.timer, baseMs: timerRemaining(s.timer), startedAt: null, status: 'paused' };
      }
      s.status = 'paused';
    });
  resumeShow = () =>
    this.update((s) => {
      s.status = 'live';
    });
  endShow = () =>
    this.update((s) => {
      s.status = 'ended';
      s.screen = 'message';
      s.message = { title: 'THANK YOU, GOODENOUGH!', body: 'The Great AI Debate is over. The conversation isn’t.' };
    });
  resetShow = () => {
    if (this.spinTimer) clearTimeout(this.spinTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    const room = this.state.roomCode;
    const sound = this.state.sound;
    const v = this.state.v;
    this.update((s, p) => {
      Object.assign(s, initialPublic(room, this.transport.kind), { v, sound });
      p.used = {};
      p.votes = {};
      p.remote = {};
      p.manual = {};
      p.simulatedParticipants = 0;
    });
    this.refreshAudience();
    this.toast('Show reset. Scores, polls and question history cleared.', 'ok');
  };
  newRoom = async () => {
    const content = this.priv.content;
    safeRemove(PUB_KEY);
    this.priv = initialPrivate(content);
    this.state = { ...initialPublic(makeRoomCode(), this.transport.kind), v: this.state.v + 1 };
    if (this.transport.kind === 'supabase') await this.ensureRemoteEvent();
    this.persist();
    this.emit();
    this.schedulePush();
    this.toast(`New room created: ${this.state.roomCode}`, 'ok');
  };
  /** Take over an existing live room from another computer using its host key. */
  recoverRoom = async (room: string, key: string) => {
    room = room.trim().toUpperCase();
    key = key.trim();
    const remote = await this.transport.fetchState(room);
    if (!remote) return this.toast('Room not found.', 'error');
    const ok = await this.transport.pushState(room, key, remote);
    if (!ok) return this.toast('Host key rejected for that room.', 'error');
    this.state = remote;
    this.priv = { ...this.priv, hostKey: key, votes: {}, remote: {}, manual: {} };
    this.persist();
    this.emit();
    this.toast(`Now hosting room ${room}.`, 'ok');
  };

  setScreen = (screen: ScreenId) =>
    this.update((s) => {
      s.screen = screen;
    });
  goRound = (round: RoundId) =>
    this.update((s, p) => {
      s.round = round;
      s.screen = 'roundIntro';
      s.phase = 'Round intro';
      s.spotlight = null;
      s.fx = { id: uid(), kind: 'flash' };
      const st = p.content.settings;
      // Never carry a running timer into a new round.
      s.timer =
        round === 'r1'
          ? emptyTimer(st.openingSec, 'Opening statement')
          : round === 'r5'
            ? emptyTimer(st.closingSec, 'Closing statement')
            : round === 'r2'
              ? emptyTimer(30, 'Discussion')
              : emptyTimer(st.prepSec, 'Preparation');
      if (round === 'r2' || round === 'r3' || round === 'r4') s.card = emptyCard();
    });
  showMain = () =>
    this.update((s) => {
      s.screen = MAIN_SCREEN[s.round];
    });
  setSpotlight = (team: TeamId | null) =>
    this.update((s) => {
      s.spotlight = team;
    });
  setPhase = (phase: string) =>
    this.update((s) => {
      s.phase = phase;
    });
  setMessage = (title: string, body: string) =>
    this.update((s) => {
      s.message = { title, body };
      s.screen = 'message';
    });
  toggleSound = () =>
    this.update((s) => {
      s.sound = !s.sound;
    });
  toggleScoreboard = () =>
    this.update((s) => {
      s.showScoreboard = !s.showScoreboard;
    });
  fireConfetti = () =>
    this.update((s) => {
      s.fx = { id: uid(), kind: 'confetti' };
    });

  // ── timer ──────────────────────────────────────────────────
  timerLoad = (label: string, sec: number, team: TeamId | null, autostart = false) =>
    this.update((s) => {
      s.timer = {
        label,
        team,
        baseMs: sec * 1000,
        totalMs: sec * 1000,
        startedAt: autostart ? now() : null,
        status: autostart ? 'running' : 'idle',
      };
      s.spotlight = team;
      s.phase = label;
    });
  timerStart = () =>
    this.update((s) => {
      if (s.timer.status === 'running') return;
      if (s.timer.baseMs <= 0) s.timer.baseMs = s.timer.totalMs;
      s.timer = { ...s.timer, startedAt: now(), status: 'running' };
    });
  timerPause = () =>
    this.update((s) => {
      if (s.timer.status !== 'running') return;
      s.timer = { ...s.timer, baseMs: timerRemaining(s.timer), startedAt: null, status: 'paused' };
    });
  timerReset = () =>
    this.update((s) => {
      s.timer = { ...s.timer, baseMs: s.timer.totalMs, startedAt: null, status: 'idle' };
    });
  timerAdd = (sec: number) =>
    this.update((s) => {
      const add = sec * 1000;
      const remaining = timerRemaining(s.timer);
      if (remaining + add < 0) return;
      s.timer = { ...s.timer, baseMs: s.timer.baseMs + add, totalMs: Math.max(1000, s.timer.totalMs + add) };
    });
  timerSetDuration = (sec: number) =>
    this.update((s) => {
      s.timer = { ...s.timer, baseMs: sec * 1000, totalMs: sec * 1000, startedAt: null, status: 'idle' };
    });

  // ── scores ─────────────────────────────────────────────────
  award = (team: TeamId, delta: number, reason: string, bonus = false) => {
    if (!delta) return;
    this.update((s) => {
      s.scores[team] += delta;
      const rs = s.roundScores[s.round] ?? { embrace: 0, ban: 0 };
      rs[team] += delta;
      s.roundScores[s.round] = rs;
      if (bonus) s.bonus[team] += delta;
      s.scoreLog = [
        ...s.scoreLog,
        { id: uid('s'), at: now(), team, delta, reason, round: s.round, bonus, kind: 'award' as const },
      ].slice(-300);
      s.fx = { id: uid(), kind: 'points', team, delta };
    });
  };
  overrideScore = (team: TeamId, value: number) =>
    this.update((s) => {
      const delta = value - s.scores[team];
      if (!delta) return;
      s.scores[team] = value;
      s.scoreLog = [
        ...s.scoreLog,
        { id: uid('s'), at: now(), team, delta, reason: `Manual override → ${value}`, round: s.round, bonus: false, kind: 'override' as const },
      ];
    });
  undoScore = (entryId: string) =>
    this.update((s) => {
      const e = s.scoreLog.find((x) => x.id === entryId);
      if (!e) return;
      s.scores[e.team] -= e.delta;
      const rs = s.roundScores[e.round];
      if (rs && e.kind === 'award') rs[e.team] -= e.delta;
      if (e.bonus) s.bonus[e.team] -= e.delta;
      s.scoreLog = s.scoreLog.filter((x) => x.id !== entryId);
    });
  resetScores = () =>
    this.update((s) => {
      s.scores = { embrace: 0, ban: 0 };
      s.roundScores = {};
      s.bonus = { embrace: 0, ban: 0 };
      s.scoreLog = [
        { id: uid('s'), at: now(), team: 'embrace', delta: 0, reason: 'Scores reset', round: s.round, bonus: false, kind: 'reset' },
      ];
    });

  // ── polls ──────────────────────────────────────────────────
  openPoll = (opts: {
    question: string;
    options: PollOption[];
    purpose: PollPurpose;
    visibility: PollVisibility;
    correctOption?: string | null;
    showOnStage?: boolean;
  }) => {
    if (this.state.poll?.status === 'open') {
      this.toast('Close the current poll before opening a new one.', 'warn');
      return;
    }
    this.update((s) => {
      if (s.poll) s.pollHistory = [...s.pollHistory.filter((x) => x.id !== s.poll!.id), s.poll];
      const poll: PollState = {
        id: uid('p'),
        question: opts.question,
        options: opts.options,
        purpose: opts.purpose,
        status: 'open',
        visibility: opts.visibility,
        revealed: false,
        openedAt: now(),
        closedAt: null,
        results: null,
        voteCount: 0,
        correctOption: opts.correctOption ?? null,
      };
      s.poll = poll;
      if (opts.purpose === 'baseline') s.baselinePollId = poll.id;
      if (opts.purpose === 'final') {
        s.finalPollId = poll.id;
        s.verdictRevealed = false;
      }
      if (opts.showOnStage !== false) s.screen = 'poll';
      s.fx = { id: uid(), kind: 'flash' };
    });
  };
  closePoll = async () => {
    const poll = this.state.poll;
    if (!poll || poll.status !== 'open') return;
    this.setBusy('closePoll', true);
    this.update((s) => {
      s.poll!.status = 'closed';
      s.poll!.closedAt = now();
      if (s.poll!.visibility === 'after') s.poll!.revealed = true;
    });
    // Make sure the server knows the poll is closed, then take the final count.
    await this.flush();
    await this.pollTallies(true);
    this.update((s) => {
      if (s.poll) s.pollHistory = [...s.pollHistory.filter((x) => x.id !== s.poll!.id), clone(s.poll)];
    });
    this.setBusy('closePoll', false);
  };
  revealPoll = () =>
    this.update((s) => {
      if (!s.poll) return;
      s.poll.revealed = true;
      s.screen = 'poll';
      s.pollHistory = s.pollHistory.map((x) => (x.id === s.poll!.id ? { ...x, revealed: true } : x));
    });
  hidePoll = () =>
    this.update((s) => {
      if (!s.poll) return;
      s.poll.revealed = false;
      if (s.poll.visibility === 'live') s.poll.visibility = 'hidden';
      s.pollHistory = s.pollHistory.map((x) => (x.id === s.poll!.id ? { ...x, revealed: false, visibility: s.poll!.visibility } : x));
    });
  setPollVisibility = (v: PollVisibility) =>
    this.update((s) => {
      if (s.poll) s.poll.visibility = v;
    });
  resetPoll = async () => {
    const poll = this.state.poll;
    if (!poll) return;
    await this.transport.resetPoll(this.state.roomCode, this.priv.hostKey, poll.id);
    this.update((s, p) => {
      const { [poll.id]: _a, ...votes } = p.votes;
      const { [poll.id]: _b, ...remote } = p.remote;
      const { [poll.id]: _c, ...manual } = p.manual;
      p.votes = votes;
      p.remote = remote;
      p.manual = manual;
      s.poll!.status = 'open';
      s.poll!.closedAt = null;
      s.poll!.revealed = false;
      s.poll!.openedAt = now();
      s.pollHistory = s.pollHistory.filter((x) => x.id !== poll.id);
    });
    this.toast('Poll reset and reopened. Previous votes discarded.', 'ok');
  };
  setManualCount = (option: string, n: number) =>
    this.update((s, p) => {
      if (!s.poll) return;
      p.manual = { ...p.manual, [s.poll.id]: { ...(p.manual[s.poll.id] ?? {}), [option]: Math.max(0, Math.floor(n) || 0) } };
    });

  /** Simulated audience (demo + rehearsal). Votes trickle in for drama and are always labelled. */
  simulateVotes = (n: number, lean: string | 'random') => {
    const poll = this.state.poll;
    if (!poll || poll.status !== 'open') return this.toast('Open a poll first.', 'warn');
    const voted = this.priv.votes[poll.id] ?? {};
    const need = Math.max(0, n - (this.priv.simulatedParticipants - Object.keys(voted).filter((k) => k.startsWith('sim-')).length));
    if (need > 0) this.updatePriv((p) => (p.simulatedParticipants += need));
    this.refreshAudience();
    const ids: string[] = [];
    for (let i = 1; i <= this.priv.simulatedParticipants && ids.length < n; i++) {
      const id = `sim-${i}`;
      if (!voted[id]) ids.push(id);
    }
    const baseline = this.state.baselinePollId ? this.priv.votes[this.state.baselinePollId] ?? {} : {};
    const choose = (id: string) => {
      const opts = poll.options.map((o) => o.id);
      if (poll.purpose === 'final' && baseline[id] && opts.includes(baseline[id].option) && Math.random() < 0.7) {
        return baseline[id].option;
      }
      if (lean !== 'random' && opts.includes(lean) && Math.random() < 0.6) return lean;
      // 'neither' is rarer than team options
      const weighted = opts.flatMap((o) => (o === 'neither' ? [o] : [o, o, o]));
      return pick(weighted);
    };
    const batches = Math.min(10, ids.length);
    const per = Math.ceil(ids.length / Math.max(1, batches));
    for (let b = 0; b < batches; b++) {
      setTimeout(() => {
        for (const id of ids.slice(b * per, (b + 1) * per)) this.recordLocalVote(id, poll.id, choose(id), true);
      }, b * 250);
    }
  };
  addSimulatedParticipants = (n: number) => {
    this.updatePriv((p) => (p.simulatedParticipants += n));
    this.refreshAudience();
  };
  clearSimulated = () => {
    this.update((_s, p) => {
      const votes: PrivateState['votes'] = {};
      for (const [pid, m] of Object.entries(p.votes)) {
        votes[pid] = Object.fromEntries(Object.entries(m).filter(([, v]) => !v.simulated));
      }
      p.votes = votes;
      p.simulatedParticipants = 0;
    });
    this.refreshAudience();
    this.toast('All simulated participants and votes removed.', 'ok');
  };

  /** Award the poll winner (team options only). Ties award nobody. */
  awardPollWinner = (points: number, reason: string) => {
    const poll = this.state.poll;
    if (!poll) return;
    const r = this.computeResults(poll.id, poll.options);
    const e = r.counts.embrace ?? 0;
    const b = r.counts.ban ?? 0;
    if (e === b) return this.toast('It’s a tie between the teams — no points awarded automatically.', 'warn');
    this.award(e > b ? 'embrace' : 'ban', points, reason);
  };

  // ── round 2: fact or fiction ───────────────────────────────
  private pickUnused<T extends { id: string }>(list: T[], label: string): T | null {
    if (!list.length) return null;
    let pool = list.filter((x) => !this.priv.used[x.id]);
    if (!pool.length) {
      this.updatePriv((p) => {
        const used = { ...p.used };
        list.forEach((x) => delete used[x.id]);
        p.used = used;
      });
      this.toast(`All ${label} used — starting the list again.`, 'info');
      pool = list;
    }
    return pick(pool);
  }
  private markUsed(id: string) {
    this.priv = { ...this.priv, used: { ...this.priv.used, [id]: true } };
  }
  fofDraw = (filter: 'fact' | 'debate' | 'any', id?: string) => {
    const facts = this.priv.content.facts;
    const item = id
      ? facts.find((f) => f.id === id)
      : this.pickUnused(filter === 'any' ? facts : facts.filter((f) => f.kind === filter), 'statements');
    if (!item) return this.toast('No statements available — add some in Content.', 'warn');
    this.markUsed(item.id);
    this.update((s) => {
      s.card = {
        ...emptyCard(),
        kind: item.kind,
        id: item.id,
        text: item.statement,
        points: item.points,
        revealedAt: now(),
      };
      s.screen = 'fof';
      s.round = s.round === 'pre' ? 'r2' : s.round;
      s.phase = item.kind === 'fact' ? 'Teams decide: fact or fiction?' : 'Debate statement';
      s.fx = { id: uid(), kind: 'flash' };
    });
  };
  fofLock = (team: TeamId, answer: 'FACT' | 'FICTION' | null) =>
    this.update((s) => {
      const locks = { ...s.card.locks };
      if (answer) locks[team] = answer;
      else delete locks[team];
      s.card.locks = locks;
    });
  fofReveal = (autoAward = true) => {
    const card = this.state.card;
    const item = this.priv.content.facts.find((f) => f.id === card.id);
    if (!item) return;
    this.update((s) => {
      s.card.answer = item.kind === 'fact' ? item.answer : null;
      s.card.explanation = item.explanation;
      s.card.locksRevealed = true;
      s.phase = 'Answer revealed';
    });
    if (autoAward && item.kind === 'fact' && item.answer) {
      for (const t of ['embrace', 'ban'] as TeamId[]) {
        if (card.locks[t] === item.answer) this.award(t, item.points, `Fact or Fiction: correct (“${item.statement.slice(0, 40)}…”)`);
      }
    }
  };
  fofAudienceQuiz = () => {
    const card = this.state.card;
    if (card.kind === 'none') return;
    const item = this.priv.content.facts.find((f) => f.id === card.id);
    if (card.kind === 'fact') {
      this.openPoll({
        question: `FACT OR FICTION? “${card.text}”`,
        options: [
          { id: 'fact', label: 'FACT' },
          { id: 'fiction', label: 'FICTION' },
        ],
        purpose: 'quiz',
        visibility: 'after',
        correctOption: item?.answer ? item.answer.toLowerCase() : null,
        showOnStage: false,
      });
    } else {
      this.openPoll({
        question: `Do you agree? “${card.text}”`,
        options: [
          { id: 'agree', label: 'AGREE' },
          { id: 'disagree', label: 'DISAGREE' },
        ],
        purpose: 'round',
        visibility: 'after',
        showOnStage: false,
      });
    }
  };

  // ── round 3: hot seat ──────────────────────────────────────
  hotDraw = (id?: string) => {
    const list = this.priv.content.scenarios;
    const item = id ? list.find((x) => x.id === id) : this.pickUnused(list, 'scenarios');
    if (!item) return this.toast('No scenarios available — add some in Content.', 'warn');
    this.markUsed(item.id);
    this.update((s) => {
      s.card = { ...emptyCard(), kind: 'scenario', id: item.id, text: item.text, points: item.points, revealedAt: now() };
      s.screen = 'hotseat';
      s.phase = 'Scenario revealed';
      s.spotlight = null;
      s.timer = emptyTimer(this.priv.content.settings.prepSec, 'Preparation');
      s.fx = { id: uid(), kind: 'flash' };
    });
  };

  // ── round 4: devil's advocate ──────────────────────────────
  devilAssign = (only?: TeamId) => {
    const list = this.priv.content.devil;
    const next = { ...(this.state.card.kind === 'devil' ? this.state.card.devil : {}) } as Partial<Record<TeamId, string>>;
    for (const t of (only ? [only] : ['embrace', 'ban']) as TeamId[]) {
      const item = this.pickUnused(list.filter((x) => x.team === t), `${TEAM_NAME[t]} challenges`);
      if (item) {
        this.markUsed(item.id);
        next[t] = item.text;
      }
    }
    this.update((s) => {
      s.card = {
        ...emptyCard(),
        kind: 'devil',
        id: uid('dv'),
        text: 'Argue the side you oppose.',
        points: this.priv.content.settings.devilBonus,
        devil: next,
        revealedAt: now(),
      };
      s.screen = 'devil';
      s.phase = 'Challenges assigned';
      s.timer = emptyTimer(this.priv.content.settings.prepSec, 'Preparation');
      s.fx = { id: uid(), kind: 'flash' };
    });
  };

  // ── AI roulette ────────────────────────────────────────────
  isSpinning = () => {
    const r = this.state.roulette;
    return r.status === 'spinning' && now() < r.startedAt + r.durationMs + 200;
  };
  spin = (forceIndex?: number) => {
    if (this.isSpinning()) return; // prevents accidental double spins
    const cats = this.priv.content.roulette;
    if (!cats.length) return;
    const n = cats.length;
    const idx = forceIndex ?? Math.floor(Math.random() * n);
    const seg = 360 / n;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = (((-(idx + 0.5) * seg - jitter) % 360) + 360) % 360;
    const from = ((this.state.roulette.toDeg % 360) + 360) % 360;
    const to = from + 360 * 6 + ((target - from + 360) % 360);
    const spinId = uid('spin');
    const duration = this.priv.content.settings.rouletteSpinMs;
    this.update((s) => {
      s.roulette = {
        ...emptyRoulette(),
        status: 'spinning',
        spinId,
        startedAt: now() + 150,
        durationMs: duration,
        fromDeg: from,
        toDeg: to,
        categoryIndex: idx,
      };
      s.screen = 'roulette';
      s.round = s.round === 'pre' ? 'roulette' : s.round;
      s.phase = 'Wheel spinning';
      s.spotlight = null;
    });
    if (this.spinTimer) clearTimeout(this.spinTimer);
    this.spinTimer = setTimeout(() => this.landSpin(spinId), duration + 200);
  };
  private landSpin(spinId: string) {
    if (this.state.roulette.spinId !== spinId || this.state.roulette.status !== 'spinning') return;
    this.update((s) => {
      s.roulette.status = 'landed';
      s.phase = 'Wheel landed';
    });
  }
  rouletteSetCategory = (idx: number) =>
    this.update((s) => {
      const seg = 360 / this.priv.content.roulette.length;
      const target = (((-(idx + 0.5) * seg) % 360) + 360) % 360;
      s.roulette = { ...emptyRoulette(), status: 'landed', categoryIndex: idx, fromDeg: target, toDeg: target, spinId: uid('set') };
      s.screen = 'roulette';
      s.phase = 'Category chosen';
    });
  rouletteReveal = (questionId?: string) => {
    const r = this.state.roulette;
    if (r.categoryIndex == null || r.status === 'spinning') return;
    const cat = this.priv.content.roulette[r.categoryIndex];
    if (!cat) return;
    const q = questionId ? cat.questions.find((x) => x.id === questionId) : this.pickUnused(cat.questions, `${cat.name} questions`);
    if (!q) return this.toast('This category has no questions — add some in Content.', 'warn');
    this.markUsed(q.id);
    const st = this.priv.content.settings;
    const team: TeamId | null = cat.mode === 'audience' ? null : pick<TeamId>(['embrace', 'ban']);
    this.update((s) => {
      s.roulette = {
        ...s.roulette,
        status: 'revealed',
        question: q.text,
        team,
        stake: cat.mode === 'double' ? st.doubleStake : 0,
        points: st.roulettePoints,
      };
      s.spotlight = team;
      s.phase = cat.mode === 'audience' ? 'Audience decides who answers' : `${team ? TEAM_NAME[team] : ''} must answer`;
      const sec = cat.mode === 'ten' ? st.tenSec : st.prepSec;
      s.timer = emptyTimer(sec, cat.mode === 'ten' ? '10-second challenge' : 'Preparation');
      s.timer.team = team;
      s.fx = { id: uid(), kind: 'flash' };
    });
  };
  rouletteSetTeam = (team: TeamId) =>
    this.update((s) => {
      s.roulette.team = team;
      s.spotlight = team;
      s.timer.team = team;
      s.phase = `${TEAM_NAME[team]} must answer`;
    });
  rouletteSetStake = (stake: number) =>
    this.update((s) => {
      s.roulette.stake = Math.max(0, Math.floor(stake));
    });
  rouletteAudienceVote = () =>
    this.openPoll({
      question: 'AUDIENCE DECIDES: Which team must answer?',
      options: TEAM_OPTIONS,
      purpose: 'audienceDecides',
      visibility: 'live',
    });
  rouletteApplyAudience = () => {
    const poll = this.state.poll;
    if (!poll || poll.purpose !== 'audienceDecides') return;
    const r = this.computeResults(poll.id, poll.options);
    const e = r.counts.embrace ?? 0;
    const b = r.counts.ban ?? 0;
    const team: TeamId = e === b ? pick<TeamId>(['embrace', 'ban']) : e > b ? 'embrace' : 'ban';
    if (e === b) this.toast('Audience tied — team chosen at random.', 'info');
    this.rouletteSetTeam(team);
    this.update((s) => {
      s.screen = 'roulette';
    });
  };
  rouletteDouble = (win: boolean) => {
    const r = this.state.roulette;
    if (!r.team) return;
    if (win) this.award(r.team, r.stake * 2, 'Double or Nothing — WON', true);
    else this.award(r.team, -r.stake, 'Double or Nothing — lost the stake');
  };
  rouletteSkip = () =>
    this.update((s) => {
      s.roulette = { ...emptyRoulette(), toDeg: s.roulette.toDeg, fromDeg: s.roulette.toDeg };
      s.spotlight = null;
      s.phase = 'Challenge skipped';
    });

  // ── round 5 + verdict ──────────────────────────────────────
  openBaselinePoll = () =>
    this.openPoll({
      question: 'Should AI be banned from universities?',
      options: POSITION_OPTIONS,
      purpose: 'baseline',
      visibility: 'hidden',
    });
  openFinalPoll = () =>
    this.openPoll({
      question: 'THE FINAL VERDICT: Should AI be banned from universities?',
      options: POSITION_OPTIONS,
      purpose: 'final',
      visibility: 'hidden',
    });
  startVerdictCountdown = async (seconds = 10) => {
    const poll = this.state.poll;
    if (!this.state.finalPollId) return this.toast('Open and close the final vote first.', 'warn');
    if (poll && poll.id === this.state.finalPollId && poll.status === 'open') await this.closePoll();
    this.update((s) => {
      s.countdown = { startedAt: now() + 300, seconds, label: 'THE VERDICT IS IN' };
      s.screen = 'countdown';
      s.verdictRevealed = false;
      s.spotlight = null;
    });
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = setTimeout(() => void this.revealVerdict(), seconds * 1000 + 300);
  };
  revealVerdict = async () => {
    const id = this.state.finalPollId;
    if (!id) return;
    if (this.transport.kind === 'supabase') await this.fetchRemoteTally(id);
    this.update((s) => {
      const mark = (p: PollState) => (p.id === id ? { ...p, revealed: true } : p);
      if (s.poll) s.poll = mark(s.poll);
      s.pollHistory = s.pollHistory.map(mark);
      s.verdictRevealed = true;
      s.screen = 'verdict';
      s.fx = { id: uid(), kind: 'confetti' };
    });
  };
  revealChampion = () =>
    this.update((s) => {
      s.championRevealed = true;
      s.screen = 'champion';
      s.fx = { id: uid(), kind: 'confetti' };
    });

  private sideFrom(r: PollResults): ShiftSide {
    const ban = r.counts.ban ?? 0;
    const embrace = r.counts.embrace ?? 0;
    const n = ban + embrace;
    return { ban, embrace, n, banPct: n ? (ban / n) * 100 : 0, embracePct: n ? (embrace / n) * 100 : 0 };
  }
  computeShift = async () => {
    const a = this.state.baselinePollId;
    const b = this.state.finalPollId;
    if (!a || !b) return this.toast('Need both the opening poll and the final vote to compare.', 'warn');
    this.setBusy('shift', true);
    if (this.transport.kind === 'supabase') {
      await this.fetchRemoteTally(a);
      await this.fetchRemoteTally(b);
    }
    const findPoll = (id: string) => (this.state.poll?.id === id ? this.state.poll : this.state.pollHistory.find((x) => x.id === id));
    const pa = findPoll(a);
    const pb = findPoll(b);
    if (!pa || !pb) {
      this.setBusy('shift', false);
      return this.toast('Could not find the opening or final poll.', 'error');
    }
    const ra = this.computeResults(a, pa.options);
    const rb = this.computeResults(b, pb.options);
    const initial = this.sideFrom(ra);
    const fin = this.sideFrom(rb);

    // Participant-level comparison: only people who voted in BOTH polls.
    // Manual (show-of-hands) counts are aggregate-only and excluded here.
    let individuals: ShiftData['individuals'] = null;
    const local = { both: 0, changed: 0, toBan: 0, toEmbrace: 0, other: 0 };
    const va = this.priv.votes[a] ?? {};
    const vb = this.priv.votes[b] ?? {};
    for (const [pid, v1] of Object.entries(va)) {
      const v2 = vb[pid];
      if (!v2) continue;
      local.both++;
      if (v1.option !== v2.option) {
        local.changed++;
        if (v2.option === 'ban') local.toBan++;
        else if (v2.option === 'embrace') local.toEmbrace++;
        else local.other++;
      }
    }
    if (this.transport.kind === 'supabase') {
      const remote = await this.transport.shift(this.state.roomCode, this.priv.hostKey, a, b);
      if (remote) {
        individuals = {
          both: remote.both + local.both,
          changed: remote.changed + local.changed,
          toBan: remote.toBan + local.toBan,
          toEmbrace: remote.toEmbrace + local.toEmbrace,
          other: remote.other + local.other,
        };
      }
    } else individuals = local;
    if (individuals && individuals.both === 0) individuals = null;

    const lead = (x: ShiftSide) => (x.n === 0 || x.banPct === 50 ? 'tie' : x.banPct > 50 ? 'ban' : 'embrace');
    const delta = fin.banPct - initial.banPct;
    const headline: ShiftData['headline'] =
      initial.n && fin.n && lead(initial) !== 'tie' && lead(fin) !== 'tie' && lead(initial) !== lead(fin)
        ? 'flipped'
        : Math.abs(delta) >= 5
          ? 'shifting'
          : 'steady';
    const includesSimulated = ra.simulatedTotal + rb.simulatedTotal > 0;
    this.update((s) => {
      s.shift = { initial, final: fin, banDeltaPts: delta, headline, individuals, includesSimulated };
      s.screen = 'shift';
      s.fx = headline === 'flipped' ? { id: uid(), kind: 'confetti' } : { id: uid(), kind: 'flash' };
    });
    this.setBusy('shift', false);
  };

  // ── generic step runner helper ─────────────────────────────
  runStep = (label: string, sec: number, team: TeamId | null, autostart: boolean) => {
    this.timerLoad(label, sec, team, autostart);
  };

  // ── content ────────────────────────────────────────────────
  setContent = (fn: (c: Content) => Content) =>
    this.update((_s, p) => {
      p.content = fn(clone(p.content));
    });
  resetUsed = () => {
    this.updatePriv((p) => (p.used = {}));
    this.toast('Question history reset — every question is available again.', 'ok');
  };
  restoreDefaultContent = () => {
    this.update((_s, p) => {
      p.content = clone(DEFAULT_CONTENT);
    });
    this.toast('Default questions restored.', 'ok');
  };

  // Convenience used by host UI labels.
  roundLabel = () => roundMeta(this.state.round).name;
  other = otherTeam;
}

let engine: HostEngine | null = null;
export function getEngine() {
  if (!engine) engine = new HostEngine();
  return engine;
}
