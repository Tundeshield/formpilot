import type { Config } from '@netlify/functions';
import { authenticate, extractsThisMonth, handler, json, usageThisMonth } from '../../src/server/http';
import { currentPlan } from '../../src/server/stripe';
import { PLANS } from '../../src/shared/plans';

export default handler(async (req) => {
  const { uid, db } = await authenticate(req);
  const [state, used, imports] = await Promise.all([currentPlan(db, uid), usageThisMonth(db, uid), extractsThisMonth(db, uid)]);
  const p = PLANS[state.plan];
  return json({
    plan: state.plan, renews: state.renews ?? null, cancelAt: state.cancelAt ?? null,
    used, limit: p.aiAnswers, imports, importLimit: p.imports,
    billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY),
  });
});

export const config: Config = { path: '/api/usage' };
