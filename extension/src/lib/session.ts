import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const __DEFAULT_APP_URL__: string;

const chromeStorage = {
  getItem: async (k: string) => ((await chrome.storage.local.get(k))[k] as string | undefined) ?? null,
  setItem: async (k: string, v: string) => { await chrome.storage.local.set({ [k]: v }); },
  removeItem: async (k: string) => { await chrome.storage.local.remove(k); },
};

export async function getAppUrl(): Promise<string> {
  const { appUrl } = await chrome.storage.local.get('appUrl');
  return String(appUrl || __DEFAULT_APP_URL__).replace(/\/+$/, '');
}
export async function setAppUrl(url: string) {
  await chrome.storage.local.set({ appUrl: url.trim().replace(/\/+$/, '') });
  client = null;
}

let client: SupabaseClient | null = null;

/** Supabase public config is served by the FormPilot backend so nothing secret is bundled here. */
export async function getClient(): Promise<SupabaseClient> {
  if (client) return client;
  const appUrl = await getAppUrl();
  let cfg = (await chrome.storage.local.get('fpConfig')).fpConfig as { appUrl: string; supabaseUrl: string; supabaseAnonKey: string } | undefined;
  if (!cfg || cfg.appUrl !== appUrl) {
    const r = await fetch(`${appUrl}/api/config`).catch(() => null);
    if (!r || !r.ok) throw new Error(`Can't reach FormPilot at ${appUrl}`);
    const j = await r.json();
    cfg = { appUrl, supabaseUrl: j.supabaseUrl, supabaseAnonKey: j.supabaseAnonKey };
    await chrome.storage.local.set({ fpConfig: cfg });
  }
  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { storage: chromeStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

export async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('Please sign in again');
  const r = await fetch(`${await getAppUrl()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
