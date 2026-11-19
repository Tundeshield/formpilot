import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError, env } from './http';
import type { Firestore } from './firestore';
import type { PlanId } from '../shared/plans';

// Minimal Stripe REST client (no SDK). Stripe is the source of truth for who has paid:
// we keep only the user's Stripe customer id in Firestore, signed with a server-held key
// so a user can't point their account at someone else's paid subscription.

const API = 'https://api.stripe.com/v1';

function form(obj: Record<string, unknown>, prefix = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === 'object') form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T = any>(method: 'GET' | 'POST', path: string, params: Record<string, unknown> = {}): Promise<T> {
  const qs = form(params).toString();
  const r = await fetch(`${API}${path}${method === 'GET' && qs ? `?${qs}` : ''}`, {
    method,
    headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? qs : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Stripe error', r.status, JSON.stringify(j).slice(0, 400));
    throw new HttpError(502, `Payment provider error: ${j?.error?.message || r.status}`);
  }
  return j as T;
}

const signingKey = () => createHmac('sha256', 'formpilot-billing-v1').update(env('STRIPE_SECRET_KEY')).digest();
const sign = (uid: string, customerId: string) => createHmac('sha256', signingKey()).update(`${uid}:${customerId}`).digest('hex');

export async function linkedCustomer(db: Firestore, uid: string): Promise<string | null> {
  const billing = (await db.get(`users/${uid}`))?.billing as { customerId?: string; sig?: string } | undefined;
  if (!billing?.customerId || !billing.sig) return null;
  const a = Buffer.from(sign(uid, billing.customerId)), b = Buffer.from(String(billing.sig));
  return a.length === b.length && timingSafeEqual(a, b) ? billing.customerId : null;
}

export async function getOrCreateCustomer(db: Firestore, uid: string, email?: string): Promise<string> {
  const existing = await linkedCustomer(db, uid);
  if (existing) return existing;
  const c = await stripe<{ id: string }>('POST', '/customers', { email, metadata: { uid } });
  await db.patch(`users/${uid}`, { billing: { customerId: c.id, sig: sign(uid, c.id) } });
  return c.id;
}

const cache = new Map<string, { plan: PlanId; renews?: number; cancelAt?: number | null; at: number }>();

export interface PlanState { plan: PlanId; renews?: number; cancelAt?: number | null }

/** Active plan for a user. Cached for 60s per warm function instance. */
export async function currentPlan(db: Firestore, uid: string): Promise<PlanState> {
  if (!process.env.STRIPE_SECRET_KEY) return { plan: 'free' };
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < 60_000) return hit;
  const customer = await linkedCustomer(db, uid);
  let state: PlanState = { plan: 'free' };
  if (customer) {
    const subs = await stripe<{ data: any[] }>('GET', '/subscriptions', { customer, status: 'all', limit: 5 });
    const live = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status));
    if (live) state = { plan: 'pro', renews: live.current_period_end ?? live.items?.data?.[0]?.current_period_end, cancelAt: live.cancel_at };
  }
  cache.set(uid, { ...state, at: Date.now() });
  return state;
}

export const forgetPlan = (uid: string) => cache.delete(uid);
