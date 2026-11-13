// ─────────────────────────────────────────────────────────────
// HostEngine — the single source of truth for the show.
// The host window owns the state; every change is versioned,
// saved locally (refresh recovery) and pushed to the transport
// (BroadcastChannel in demo mode, Supabase in live mode).
// ─────────────────────────────────────────────────────────────
import { DEFAULT_PRACTICE, DEFAULT_SETTINGS, DEFAULT_TOPICS, buildSchedule, debateFlow, makeTeams, speechOf, speechSec } from './content';
import { now, setClockOffset, timerRemaining } from './time';
import { getLocalBus, getTransport, type ConnStatus, type DemoRequest, type Transport, type VoteResult } from './transport';
import type {
  Debate,
  MusicSlot,
  PollOption,
  PracticeSettings,
  PollResults,
  PollState,
  PrivateState,
  PublicState,
  ScreenId,
  Settings,
  Side,
  Step,
  Team,
  TimerState,
  Topic,
  WheelState,
} from './types';
import { clone, makeRoomCode, makeSecret, pick, safeJson, safeRemove, safeSet, uid } from './util';

const PUB_KEY = 'gad:host:public:v2';
const PRIV_KEY = 'gad:host:private:v2';
export const HOST_PUB_KEY = PUB_KEY;

const emptyTimer = (sec = 60, label = 'Timer', side: Side | null = null): TimerState => ({
  label,
  side,
  baseMs: sec * 1000,
  totalMs: sec * 1000,
  startedAt: null,
  status: 'idle',
});
const emptyWheel = (): WheelState => ({ status: 'idle', spinId: null, startedAt: 0, durationMs: 0, fromDeg: 0, toDeg: 0, index: null });

export function initialPublic(roomCode: string, backend: 'demo' | 'supabase'): PublicState {
  const teams = makeTeams(4);
  const topics = clone(DEFAULT_TOPICS);
  return {
    v: 1,
    roomCode,
    backend,
    status: 'lobby',
    screen: 'home',
    teams,
    topics,
    settings: { ...DEFAULT_SETTINGS },
    practice: clone(DEFAULT_PRACTICE),
    schedule: buildSchedule(teams, topics, DEFAULT_PRACTICE),
    cur: { round: 0, debate: 0, step: 'intro' },
    scores: Object.fromEntries(teams.map((t) => [t.id, 0])),
    scoreLog: [],
    timer: emptyTimer(60),
    wheel: emptyWheel(),
    poll: null,
    pollHistory: [],
    message: null,
    sound: true,
    music: { on: true, volume: 0.5, custom: {} },
    fx: null,
    showScoreboard: true,
    audience: { real: 0, simulated: 0 },
    updatedAt: Date.now(),
  };
}

function initialPrivate(): PrivateState {
  return { hostKey: makeSecret(), votes: {}, remote: {}, manual: {}, localParticipants: {}, simulatedParticipants: 0, remoteParticipants: 0 };
}

// ── helpers usable by every screen ───────────────────────────
export const teamName = (s: PublicState, id: string | null | undefined) => s.teams.find((t) => t.id === id)?.name ?? '—';
export const currentRound = (s: PublicState) => s.schedule[s.cur.round] ?? null;
export const topicOf = (s: PublicState, r: { topicId: string; practice?: boolean } | null): Topic | null =>
  !r ? null : r.practice ? s.practice.topic : s.topics.find((t) => t.id === r.topicId) ?? null;
