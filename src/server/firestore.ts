import { createRemoteJWKSet, jwtVerify } from 'jose';
import { HttpError, env } from './http';

// No service-account secret needed: we verify the user's Firebase ID token against
// Google's public keys, then call Firestore's REST API *with that token*, so the
// Firestore security rules apply to every server read and write.

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export const projectId = () => env('VITE_FIREBASE_PROJECT_ID');

export async function verifyIdToken(token: string): Promise<{ uid: string; email?: string }> {
  try {
    const pid = projectId();
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${pid}`, audience: pid });
    if (!payload.sub) throw new Error('no sub');
    return { uid: payload.sub, email: payload.email as string | undefined };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, 'Session expired — please sign in again');
  }
}

type FsValue = Record<string, any>;

export function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== undefined).map(toFs) } };
  return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
}
export function toFields(o: Record<string, unknown>): Record<string, FsValue> {
  return Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toFs(x)]));
}
export function fromFs(v: FsValue): unknown {
  if (!v || 'nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
export function fromFields(f: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, x]) => [k, fromFs(x)]));
}

const base = () => `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;

async function call(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (r.status === 404) return null;
  if (!r.ok) {
    console.error('Firestore', r.status, (await r.text()).slice(0, 300));
    throw new HttpError(r.status === 403 ? 403 : 500, r.status === 403 ? 'Access denied' : 'Database error');
  }
  return r.json() as Promise<any>;
}

export class Firestore {
  constructor(private token: string) {}

  async get(path: string): Promise<Record<string, any> | null> {
    const doc = await call(this.token, `${base()}/${path}`);
    return doc ? fromFields(doc.fields || {}) : null;
  }

  /** Merge-update the given top-level fields (creates the document if missing). */
  async patch(path: string, data: Record<string, unknown>) {
    const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    await call(this.token, `${base()}/${path}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields: toFields(data) }) });
  }

  async increment(path: string, field: string, by: number) {
    const name = `projects/${projectId()}/databases/(default)/documents/${path}`;
    await call(this.token, `${base()}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: [{ transform: { document: name, fieldTransforms: [{ fieldPath: field, increment: { integerValue: String(by) } }] } }] }),
    });
  }
}
