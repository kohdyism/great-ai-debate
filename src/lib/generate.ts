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

// Deliberately provocative: bold, absolute claims — half poke the "pro" side, half the "anti" side.
const TEMPLATES = [
  '{T} is ruining our generation.',
  '{T} should be banned outright — no exceptions.',
  '{T} is the biggest scam of the century.',
  'We would all be happier if {t} disappeared tomorrow.',
  'People who love {t} are part of the problem.',
  '{T} is a toy for the rich, not progress for everyone.',
  'Governments are cowards for not cracking down on {t}.',
  '{T} has done more harm than good — and deep down we all know it.',
  'Criticising {t} is just fear of change.',
  'In 20 years, {t} will be seen as a massive mistake.',
  '{T} should be illegal for under-18s.',
  'Your parents were right about {t}.',
  'Banning {t} would be an attack on our freedom.',
  '{T} is the best thing to happen to our generation.',
  'Nobody actually needs {t}.',
  'Anyone making money from {t} should be taxed until it hurts.',
  'Opting out of {t} is a privilege most people can’t afford.',
  '{T} makes us lonelier, dumber and angrier.',
  'If you’re not worried about {t}, you’re not paying attention.',
  'The panic about {t} is just old people being scared.',
  'The hype around {t} is 90% marketing.',
  'Our generation will be judged harshly for {t}.',
];

export function templateStatements(topic: string, n: number, avoid: string[] = []): string[] {
  const t = smartLower(topic) || 'this topic';
  const all = TEMPLATES.map((x) => x.replace('{T}', cap(t)).replace('{t}', t));
  const fresh = all.filter((s) => !avoid.includes(s));
  const pool = [...(fresh.length >= n ? fresh : all)];
  const out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
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
  const prompt = `You are writing statements for a loud, fun, live student debate gameshow.
Topic: "${topic}"
Write ${n} PROVOCATIVE debate statements about this topic. Rules:
- Bold, spicy and contrarian: the kind of line that makes the audience gasp, laugh or shout "no way!".
- Use strong, absolute wording ("should be banned", "is a scam", "is ruining", "deserves to die out", "is the best thing ever").
- Each is ONE punchy statement, max 14 words, instantly understandable on a big screen.
- Genuinely two-sided: a smart team could argue FOR it and another AGAINST it. Mix ones that provoke supporters and ones that provoke critics.
- Varied angles: personal life, money, ethics, the future, policy, and one cheeky/funny one.
- No hate, slurs or attacks on protected groups or real private individuals; no factual quiz statements.
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

export const randomTemplate = (topic: string, avoid: string[]) => templateStatements(topic, 1, avoid)[0] ?? pick(TEMPLATES);
