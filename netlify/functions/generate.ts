import type { Config } from '@netlify/functions';
import { HttpError, authenticate, handler, json, monthlyLimit, readJson, usageThisMonth } from '../../src/server/http';
import { generateAnswers } from '../../src/server/generate';
import { getLLM } from '../../src/server/llm';
import type { GenerateRequest, Profile } from '../../src/shared/types';

export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { user, db } = await authenticate(req);
  const body = await readJson<GenerateRequest>(req);
  if (!Array.isArray(body.fields) || !body.fields.length) throw new HttpError(400, 'No fields to answer');

  const limit = monthlyLimit();
  const used = await usageThisMonth(db);
  if (used >= limit) throw new HttpError(429, `Monthly limit reached (${limit} AI answers). It resets on the 1st.`);

  const { data, error } = await db.from('profiles').select('data').eq('id', user.id).maybeSingle();
  if (error) throw new HttpError(500, 'Could not load your profile');
  const profile = (data?.data || {}) as Profile;

  const { answers, aiFieldCount } = await generateAnswers(profile, body, getLLM());
  if (aiFieldCount > 0) {
    await db.from('usage_events').insert({
      user_id: user.id, kind: body.regenerate ? 'regenerate' : 'generate', units: aiFieldCount,
      host: String(body.page?.host || '').slice(0, 100),
    });
  }
  return json({ answers, usage: { used: used + aiFieldCount, limit } });
});

export const config: Config = { path: '/api/generate' };
