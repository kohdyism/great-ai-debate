export const uid = (prefix = '') =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/** Room codes avoid look-alike characters (0/O, 1/I/L). */
export const makeRoomCode = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  for (const n of buf) s += chars[n % chars.length];
  return s;
};

export const makeSecret = () => {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const clone = <T,>(x: T): T =>
  typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x));

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);

export const fmtPct = (n: number) => `${Math.round(n)}%`;

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / sandbox) — state still lives in memory */
  }
}
export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
export function safeJson<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
