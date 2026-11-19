import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../../../src/shared/types';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { extractText } from '../lib/extractText';
import { loadProfile, mergeProfile, saveProfile } from '../lib/profile';
import { PageHeader } from '../components/Layout';

interface Doc {
  id: string; file_name: string; storage_path: string; size_bytes: number; status: string;
  extracted: Profile | null; error: string | null; created_at: string;
}

const ACCEPT = '.pdf,.docx,.txt,.md';

export function DocumentsPage() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<Doc | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message); else setDocs(data as Doc[]);
  }
  useEffect(() => { refresh(); }, []);

  async function upload(file: File) {
    setError('');
    if (file.size > 10 * 1024 * 1024) return setError('Files must be under 10 MB.');
    try {
      setBusy('Uploading…');
      const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || undefined });
      if (up.error) throw up.error;
      const { data: doc, error } = await supabase.from('documents')
        .insert({ user_id: uid, file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size })
        .select().single();
      if (error) throw error;
      setBusy('Reading document…');
      const text = await extractText(file);
      if (text.length < 40) {
        await supabase.from('documents').update({ status: 'failed', error: 'No readable text (scanned PDFs are not supported yet).' }).eq('id', doc.id);
        throw new Error('This file has no readable text. Scanned/image-only PDFs need OCR, which the MVP does not support yet.');
      }
      setBusy('Extracting your information with AI…');
      const { extracted } = await api<{ extracted: Profile }>('/api/extract', { documentId: doc.id, text });
      await refresh();
      setReviewing({ ...(doc as Doc), status: 'extracted', extracted });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      await refresh();
    } finally { setBusy(''); }
  }

  async function remove(d: Doc) {
    if (!confirm(`Delete ${d.file_name}? Information already added to your profile stays.`)) return;
    await supabase.storage.from('documents').remove([d.storage_path]);
    await supabase.from('documents').delete().eq('id', d.id);
    refresh();
  }

  async function open(d: Doc) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (reviewing?.extracted) return <Review doc={reviewing} uid={uid} onDone={() => { setReviewing(null); refresh(); }} />;

  return (
    <>
      <PageHeader title="Documents" subtitle="Upload a CV or professional profile. FormPilot extracts the facts; you choose what goes into your profile." />
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f && !busy) upload(f); }}
        role="button" tabIndex={0}
      >
        {busy ? <div className="row" style={{ justifyContent: 'center' }}><span className="spinner" /> {busy}</div> : (
          <div className="stack" style={{ gap: 4 }}>
            <strong>Drop a file or click to upload</strong>
            <span className="subtle">PDF, DOCX or TXT · up to 10 MB · tip: LinkedIn → More → Save to PDF</span>
          </div>
        )}
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
      </div>
      {error && <div className="notice notice-error" style={{ marginTop: 14 }}>{error}</div>}

      <div className="card" style={{ marginTop: 24 }}>
        {docs === null ? <div className="card-body"><span className="spinner" /></div> : docs.length === 0 ? (
          <div className="card-body subtle">No documents yet.</div>
        ) : docs.map((d) => (
          <div className="doc-row" key={d.id}>
            <div className="doc-icon">{d.file_name.split('.').pop()?.toUpperCase().slice(0, 4)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</div>
              <div className="subtle">{new Date(d.created_at).toLocaleDateString()} · {Math.max(1, Math.round(d.size_bytes / 1024))} KB{d.error ? ` · ${d.error}` : ''}</div>
            </div>
            <span className={`badge ${d.status === 'merged' ? 'badge-high' : d.status === 'failed' ? 'badge-missing' : d.status === 'extracted' ? 'badge-medium' : ''}`}>
              {{ uploaded: 'Uploaded', extracted: 'Ready to review', merged: 'Added to profile', failed: 'Failed' }[d.status] || d.status}
            </span>
            {d.extracted && <button className="btn btn-sm" onClick={() => setReviewing(d)}>Review</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => open(d)}>Open</button>
            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(d)}>Delete</button>
          </div>
        ))}
      </div>
    </>
  );
}

type Pick = Record<string, boolean>;

