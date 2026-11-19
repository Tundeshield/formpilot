import { describe, expect, it } from 'vitest';
import { classifyField, matchOption } from '../src/shared/classify';
import { buildContext, validateAnswer } from '../src/server/generate';
import type { DetectedField } from '../src/shared/types';

const f = (label: string, extra: Partial<DetectedField> = {}): DetectedField => ({ id: 'fp-1', kind: 'text', label, required: false, ...extra });

describe('classifyField', () => {
  it.each([
    ['Email address', 'email'], ['Mobile number', 'phone'], ['Given name', 'firstName'], ['Surname', 'lastName'],
    ['Full name', 'fullName'], ['LinkedIn URL', 'linkedin'], ['Postcode', 'postalCode'], ['Country', 'country'],
  ])('%s → %s', (label, purpose) => {
    expect(classifyField(f(label))).toMatchObject({ type: 'direct', purpose });
  });
  it('does not treat lookalikes as direct', () => {
    expect(classifyField(f('Name of your previous employer')).type).toBe('open');
    expect(classifyField(f('Which country are you authorised to work in?')).type).toBe('open');
    expect(classifyField(f('Describe your experience with email marketing', { kind: 'textarea' })).type).toBe('open');
  });
  it('leaves consent and self-ID to the user', () => {
    expect(classifyField(f('I agree to the terms', { kind: 'checkbox' })).type).toBe('personal-decision');
    expect(classifyField(f('Veteran status', { kind: 'select' })).type).toBe('personal-decision');
  });
});

describe('matchOption', () => {
  it('handles synonyms and accents', () => {
    expect(matchOption('UK', ['United States', 'United Kingdom'])).toBe('United Kingdom');
    expect(matchOption('Ivory Coast', ["Côte d'Ivoire", 'Ghana'])).toBe("Côte d'Ivoire");
    expect(matchOption('Mars', ['Earth'])).toBeUndefined();
  });
});

describe('validateAnswer', () => {
  it('rejects placeholders and respects maxLength', () => {
    expect(validateAnswer(f('Why us?'), { status: 'answered', value: 'I love [Company]' }).status).toBe('needs_info');
    expect(validateAnswer(f('Bio', { maxLength: 5 }), { status: 'answered', value: 'abcdefgh', confidence: 0.9 }).value).toBe('abcde');
  });
});

describe('buildContext', () => {
  it('returns only requested, non-empty sections', () => {
    const ctx = buildContext({ contact: { email: 'x@y.z' }, summary: 'hi', skills: [] }, ['summary', 'skills']);
    expect(ctx).toEqual({ summary: 'hi' });
  });
});
