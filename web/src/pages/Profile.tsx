import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Education, Experience, Fact, Profile } from '../../../src/shared/types';
import { useAuth } from '../lib/auth';
import { completeness, loadProfile, newId, saveProfile } from '../lib/profile';
import { PageHeader } from '../components/Layout';

const FACT_SUGGESTIONS = [
  'Work authorization', 'Requires visa sponsorship', 'Notice period', 'Earliest start date',
  'Salary expectation', 'Willing to relocate', 'Preferred work arrangement', 'Years of experience', 'How did you hear about us',
];

export function ProfilePage() {
  const { user } = useAuth();
  const uid = user!.uid;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadProfile(uid).then((p) => { setProfile(p); setSaved(JSON.stringify(p)); }).catch((e) => setError(e.message));
  }, [uid]);

  if (error && !profile) return <div className="notice notice-error">{error}</div>;
  if (!profile) return <span className="spinner" />;

  const dirty = JSON.stringify(profile) !== saved;
  const set = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch });
  const setIn = <K extends 'personal' | 'contact' | 'links'>(k: K, key: string, v: string) =>
    setProfile({ ...profile, [k]: { ...(profile[k] || {}), [key]: v } });
  const { pct, missing } = completeness(profile);

  async function save() {
    setBusy(true); setError('');
    try { await saveProfile(uid, profile!); setSaved(JSON.stringify(profile)); setToast('Profile saved'); setTimeout(() => setToast(''), 2200); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
    setBusy(false);
  }

  const text = (k: 'personal' | 'contact' | 'links', key: string, label: string, type = 'text', ac?: string) => (
    <label className="field">{label}
      <input className="input" type={type} autoComplete={ac} value={((profile[k] || {}) as Record<string, string>)[key] || ''} onChange={(e) => setIn(k, key, e.target.value)} />
    </label>
  );

  return (
    <>
      <PageHeader
        title="Your profile"
        subtitle="This is FormPilot's knowledge base. Answers are only ever drawn from what's here."
        actions={<Link className="btn" to="/app/documents">Import from CV</Link>}
      />

      <div className="card card-body stack" style={{ gap: 10, marginBottom: 32 }}>
        <div className="row between"><h3>Profile strength</h3><span className="subtle">{pct}%</span></div>
        <div className="progress"><div style={{ width: `${pct}%` }} /></div>
        {missing.length > 0 && <p className="subtle">Add {missing.slice(0, 4).join(', ').toLowerCase()} to answer more questions confidently.</p>}
      </div>

      <Section title="Personal" desc="How forms should refer to you.">
        <div className="grid-2">
          {text('personal', 'firstName', 'First name', 'text', 'given-name')}
          {text('personal', 'lastName', 'Last name', 'text', 'family-name')}
          {text('personal', 'preferredName', 'Preferred name')}
          {text('personal', 'headline', 'Professional headline')}
        </div>
      </Section>

      <Section title="Contact" desc="Used only for contact fields — never put into free-text answers.">
        <div className="grid-2">
          {text('contact', 'email', 'Email', 'email', 'email')}
          {text('contact', 'phone', 'Phone', 'tel', 'tel')}
        </div>
        {text('contact', 'addressLine', 'Street address', 'text', 'street-address')}
        <div className="grid-2">
          {text('contact', 'city', 'City')}
          {text('contact', 'region', 'State / region')}
          {text('contact', 'postalCode', 'Postal code')}
          {text('contact', 'country', 'Country')}
        </div>
      </Section>

      <Section title="Links">
        <div className="grid-2">
          {text('links', 'linkedin', 'LinkedIn', 'url')}
          {text('links', 'github', 'GitHub', 'url')}
          {text('links', 'website', 'Website', 'url')}
          {text('links', 'portfolio', 'Portfolio', 'url')}
        </div>
      </Section>

      <Section title="Summary" desc="A few sentences about who you are professionally. Powers 'Tell us about yourself'.">
        <textarea className="input" rows={5} value={profile.summary || ''} onChange={(e) => set({ summary: e.target.value })} placeholder="e.g. Product operations manager with 6 years in regulated fintech…" />
      </Section>

      <Section title="Experience" desc="Specific achievements produce specific answers.">
        <ListEditor<Experience>
          items={profile.experience || []}
          onChange={(experience) => set({ experience })}
          blank={() => ({ id: newId(), title: '', company: '' })}
          addLabel="Add role"
          title={(x) => [x.title, x.company].filter(Boolean).join(' · ') || 'New role'}
          render={(x, up) => (
            <>
              <div className="grid-2">
                <label className="field">Job title<input className="input" value={x.title} onChange={(e) => up({ title: e.target.value })} /></label>
                <label className="field">Company<input className="input" value={x.company} onChange={(e) => up({ company: e.target.value })} /></label>
              </div>
              <div className="grid-3">
                <label className="field">Start<input className="input" placeholder="2021-03" value={x.startDate || ''} onChange={(e) => up({ startDate: e.target.value })} /></label>
                <label className="field">End<input className="input" placeholder={x.current ? 'Present' : '2024-06'} disabled={x.current} value={x.current ? '' : x.endDate || ''} onChange={(e) => up({ endDate: e.target.value })} /></label>
                <label className="field">Location<input className="input" value={x.location || ''} onChange={(e) => up({ location: e.target.value })} /></label>
              </div>
              <label className="row subtle"><input type="checkbox" checked={!!x.current} onChange={(e) => up({ current: e.target.checked, endDate: e.target.checked ? '' : x.endDate })} /> I currently work here</label>
              <label className="field">Description & achievements
                <textarea className="input" rows={4} value={[x.description, ...(x.achievements || []).map((a) => `• ${a}`)].filter(Boolean).join('\n')}
                  onChange={(e) => up({ description: e.target.value, achievements: [] })} />
              </label>
            </>
          )}
        />
      </Section>

      <Section title="Education">
        <ListEditor<Education>
          items={profile.education || []}
          onChange={(education) => set({ education })}
          blank={() => ({ id: newId(), institution: '' })}
          addLabel="Add education"
          title={(x) => [x.degree, x.institution].filter(Boolean).join(' · ') || 'New entry'}
          render={(x, up) => (
            <>
              <label className="field">Institution<input className="input" value={x.institution} onChange={(e) => up({ institution: e.target.value })} /></label>
              <div className="grid-2">
                <label className="field">Degree<input className="input" value={x.degree || ''} onChange={(e) => up({ degree: e.target.value })} /></label>
                <label className="field">Field of study<input className="input" value={x.field || ''} onChange={(e) => up({ field: e.target.value })} /></label>
              </div>
              <div className="grid-3">
                <label className="field">Start<input className="input" value={x.startDate || ''} onChange={(e) => up({ startDate: e.target.value })} /></label>
                <label className="field">End<input className="input" value={x.endDate || ''} onChange={(e) => up({ endDate: e.target.value })} /></label>
                <label className="field">Grade<input className="input" value={x.grade || ''} onChange={(e) => up({ grade: e.target.value })} /></label>
              </div>
            </>
          )}
        />
      </Section>

      <Section title="Skills" desc="Press Enter or comma to add.">
        <TagInput values={profile.skills || []} onChange={(skills) => set({ skills })} placeholder="e.g. Product operations, SQL, React" />
      </Section>
      <Section title="Certifications">
        <TagInput values={profile.certifications || []} onChange={(certifications) => set({ certifications })} placeholder="e.g. PRINCE2 Practitioner" />
      </Section>
      <Section title="Languages">
        <TagInput values={profile.languages || []} onChange={(languages) => set({ languages })} placeholder="e.g. English (native), French (conversational)" />
      </Section>

      <Section title="Common form answers" desc="Facts forms often ask for. FormPilot will flag these questions if they're missing instead of guessing.">
        <FactsEditor facts={profile.facts || []} onChange={(facts) => set({ facts })} />
      </Section>

      {error && <div className="notice notice-error">{error}</div>}
      {(dirty || toast) && (
        <div className="savebar" role="status">
          {toast ? <span style={{ padding: '6px 8px 6px 0' }}>{toast}</span> : (
            <>
              <span>Unsaved changes</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setProfile(JSON.parse(saved))}>Discard</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : 'Save profile'}</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-intro"><h2>{title}</h2>{desc && <p className="subtle">{desc}</p>}</div>
      <div className="stack">{children}</div>
    </section>
  );
}

function ListEditor<T extends { id: string }>(props: {
  items: T[]; onChange: (v: T[]) => void; blank: () => T; addLabel: string;
  title: (x: T) => string; render: (x: T, up: (p: Partial<T>) => void) => ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const { items, onChange } = props;
  return (
    <div>
      {items.map((x, i) => (
        <div className="item" key={x.id}>
          <div className="item-head" style={open === x.id ? undefined : { marginBottom: 0 }}>
            <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontWeight: 600, color: 'var(--text)' }} onClick={() => setOpen(open === x.id ? null : x.id)}>
              {props.title(x)}
            </button>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === x.id ? null : x.id)}>{open === x.id ? 'Done' : 'Edit'}</button>
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div>
          {open === x.id && <div className="stack">{props.render(x, (p) => onChange(items.map((y, j) => (j === i ? { ...y, ...p } : y))))}</div>}
        </div>
      ))}
      <button className="btn btn-sm" style={{ marginTop: items.length ? 12 : 0 }} onClick={() => { const b = props.blank(); onChange([...items, b]); setOpen(b.id); }}>+ {props.addLabel}</button>
    </div>
  );
}