function Review({ doc, uid, onDone }: { doc: Doc; uid: string; onDone: () => void }) {
  const x = doc.extracted!;
  const rows: { key: string; group: string; label: string; apply: (p: Profile) => Profile }[] = [];
  const scalar = (group: string, obj: 'personal' | 'contact' | 'links', names: Record<string, string>) => {
    for (const [k, label] of Object.entries(names)) {
      const v = (x[obj] as Record<string, string> | undefined)?.[k];
      if (v) rows.push({ key: `${obj}.${k}`, group, label: `${label}: ${v}`, apply: (p) => ({ ...p, [obj]: { ...(p[obj] || {}), [k]: v } }) });
    }
  };
  scalar('Personal & contact', 'personal', { firstName: 'First name', lastName: 'Last name', headline: 'Headline' });
  scalar('Personal & contact', 'contact', { email: 'Email', phone: 'Phone', city: 'City', region: 'Region', country: 'Country' });
  scalar('Links', 'links', { linkedin: 'LinkedIn', github: 'GitHub', website: 'Website', portfolio: 'Portfolio' });
  if (x.summary) rows.push({ key: 'summary', group: 'Summary', label: x.summary, apply: (p) => ({ ...p, summary: x.summary }) });
  (x.experience || []).forEach((e, i) => rows.push({
    key: `exp${i}`, group: 'Experience', label: `${e.title} · ${e.company}${e.startDate ? ` (${e.startDate}–${e.current ? 'present' : e.endDate || ''})` : ''}`,
    apply: (p) => mergeProfile(p, { experience: [e] }),
  }));
  (x.education || []).forEach((e, i) => rows.push({
    key: `edu${i}`, group: 'Education', label: [e.degree, e.field, e.institution].filter(Boolean).join(' · '),
    apply: (p) => mergeProfile(p, { education: [e] }),
  }));
  for (const k of ['skills', 'certifications', 'languages'] as const) {
    if (x[k]?.length) rows.push({ key: k, group: k[0].toUpperCase() + k.slice(1), label: x[k]!.join(', '), apply: (p) => mergeProfile(p, { [k]: x[k] }) });
  }

  const [picked, setPicked] = useState<Pick>(() => Object.fromEntries(rows.map((r) => [r.key, true])));
  const [current, setCurrent] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { loadProfile(uid).then(setCurrent); }, [uid]);

  async function apply() {
    if (!current) return;
    setBusy(true);
    try {
      // Scalar picks overwrite (the user explicitly ticked them); list picks are appended without duplicates.
      const next = rows.filter((r) => picked[r.key]).reduce((p, r) => r.apply(p), current);
      await saveProfile(uid, next);
      await supabase.from('documents').update({ status: 'merged' }).eq('id', doc.id);
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); setBusy(false); }
  }

  const groups = [...new Set(rows.map((r) => r.group))];
  const existing = (key: string) => {
    if (!current || !key.includes('.')) return undefined;
    const [o, k] = key.split('.');
    return ((current as any)[o] || {})[k] as string | undefined;
  };

  return (
    <>
      <PageHeader title="Review extracted information" subtitle={<>From <strong>{doc.file_name}</strong>. Untick anything that's wrong — nothing is added until you confirm.</>}
        actions={<><button className="btn btn-ghost" onClick={onDone}>Cancel</button><button className="btn btn-primary" onClick={apply} disabled={busy || !current}>{busy ? <span className="spinner" /> : `Add ${Object.values(picked).filter(Boolean).length} items to profile`}</button></>} />
      {error && <div className="notice notice-error">{error}</div>}
      {rows.length === 0 ? <div className="notice">Nothing could be extracted from this document.</div> : (
        <div className="card">
          {groups.map((g, gi) => (
            <div className="review-group" key={g} style={gi === 0 ? { borderTop: 0 } : undefined}>
              <h3 style={{ marginBottom: 6 }}>{g}</h3>
              {rows.filter((r) => r.group === g).map((r) => {
                const ex = existing(r.key);
                return (
                  <label className="review-item" key={r.key}>
                    <input type="checkbox" checked={!!picked[r.key]} onChange={(e) => setPicked({ ...picked, [r.key]: e.target.checked })} />
                    <span style={{ flex: 1 }}>
                      {r.label.length > 400 ? r.label.slice(0, 400) + '…' : r.label}
                      {ex && !r.label.endsWith(`: ${ex}`) && <span className="subtle"> — replaces “{ex}”</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
