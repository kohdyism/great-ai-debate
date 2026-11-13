import type { Debate, PracticeSettings, RoundPlan, Settings, Side, SpeechStep, Step, Team, Topic } from './types';

/** Proper debate order: openings (FOR first), counters, then summaries (AGAINST first, FOR has the last word). */
export const SPEECHES: { step: SpeechStep; side: Side; kind: 'OPENING' | 'COUNTER' | 'SUMMARY'; secKey: 'speechSec' | 'rebuttalSec' | 'summarySec' }[] = [
  { step: 'for', side: 'for', kind: 'OPENING', secKey: 'speechSec' },
  { step: 'against', side: 'against', kind: 'OPENING', secKey: 'speechSec' },
  { step: 'forCounter', side: 'for', kind: 'COUNTER', secKey: 'rebuttalSec' },
  { step: 'againstCounter', side: 'against', kind: 'COUNTER', secKey: 'rebuttalSec' },
  { step: 'againstSummary', side: 'against', kind: 'SUMMARY', secKey: 'summarySec' },
  { step: 'forSummary', side: 'for', kind: 'SUMMARY', secKey: 'summarySec' },
];
export const speechOf = (step: Step) => SPEECHES.find((x) => x.step === step) ?? null;
export const speechSec = (s: Settings, secKey: 'speechSec' | 'rebuttalSec' | 'summarySec') => s[secKey] ?? 30;
/** The step order of one debate, skipping counters/summaries set to 0 seconds. */
export function debateFlow(s: Settings): Step[] {
  return ['spin', 'reveal', 'prep', ...SPEECHES.filter((x) => speechSec(s, x.secKey) > 0).map((x) => x.step), 'verdict', 'result'];
}
import { uid } from './util';

const q = (text: string, i: number, t: string) => ({ id: `${t}-q${i + 1}`, text });
const topic = (id: string, title: string, qs: string[]): Topic => ({ id, title, questions: qs.map((x, i) => q(x, i, id)) });

/** Example content — every question is a statement teams can argue FOR or AGAINST. Edit in Host → Setup. */
export const DEFAULT_TOPICS: Topic[] = [
  topic('t1', 'AI & Work', [
    'AI will take more jobs than it creates.',
    'Companies should be free to replace workers with AI.',
    'Using AI at work is cheating.',
    'AI will make the workplace fairer.',
    'AI should never decide who gets hired.',
    'AI skills will matter more than a degree.',
  ]),
  topic('t2', 'AI & Education', [
    'AI should be banned from universities.',
    'AI makes students lazy.',
    'AI tutors should replace some human teaching.',
    'Using AI for coursework is cheating.',
    'AI will make education fairer.',
    'Exams should go back to pen and paper.',
  ]),
  topic('t3', 'AI & Society', [
    'AI does more harm than good to society.',
    'AI should be strictly regulated by governments.',
    'AI will widen the gap between rich and poor.',
    'We rely on AI too much.',
    'Humans should always have the final say over AI.',
    'Big tech has too much power over AI.',
  ]),
];

/** Light-hearted warm-up so teams learn the format and the audience learns to vote. */
export const DEFAULT_PRACTICE: PracticeSettings = {
  enabled: true,
  debates: 1,
  topic: topic('practice', 'Warm-up: Just for Fun', [
    'Cats are better than dogs.',
    'Pineapple belongs on pizza.',
    'Summer is better than winter.',
    'Every student should take a gap year.',
    'Homework should be banned.',
    'Texting is better than calling.',
  ]),
};

export const DEFAULT_SETTINGS: Settings = {
  prepSec: 30,
  speechSec: 60,
  rebuttalSec: 30,
  summarySec: 30,
  winPoints: 10,
  drawPoints: 5,
  spinMs: 6000,
};

export const makeTeams = (n: number, existing: Team[] = []): Team[] =>
  Array.from({ length: n }, (_, i) => existing[i] ?? { id: `team${i + 1}`, name: `Team ${i + 1}` });

/**
 * Fair schedule: with N teams, each round has N debates.
 * Debate i: FOR = team i, AGAINST = team (i + k) mod N.
 * → every team argues FOR exactly once and AGAINST exactly once per round.
 * k changes each round (1, 2, … N−1) so teams meet different opponents.
 * Debates are ordered so the same team rarely speaks twice in a row.
 */
export function buildSchedule(teams: Team[], topics: Topic[], practice?: PracticeSettings | null): RoundPlan[] {
  const n = teams.length;
  const roundFor = (t: Topic, r: number): RoundPlan => {
    const k = n > 1 ? 1 + (r % (n - 1)) : 0;
    const pairs: Debate[] = teams.map((_, i) => ({
      id: uid('d'),
      forTeam: teams[i].id,
      againstTeam: teams[(i + k) % n].id,
      questionId: null,
      question: null,
      winner: null,
    }));
    // Reorder: every other debate first (0,2,4…,1,3,5…) so the same team rarely speaks twice in a row.
    const order = n > 3 ? [...pairs.filter((_, i) => i % 2 === 0), ...pairs.filter((_, i) => i % 2 === 1)] : pairs;
    return { topicId: t.id, debates: order };
  };
  const rounds = topics.map((t, r) => roundFor(t, r));
  if (practice?.enabled && n >= 2) {
    // Practice pairs neighbours (1v2, 3v4, …) so different teams get a go.
    const count = Math.max(1, Math.min(practice.debates, n));
    const debates: Debate[] = Array.from({ length: count }, (_, i) => ({
      id: uid('d'),
      forTeam: teams[(i * 2) % n].id,
      againstTeam: teams[(i * 2 + 1) % n].id,
      questionId: null,
      question: null,
      winner: null,
    }));
    rounds.unshift({ topicId: practice.topic.id, debates, practice: true });
  }
  return rounds;
}

/** Segment colours for the wheel, alternating red / blue / gold / dark. */
export const WHEEL_COLORS = ['#e3192b', '#1565ff', '#e9b53a', '#10131c', '#e3192b', '#1565ff', '#e9b53a', '#10131c', '#e3192b', '#1565ff'];
