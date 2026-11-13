// ─────────────────────────────────────────────────────────────
// Shared types for the whole show.
// PublicState is what every screen (Stage, Host, Audience) sees.
// It must never contain hidden poll results or secrets.
// PrivateState lives only with the host (content, raw votes, keys).
// ─────────────────────────────────────────────────────────────

export type TeamId = 'embrace' | 'ban';
export const TEAMS: TeamId[] = ['embrace', 'ban'];
export const TEAM_NAME: Record<TeamId, string> = { embrace: 'TEAM EMBRACE', ban: 'TEAM BAN' };
export const otherTeam = (t: TeamId): TeamId => (t === 'embrace' ? 'ban' : 'embrace');

export type RoundId = 'pre' | 'r1' | 'r2' | 'r3' | 'r4' | 'roulette' | 'r5';

export const ROUNDS: { id: RoundId; num?: number; name: string; short: string; tagline: string }[] = [
  { id: 'pre', name: 'Pre-show', short: 'PRE-SHOW', tagline: 'Doors open · Join the jury' },
  { id: 'r1', num: 1, name: 'The Opening Gambit', short: 'OPENING GAMBIT', tagline: 'Two teams. Sixty seconds each. Make your case.' },
  { id: 'r2', num: 2, name: 'Fact or Fiction?', short: 'FACT OR FICTION?', tagline: 'Know your stuff — or bluff it.' },
  { id: 'r3', num: 3, name: 'The Hot Seat', short: 'THE HOT SEAT', tagline: 'Real dilemmas. No time to hide.' },
  { id: 'roulette', name: 'AI Roulette', short: 'AI ROULETTE', tagline: 'Spin the wheel. Face the challenge.' },
  { id: 'r4', num: 4, name: "The Devil's Advocate", short: "DEVIL'S ADVOCATE", tagline: 'Argue the side you hate.' },
  { id: 'r5', num: 5, name: 'The Final Verdict', short: 'FINAL VERDICT', tagline: 'Ninety seconds. One last chance.' },
];
export const roundMeta = (id: RoundId) => ROUNDS.find((r) => r.id === id)!;

export type ScreenId =
  | 'home'
  | 'join'
  | 'roundIntro'
  | 'teams'
  | 'fof'
  | 'hotseat'
  | 'devil'
  | 'roulette'
  | 'poll'
  | 'scoreboard'
  | 'final'
  | 'countdown'
  | 'verdict'
  | 'shift'
  | 'champion'
  | 'message';

export interface TimerState {
  label: string;
  team: TeamId | null;
  /** Remaining ms at the moment of startedAt (running) or the frozen remaining ms (paused/idle). */
  baseMs: number;
  /** Full duration, used for progress rings. */
  totalMs: number;
  /** Server-clock epoch ms when the current run began; null when not running. */
  startedAt: number | null;
  status: 'idle' | 'running' | 'paused';
}

export type PollVisibility = 'hidden' | 'live' | 'after';
export type PollPurpose = 'baseline' | 'final' | 'round' | 'quiz' | 'audienceDecides';

export interface PollOption {
  id: string; // 'embrace' | 'ban' | 'neither' | 'fact' | 'fiction' | custom
  label: string;
  team?: TeamId | null;
}

export interface PollResults {
  counts: Record<string, number>; // combined
  real: Record<string, number>; // genuine audience devices
  simulated: Record<string, number>; // demo / rehearsal votes
  manual: Record<string, number>; // show-of-hands entered by host
  total: number;
  realTotal: number;
  simulatedTotal: number;
  manualTotal: number;
}

export interface PollState {
  id: string;
  question: string;
  options: PollOption[];
  purpose: PollPurpose;
  status: 'open' | 'closed';
  visibility: PollVisibility;
  revealed: boolean;
  openedAt: number;
  closedAt: number | null;
  /** Only populated when the host allows results to be seen. */
  results: PollResults | null;
  /** Total votes received so far — always safe to show (no split). */
  voteCount: number;
  correctOption?: string | null; // for audience quiz polls
}

export interface ScoreEntry {
  id: string;
  at: number;
  team: TeamId;
  delta: number;
  reason: string;
  round: RoundId;
  bonus: boolean;
  kind: 'award' | 'override' | 'reset';
}

export interface CardState {
  /** What is on the giant LED panel right now (statement, scenario, challenge). */
  kind: 'fact' | 'debate' | 'scenario' | 'devil' | 'none';
  id: string | null;
  text: string;
  /** Fact-or-fiction answer — only filled in once revealed. */
  answer: 'FACT' | 'FICTION' | null;
  explanation: string | null;
  points: number;
  /** Team answers locked in (fact or fiction). Shown only after reveal. */
  locks: Partial<Record<TeamId, 'FACT' | 'FICTION'>>;
  locksRevealed: boolean;
  /** Devil's advocate: one challenge per team. */
  devil?: Partial<Record<TeamId, string>>;
  revealedAt: number;
}

