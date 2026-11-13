import type { Debate, RoundPlan, Settings, Team, Topic } from './types';
import { uid } from './util';

const q = (text: string, i: number, t: string) => ({ id: `${t}-q${i + 1}`, text });
const topic = (id: string, title: string, qs: string[]): Topic => ({ id, title, questions: qs.map((x, i) => q(x, i, id)) });

/** Example content — every question is a statement teams can argue FOR or AGAINST. Edit in Host → Setup. */
export const DEFAULT_TOPICS: Topic[] = [
  topic('t1', 'AI & Work', [
    'AI will take more jobs than it creates.',
    'AI is good for workers.',
    'AI makes people lazy.',
    'Companies should be free to replace humans with AI.',
    'AI makes the workplace fairer.',
    'AI skills matter more than a degree.',
  ]),
  topic('t2', 'AI & Creativity', [
    'AI art is real art.',
    'AI is killing human creativity.',
    'Creating with AI is cheating.',
    'AI will make everyone an artist.',
    'Some creative work should stay human-only.',
    'AI makes entertainment better.',
  ]),
  topic('t3', 'AI in Everyday Life', [
    'AI makes our lives better.',
    'We rely on AI too much.',
    'AI is more dangerous than helpful.',
    'Children should not use AI.',
    'AI should be strictly regulated.',
    'We should let AI make decisions for us.',
  ]),
];

export const DEFAULT_SETTINGS: Settings = {
  prepSec: 30,
  speechSec: 60,
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
export function buildSchedule(teams: Team[], topics: Topic[]): RoundPlan[] {
  const n = teams.length;
  return topics.map((t, r) => {
    const k = n > 1 ? 1 + (r % (n - 1)) : 0;
    const pairs: Debate[] = teams.map((_, i) => ({
      id: uid('d'),
      forTeam: teams[i].id,
      againstTeam: teams[(i + k) % n].id,
      questionId: null,
      question: null,
      winner: null,
    }));
    // Reorder: take every other debate first (0,2,4…,1,3,5…) to spread teams out.
    const order = n > 3 ? [...pairs.filter((_, i) => i % 2 === 0), ...pairs.filter((_, i) => i % 2 === 1)] : pairs;
    return { topicId: t.id, debates: order };
  });
}

/** Segment colours for the wheel, alternating red / blue / gold / dark. */
export const WHEEL_COLORS = ['#e3192b', '#1565ff', '#e9b53a', '#10131c', '#e3192b', '#1565ff', '#e9b53a', '#10131c', '#e3192b', '#1565ff'];
