import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { updatePassword } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { deleteObject, listAll, ref } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { friendly } from './Auth';
import { api } from '../lib/api';
import { applyTextSize } from '../lib/textsize';
import { PageHeader } from '../components/Layout';

export function AccountPage() {
  const { user: u } = useAuth();
  const user = u!;
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [usageErr, setUsageErr] = useState('');
  const [size, setSize] = useState(() => applyTextSize());
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { api<{ used: number; limit: number }>('/api/usage').then(setUsage).catch((e) => setUsageErr(e.message)); }, []);

  async function changePassword() {
    try { await updatePassword(user, pw); setMsg({ ok: true, text: 'Password updated.' }); setPw(''); }
    catch (e) { setMsg({ ok: false, text: friendly(e) }); }
  }

  async function deleteData() {
    if (!confirm('Permanently delete your profile and all uploaded documents? This cannot be undone.')) return;
    const files = await listAll(ref(storage, `users/${user.uid}/documents`));
    await Promise.all(files.items.map((f) => deleteObject(f)));
    const docs = await getDocs(collection(db, 'users', user.uid, 'documents'));
    await Promise.all(docs.docs.map((d) => deleteDoc(d.ref)));
    await setDoc(doc(db, 'users', user.uid), { profile: { contact: { email: user.email } } });
    setMsg({ ok: true, text: 'Your profile and documents have been deleted.' });
  }

  const pct = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <>
      <PageHeader title="Account" />
      <div className="stack" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-head"><h2>Usage this month</h2><span className="badge plain">Free plan</span></div>
          <div className="card-body stack" style={{ gap: 10 }}>
            {usageErr ? <div className="notice notice-error">{usageErr}</div> : !usage ? <span className="spinner" /> : (
              <>
                <div className="row between"><div className="stat"><strong>{usage.used}</strong><span className="subtle">of {usage.limit} AI-generated answers</span></div></div>
                <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                <p className="subtle">Fields filled straight from your profile (name, email…) don't count. Resets on the 1st of each month.</p>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Sign-in</h2></div>
          <div className="card-body stack">
            <div><div className="subtle">Email</div><div>{user.email}</div></div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 1 }}>New password<input className="input" type="password" minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
              <button className="btn" disabled={pw.length < 8} onClick={changePassword}>Update</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Accessibility</h2></div>
          <div className="card-body row between wrap">
            <span className="muted">Text size</span>
            <div className="seg">
              <button className={size === 'normal' ? 'on' : ''} onClick={() => setSize(applyTextSize('normal'))}>Default</button>
              <button className={size === 'large' ? 'on' : ''} onClick={() => setSize(applyTextSize('large'))}>Large</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Your data</h2></div>
          <div className="card-body stack">
            <p className="muted">FormPilot never stores passwords or payment details from forms, and only sends the parts of your profile relevant to the questions being answered.</p>
            <div><button className="btn btn-danger" onClick={deleteData}>Delete my profile & documents</button></div>
          </div>
        </div>
        {msg && <div className={`notice ${msg.ok ? 'notice-success' : 'notice-error'}`}>{msg.text}</div>}
      </div>
    </>
  );
}
