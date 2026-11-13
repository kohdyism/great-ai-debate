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

const TEMPLATES = [
  '{T} does more good than harm.',
  '{T} should be banned.',
  'Governments should regulate {t} much more strictly.',
  'The world would be better off without {t}.',
  '{T} is massively overrated.',
  'Every school should teach students about {t}.',
  '{T} will be unrecognisable in 20 years.',
  'Young people understand {t} better than their parents do.',
  'Big companies profit too much from {t}.',
  'We should spend more public money on {t}.',
  '{T} makes people less happy.',
  'Access to {t} should be a right, not a luxury.',
  'The benefits of {t} are shared unfairly.',
  'Most people’s opinions about {t} are based on myths.',
  'When it comes to {t}, tradition should beat innovation.',
  'You can’t stay neutral about {t}.',
  'In ten years we will regret how we handled {t}.',
  'Individuals, not governments, should make the rules on {t}.',
  'Universities should take {t} far more seriously.',
  'The risks of {t} are exaggerated by the media.',
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
  const prompt = `You are writing statements for a live student debate gameshow.
Topic: "${topic}"
Write ${n} debate statements about this topic. Rules:
- Each is ONE clear, punchy statement (max 14 words) that one team can argue FOR and another AGAINST.
- Genuinely two-sided: reasonable people disagree. No facts-with-one-right-answer, nothing offensive.
- Varied angles: ethics, practical, personal life, policy, the future, and one light-hearted one.
- Easy to understand instantly when read off a big screen.
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
