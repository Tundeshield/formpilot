import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PLANS } from '../../../src/shared/plans';
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
  const [usage, setUsage] = useState<Usage | null>(null);
  const [params, setParams] = useSearchParams();
  const wanted = params.get('plan') === 'month' ? 'month' : params.get('plan') === 'year' ? 'year' : null;
  const [billingBusy, setBillingBusy] = useState('');
  const [billingErr, setBillingErr] = useState('');
  const [usageErr, setUsageErr] = useState('');
  const [size, setSize] = useState(() => applyTextSize());
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { api<Usage>('/api/usage').then(setUsage).catch((e) => setUsageErr(e.message)); }, []);

  async function billing(action: 'checkout' | 'portal', interval?: 'month' | 'year') {
    setBillingBusy(action + (interval || '')); setBillingErr('');
    try { const { url } = await api<{ url: string }>(`/api/billing/${action}`, { interval }); window.location.href = url; }
    catch (e) { setBillingErr(e instanceof Error ? e.message : 'Billing is unavailable right now'); setBillingBusy(''); }
  }

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


  return (
    <>
      <PageHeader title="Account" />
      <div className="stack" style={{ gap: 20 }}>
        {params.get('upgraded') && (
          <div className="notice notice-success row between">
            <span>Welcome to Pro. Your new limits apply right away (allow up to a minute).</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setParams({})}>Dismiss</button>
          </div>
        )}
        <div className="card">
          <div className="card-head">
            <h2>Plan & usage</h2>
            {usage && <span className={`badge plain ${usage.plan === 'pro' ? 'badge-medium' : ''}`}>{PLANS[usage.plan].name} plan</span>}
          </div>
          <div className="card-body stack">
            {usageErr ? <div className="notice notice-error">{usageErr}</div> : !usage ? <span className="spinner" /> : (
              <>
                <Meter label="AI-written answers" used={usage.used} limit={usage.limit} />
                <Meter label="Document imports" used={usage.imports} limit={usage.importLimit} />
                <p className="subtle">Fields filled straight from your profile (name, email, links…) never count. Usage resets on the 1st of each month.</p>
                {usage.plan === 'pro' ? (
                  <div className="row between wrap">
                    <span className="muted">{usage.cancelAt ? `Pro ends on ${new Date(usage.cancelAt * 1000).toLocaleDateString()}.` : usage.renews ? `Renews on ${new Date(usage.renews * 1000).toLocaleDateString()}.` : 'Pro is active.'}</span>
                    <button className="btn" disabled={!!billingBusy} onClick={() => billing('portal')}>{billingBusy === 'portal' ? <span className="spinner" /> : 'Manage billing'}</button>
                  </div>
                ) : usage.billingEnabled ? (
                  <div className="upgrade">
                    <div>
                      <h3>Upgrade to Pro</h3>
                      <p className="subtle">{PLANS.pro.aiAnswers.toLocaleString()} AI answers and {PLANS.pro.imports} imports a month. Cancel anytime.</p>
                    </div>
                    <div className="row wrap">
                      <button className={`btn ${wanted === 'month' ? 'btn-primary' : ''}`} disabled={!!billingBusy} onClick={() => billing('checkout', 'month')}>{billingBusy === 'checkoutmonth' ? <span className="spinner" /> : `$${PLANS.pro.monthlyUsd} / month`}</button>
                      <button className={`btn ${wanted !== 'month' ? 'btn-primary' : ''}`} disabled={!!billingBusy} onClick={() => billing('checkout', 'year')}>{billingBusy === 'checkoutyear' ? <span className="spinner" /> : `$${PLANS.pro.yearlyUsd} / year`}</button>
                    </div>
                  </div>
                ) : <p className="subtle">Paid plans are coming soon.</p>}
                {billingErr && <div className="notice notice-error">{billingErr}</div>}
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

interface Usage {
  plan: 'free' | 'pro'; renews: number | null; cancelAt: number | null;
  used: number; limit: number; imports: number; importLimit: number; billingEnabled: boolean;
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row between"><span className="muted">{label}</span><span className="subtle"><strong style={{ color: 'var(--text)' }}>{used.toLocaleString()}</strong> of {limit.toLocaleString()}</span></div>
      <div className="progress"><div style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--red)' : undefined }} /></div>
    </div>
  );
}