function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...values, ...parts]);
    setDraft('');
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      {values.length > 0 && (
        <div className="row wrap">
          {values.map((v) => <span className="chip" key={v}>{v}<button aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button></span>)}
        </div>
      )}
      <input className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }} />
    </div>
  );
}

function FactsEditor({ facts, onChange }: { facts: Fact[]; onChange: (f: Fact[]) => void }) {
  const unused = FACT_SUGGESTIONS.filter((s) => !facts.some((f) => f.label.toLowerCase() === s.toLowerCase()));
  const up = (i: number, p: Partial<Fact>) => onChange(facts.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {facts.map((f, i) => (
        <div className="row" key={f.id} style={{ alignItems: 'flex-start' }}>
          <input className="input" style={{ flex: '0 0 38%' }} value={f.label} placeholder="Question" onChange={(e) => up(i, { label: e.target.value })} />
          <input className="input" value={f.value} placeholder="Your answer" onChange={(e) => up(i, { value: e.target.value })} />
          <button className="btn btn-ghost btn-sm btn-danger" style={{ marginTop: 4 }} aria-label="Remove" onClick={() => onChange(facts.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <div className="row wrap">
        {unused.slice(0, 6).map((s) => <button key={s} className="btn btn-sm" onClick={() => onChange([...facts, { id: newId(), label: s, value: '' }])}>+ {s}</button>)}
        <button className="btn btn-sm btn-ghost" onClick={() => onChange([...facts, { id: newId(), label: '', value: '' }])}>+ Custom</button>
      </div>
    </div>
  );
}
