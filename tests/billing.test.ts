import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentPlan, getOrCreateCustomer, linkedCustomer } from '../src/server/stripe';
import type { Firestore } from '../src/server/firestore';

function fakeDb(initial: Record<string, any> = {}) {
  const docs: Record<string, any> = { ...initial };
  return {
    docs,
    db: {
      get: async (p: string) => docs[p] ?? null,
      patch: async (p: string, d: Record<string, unknown>) => { docs[p] = { ...(docs[p] || {}), ...d }; },
      increment: async () => {},
    } as unknown as Firestore,
  };
}

describe('Stripe billing link', () => {
  beforeEach(() => { process.env.STRIPE_SECRET_KEY = 'sk_test_x'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('stores a signed customer id that cannot be reused by another user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'cus_123' }), { status: 200 }));
    const { db, docs } = fakeDb();
    expect(await getOrCreateCustomer(db, 'alice', 'a@x.com')).toBe('cus_123');
    expect(await linkedCustomer(db, 'alice')).toBe('cus_123');
    // Bob copies Alice's billing block into his own user doc:
    docs['users/bob'] = { billing: docs['users/alice'].billing };
    expect(await linkedCustomer(db, 'bob')).toBeNull();
    // Tampered id with a stale signature:
    docs['users/alice'].billing = { ...docs['users/alice'].billing, customerId: 'cus_999' };
    expect(await linkedCustomer(db, 'alice')).toBeNull();
  });

  it('reports pro only for a live subscription', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cus_1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: 'active', current_period_end: 1800000000, cancel_at: null }] }), { status: 200 }));
    const { db } = fakeDb();
    await getOrCreateCustomer(db, 'carol');
    expect((await currentPlan(db, 'carol')).plan).toBe('pro');
    const { db: db2 } = fakeDb();
    expect((await currentPlan(db2, 'dave')).plan).toBe('free'); // no customer → free, no API call
  });
});
