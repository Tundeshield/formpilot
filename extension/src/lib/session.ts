// Sign-in for the extension without the Firebase SDK: we call Firebase Auth's REST API
// directly and keep the long-lived refresh token in chrome.storage.local. ID tokens
// (1 hour) are renewed silently, so the user stays signed in across panel closes and
// browser restarts until they sign out or the session is revoked (e.g. password change).

declare const __DEFAULT_APP_URL__: string;

export interface Session { uid: string; email: string; idToken: string; refreshToken: string; expiresAt: number }
interface Config { appUrl: string; apiKey: string; authDomain: string; projectId: string }

const KEY = 'fpSession';

export async function getAppUrl(): Promise<string> {
  const { appUrl } = await chrome.storage.local.get('appUrl');
  return String(appUrl || __DEFAULT_APP_URL__).replace(/\/+$/, '');
}
export async function setAppUrl(url: string) {
  await chrome.storage.local.set({ appUrl: url.trim().replace(/\/+$/, '') });
  await chrome.storage.local.remove(['fpConfig', KEY]);
}

async function getConfig(): Promise<Config> {
  const appUrl = await getAppUrl();
  const cached = (await chrome.storage.local.get('fpConfig')).fpConfig as Config | undefined;
  if (cached && cached.appUrl === appUrl) return cached;
  const r = await fetch(`${appUrl}/api/config`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Can't reach FormPilot at ${appUrl}`);
  const cfg = { appUrl, ...(await r.json()) } as Config;
  await chrome.storage.local.set({ fpConfig: cfg });
  return cfg;
}

export async function getSession(): Promise<Session | null> {
  return ((await chrome.storage.local.get(KEY))[KEY] as Session | undefined) ?? null;
}

/** Calls back with the session now and whenever it changes (sign-in/out in any panel). */
export function watchSession(cb: (s: Session | null) => void): () => void {
  getSession().then(cb);
  const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && KEY in changes) cb((changes[KEY].newValue as Session | undefined) ?? null);
  };
  chrome.storage.onChanged.addListener(onChange);
  return () => chrome.storage.onChanged.removeListener(onChange);
}

const AUTH_ERRORS: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
  INVALID_PASSWORD: 'Email or password is incorrect.',
  EMAIL_NOT_FOUND: 'Email or password is incorrect.',
  INVALID_EMAIL: 'Enter a valid email address.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Try again in a few minutes.',
};

export async function signIn(email: string, password: string): Promise<Session> {
  const cfg = await getConfig();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }).catch(() => null);
  if (!r) throw new Error("Can't reach the sign-in service. Check your connection.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = String(j?.error?.message || '').split(' ')[0];
    throw new Error(AUTH_ERRORS[code] || 'Sign-in failed. Try again.');
  }
  const s: Session = {
    uid: j.localId, email: j.email, idToken: j.idToken, refreshToken: j.refreshToken,
    expiresAt: Date.now() + Number(j.expiresIn || 3600) * 1000,
  };
  await chrome.storage.local.set({ [KEY]: s });
  return s;
}

export async function signOut() { await chrome.storage.local.remove(KEY); }

let refreshing: Promise<string> | null = null;

/** A valid ID token, refreshed when within 5 minutes of expiry. Offline ≠ signed out. */
export async function getIdToken(force = false): Promise<string> {
  const s = await getSession();
  if (!s) throw new Error('Please sign in');
  if (!force && s.expiresAt - Date.now() > 5 * 60_000) return s.idToken;
  refreshing ??= (async () => {
    try {
      const cfg = await getConfig();
      const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${cfg.apiKey}`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refreshToken }).toString(),
      }).catch(() => null);
      if (!r) throw new Error("You're offline. Check your connection and try again.");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code = String(j?.error?.message || '');
        // Only a revoked/invalid session signs the user out; anything else is transient.
        if (/TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN/.test(code)) {
          await signOut();
          throw new Error('Your session ended. Please sign in again.');
        }
        throw new Error('Could not refresh your session. Try again.');
      }
      const next: Session = { ...s, idToken: j.id_token, refreshToken: j.refresh_token || s.refreshToken, expiresAt: Date.now() + Number(j.expires_in || 3600) * 1000 };
      await chrome.storage.local.set({ [KEY]: next });
      return next.idToken;
    } finally { refreshing = null; }
  })();
  return refreshing;
}

export async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const send = async (token: string) => fetch(`${await getAppUrl()}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let r = await send(await getIdToken()).catch(() => null);
  if (r && r.status === 401) r = await send(await getIdToken(true)).catch(() => null); // token revoked early: refresh once
  if (!r) throw new Error("Can't reach FormPilot. Check your connection.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
