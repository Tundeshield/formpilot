import type { Config } from '@netlify/functions';
import { HttpError, authenticate, handler, json, readJson } from '../../src/server/http';
import type { Profile } from '../../src/shared/types';

// Lets the extension save an answer the user typed for a "needs info" field back into
// their profile, without the extension ever downloading the full profile.
export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { user, db } = await authenticate(req);
  const { label, value } = await readJson<{ label: string; value: string }>(req, 20_000);
  const l = String(label || '').trim().slice(0, 200), v = String(value || '').trim().slice(0, 4000);
  if (!l || !v) throw new HttpError(400, 'Label and value are required');

  const { data } = await db.from('profiles').select('data').eq('id', user.id).maybeSingle();
  const profile = (data?.data || {}) as Profile;
  const facts = (profile.facts || []).filter((f) => f.label.toLowerCase() !== l.toLowerCase());
  facts.push({ id: Math.random().toString(36).slice(2, 10), label: l, value: v });
  const { error } = await db.from('profiles').upsert({ id: user.id, data: { ...profile, facts }, updated_at: new Date().toISOString() });
  if (error) throw new HttpError(500, 'Could not save to your profile');
  return json({ ok: true });
});

export const config: Config = { path: '/api/facts' };
