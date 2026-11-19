import type { Config } from '@netlify/functions';
import { HttpError, authenticate, handler, json, monthKey, readJson, usageThisMonth } from '../../src/server/http';
import { currentPlan } from '../../src/server/stripe';
import { PLANS } from '../../src/shared/plans';
import { generateAnswers } from '../../src/server/generate';
import { getLLM } from '../../src/server/llm';
import type { GenerateRequest, Profile } from '../../src/shared/types';

export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { uid, db } = await authenticate(req);
  const body = await readJson<GenerateRequest>(req);
  if (!Array.isArray(body.fields) || !body.fields.length) throw new HttpError(400, 'No fields to answer');

  const [{ plan }, used] = await Promise.all([currentPlan(db, uid), usageThisMonth(db, uid)]);
  const limit = PLANS[plan].aiAnswers;
  if (used >= limit) {
    throw new HttpError(429, plan === 'free'
      ? `You've used all ${limit} free AI answers this month. Upgrade to Pro for ${PLANS.pro.aiAnswers.toLocaleString()} a month.`
      : `Monthly limit reached (${limit} AI answers). It resets on the 1st.`);
  }

  const user = await db.get(`users/${uid}`);
  const profile = (user?.profile || {}) as Profile;

  const { answers, aiFieldCount } = await generateAnswers(profile, body, getLLM());
  if (aiFieldCount > 0) await db.increment(`users/${uid}/usage/${monthKey()}`, 'units', aiFieldCount);
  return json({ answers, usage: { used: used + aiFieldCount, limit, plan } });
});

export const config: Config = { path: '/api/generate' };
