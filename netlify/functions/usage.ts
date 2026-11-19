import type { Config } from '@netlify/functions';
import { authenticate, handler, json, monthlyLimit, usageThisMonth } from '../../src/server/http';

export default handler(async (req) => {
  const { uid, db } = await authenticate(req);
  return json({ used: await usageThisMonth(db, uid), limit: monthlyLimit() });
});

export const config: Config = { path: '/api/usage' };
