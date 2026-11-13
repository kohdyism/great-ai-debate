declare global {
  interface Window {
    GAD_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string };
  }
}

/**
 * Supabase credentials come from (in order):
 *  1. public/config.js  → window.GAD_CONFIG (editable after build, no rebuild needed)
 *  2. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars at build time
 * If neither is present the app runs in DEMO MODE.
 */
export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const w = typeof window !== 'undefined' ? window.GAD_CONFIG : undefined;
  // Accept pasted URLs like https://xxx.supabase.co/rest/v1/ — keep only the project origin.
  const url = (w?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/(rest|auth|realtime)\/v1\/?.*$/i, '')
    .replace(/\/+$/, '');
  const anonKey = (w?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const isLiveBackend = () => getSupabaseConfig() !== null;
