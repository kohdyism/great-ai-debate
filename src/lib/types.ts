// ─────────────────────────────────────────────────────────────
// Shared types. PublicState is what every screen sees; it never
// contains hidden poll results. PrivateState lives only with the host.
// ─────────────────────────────────────────────────────────────

export type Side = 'for' | 'against';
export const SIDE_LABEL: Record<Side, string> = { for: 'FOR', against: 'AGAINST' };

export interface Team {
  id: string;
  name: string;
}

export interface Question {
  id: string;
  text: string;
}

export interface Topic {
  id: string;
  title: string;
  questions: Question[];
}

export interface Settings {
  prepSec: number;
  /** opening speech */
  speechSec: number;
  /** counter / rebuttal (0 = skip) */
  rebuttalSec: number;
  /** closing summary (0 = skip) */
  summarySec: number;
  /** audience vote countdown; voting closes automatically at 0 */
  voteSec: number;
  winPoints: number;
  drawPoints: number;
  spinMs: number;
}

export interface Debate {
  id: string;
  forTeam: string;
  againstTeam: string;
  questionId: string | null;
  question: string | null;
  /** team id, 'draw', or null while undecided */
  winner: string | null;
}

export interface RoundPlan {
  topicId: string;
  debates: Debate[];
  /** warm-up round: no points */
  practice?: boolean;
}

export interface PracticeSettings {
  enabled: boolean;
  /** number of practice debates (1 … number of teams) */
  debates: number;
  topic: Topic;
}

/** Steps inside one debate (plus the round intro). */
export type SpeechStep = 'for' | 'against' | 'forCounter' | 'againstCounter' | 'againstSummary' | 'forSummary';
export type Step = 'intro' | 'spin' | 'reveal' | 'prep' | SpeechStep | 'verdict' | 'result';

export type ScreenId = 'home' | 'join' | 'show' | 'scoreboard' | 'champion' | 'message';

export interface TimerState {
  label: string;
  side: Side | null;
  baseMs: number;
  totalMs: number;
  startedAt: number | null;
  status: 'idle' | 'running' | 'paused';
}

export type PollVisibility = 'hidden' | 'live' | 'after';

export interface PollOption {
  id: string;
  label: string;
  side?: Side | null;
}

export interface PollResults {
  counts: Record<string, number>;
  real: Record<string, number>;
  simulated: Record<string, number>;
  manual: Record<string, number>;
  total: number;
  realTotal: number;
  simulatedTotal: number;
  manualTotal: number;
}

export interface PollState {
  id: string;
  question: string;
  options: PollOption[];
  debateId: string | null;
  status: 'open' | 'closed';
  visibility: PollVisibility;
  revealed: boolean;
  openedAt: number;
  closedAt: number | null;
  results: PollResults | null;
  voteCount: number;
}

export interface WheelState {
  status: 'idle' | 'spinning' | 'landed';
  spinId: string | null;
  startedAt: number;
  durationMs: number;
  fromDeg: number;
  toDeg: number;
  /** index into the current topic's questions */
  index: number | null;
}

export interface ScoreEntry {
  id: string;
  at: number;
  team: string;
  delta: number;
  reason: string;
}

export interface Fx {
  id: string;
  kind: 'points' | 'confetti' | 'flash' | 'sound';
  team?: string | null;
  delta?: number;
  sound?: string;
}

export type MusicSlot = 'lobby' | 'suspense' | 'celebrate';
export interface MusicSettings {
  on: boolean;
  volume: number;
  /** names of host-uploaded songs (the files live in the host browser) */
  custom: Partial<Record<MusicSlot, string>>;
}

export interface PublicState {
  v: number;
  roomCode: string;
  backend: 'demo' | 'supabase';
  status: 'lobby' | 'live' | 'paused' | 'ended';
  screen: ScreenId;

  teams: Team[];
  topics: Topic[];
  settings: Settings;
  practice: PracticeSettings;
  schedule: RoundPlan[];
  cur: { round: number; debate: number; step: Step };

  scores: Record<string, number>;
  scoreLog: ScoreEntry[];
  timer: TimerState;
  wheel: WheelState;
  poll: PollState | null;
  pollHistory: PollState[];
  message: { title: string; body: string } | null;
  sound: boolean;
  music: MusicSettings;
  fx: Fx | null;
  showScoreboard: boolean;
  audience: { real: number; simulated: number };
  updatedAt: number;
}

export interface VoteRecord {
  participantId: string;
  option: string;
  simulated: boolean;
  at: number;
}

export interface PrivateState {
  hostKey: string;
  votes: Record<string, Record<string, VoteRecord>>;
  remote: Record<string, Record<string, number>>;
  manual: Record<string, Record<string, number>>;
  localParticipants: Record<string, number>;
  simulatedParticipants: number;
  remoteParticipants: number;
}
