import type { DetectedField, Profile, ProfileSection } from './types';

/** Deterministic purposes that map 1:1 onto a profile value (no LLM needed). */
export type DirectPurpose =
  | 'email' | 'phone' | 'firstName' | 'lastName' | 'fullName' | 'preferredName'
  | 'addressLine' | 'city' | 'region' | 'postalCode' | 'country' | 'location'
  | 'linkedin' | 'github' | 'website' | 'portfolio'
  | 'currentTitle' | 'currentCompany';

export type Classification =
  | { type: 'direct'; purpose: DirectPurpose; section: ProfileSection }
  | { type: 'personal-decision'; reason: string }
  | { type: 'open'; sections: ProfileSection[] };

const norm = (s: string | undefined) => (s || '').toLowerCase().replace(/[_\-\[\]]+/g, ' ').replace(/\s+/g, ' ').trim();

const AUTOCOMPLETE: Record<string, DirectPurpose> = {
  email: 'email', tel: 'phone', 'tel-national': 'phone', 'given-name': 'firstName', 'family-name': 'lastName',
  name: 'fullName', nickname: 'preferredName', 'street-address': 'addressLine', 'address-line1': 'addressLine',
  'address-level2': 'city', 'address-level1': 'region', 'postal-code': 'postalCode', country: 'country',
  'country-name': 'country', url: 'website', 'organization-title': 'currentTitle', organization: 'currentCompany',
};

// Ordered: first match wins. Tested against "label + name + placeholder".
const PATTERNS: [RegExp, DirectPurpose][] = [
  [/\be ?mail\b/, 'email'],
  [/\b(phone|mobile|telephone|tel|cell)\b/, 'phone'],
  [/\blinked ?in\b/, 'linkedin'],
  [/\bgit ?hub\b/, 'github'],
  [/\bportfolio\b/, 'portfolio'],
  [/\b(website|personal site|homepage|blog url)\b/, 'website'],
  [/\b(first|given|fore) ?name\b|\bfname\b/, 'firstName'],
  [/\b(last|family|sur) ?name\b|\bsurname\b|\blname\b/, 'lastName'],
  [/\b(preferred|nick) ?name\b/, 'preferredName'],
  [/^(full |your |legal )?name\*?$|\bfull name\b|\byour (full )?name\b|\blegal name\b/, 'fullName'],
  [/\b(street|address line|address 1|address)\b(?!.*e ?mail)/, 'addressLine'],
  [/\b(zip|postal|post) ?code\b|\bpostcode\b/, 'postalCode'],
  [/\b(city|town)\b/, 'city'],
  [/^(state|province|county|region)( ?\/ ?(state|province|region|county))?\*?$|\bstate or province\b/, 'region'],
  [/\bcountry\b(?!.*(authori|eligib|citizen|visa|work))/, 'country'],
  [/^(current )?location$|\bwhere are you (based|located)\b|\bcurrent location\b/, 'location'],
  [/\b(current|most recent) (job )?(title|position|role)\b|^job title$/, 'currentTitle'],
  [/\b(current|most recent) (company|employer|organi[sz]ation)\b|^company$|^employer$/, 'currentCompany'],
];

const SECTION_OF: Record<DirectPurpose, ProfileSection> = {
  email: 'contact', phone: 'contact', addressLine: 'contact', city: 'contact', region: 'contact',
  postalCode: 'contact', country: 'contact', location: 'contact',
  firstName: 'personal', lastName: 'personal', fullName: 'personal', preferredName: 'personal',
  linkedin: 'links', github: 'links', website: 'links', portfolio: 'links',
  currentTitle: 'experience', currentCompany: 'experience',
};

const PERSONAL_DECISION: [RegExp, string][] = [
  [/\b(gender|sex|race|ethnic|hispanic|latino|veteran|disab|sexual orientation|transgender|religio)/,
    'Voluntary self-identification — please answer this yourself.'],
  [/\b(i agree|i accept|i consent|terms|privacy policy|acknowledge|i certify|i confirm|i understand|declar|attest|signature|sign here)\b/,
    'Consent or legal declaration — FormPilot never agrees on your behalf.'],
  [/\b(newsletter|marketing|subscribe|opt in|promotional)\b/, 'Marketing preference — your choice.'],
];

const OPEN_TOPICS: [RegExp, ProfileSection[]][] = [
  [/\b(experience|role|job|position|work|career|employ|manag|led|lead|project|challeng|achiev|accomplish|responsib)/, ['summary', 'experience']],
  [/\b(skill|tool|technolog|stack|language|proficien|expert|strength)/, ['skills', 'languages', 'certifications']],
  [/\b(educat|degree|university|college|school|qualif|study|gpa|grade)/, ['education', 'certifications']],
  [/\b(about yourself|about you|introduce|bio|summary|why|interest|motivat|cover letter|fit|value|goal)/, ['summary', 'experience', 'skills']],
  [/\b(salary|compensation|notice|start date|available|relocat|visa|sponsor|authori[sz]|eligib|citizen|remote|hybrid|travel|years of)/, ['facts', 'experience', 'contact']],
  [/\b(speak|fluent|language)/, ['languages']],
];