export const currentTopic = (s: PublicState): Topic | null => topicOf(s, currentRound(s));
export const isPractice = (s: PublicState) => !!currentRound(s)?.practice;
/** "PRACTICE ROUND" or "ROUND 2 OF 3" (practice doesn't count towards numbering). */
export function roundLabel(s: PublicState, ri = s.cur.round, withTotal = true): string {
  const r = s.schedule[ri];
  if (r?.practice) return 'PRACTICE ROUND';
  const offset = s.schedule[0]?.practice ? 1 : 0;
  const total = s.schedule.length - offset;
  return `ROUND ${ri - offset + 1}${withTotal ? ` OF ${total}` : ''}`;
}
export const currentDebate = (s: PublicState): Debate | null => currentRound(s)?.debates[s.cur.debate] ?? null;
export const isLastDebate = (s: PublicState) => {
  const r = currentRound(s);
  return !!r && s.cur.debate >= r.debates.length - 1;
};
export const isLastRound = (s: PublicState) => s.cur.round >= s.schedule.length - 1;
export const usedQuestionIds = (s: PublicState) => new Set((currentRound(s)?.debates ?? []).map((d) => d.questionId).filter(Boolean) as string[]);
export const showFinished = (s: PublicState) => s.cur.step === 'result' && isLastDebate(s) && isLastRound(s);

/** Human description of what NEXT will do — shown on the big button. */
export function nextLabel(s: PublicState): string {
  const d = currentDebate(s);
  if (s.screen === 'home') return s.status === 'lobby' ? 'Start the show → show the join QR code' : 'Back to the debates';
  if (s.screen === 'join') return s.cur.step === 'intro' && s.cur.debate === 0 && s.cur.round === 0 ? 'Begin Round 1' : 'Back to the debates';
  if (s.screen === 'message') return 'Back to the debates';
  if (s.screen === 'champion') return 'Show complete 🎉';
  if (s.screen === 'scoreboard') return showFinished(s) ? 'Crown the champion 🏆' : 'Back to the debates';
  const step = s.cur.step;
  if (step === 'intro') return 'Spin for Debate 1';
  if (step === 'spin') return s.wheel.status === 'spinning' ? 'Spinning…' : 'SPIN THE WHEEL';
  if (step === 'verdict') return d?.winner ? 'Show the result' : 'Pick a winner first ↓';
  if (step === 'result') {
    if (!isLastDebate(s)) return `Next: Debate ${s.cur.debate + 2}`;
    if (!isLastRound(s)) return `Next: ${roundLabel(s, s.cur.round + 1, false).toLowerCase().replace('round', 'Round')}`;
    return 'Final scoreboard';
  }
  const flow = debateFlow(s.settings);
  const nxt = flow[flow.indexOf(step) + 1];
  if (nxt === 'prep') return `Start ${s.settings.prepSec}s preparation`;
  if (nxt === 'verdict') return 'Decide who won';
  const sp = speechOf(nxt);
  if (sp) {
    const team = teamName(s, sp.side === 'for' ? d?.forTeam : d?.againstTeam);
    return `${team}: ${sp.side.toUpperCase()} ${sp.kind.toLowerCase()} (${speechSec(s.settings, sp.secKey)}s)`;
  }
  return 'Next';
}

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
}

export class HostEngine {
  state: PublicState;
  priv: PrivateState;
  transport: Transport;
  private conn: ConnStatus;
  private lastPushOk = true;
  private ready = false;
  private toasts: Toast[] = [];
  private listeners = new Set<() => void>();
  private snap!: Snapshot;
  private pushing = false;
  private pendingPush = false;
  private pushWaiters: (() => void)[] = [];
  private spinTimer: ReturnType<typeof setTimeout> | null = null;
  private loops: ReturnType<typeof setInterval>[] = [];

