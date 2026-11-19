import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

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

/** Verifies the Supabase JWT and returns a client that acts *as that user*, so RLS applies. */
export async function authenticate(req: Request): Promise<{ user: User; db: SupabaseClient }> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Not signed in');
  const db = createClient(env('SUPABASE_URL', process.env.VITE_SUPABASE_URL), env('SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Session expired — please sign in again');
  return { user: data.user, db };
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

export function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function usageThisMonth(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.from('usage_events').select('units, kind').gte('created_at', monthStart());
  if (error) throw new HttpError(500, 'Could not read usage');
  return (data || []).filter((r) => r.kind !== 'extract').reduce((s, r) => s + (r.units || 0), 0);
}

export const monthlyLimit = () => Number(process.env.MONTHLY_GENERATION_LIMIT || 300);
