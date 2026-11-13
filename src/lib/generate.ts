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

// Broad, classic debate motions: short, big-picture, anyone can argue either side without specialist knowledge.
const TEMPLATES = [
  '{T} does more harm than good.',
  '{T} should be banned.',
  '{T} is overrated.',
  'The world would be better without {t}.',
  '{T} is a force for good.',
  'The benefits of {t} outweigh the risks.',
  'Society relies too much on {t}.',
  '{T} should be strictly regulated.',
  '{T} makes people happier.',
  '{T} is the future.',
  '{T} is bad for young people.',
  '{T} makes society more unequal.',
  'We should embrace {t}, not fear it.',
  '{T} is more dangerous than people think.',
  '{T} has gone too far.',
  '{T} is worth the cost.',
  'Governments should stay out of {t}.',
  '{T} brings people together.',
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
  const prompt = `You are writing motions for a live student debate gameshow.
Topic: "${topic}"
Write ${n} BROAD debate statements about this topic. Rules:
- Big-picture, classic debate-club style motions, e.g. "X does more harm than good", "X should be banned", "X is overrated", "We rely too much on X", "X is a force for good".
- Short: max 10 words. Instantly understandable on a big screen.
- Anyone can argue either side using general knowledge — no niche scenarios, no specific numbers, ages, dates, places, products or people.
- Genuinely two-sided with confident, bold wording, so the room has an opinion straight away.
- Each statement covers a different angle (e.g. good vs harm, regulation, society, young people, the future, happiness).
- Nothing offensive; no factual quiz statements.
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
