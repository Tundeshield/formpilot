import type { Config } from '@netlify/functions';
import { HttpError, authenticate, env, handler, json, readJson } from '../../src/server/http';
import { forgetPlan, getOrCreateCustomer, linkedCustomer, stripe } from '../../src/server/stripe';
import { verifyIdToken } from '../../src/server/firestore';

// POST /api/billing/checkout {interval: 'month'|'year'} → Stripe Checkout URL
// POST /api/billing/portal → Stripe customer portal URL (manage, cancel, invoices)
export default handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const { uid, db } = await authenticate(req);
  const origin = (process.env.URL || new URL(req.url).origin).replace(/\/$/, '');
  const action = new URL(req.url).pathname.split('/').pop();

  if (action === 'checkout') {
    const { interval } = await readJson<{ interval?: string }>(req, 2_000);
    const price = interval === 'year' ? env('STRIPE_PRICE_YEARLY') : env('STRIPE_PRICE_MONTHLY');
    const { email } = await verifyIdToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    const customer = await getOrCreateCustomer(db, uid, email);
    forgetPlan(uid);
    const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
      mode: 'subscription', customer, client_reference_id: uid,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { uid } },
      success_url: `${origin}/app/account?upgraded=1`,
      cancel_url: `${origin}/app/account`,
    });
    return json({ url: session.url });
  }

  if (action === 'portal') {
    const customer = await linkedCustomer(db, uid);
    if (!customer) throw new HttpError(404, 'No billing account yet');
    forgetPlan(uid);
    const s = await stripe<{ url: string }>('POST', '/billing_portal/sessions', { customer, return_url: `${origin}/app/account` });
    return json({ url: s.url });
  }

  throw new HttpError(404, 'Unknown billing action');
});

export const config: Config = { path: ['/api/billing/checkout', '/api/billing/portal'] };
