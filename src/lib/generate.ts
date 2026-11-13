// Statement generator for any topic.
//  • With an Anthropic API key (stored only in this browser): Claude writes fresh, topic-specific statements.
//  • Without a key (or offline): a built-in generator builds debatable statements from templates.
import { pick, safeGet, safeRemove, safeSet } from './util';

const KEY_STORE = 'gad:anthropic-key';
export const getApiKey = () => safeGet(KEY_STORE) ?? '';
export const setApiKey = (k: string) => (k.trim() ? safeSet(KEY_STORE, k.trim()) : safeRemove(KEY_STORE));

/** "SOCIAL MEDIA" → "social media", keeps short acronyms like AI / UK / NHS. */
function smartLower(t: string) {
  return t
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && /[A-Z]/.test(w) && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(' ');
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

// ── Hand-written banks ──
// Every statement is a value judgement, a policy ("should…") or a prediction, or an empirical claim
// that research genuinely disagrees about. Nothing that published evidence or scientific consensus settles.
const BANKS: { match: RegExp; statements: string[] }[] = [
  {
    match: /\b(work|job|jobs|career|employ|workplace|business|economy)/i,
    statements: [
      'AI will take more jobs than it creates.',
      'AI will make work more meaningful, not less.',
      'Companies should be free to replace workers with AI.',
      'Using AI at work is cheating.',
      'AI will make the workplace fairer.',
      'AI should give everyone a shorter working week.',
      'AI should never decide who gets hired.',
      'AI skills will matter more than a degree.',
      'Workers should be paid when AI replaces them.',
      'Every worker should be trained to use AI.',
    ],
  },
  {
    match: /\b(educat|school|universit|learn|student|teach|study|exam|college)/i,
    statements: [
      'AI should be banned from universities.',
      'AI makes students lazy.',
      'AI tutors should replace some human teaching.',
      'Using AI for coursework is cheating.',
      'Schools should teach AI from a young age.',
      'AI will make education fairer.',
      'Exams should go back to pen and paper.',
      'AI will make degrees worthless.',
      'Teachers should use AI to mark work.',
      'Students should be allowed to use AI in exams.',
    ],
  },
  {
    match: /\b(societ|world|democra|politic|future|ethic|humanity|government|public)/i,
    statements: [
      'AI does more harm than good to society.',
      'AI should be strictly regulated by governments.',
      'AI will widen the gap between rich and poor.',
      'We rely on AI too much.',
      'AI companies should be responsible for AI’s mistakes.',
      'Humans should always have the final say over AI.',
      'AI will bring people closer together.',
      'Big tech has too much power over AI.',
      'AI is a threat to democracy.',
      'Life will be better with AI than without it.',
    ],
  },
  {
    match: /\b(art|creativ|music|film|writ|design|culture|entertain)/i,
    statements: [
      'AI art is real art.',
      'AI is bad for human creativity.',
      'Creating with AI is cheating.',
      'AI will make everyone an artist.',
      'Artists should be paid when AI learns from their work.',
      'Some creative work should stay human-only.',
      'AI will make entertainment better.',
      'Human-made art will become a luxury.',
    ],
  },
  {
    match: /\b(health|medic|doctor|hospital|nhs|wellbeing|mental)/i,
    statements: [
      'AI should be allowed to diagnose patients.',
      'AI will make healthcare fairer.',
      'Patients should always see a human doctor.',
      'AI chatbots should be allowed to offer therapy.',
      'We should share our health data to train AI.',
      'AI in healthcare does more good than harm.',
    ],
  },
  {
    match: /\b(climate|environment|planet|green|energy|sustainab)/i,
    statements: [
      'AI does more harm than good to the planet.',
      'AI will help us tackle climate change.',
      'AI’s energy use should be strictly limited.',
      'Frequent flyers should pay much higher taxes.',
      'Governments should force companies to go green.',
      'Rich countries should pay for climate damage.',
    ],
  },
  {
    match: /\b(social media|tiktok|instagram|online|internet|smartphone|phone)/i,
    statements: [
      'Social media does more harm than good.',
      'Under-16s should be banned from social media.',
      'Social media should verify every user’s identity.',
      'Influencers are bad role models.',
      'Social media companies should be held responsible for content.',
      'Phones should be banned in schools.',
    ],
  },
  {
    match: /\b(relationship|dating|love|friend|family)/i,
    statements: [
      'An AI friend is better than no friend at all.',
      'Dating apps have ruined romance.',
      'Online friends are real friends.',
      'AI will make human relationships better.',
      'Families should have tech-free time every day.',
      'Relationships with AI should be taken seriously.',
    ],
  },
];

// ── Fallbacks: one statement per angle. Opinion, policy and prediction only —
// never a factual claim that research could already have settled.
const AI_DOMAIN_ANGLES = [
  ['AI does more harm than good in {x}.', 'AI will make {x} better for everyone.'],
  ['AI in {x} should be strictly regulated.', 'AI should be kept out of {x}.'],
  ['Humans should always have the final say in {x}.', 'AI will replace humans in {x}.'],
  ['AI will make {x} fairer.', 'AI in {x} will mostly benefit the rich.'],
  ['We are moving too fast with AI in {x}.', 'Refusing AI in {x} means falling behind.'],
  ['We should trust AI to make decisions in {x}.', 'Everyone in {x} should be trained to use AI.'],
];
const GENERIC_ANGLES = [
  ['{T} does more good than harm.', '{T} does more harm than good.'],
  ['{T} should be more strictly regulated.', 'Governments should stay out of {t}.'],
  ['{T} is overrated.', '{T} deserves more attention than it gets.'],
  ['The benefits of {t} mostly go to the rich.', '{T} benefits everyone, not just the few.'],
  ['{T} will matter even more in the future.', 'In 20 years, {t} will be a thing of the past.'],
  ['We would be better off with less {t}.', 'We need more {t}, not less.'],
];
// Topics where science has a clear consensus: only offer policy questions, never "is it good/real/harmful".
const CONSENSUS = /\b(vaccin|climate change|global warming|evolution|flat earth|moon landing|smoking|tobacco|fluorid)/i;
const POLICY_ANGLES = [
  ['Governments should do more about {t}.', 'Individuals, not governments, should lead on {t}.'],
  ['Public money should be spent on {t}.', 'Companies, not taxpayers, should pay for {t}.'],
  ['Every school should teach about {t}.', 'Schools spend too much time on {t}.'],
  ['Experts, not the public, should decide policy on {t}.', 'Everyone should get a vote on {t}.'],
  ['Rich countries should do the most about {t}.', 'Every country should share the cost of {t}.'],
  ['The media covers {t} badly.', 'Celebrities should speak out more on {t}.'],
];

function domainPhrase(x: string) {
  const d = x.trim().toLowerCase();
  if (/^work$|^jobs?$/.test(d)) return 'the workplace';
  if (/^society$|^the world$/.test(d)) return 'society';
  return d;
}

export function templateStatements(topic: string, n: number, avoid: string[] = []): string[] {
  const raw = topic.trim();
  const fresh = (list: string[]) => {
    const f = list.filter((s) => !avoid.includes(s));
    return f.length >= n ? f : list;
  };
  // 1) Curated bank for familiar themes.
  const bank = BANKS.find((b) => b.match.test(raw));
  if (bank) return shuffle(fresh(bank.statements)).slice(0, n);
  // 2) "AI & X" / "AI in X" / "AI and X" → AI-in-a-domain angles.
  const m = raw.match(/^\s*AI\s*(?:&|and|in|\+|vs\.?|x)\s*(.+)$/i);
  const pickAngles = (groups: string[][], fill: (s: string) => string) => {
    const out = shuffle(groups)
      .map((g) => shuffle(g.map(fill).filter((s) => !avoid.includes(s)))[0] ?? fill(g[0]))
      .slice(0, n);
    return out;
  };
  if (m) {
    const x = domainPhrase(m[1]);
    return pickAngles(AI_DOMAIN_ANGLES, (t) => t.replace('{x}', x));
  }
  // 3) Any other subject.
  const t = smartLower(raw) || 'this topic';
  return pickAngles(CONSENSUS.test(raw) ? POLICY_ANGLES : GENERIC_ANGLES, (s) => s.replace('{T}', cap(t)).replace('{t}', t));
}

async function callClaude(key: string, model: string, prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return (data?.content ?? []).map((c: any) => c.text ?? '').join('');
}

export async function aiStatements(topic: string, n: number, avoid: string[] = []): Promise<{ statements: string[]; source: 'ai' | 'builtin'; error?: string }> {
  const key = getApiKey();
  if (!key) return { statements: templateStatements(topic, n, avoid), source: 'builtin' };
  const prompt = `You are writing motions for a live student debate gameshow.
Topic: "${topic}"
Write ${n} debate statements about this topic. Rules:
- Broad, big-picture claims a student audience instantly has an opinion on (e.g. "AI will take more jobs than it creates", "AI makes students lazy", "Humans should always have the final say over AI").
- Short and natural: max 10 words, plain everyday English, reads well on a big screen.
- Every statement takes a DIFFERENT angle — e.g. overall good vs harm, fairness/inequality, regulation/control, human vs machine, young people, the future. No two may share the same sentence pattern.
- Genuinely two-sided: confident wording one team can argue FOR and another AGAINST, using general knowledge only.
- MUST NOT be contradicted by peer-reviewed research or scientific consensus. Prefer opinions, values, policies ("should…") and predictions. Only use an empirical claim if researchers genuinely disagree about it. Never contradict established science (e.g. on vaccines, climate change, evolution).
- No niche scenarios, numbers, ages, dates, products or named people. Nothing offensive. No factual quiz statements.
${avoid.length ? `- Do not repeat or closely paraphrase these: ${avoid.map((a) => `"${a}"`).join('; ')}` : ''}
Reply with ONLY a JSON array of ${n} strings.`;
  for (const model of ['claude-haiku-5-5', 'claude-sonnet-5-5']) {
    try {
      const text = await callClaude(key, model, prompt);
      const m = text.match(/\[[\s\S]*\]/);
      const arr = m ? (JSON.parse(m[0]) as unknown[]) : [];
      const statements = arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, n);
      if (statements.length) {
        while (statements.length < n) statements.push(...templateStatements(topic, n - statements.length, [...avoid, ...statements]));
        return { statements, source: 'ai' };
      }
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (/model/i.test(msg) && model === 'claude-haiku-5-5') continue; // try the next model
      return { statements: templateStatements(topic, n, avoid), source: 'builtin', error: msg };
    }
  }
  return { statements: templateStatements(topic, n, avoid), source: 'builtin', error: 'No statements returned' };
}

export const randomTemplate = (topic: string, avoid: string[]) => templateStatements(topic, 1, avoid)[0] ?? pick(GENERIC_ANGLES.flat());