export function fieldText(f: Pick<DetectedField, 'label' | 'name' | 'placeholder'>): string {
  return norm([f.label, f.name, f.placeholder].filter(Boolean).join(' '));
}

export function classifyField(f: DetectedField): Classification {
  const label = norm(f.label);
  const text = fieldText(f);

  // Self-ID applies to short choice/text questions; consent & marketing only to tick-boxes.
  const choice = f.kind === 'checkbox' || f.kind === 'checkbox-group' || f.kind === 'radio';
  for (const [i, [re, reason]] of PERSONAL_DECISION.entries()) {
    const applies = i === 0 ? f.kind !== 'textarea' && label.length <= 70 : choice;
    if (applies && (re.test(label) || (f.kind === 'checkbox' && re.test(text)))) return { type: 'personal-decision', reason };
  }

  // Long-form questions are never "direct" even if they mention e.g. "email".
  const isLongForm = f.kind === 'textarea' || label.length > 70;
  if (!isLongForm) {
    const ac = (f.autocomplete || '').toLowerCase().split(/\s+/).pop() || '';
    if (AUTOCOMPLETE[ac]) return direct(AUTOCOMPLETE[ac]);
    if (f.inputType === 'email') return direct('email');
    if (f.inputType === 'tel') return direct('phone');
    for (const [re, purpose] of PATTERNS) {
      if (re.test(label) || (!label && re.test(text))) return direct(purpose);
    }
    if (!label) for (const [re, purpose] of PATTERNS) if (re.test(text)) return direct(purpose);
  }

  const sections = new Set<ProfileSection>();
  for (const [re, secs] of OPEN_TOPICS) if (re.test(text)) secs.forEach((s) => sections.add(s));
  sections.add('facts'); // user-provided Q&A facts are always eligible for open questions
  if (sections.size === 1) ['summary', 'experience', 'skills'].forEach((s) => sections.add(s as ProfileSection));
  return { type: 'open', sections: [...sections] };
}

function direct(purpose: DirectPurpose): Classification {
  return { type: 'direct', purpose, section: SECTION_OF[purpose] };
}

export function currentRole(p: Profile) {
  const xs = p.experience || [];
  return xs.find((x) => x.current || !x.endDate) || xs[0];
}

export function directValue(purpose: DirectPurpose, p: Profile): string | undefined {
  const c = p.contact || {}, per = p.personal || {}, l = p.links || {};
  const v = (() => {
    switch (purpose) {
      case 'email': return c.email;
      case 'phone': return c.phone;
      case 'firstName': return per.firstName;
      case 'lastName': return per.lastName;
      case 'preferredName': return per.preferredName || per.firstName;
      case 'fullName': return [per.firstName, per.lastName].filter(Boolean).join(' ');
      case 'addressLine': return c.addressLine;
      case 'city': return c.city;
      case 'region': return c.region;
      case 'postalCode': return c.postalCode;
      case 'country': return c.country;
      case 'location': return [c.city, c.region, c.country].filter(Boolean).join(', ');
      case 'linkedin': return l.linkedin;
      case 'github': return l.github;
      case 'website': return l.website || l.portfolio;
      case 'portfolio': return l.portfolio || l.website;
      case 'currentTitle': return currentRole(p)?.title || per.headline;
      case 'currentCompany': return currentRole(p)?.company;
    }
  })();
  return v && v.trim() ? v.trim() : undefined;
}

const SYNONYMS: string[][] = [
  ['united kingdom', 'uk', 'great britain', 'britain', 'england', 'gb'],
  ['united states', 'usa', 'us', 'united states of america', 'america'],
  ["cote d'ivoire", "côte d'ivoire", 'ivory coast', 'cote divoire'],
  ['united arab emirates', 'uae'],
  ['yes', 'y', 'true'],
  ['no', 'n', 'false'],
];

const simplify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Map a free-text value to one of the provided options. Returns undefined if no confident match. */
export function matchOption(value: string, options: string[]): string | undefined {
  const v = simplify(value);
  if (!v) return undefined;
  const opts = options.map((o) => ({ o, s: simplify(o) }));
  const exact = opts.find((x) => x.s === v);
  if (exact) return exact.o;
  const group = SYNONYMS.find((g) => g.map(simplify).includes(v));
  if (group) {
    const hit = opts.find((x) => group.map(simplify).includes(x.s));
    if (hit) return hit.o;
  }
  const starts = opts.filter((x) => x.s.length > 1 && (x.s.startsWith(v) || v.startsWith(x.s)));
  if (starts.length === 1) return starts[0].o;
  return undefined;
}

/** Options that are placeholders like "Select…" should never be chosen. */
export function isPlaceholderOption(o: string): boolean {
  return /^(\s*|-+|select.*|choose.*|please select.*|--.*)$/i.test(o.trim());
}
