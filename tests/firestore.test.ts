import { describe, expect, it } from 'vitest';
import { fromFields, toFields } from '../src/server/firestore';

describe('Firestore REST value conversion', () => {
  it('round-trips a profile', () => {
    const profile = {
      personal: { firstName: 'Ada' }, skills: ['SQL', 'React'], experience: [{ id: 'x', title: 'PM', current: true, years: 2.5 }],
      facts: [], summary: '', nothing: null,
    };
    expect(fromFields(toFields({ profile }))).toEqual({ profile });
  });
  it('drops undefined and encodes integers as strings', () => {
    const f = toFields({ a: 3, b: undefined });
    expect(f).toEqual({ a: { integerValue: '3' } });
  });
});
