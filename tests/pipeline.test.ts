// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { scanPage } from '../src/shared/scan';
import { fillFields } from '../src/shared/fill';
import { generateAnswers } from '../src/server/generate';
import type { LLM } from '../src/server/llm';
import type { Profile, ScanResult } from '../src/shared/types';

const html = readFileSync('web/public/demo/index.html', 'utf8');
// Simulate chrome.scripting.executeScript, which serialises the function source.
const inject = <F extends (...a: any[]) => any>(fn: F): F => new Function(`return (${fn.toString()})`)() as F;

const profile: Profile = {
  personal: { firstName: 'Ada', lastName: 'Obi', headline: 'Product Operations Manager' },
  contact: { email: 'ada@example.com', phone: '+44 7700 900000', city: 'London', country: 'UK' },
  links: { linkedin: 'https://linkedin.com/in/adaobi' },
  summary: 'Product operations manager with 6 years in regulated fintech.',
  experience: [{ id: '1', title: 'Product Operations Manager', company: 'Remitly-ish', current: true, description: 'Launched 4 payment corridors.' }],
  skills: ['Process design', 'SQL'],
  facts: [{ id: 'f', label: 'Notice period', value: '1 month' }],
};

let scan: ScanResult;
let lastPrompt = '';
const llm: LLM = {
  async completeJSON({ user }) {
    lastPrompt = user;
    const fields = JSON.parse(user.match(/<fields>([\s\S]*)<\/fields>/)![1]);
    return { answers: fields.map((f: any) => {
      if (/salary/i.test(f.label)) return { id: f.id, status: 'needs_info', value: null, reason: 'No salary expectation in your profile' };
      if (f.kind === 'select' && /notice/i.test(f.label)) return { id: f.id, status: 'answered', value: '1 month', confidence: 0.9, sources: ['facts'] };
      if (f.kind === 'radio') return { id: f.id, status: 'answered', value: 'Made-up option', confidence: 0.9 }; // must be rejected
      if (f.kind === 'checkbox-group') return { id: f.id, status: 'answered', value: ['Payments', 'Compliance'], confidence: 0.8 };
      if (f.inputType === 'number') return { id: f.id, status: 'answered', value: '6 years', confidence: 0.85 };
      return { id: f.id, status: 'answered', value: `Answer for ${f.label}`, confidence: 0.7, sources: ['experience'] };
    }) };
  },
};

beforeEach(() => {
  document.open(); document.write(html); document.close();
  scan = inject(scanPage)();
});

describe('scanner', () => {
  it('detects fields with useful labels in page order', () => {
    const labels = scan.fields.map((f) => f.label);
    expect(labels.slice(0, 4)).toEqual(['First name', 'Last name', 'Email address', 'Phone']);
    expect(labels).toContain('Current job title'); // div label without for=
    expect(labels).toContain('Why are you interested in this position at Northwind Health?'); // aria-labelledby
    expect(scan.fields.find((f) => f.name === 'why')?.helpText).toBe('Around 150 words.');
    expect(scan.fields.find((f) => f.kind === 'radio')?.label).toBe('Are you willing to relocate if required?');
    expect(scan.fields.find((f) => f.kind === 'checkbox-group')?.options).toEqual(['Payments', 'Healthcare', 'Compliance', 'E-commerce']);
    expect(scan.fields.find((f) => f.kind === 'checkbox')?.label).toMatch(/^I agree to Northwind/);
  });
  it('skips passwords, files, payment and hidden honeypot fields', () => {
    expect(scan.skipped.map((s) => s.reason).sort()).toEqual(['file', 'password', 'sensitive']);
    expect(scan.fields.some((f) => f.name === 'website_url_hp' || f.name === 'cardnumber' || f.name === 'password')).toBe(false);
  });
});

describe('answer pipeline', () => {
  it('answers direct fields from the profile, flags gaps and never guesses', async () => {
    const { answers, aiFieldCount } = await generateAnswers(profile, { page: scan, fields: scan.fields }, llm);
    const by = (name: string) => answers.find((a) => a.id === scan.fields.find((f) => f.name === name)!.id)!;
    expect(by('first_name')).toMatchObject({ value: 'Ada', method: 'profile', status: 'answered' });
    expect(by('email').value).toBe('ada@example.com');
    expect(by('country').value).toBe('United Kingdom'); // "UK" mapped to the option
    expect(by('current_title').value).toBe('Product Operations Manager');
    expect(by('salary')).toMatchObject({ status: 'needs_info' });
    expect(by('relocate')).toMatchObject({ status: 'needs_info' }); // invented option rejected
    expect(by('years').value).toBe('6');
    expect(by('notice').value).toBe('1 month');
    expect(by('gender')).toMatchObject({ status: 'needs_info', method: 'profile' });
    expect(by('consent')).toMatchObject({ status: 'needs_info', method: 'profile' });
    expect(aiFieldCount).toBeLessThan(scan.fields.length);
  });
  it('sends only relevant profile sections to the LLM — never contact details', async () => {
    await generateAnswers(profile, { page: scan, fields: scan.fields }, llm);
    expect(lastPrompt).not.toContain('ada@example.com');
    expect(lastPrompt).not.toContain('+44 7700');
    expect(lastPrompt).toContain('<page>');
  });
});

describe('filler', () => {
  it('fills approved values without submitting', async () => {
    let submitted = false;
    document.querySelector('form')!.addEventListener('submit', () => { submitted = true; });
    const { answers } = await generateAnswers(profile, { page: scan, fields: scan.fields }, llm);
    const values = answers.filter((a) => a.status === 'answered').map((a) => ({ id: a.id, kind: scan.fields.find((f) => f.id === a.id)!.kind, value: a.value as any }));
    const results = inject(fillFields)(values, false);
    expect(results.every((r) => r.ok)).toBe(true);
    expect((document.getElementById('fn') as HTMLInputElement).value).toBe('Ada');
    expect((document.getElementById('country') as HTMLSelectElement).value).toBe('GB');
    expect((document.getElementById('notice') as HTMLSelectElement).value).toBe('1 month');
    const areas = Array.from(document.querySelectorAll<HTMLInputElement>('input[name=areas]')).filter((i) => i.checked).map((i) => i.value);
    expect(areas).toEqual(['payments', 'compliance']);
    expect((document.querySelector('input[name=consent]') as HTMLInputElement).checked).toBe(false);
    expect(submitted).toBe(false);
  });
  it('fires input events so framework-controlled inputs update', () => {
    const el = document.getElementById('fn') as HTMLInputElement;
    let seen = '';
    el.addEventListener('input', () => { seen = el.value; });
    inject(fillFields)([{ id: el.getAttribute('data-formpilot-id')!, kind: 'text', value: 'Zed' }], false);
    expect(seen).toBe('Zed');
  });
});
