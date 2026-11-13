import type { Debate, RoundPlan, Settings, Team, Topic } from './types';
import { uid } from './util';

const q = (text: string, i: number, t: string) => ({ id: `${t}-q${i + 1}`, text });
const topic = (id: string, title: string, qs: string[]): Topic => ({ id, title, questions: qs.map((x, i) => q(x, i, id)) });

/** Example content — every question is a statement teams can argue FOR or AGAINST. Edit in Host → Setup. */
export const DEFAULT_TOPICS: Topic[] = [
  topic('t1', 'AI & the Future of Work', [
    'AI will create more jobs than it destroys.',
    'Companies should pay a tax for every job replaced by AI.',
    'AI productivity should earn everyone a four-day week.',
    'Job interviews should never be run by AI.',
    'Creative jobs are safe from AI.',
    'Everyone should still learn to code.',
  ]),
  topic('t2', 'AI & Creativity', [
    'AI-generated art is real art.',
    'Songs made with AI should be allowed to win music awards.',
    'Artists should be paid when AI learns from their work.',
    'A novel written by AI could deserve the Booker Prize.',
    'AI makes everyone creative.',
    'Films should be labelled if AI was used to make them.',
  ]),
  topic('t3', 'AI in Everyday Life', [
    'An AI friend is better than no friend at all.',
    'AI should be allowed to drive our cars.',
    'Smart speakers should be banned from bedrooms.',
    'Children under 12 should not use AI chatbots.',
    'AI matchmaking will make relationships better.',
    'Life is better with AI than without it.',
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