  constructor() {
    this.transport = getTransport();
    this.conn = this.transport.status;
    const savedPub = safeJson<PublicState>(PUB_KEY);
    const savedPriv = safeJson<PrivateState>(PRIV_KEY);
    const backend = this.transport.kind;
    if (savedPub && savedPriv && savedPub.backend === backend) {
      this.state = { ...initialPublic(savedPub.roomCode, backend), ...savedPub };
      this.state.settings = { ...DEFAULT_SETTINGS, ...savedPub.settings };
      this.state.music = Object.assign({ on: true, volume: 0.5, custom: {} }, savedPub.music ?? {});
      // Replace the earlier example topics with the new defaults if the show hasn't started.
      const OLD_DEFAULTS = ['AI & Work', 'AI & Creativity', 'AI in Everyday Life', 'AI & the Future of Work', 'AI & ASSESSMENT', 'AI IN TEACHING & LEARNING', 'THE FUTURE OF UNIVERSITIES'];
      const fresh = savedPub.schedule.every((r) => r.debates.every((d) => !d.question && !d.winner));
      if (fresh && savedPub.topics.some((t) => t.title === 'AI & Creativity' || t.title === 'AI IN TEACHING & LEARNING') && savedPub.topics.every((t) => OLD_DEFAULTS.includes(t.title))) {
        this.state.topics = clone(DEFAULT_TOPICS);
        this.state.schedule = buildSchedule(this.state.teams, this.state.topics, savedPub.practice ?? DEFAULT_PRACTICE);
      }
      // Swap the few earlier example statements that research doesn't support for evidence-safe versions.
      const FIX: Record<string, string> = {
        'AI makes the workplace fairer.': 'AI will make the workplace fairer.',
        'AI skills matter more than a degree.': 'AI skills will matter more than a degree.',
        'AI tutors are better than human teachers.': 'AI tutors should replace some human teaching.',
        'AI makes education fairer.': 'AI will make education fairer.',
        'AI makes the rich richer.': 'AI will widen the gap between rich and poor.',
        'Breakfast is the most important meal.': 'Every student should take a gap year.',
      };
      const fixTopic = (t: Topic) => ({ ...t, questions: t.questions.map((q) => (FIX[q.text] ? { ...q, text: FIX[q.text] } : q)) });
      this.state.topics = this.state.topics.map(fixTopic);
      if (this.state.practice) this.state.practice = { ...this.state.practice, topic: fixTopic(this.state.practice.topic) };
      for (const r of this.state.schedule) for (const d of r.debates) if (d.question && FIX[d.question] && !d.winner) d.question = FIX[d.question];
      if (!savedPub.practice) {
        // Older saved show: add the practice round if nothing has been played yet.
        this.state.practice = clone(DEFAULT_PRACTICE);
        const untouched = savedPub.schedule.every((r) => r.debates.every((d) => !d.question && !d.winner));
        if (untouched) {
          this.state.schedule = buildSchedule(savedPub.teams, savedPub.topics, this.state.practice);
          this.state.cur = { round: 0, debate: 0, step: 'intro' };
        } else this.state.practice.enabled = false;
      }
      this.priv = { ...initialPrivate(), ...savedPriv };
    } else {
      this.state = initialPublic(makeRoomCode(), backend);
      this.priv = initialPrivate();
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
    this.snap = { state: this.state, priv: this.priv, conn: this.conn, lastPushOk: this.lastPushOk, ready: this.ready, toasts: this.toasts };
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
    }, tone === 'error' ? 7000 : 3500);
  }

  update(fn: (s: PublicState, p: PrivateState) => void) {
    const s = clone(this.state);
    const p = { ...this.priv };
    fn(s, p);
    this.publishResults(s, p);
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
      setTimeout(() => {
        if (!this.pushing) void this.doPush();
      }, 2000);
      return;
    }
    const w = this.pushWaiters;
    this.pushWaiters = [];
    w.forEach((f) => f());
  }
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
    getLocalBus().setHandler((req) => this.handleLocal(req));
    this.loops.push(setInterval(() => void this.pollTallies(), 1500));
    this.loops.push(setInterval(() => void this.pollParticipants(), 5000));
    void this.pollParticipants();
    const w = this.state.wheel;
    if (w.status === 'spinning') {
      this.spinTimer = setTimeout(() => this.landSpin(w.spinId!), Math.max(0, w.startedAt + w.durationMs - now()));
    }
    this.ready = true;
    this.persist();
    this.emit();
    this.schedulePush();
  }
  destroy() {
    this.loops.forEach(clearInterval);
    this.loops = [];
    getLocalBus().setHandler(null);
  }

  private async ensureRemoteEvent() {
    const remote = await this.transport.fetchState(this.state.roomCode);
    if (remote) {
      if (remote.v > this.state.v && (remote as PublicState).teams) this.state = { ...this.state, ...remote };
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

  private handleLocal(req: DemoRequest): any {
    if (req.type === 'cmd') {
      if (req.cmd === 'start') this.next();
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
    const real = this.transport.kind === 'demo' ? Object.keys(this.priv.localParticipants).length : this.priv.remoteParticipants;
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
    const t = await this.transport.tallies(this.state.roomCode, this.priv.hostKey, poll.id);
    if (!t) return;
    if (JSON.stringify(this.priv.remote[poll.id] ?? {}) !== JSON.stringify(t.counts)) {
      this.update((_s, p) => {
        p.remote = { ...p.remote, [poll.id]: t.counts };
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
      const b = v.simulated ? simulated : real;
      if (v.option in b) b[v.option]++;
    }
    for (const [k, n] of Object.entries(p.remote[pollId] ?? {})) if (k in real) real[k] += n;
    for (const [k, n] of Object.entries(p.manual[pollId] ?? {})) if (k in manual) manual[k] += Math.max(0, n | 0);
    const counts = zero();
    for (const k of Object.keys(counts)) counts[k] = real[k] + simulated[k] + manual[k];
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    return { counts, real, simulated, manual, total: sum(counts), realTotal: sum(real), simulatedTotal: sum(simulated), manualTotal: sum(manual) };
  }
  private publishResults(s: PublicState, p: PrivateState) {
    const apply = (poll: PollState) => {
      const r = this.computeResults(poll.id, poll.options, p);
      poll.voteCount = r.total;
      poll.results = poll.revealed || poll.visibility === 'live' ? r : null;
    };
    if (s.poll) apply(s.poll);
    s.pollHistory.forEach(apply);
  }

  // ═════════════════════════════════════════════════════════
  // THE SHOW FLOW — one NEXT button walks through everything
  // ═════════════════════════════════════════════════════════
  next = () => {
    const s = this.state;
    if (s.screen === 'home' && s.status === 'lobby') {
      return this.update((x) => {
        x.status = 'live';
        x.screen = 'join';
        x.fx = { id: uid(), kind: 'flash' };
      });
    }
    if (s.screen === 'home' || s.screen === 'join' || s.screen === 'message')
      return this.update((x) => {
        x.screen = 'show';
        x.status = 'live';
        x.fx = { id: uid(), kind: 'flash' };
      });
    if (s.screen === 'scoreboard' || s.screen === 'champion') {
      if (showFinished(s)) return this.showChampion();
      return this.update((x) => void (x.screen = 'show'));
    }
    const d = currentDebate(s);
    switch (s.cur.step) {
      case 'intro':
        return this.goStep('spin');
      case 'spin':
        if (s.wheel.status === 'landed' && d?.question) return this.goStep('reveal');
        return this.spin();
      case 'verdict':
        if (!d?.winner) return this.toast('Pick the winner of this debate first (or Draw).', 'warn');
        return this.goStep('result');
      case 'result':
        if (!isLastDebate(s)) return this.goDebate(s.cur.round, s.cur.debate + 1);
        if (!isLastRound(s)) return this.goRound(s.cur.round + 1);
        return this.update((x) => {
          x.screen = 'scoreboard';
          x.fx = { id: uid(), kind: 'flash' };
        });
      default: {
        // reveal → prep → openings → counters → summaries → verdict
        const flow = debateFlow(s.settings);
        const nxt = flow[flow.indexOf(s.cur.step) + 1];
        if (nxt) return this.goStep(nxt);
      }
    }
  };

  /** Jump to a step of the current debate (loads timers etc.). */
  goStep = (step: Step) => {
    const st = this.state.settings;
    this.update((s) => {
      const d = currentDebate(s);
      s.screen = 'show';
      s.cur.step = step;
      if (s.status === 'lobby') s.status = 'live';
      if (step === 'intro' || step === 'spin') {
        s.timer = emptyTimer(st.prepSec, 'Preparation');
        s.fx = { id: uid(), kind: 'flash' };
      }
      if (step === 'reveal') s.timer = emptyTimer(st.prepSec, 'Preparation');
      if (step === 'prep') s.timer = { ...emptyTimer(st.prepSec, 'Preparation'), startedAt: now(), status: 'running' };
      const sp = speechOf(step);
      if (sp) {
        const team = teamName(s, sp.side === 'for' ? d?.forTeam : d?.againstTeam);
        s.timer = { ...emptyTimer(speechSec(st, sp.secKey), `${team} · ${sp.side.toUpperCase()} ${sp.kind}`, sp.side), startedAt: now(), status: 'running' };
      }
      if ((step === 'verdict' || step === 'result') && s.timer.status === 'running') {
        s.timer = { ...s.timer, baseMs: timerRemaining(s.timer), startedAt: null, status: 'paused' };
      }
      if (step === 'result' && d?.winner) s.fx = { id: uid(), kind: 'confetti' };
    });
  };

  goDebate = (round: number, debate: number) => {
    this.update((s) => {
      s.cur = { round, debate, step: 'spin' };
      s.screen = 'show';
      if (s.status === 'lobby') s.status = 'live';
      const d = currentDebate(s);
      const topic = currentTopic(s);
      const idx = d?.questionId && topic ? topic.questions.findIndex((q) => q.id === d.questionId) : -1;
      if (d?.question && topic && idx >= 0) {
        const seg = 360 / topic.questions.length;
        const target = ((-(idx + 0.5) * seg) % 360 + 360) % 360;
        s.wheel = { ...emptyWheel(), status: 'landed', index: idx, fromDeg: target, toDeg: target, spinId: uid('set') };
        s.cur.step = d.winner ? 'result' : 'reveal';
      } else {
        s.wheel = { ...emptyWheel(), toDeg: s.wheel.toDeg, fromDeg: s.wheel.toDeg };
      }
      s.timer = emptyTimer(s.settings.prepSec, 'Preparation');
      s.fx = { id: uid(), kind: 'flash' };
    });
  };
  goRound = (round: number) =>
    this.update((s) => {
      s.cur = { round, debate: 0, step: 'intro' };
      s.screen = 'show';
      if (s.status === 'lobby') s.status = 'live';
      s.wheel = { ...emptyWheel(), toDeg: s.wheel.toDeg, fromDeg: s.wheel.toDeg };
      s.timer = emptyTimer(s.settings.prepSec, 'Preparation');
      s.fx = { id: uid(), kind: 'flash' };
    });

  // ── wheel ──────────────────────────────────────────────────
  isSpinning = () => {
    const w = this.state.wheel;
    return w.status === 'spinning' && now() < w.startedAt + w.durationMs + 200;
  };
  spin = (forceIndex?: number) => {
    if (this.isSpinning()) return;
    const topic = currentTopic(this.state);
    if (!topic || !topic.questions.length) return this.toast('This round’s topic has no questions — add some in Setup.', 'warn');
    const n = topic.questions.length;
    const used = usedQuestionIds(this.state);
    const d = currentDebate(this.state);
    if (d?.questionId) used.delete(d.questionId);
    let pool = topic.questions.map((_, i) => i).filter((i) => !used.has(topic.questions[i].id));
    if (!pool.length) pool = topic.questions.map((_, i) => i);
    const idx = forceIndex ?? pick(pool);
    const seg = 360 / n;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = (((-(idx + 0.5) * seg - jitter) % 360) + 360) % 360;
    const from = ((this.state.wheel.toDeg % 360) + 360) % 360;
    const to = from + 360 * 5 + ((target - from + 360) % 360);
    const spinId = uid('spin');
    const dur = this.state.settings.spinMs;
    this.update((s) => {
      s.screen = 'show';
      s.cur.step = 'spin';
      s.wheel = { status: 'spinning', spinId, startedAt: now() + 150, durationMs: dur, fromDeg: from, toDeg: to, index: idx };
      const dd = currentDebate(s);
      if (dd) {
        dd.questionId = null;
        dd.question = null;
      }
    });
    if (this.spinTimer) clearTimeout(this.spinTimer);
    this.spinTimer = setTimeout(() => this.landSpin(spinId), dur + 200);
  };
  private landSpin(spinId: string) {
    if (this.state.wheel.spinId !== spinId || this.state.wheel.status !== 'spinning') return;
    this.update((s) => {
      s.wheel.status = 'landed';
      const topic = currentTopic(s);
      const d = currentDebate(s);
      const q = topic && s.wheel.index != null ? topic.questions[s.wheel.index] : null;
      if (d && q) {
        d.questionId = q.id;
        d.question = q.text;
      }
      s.cur.step = 'reveal';
      s.timer = emptyTimer(s.settings.prepSec, 'Preparation');
    });
  }

  // ── verdict / scores ───────────────────────────────────────
  setWinner = (winner: string | null) => {
    const s = this.state;
    const d = currentDebate(s);
    if (!d) return;
    const prev = d.winner;
    if (prev === winner) return;
    const st = s.settings;
    const pts = (w: string | null): Record<string, number> =>
      w === 'draw' ? { [d.forTeam]: st.drawPoints, [d.againstTeam]: st.drawPoints } : w ? { [w]: st.winPoints } : {};
    const before = pts(prev);
    const after = pts(winner);
    const label = `${roundLabel(s, s.cur.round, false)} · Debate ${s.cur.debate + 1}`;
    const practice = isPractice(s);
    this.update((x) => {
      const dd = currentDebate(x)!;
      dd.winner = winner;
      if (practice) return; // practice round: no points
      for (const [t, n] of Object.entries(before)) this.addPoints(x, t, -n, `${label}: result changed`);
      for (const [t, n] of Object.entries(after)) this.addPoints(x, t, n, `${label}: ${winner === 'draw' ? 'draw' : 'won'}`);
      const top = Object.entries(after)[0];
      if (top && winner !== 'draw') x.fx = { id: uid(), kind: 'points', team: top[0], delta: top[1] };
    });
  };
  private addPoints(s: PublicState, team: string, delta: number, reason: string) {
    if (!delta) return;
    s.scores[team] = (s.scores[team] ?? 0) + delta;
    s.scoreLog = [...s.scoreLog, { id: uid('s'), at: now(), team, delta, reason }].slice(-300);
  }
  /** Restart the current debate: undo its points, clear its question and vote, back to the wheel. */
  restartDebate = () => {
    const d = currentDebate(this.state);
    if (!d) return;
    if (d.winner) this.setWinner(null);
    if (this.spinTimer) clearTimeout(this.spinTimer);
    this.update((s) => {
      const dd = currentDebate(s)!;
      dd.questionId = null;
      dd.question = null;
      dd.winner = null;
      if (s.poll?.debateId === dd.id) s.poll = null;
      s.pollHistory = s.pollHistory.filter((p) => p.debateId !== dd.id);
      s.cur.step = 'spin';
      s.screen = 'show';
      s.wheel = { ...emptyWheel(), toDeg: s.wheel.toDeg, fromDeg: s.wheel.toDeg };
      s.timer = emptyTimer(s.settings.prepSec, 'Preparation');
      s.fx = { id: uid(), kind: 'flash' };
    });
    this.toast('Debate restarted — spin the wheel again.', 'ok');
  };
  adjust = (team: string, delta: number) =>
    this.update((s) => {
      this.addPoints(s, team, delta, 'Host adjustment');
      s.fx = { id: uid(), kind: 'points', team, delta };
    });

  // ── audience vote for the current debate ───────────────────
  openDebateVote = () => {
    const s = this.state;
    const d = currentDebate(s);
    if (!d) return;
    if (s.poll?.status === 'open') return this.toast('A vote is already open.', 'warn');
    this.update((x) => {
      if (x.poll) x.pollHistory = [...x.pollHistory.filter((p) => p.id !== x.poll!.id), x.poll].slice(-30);
      x.poll = {
        id: uid('p'),
        question: 'Who won this debate?',
        options: [
          { id: d.forTeam, label: `${teamName(x, d.forTeam)} (FOR)`, side: 'for' },
          { id: d.againstTeam, label: `${teamName(x, d.againstTeam)} (AGAINST)`, side: 'against' },
        ],
        debateId: d.id,
        status: 'open',
        visibility: 'hidden',
        revealed: false,
        openedAt: now(),
        closedAt: null,
        results: null,
        voteCount: 0,
      };
      x.screen = 'show';
      x.cur.step = 'verdict';
      if (x.timer.status === 'running') x.timer = { ...x.timer, baseMs: timerRemaining(x.timer), startedAt: null, status: 'paused' };
    });
  };
  closeVote = async () => {
    const poll = this.state.poll;
    if (!poll || poll.status !== 'open') return;
    this.update((s) => {
      s.poll!.status = 'closed';
      s.poll!.closedAt = now();
      s.poll!.revealed = true;
    });
    await this.flush();
    await this.pollTallies(true);
    // Apply the audience's choice as the debate winner (host can still change it).
    const d = currentDebate(this.state);
    const p = this.state.poll;
    if (d && p && p.debateId === d.id) {
      const r = this.computeResults(p.id, p.options);
      const a = r.counts[d.forTeam] ?? 0;
      const b = r.counts[d.againstTeam] ?? 0;
      if (r.total > 0) this.setWinner(a === b ? 'draw' : a > b ? d.forTeam : d.againstTeam);
      else this.toast('No votes were cast — pick the winner yourself.', 'warn');
    }
  };
  setManualCount = (option: string, n: number) =>
    this.update((s, p) => {
      if (!s.poll) return;
      p.manual = { ...p.manual, [s.poll.id]: { ...(p.manual[s.poll.id] ?? {}), [option]: Math.max(0, Math.floor(n) || 0) } };
    });
  simulateVotes = (n: number) => {
    const poll = this.state.poll;
    if (!poll || poll.status !== 'open') return this.toast('Open a vote first.', 'warn');
    const voted = this.priv.votes[poll.id] ?? {};
    const simVoted = Object.keys(voted).filter((k) => k.startsWith('sim-')).length;
    const need = Math.max(0, n - (this.priv.simulatedParticipants - simVoted));
    if (need > 0) this.updatePriv((p) => (p.simulatedParticipants += need));
    this.refreshAudience();
    const ids: string[] = [];
    for (let i = 1; i <= this.priv.simulatedParticipants && ids.length < n; i++) if (!voted[`sim-${i}`]) ids.push(`sim-${i}`);
    const lean = pick(poll.options).id;
    ids.forEach((id, i) =>
      setTimeout(() => this.recordLocalVote(id, poll.id, Math.random() < 0.6 ? lean : pick(poll.options).id, true), Math.floor(i / 3) * 120),
    );
  };

  // ── timer ──────────────────────────────────────────────────
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
      if (timerRemaining(s.timer) + add < 0) return;
      s.timer = { ...s.timer, baseMs: s.timer.baseMs + add, totalMs: Math.max(1000, s.timer.totalMs + add) };
    });

  // ── screens / extras ───────────────────────────────────────
  setScreen = (screen: ScreenId) =>
    this.update((s) => {
      s.screen = screen;
      if (screen !== 'home' && s.status === 'lobby') s.status = 'live';
    });
  showChampion = () =>
    this.update((s) => {
      s.screen = 'champion';
      s.status = 'live';
      s.fx = { id: uid(), kind: 'confetti' };
    });
  setMessage = (title: string, body: string) =>
    this.update((s) => {
      s.message = { title, body };
      s.screen = 'message';
    });
  toggleSound = () => this.update((s) => void (s.sound = !s.sound));
  toggleMusic = () => this.update((s) => void (s.music = { ...s.music, on: !s.music.on }));
  setMusicVolume = (v: number) => this.update((s) => void (s.music = { ...s.music, volume: Math.max(0, Math.min(1, v)) }));
  setCustomTrack = (slot: MusicSlot, name: string | null) =>
    this.update((s) => {
      const custom = { ...s.music.custom };
      if (name) custom[slot] = name;
      else delete custom[slot];
      s.music = { ...s.music, custom };
    });
  playSound = (name: string) => this.update((s) => void (s.fx = { id: uid(), kind: 'sound', sound: name }));
  fireConfetti = () => this.update((s) => void (s.fx = { id: uid(), kind: 'confetti' }));
  pauseShow = () =>
    this.update((s) => {
      if (s.timer.status === 'running') s.timer = { ...s.timer, baseMs: timerRemaining(s.timer), startedAt: null, status: 'paused' };
      s.status = 'paused';
    });
  resumeShow = () => this.update((s) => void (s.status = 'live'));

  // ── setup ──────────────────────────────────────────────────
  /** Save setup. Changing the number of teams or topics rebuilds the schedule and resets scores. */
  applySetup = (teams: Team[], topics: Topic[], settings: Settings, practice: PracticeSettings) => {
    const s = this.state;
    const sameShape =
      teams.length === s.teams.length &&
      teams.every((t, i) => t.id === s.teams[i].id) &&
      topics.length === s.topics.length &&
      topics.every((t, i) => t.id === s.topics[i].id) &&
      practice.enabled === s.practice.enabled &&
      (!practice.enabled || practice.debates === s.practice.debates);
    this.update((x) => {
      x.teams = teams;
      x.topics = topics;
      x.settings = settings;
      x.practice = practice;
      if (!sameShape) {
        x.schedule = buildSchedule(teams, topics, practice);
        x.scores = Object.fromEntries(teams.map((t) => [t.id, 0]));
        x.scoreLog = [];
        x.cur = { round: 0, debate: 0, step: 'intro' };
        x.wheel = emptyWheel();
        x.poll = null;
        x.pollHistory = [];
      } else {
        for (const r of x.schedule)
          for (const d of r.debates) {
            const q = [...topics, practice.topic].flatMap((t) => t.questions).find((qq) => qq.id === d.questionId);
            if (q) d.question = q.text;
          }
      }
    });
    this.toast(sameShape ? 'Setup saved.' : 'Setup saved — new schedule created, scores reset.', 'ok');
    return !sameShape;
  };

  resetShow = () => {
    if (this.spinTimer) clearTimeout(this.spinTimer);
    const { teams, topics, settings, practice, music, roomCode, v, sound } = this.state;
    this.update((s, p) => {
      Object.assign(s, initialPublic(roomCode, this.transport.kind), { v, sound, music, teams, topics, settings, practice });
      s.schedule = buildSchedule(teams, topics, practice);
      s.scores = Object.fromEntries(teams.map((t) => [t.id, 0]));
      p.votes = {};
      p.remote = {};
      p.manual = {};
      p.simulatedParticipants = 0;
    });
    this.refreshAudience();
    this.toast('Show restarted from the beginning. Teams and questions kept.', 'ok');
  };
  newRoom = async () => {
    const { teams, topics, settings, practice } = this.state;
    safeRemove(PUB_KEY);
    this.priv = initialPrivate();
    this.state = { ...initialPublic(makeRoomCode(), this.transport.kind), teams, topics, settings, practice, v: this.state.v + 1 };
    this.state.schedule = buildSchedule(teams, topics, practice);
    this.state.scores = Object.fromEntries(teams.map((t) => [t.id, 0]));
    if (this.transport.kind === 'supabase') await this.ensureRemoteEvent();
    this.persist();
    this.emit();
    this.schedulePush();
    this.toast(`New room created: ${this.state.roomCode}`, 'ok');
  };
}

let engine: HostEngine | null = null;
export function getEngine() {
  if (!engine) engine = new HostEngine();
  return engine;
}
