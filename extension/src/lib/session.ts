import { initializeApp, type FirebaseApp } from 'firebase/app';
// The web-extension build of Firebase Auth avoids remote scripts, as Manifest V3 requires.
import { getAuth, type Auth } from 'firebase/auth/web-extension';

declare const __DEFAULT_APP_URL__: string;

export async function getAppUrl(): Promise<string> {
  const { appUrl } = await chrome.storage.local.get('appUrl');
  return String(appUrl || __DEFAULT_APP_URL__).replace(/\/+$/, '');
}
export async function setAppUrl(url: string) {
  await chrome.storage.local.set({ appUrl: url.trim().replace(/\/+$/, '') });
  await chrome.storage.local.remove('fpConfig');
}

let auth: Auth | null = null;

/** Firebase public web config is served by the FormPilot backend so nothing is hard-coded here. */
export async function getFirebaseAuth(): Promise<Auth> {
  if (auth) return auth;
  const appUrl = await getAppUrl();
  let cfg = (await chrome.storage.local.get('fpConfig')).fpConfig as { appUrl: string; apiKey: string; authDomain: string; projectId: string } | undefined;
  if (!cfg || cfg.appUrl !== appUrl) {
    const r = await fetch(`${appUrl}/api/config`).catch(() => null);
    if (!r || !r.ok) throw new Error(`Can't reach FormPilot at ${appUrl}`);
    cfg = { appUrl, ...(await r.json()) };
    await chrome.storage.local.set({ fpConfig: cfg });
  }
  const app: FirebaseApp = initializeApp({ apiKey: cfg!.apiKey, authDomain: cfg!.authDomain, projectId: cfg!.projectId });
  auth = getAuth(app); // persists the session in IndexedDB
  return auth;
}

export async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const a = await getFirebaseAuth();
  const token = await a.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in again');
  const r = await fetch(`${await getAppUrl()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
