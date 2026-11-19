import type { Profile } from '../../../src/shared/types';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export const newId = () => Math.random().toString(36).slice(2, 10);

export async function loadProfile(userId: string): Promise<Profile> {
  const snap = await getDoc(doc(db, 'users', userId));
  const p = (snap.data()?.profile || {}) as Profile;
  // First visit: start the profile with the account email.
  if (!snap.exists() && auth.currentUser?.email) p.contact = { email: auth.currentUser.email };
  return p;
}

export async function saveProfile(userId: string, profile: Profile) {
  const clean = JSON.parse(JSON.stringify(profile, (_k, v) => (v === '' ? undefined : v)));
  await setDoc(doc(db, 'users', userId), { profile: clean, updatedAt: serverTimestamp() }, { merge: true });
}

/** Completeness heuristic used for the dashboard header. */
export function completeness(p: Profile): { pct: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!(p.personal?.firstName && p.personal?.lastName), 'Name'],
    [!!p.contact?.email, 'Email'],
    [!!p.contact?.phone, 'Phone'],
    [!!(p.contact?.city || p.contact?.country), 'Location'],
    [!!p.summary && p.summary.length > 80, 'Summary'],
    [(p.experience?.length || 0) > 0, 'Experience'],
    [(p.education?.length || 0) > 0, 'Education'],
    [(p.skills?.length || 0) >= 3, 'Skills'],
    [(p.facts?.length || 0) > 0, 'Form answers'],
  ];
  return { pct: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100), missing: checks.filter((c) => !c[0]).map((c) => c[1]) };
}

/** Merge an extracted profile into the existing one. Existing values win unless empty; lists are appended without duplicates. */
export function mergeProfile(base: Profile, add: Profile): Profile {
  const out: Profile = structuredClone(base);
  const mergeObj = <K extends 'personal' | 'contact' | 'links'>(k: K) => {
    const cur = { ...(out[k] || {}) } as Record<string, string | undefined>;
    for (const [key, v] of Object.entries(add[k] || {})) if (v && !cur[key]) cur[key] = v as string;
    (out as any)[k] = cur;
  };
  mergeObj('personal'); mergeObj('contact'); mergeObj('links');
  if (add.summary && !out.summary) out.summary = add.summary;
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const exp = out.experience || [];
  for (const x of add.experience || []) if (!exp.some((e) => key(e.title + e.company) === key(x.title + x.company))) exp.push({ ...x, id: newId() });
  out.experience = exp;
  const edu = out.education || [];
  for (const x of add.education || []) if (!edu.some((e) => key(e.institution + (e.degree || '')) === key(x.institution + (x.degree || '')))) edu.push({ ...x, id: newId() });
  out.education = edu;
  for (const k of ['skills', 'certifications', 'languages'] as const) {
    const list = out[k] || [];
    for (const s of add[k] || []) if (!list.some((x) => key(x) === key(s))) list.push(s);
    out[k] = list;
  }
  return out;
}
