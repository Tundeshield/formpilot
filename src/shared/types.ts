// ---------- Knowledge profile (stored as JSONB in profiles.data) ----------

export interface Experience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate?: string; // free text, e.g. "2021-03" or "Mar 2021"
  endDate?: string; // empty = present
  current?: boolean;
  description?: string;
  achievements?: string[];
}

export interface Education {
  id: string;
  institution: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
  description?: string;
}

export interface Fact {
  id: string;
  label: string; // e.g. "Notice period"
  value: string; // e.g. "One month"
}

export interface Profile {
  personal?: {
    firstName?: string;
    lastName?: string;
    preferredName?: string;
    headline?: string; // "Product Operations Manager"
    pronouns?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
    addressLine?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  links?: {
    linkedin?: string;
    github?: string;
    website?: string;
    portfolio?: string;
  };
  summary?: string;
  experience?: Experience[];
  education?: Education[];
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  facts?: Fact[];
}

export type ProfileSection =
  | 'personal'
  | 'contact'
  | 'links'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'facts';

// ---------- Form detection ----------

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox' // single boolean checkbox
  | 'checkbox-group';

export interface DetectedField {
  id: string; // data-formpilot-id assigned by the scanner
  kind: FieldKind;
  inputType?: string; // email, tel, url, number, date…
  label: string;
  name?: string;
  placeholder?: string;
  helpText?: string;
  autocomplete?: string;
  options?: string[]; // select / radio / checkbox-group
  required: boolean;
  maxLength?: number;
  currentValue?: string | string[] | boolean;
  section?: string; // nearest heading / legend
}

export interface ScanResult {
  url: string;
  title: string;
  host: string;
  pageContext: string; // h1 + meta description, trimmed
  fields: DetectedField[];
  skipped: { reason: 'sensitive' | 'file' | 'password'; label: string }[];
}

// ---------- Answer generation ----------

export type AnswerStatus = 'answered' | 'needs_info';

export interface GeneratedAnswer {
  id: string;
  status: AnswerStatus;
  value: string | string[] | boolean | null;
  confidence: number; // 0..1
  reason?: string; // why it needs info / caveats
  sources: ProfileSection[]; // which parts of the profile were used
  method: 'profile' | 'ai';
}

export interface GenerateRequest {
  page: { url: string; title: string; host: string; pageContext: string };
  fields: DetectedField[];
  regenerate?: { previous?: string; instruction?: string };
}

export interface GenerateResponse {
  answers: GeneratedAnswer[];
  usage: { used: number; limit: number };
}

export type FillValue = { id: string; kind: FieldKind; value: string | string[] | boolean };
export type FillResult = { id: string; ok: boolean; error?: string };

export function confidenceLevel(a: Pick<GeneratedAnswer, 'status' | 'confidence'>): 'high' | 'medium' | 'low' | 'missing' {
  if (a.status === 'needs_info') return 'missing';
  if (a.confidence >= 0.8) return 'high';
  if (a.confidence >= 0.55) return 'medium';
  return 'low';
}
