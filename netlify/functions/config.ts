import type { Config } from '@netlify/functions';
import { env, handler, json } from '../../src/server/http';

// Public, non-secret settings the extension needs to sign users in. The anon key is
// designed to be public; all data access is enforced by row-level security.
export default handler(async () =>
  json({
    supabaseUrl: env('SUPABASE_URL', process.env.VITE_SUPABASE_URL),
    supabaseAnonKey: env('SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY),
  }));

export const config: Config = { path: '/api/config' };