export interface RouletteState {
  status: 'idle' | 'spinning' | 'landed' | 'revealed';
  spinId: string | null;
  startedAt: number;
  durationMs: number;
  /** Total rotation in degrees the wheel travels during this spin (absolute end angle). */
  fromDeg: number;
  toDeg: number;
  categoryIndex: number | null;
  question: string | null;
  team: TeamId | null;
  stake: number;
  points: number;
}

export interface CountdownState {
  startedAt: number;
  seconds: number;
  label: string;
}

export interface ShiftSide {
  ban: number;
  embrace: number;
  n: number;
  banPct: number;
  embracePct: number;
}
export interface ShiftData {
  initial: ShiftSide;
  final: ShiftSide;
  banDeltaPts: number; // final - initial (percentage points)
  headline: 'flipped' | 'shifting' | 'steady';
  individuals: null | { both: number; changed: number; toBan: number; toEmbrace: number; other: number };
  includesSimulated: boolean;
}

export interface Fx {
  id: string;
  kind: 'points' | 'confetti' | 'flash';
  team?: TeamId | null;
  delta?: number;
}

export interface WheelCat {
  id: string;
  name: string;
  blurb: string;
  mode: RouletteMode;
}

export interface PublicState {
  v: number; // version — monotonically increasing
  roomCode: string;
  backend: 'demo' | 'supabase';
  status: 'lobby' | 'live' | 'paused' | 'ended';
  screen: ScreenId;
  round: RoundId;
  /** Free-form phase label for the current activity, shown to the host and sometimes on stage. */
  phase: string;
  /** Highlighted (speaking/answering) team on stage. */
  spotlight: TeamId | null;
  scores: Record<TeamId, number>;
  roundScores: Partial<Record<RoundId, Record<TeamId, number>>>;
  bonus: Record<TeamId, number>;
  scoreLog: ScoreEntry[];
  timer: TimerState;
  poll: PollState | null;
  pollHistory: PollState[]; // closed polls (results only if revealed)
  baselinePollId: string | null;
  finalPollId: string | null;
  card: CardState;
  roulette: RouletteState;
  /** Wheel segment names (no questions) so the stage can draw the wheel. */
  wheel: WheelCat[];
  countdown: CountdownState | null;
  shift: ShiftData | null;
  verdictRevealed: boolean;
  championRevealed: boolean;
  message: { title: string; body: string } | null;
  sound: boolean;
  fx: Fx | null;
  showScoreboard: boolean;
  /** Audience size — safe to show everywhere. */
  audience: { real: number; simulated: number };
  updatedAt: number;
}

// ── Content (host-editable, stored privately) ─────────────────

export interface FactItem {
  id: string;
  statement: string;
  kind: 'fact' | 'debate';
  answer: 'FACT' | 'FICTION' | null;
  explanation: string;
  points: number;
}

export interface ScenarioItem {
  id: string;
  text: string;
  points: number;
}

export interface DevilItem {
  id: string;
  team: TeamId; // the team that must argue this
  text: string;
  points: number;
}

export type RouletteMode = 'devil' | 'hot' | 'impossible' | 'switch' | 'ten' | 'wild' | 'audience' | 'double';

export interface RouletteCategory {
  id: string;
  name: string;
  mode: RouletteMode;
  blurb: string;
  questions: { id: string; text: string }[];
}

export interface Settings {
  openingSec: number;
  closingSec: number;
  prepSec: number;
  responseSec: number;
  challengeSec: number;
  tenSec: number;
  pollPoints: number;
  rouletteSpinMs: number;
  doubleStake: number;
  roulettePoints: number;
  devilBonus: number;
}

export interface Content {
  facts: FactItem[];
  scenarios: ScenarioItem[];
  devil: DevilItem[];
  roulette: RouletteCategory[];
  settings: Settings;
}

export interface VoteRecord {
  participantId: string;
  option: string;
  simulated: boolean;
  at: number;
}

export interface PrivateState {
  hostKey: string;
  content: Content;
  used: Record<string, true>;
  /** Demo/local votes and all simulated votes: pollId -> participantId -> vote. */
  votes: Record<string, Record<string, VoteRecord>>;
  /** Real-device tallies fetched from the server per poll (never published unless allowed). */
  remote: Record<string, Record<string, number>>;
  manual: Record<string, Record<string, number>>;
  /** Local (same-browser) participants, demo mode only. */
  localParticipants: Record<string, number>;
  simulatedParticipants: number;
  remoteParticipants: number;
}
