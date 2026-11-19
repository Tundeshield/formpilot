import { Firestore, verifyIdToken } from './firestore';

export const CORS: Record<string, string> = {
  // The extension calls from a chrome-extension:// origin. Auth is a bearer token
  // (never cookies), so a permissive origin does not expose user data.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new HttpError(500, `Server misconfigured: ${name} is not set`);
  return v;
}

/** Verifies the Firebase ID token and returns a Firestore client that acts *as that user*, so security rules apply. */
export async function authenticate(req: Request): Promise<{ uid: string; db: Firestore }> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Not signed in');
  const { uid } = await verifyIdToken(token);
  return { uid, db: new Firestore(token) };
}

export async function readJson<T>(req: Request, maxBytes = 400_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try { return JSON.parse(text) as T; } catch { throw new HttpError(400, 'Invalid JSON'); }
}

export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

export const monthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM

export async function usageThisMonth(db: Firestore, uid: string): Promise<number> {
  const doc = await db.get(`users/${uid}/usage/${monthKey()}`);
  return Number(doc?.units || 0);
}

export const monthlyLimit = () => Number(process.env.MONTHLY_GENERATION_LIMIT || 300);
