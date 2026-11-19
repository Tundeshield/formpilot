import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { DetectedField, FillValue, GenerateResponse, GeneratedAnswer, ScanResult } from '../../src/shared/types';
import { confidenceLevel } from '../../src/shared/types';
import { callApi, getAppUrl, setAppUrl, signIn, signOut as endSession, watchSession, type Session } from './lib/session';
import { AccessError, activeTabId, fill, requestHostAccess, reveal, scan } from './lib/tab';

type Value = string | string[] | boolean;
interface Item {
  field: DetectedField;
  answer?: GeneratedAnswer;
  value: Value | null; // what will be filled (edited or generated)
  approved: boolean;
  skipped: boolean;
  editing: boolean;
  saveToProfile: boolean;
  busy?: boolean;
  brief?: string; // the user's short description, kept so later tweaks build on it
  error?: string;
  filled?: 'ok' | string; // 'ok' or error message
}

type Phase =
  | { k: 'idle' }
  | { k: 'working'; msg: string }
  | { k: 'needs-access'; msg: string }
  | { k: 'error'; msg: string }
  | { k: 'review' };

const LEVEL_LABEL = { high: 'High', medium: 'Review', low: 'Low', missing: 'Needs info' } as const;

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [size, setSize] = useState<'normal' | 'large'>('normal');

  useEffect(() => {
    chrome.storage.local.get('textSize').then(({ textSize }) => setSize(textSize === 'large' ? 'large' : 'normal'));
    return watchSession(setSession);
  }, []);
  useEffect(() => { document.documentElement.dataset.text = size; chrome.storage.local.set({ textSize: size }); }, [size]);

  if (session === undefined) return <div className="center"><span className="spinner" /></div>;
  if (!session) return <SignIn />;
  return <Main session={session} size={size} setSize={setSize} />;
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="hdr">
      <span className="logo"><span className="logo-mark"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 8h6M3 12h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><path d="m9.5 12 1.6 1.6L14 10.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span>FormPilot</span>
      {right}
    </header>
  );
}

function SignIn() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState('');
  const [showServer, setShowServer] = useState(false);
  useEffect(() => { getAppUrl().then(setServer); }, []);

  // Inputs are uncontrolled and read on submit, so values Chrome autofills
  // (including a picked saved email) are always used.
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const data = new FormData(e.currentTarget);
    try {
      if (server && server !== (await getAppUrl())) await setAppUrl(server);
      await signIn(String(data.get('email') || '').trim(), String(data.get('password') || ''));
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed'); }
    setBusy(false);
  }

  return (
    <div className="page">
      <Header />
      <form className="pad stack" onSubmit={submit} method="post" action="#" autoComplete="on">
        <div><h2>Sign in</h2><p className="subtle">Use your FormPilot account. You'll stay signed in until you sign out.</p></div>
        <label className="field">Email<input className="input" type="email" name="email" id="fp-email" autoComplete="username email" required /></label>
        <label className="field">Password<input className="input" type="password" name="password" id="fp-password" autoComplete="current-password" required /></label>
        {error && <div className="notice notice-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <span className="spinner" /> : 'Sign in'}</button>
        <p className="subtle center-text">No account? <a href={`${server}/signup`} target="_blank" rel="noreferrer">Create one</a></p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowServer(!showServer)}>Server settings</button>
        {showServer && <label className="field">FormPilot URL<input className="input mono" value={server} onChange={(e) => setServer(e.target.value)} /></label>}
      </form>
    </div>
  );
}

function Main({ session, size, setSize }: { session: Session; size: 'normal' | 'large'; setSize: (s: 'normal' | 'large') => void }) {
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });
  const [page, setPage] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [tabId, setTabId] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [usage, setUsage] = useState<GenerateResponse['usage'] | null>(null);
  const [menu, setMenu] = useState(false);
  const [filledMsg, setFilledMsg] = useState('');
  const appUrl = useRef('');
  useEffect(() => { getAppUrl().then((u) => (appUrl.current = u)); }, []);

  // Mark results stale when the scanned tab navigates or the user switches tabs.
  useEffect(() => {
    const onUpd = (id: number, info: chrome.tabs.TabChangeInfo) => { if (id === tabId && info.status === 'loading') setStale(true); };
    const onAct = (info: chrome.tabs.TabActiveInfo) => { if (tabId !== null) setStale(info.tabId !== tabId); };
    chrome.tabs.onUpdated.addListener(onUpd); chrome.tabs.onActivated.addListener(onAct);
    return () => { chrome.tabs.onUpdated.removeListener(onUpd); chrome.tabs.onActivated.removeListener(onAct); };
  }, [tabId]);

  const update = (id: string, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.field.id === id ? { ...x, ...patch } : x)));

  async function start() {
    setFilledMsg(''); setStale(false);
    try {
      setPhase({ k: 'working', msg: 'Scanning page…' });
      const id = await activeTabId(); setTabId(id);
      const result = await scan(id);
      setPage(result);
      if (!result.fields.length) { setItems([]); setPhase({ k: 'review' }); return; }
      const base: Item[] = result.fields.map((f) => ({
        field: f, value: null, approved: false, editing: false, saveToProfile: true,
        skipped: hasValue(f.currentValue), // never overwrite what's already on the page unless asked
      }));
      setItems(base);
      setPhase({ k: 'working', msg: `Found ${result.fields.length} fields. Drafting answers…` });
      const toAsk = result.fields.filter((f) => !hasValue(f.currentValue));
      if (toAsk.length) {
        const res = await callApi<GenerateResponse>('/api/generate', { page: pageInfo(result), fields: toAsk });
        setUsage(res.usage);
        const byId = new Map(res.answers.map((a) => [a.id, a]));
        setItems(base.map((x) => { const a = byId.get(x.field.id); return a ? { ...x, answer: a, value: a.value } : x; }));
      }
      setPhase({ k: 'review' });
    } catch (e) {
      if (e instanceof AccessError) setPhase(e.canRequest ? { k: 'needs-access', msg: e.message } : { k: 'error', msg: e.message });
      else setPhase({ k: 'error', msg: e instanceof Error ? e.message : 'Something went wrong' });
    }
  }

  async function grantAndScan() {
    const ok = await requestHostAccess();
    if (ok) start(); else setPhase({ k: 'error', msg: 'Permission not granted. FormPilot only reads a page when you click Scan.' });
  }

  /** Rewrite one field: from a brief, with a tweak instruction, or just a fresh version. */
  async function regenerate(it: Item, opts: { instruction?: string; brief?: string } = {}) {
    if (!page) return;
    const brief = opts.brief ?? it.brief;
    update(it.field.id, { busy: true, error: undefined, brief });
    try {
      const previous = it.answer?.status === 'answered' && typeof it.value === 'string' ? it.value : undefined;
      const res = await callApi<GenerateResponse>('/api/generate', {
        page: pageInfo(page), fields: [it.field],
        regenerate: { previous, instruction: opts.instruction, brief },
      });
      setUsage(res.usage);
      const a = res.answers[0];
      update(it.field.id, { busy: false, answer: a, value: a?.value ?? null, approved: false, editing: false });
    } catch (e) {
      update(it.field.id, { busy: false, error: e instanceof Error ? e.message : 'Could not write this answer' });
    }
  }

  const ready = (x: Item) => !x.skipped && hasValue(x.value);
  const approveAll = () => setItems((xs) => xs.map((x) => (ready(x) ? { ...x, approved: true, editing: false } : x)));
  const toFill = items.filter((x) => x.approved && ready(x));

  async function doFill() {
    if (tabId === null || !toFill.length) return;
    setPhase({ k: 'working', msg: 'Filling form…' });
    try {
      const values: FillValue[] = toFill.map((x) => ({ id: x.field.id, kind: x.field.kind, value: x.value as Value }));
      const results = await fill(tabId, values);
      const byId = new Map(results.map((r) => [r.id, r]));
      setItems((xs) => xs.map((x) => { const r = byId.get(x.field.id); return r ? { ...x, filled: r.ok ? 'ok' : r.error || 'Failed' } : x; }));
      // Save answers the user supplied for "needs info" questions, if they opted in.
      const learn = toFill.filter((x) => x.answer?.status === 'needs_info' && x.saveToProfile && typeof x.value === 'string' && x.field.kind !== 'checkbox');
      await Promise.all(learn.map((x) => callApi('/api/facts', { label: x.field.label, value: x.value }).catch(() => null)));
      const ok = results.filter((r) => r.ok).length;
      setFilledMsg(`Filled ${ok} of ${results.length} field${results.length === 1 ? '' : 's'}${learn.length ? ` · saved ${learn.length} new answer${learn.length === 1 ? '' : 's'} to your profile` : ''}. Check the page, then submit it yourself.`);
      setPhase({ k: 'review' });
    } catch (e) {
      setPhase({ k: 'error', msg: e instanceof Error ? e.message : 'Could not fill the form' });
    }
  }

  const stats = useMemo(() => ({
    detected: items.length,
    answerable: items.filter((x) => x.answer?.status === 'answered').length,
    missing: items.filter((x) => x.answer?.status === 'needs_info').length,
  }), [items]);

  async function signOut() { await endSession(); }

  return (
    <div className="page">
      <Header right={
        <div className="menu-wrap">
          <button className="btn btn-ghost btn-icon" aria-label="Menu" onClick={() => setMenu(!menu)}>⋯</button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <div className="menu-label">{session.email}</div>
              <a className="menu-item" href={`${appUrl.current}/app`} target="_blank" rel="noreferrer">Edit profile ↗</a>
              <a className="menu-item" href={`${appUrl.current}/app/account`} target="_blank" rel="noreferrer">Plan & billing ↗</a>
              <button className="menu-item" onClick={() => setSize(size === 'large' ? 'normal' : 'large')}>Text size: {size === 'large' ? 'Large' : 'Default'}</button>
              {usage && <div className="menu-label">{usage.used} / {usage.limit} AI answers this month</div>}
              <button className="menu-item" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      } />

      {phase.k === 'idle' && (
        <div className="pad stack empty">
          <div className="hero-icon">⌁</div>
          <h2>Fill this page's form</h2>
          <p className="subtle">FormPilot reads the form on the current tab, drafts answers from your profile, and lets you review everything before anything is filled.</p>
          <button className="btn btn-primary btn-block" onClick={start}>Scan page</button>
          <p className="subtle">FormPilot never submits forms and ignores password and payment fields.</p>
        </div>
      )}

      {phase.k === 'working' && <div className="pad center-col"><span className="spinner" /><span className="subtle">{phase.msg}</span></div>}

      {phase.k === 'needs-access' && (
        <div className="pad stack">
          <div className="notice notice-info">{phase.msg} It only reads a page when you click Scan, and never submits anything.</div>
          <button className="btn btn-primary btn-block" onClick={grantAndScan}>Allow & scan</button>
        </div>
      )}

      {phase.k === 'error' && (
        <div className="pad stack">
          <div className="notice notice-error">{phase.msg}</div>
          {/upgrade/i.test(phase.msg)
            ? <a className="btn btn-primary btn-block" href={`${appUrl.current}/app/account`} target="_blank" rel="noreferrer">Upgrade to Pro</a>
            : <button className="btn btn-block" onClick={start}>Try again</button>}
        </div>
      )}

      {phase.k === 'review' && page && (
        <>
          <div className="pad-x page-meta">
            <div className="truncate" title={page.url}><strong>{page.title || page.host}</strong></div>
            <button className="btn btn-ghost btn-sm" onClick={start}>Rescan</button>
          </div>
          {stale && <div className="pad-x"><div className="notice notice-info">The page changed. Rescan before filling.</div></div>}

          {items.length === 0 ? (
            <div className="pad"><div className="notice">No fillable form fields found on this page. Forms inside embedded frames or custom widgets aren't supported yet.</div></div>
          ) : (
            <>
              <div className="stats">
                <div><strong>{stats.detected}</strong><span>Detected</span></div>
                <div><strong className="c-green">{stats.answerable}</strong><span>Answerable</span></div>
                <div><strong className="c-red">{stats.missing}</strong><span>Need info</span></div>
              </div>
              {page.skipped.length > 0 && (
                <div className="pad-x"><p className="subtle skipnote">Ignored for your safety: {page.skipped.map((s) => s.label).slice(0, 4).join(', ')}{page.skipped.length > 4 ? '…' : ''}</p></div>
              )}
              <div className="list">
                {items.map((it) => (
                  <FieldCard key={it.field.id} it={it}
                    onChange={(p) => update(it.field.id, p)}
                    onReveal={() => tabId !== null && reveal(tabId, it.field.id)}
                    onRegenerate={(opts) => regenerate(it, opts)} />
                ))}
              </div>
            </>
          )}

          {items.length > 0 && (
            <footer className="footer">
              {filledMsg && <div className="notice notice-success footer-msg">{filledMsg}</div>}
              <div className="row">
                <button className="btn" onClick={approveAll} disabled={!items.some((x) => ready(x) && !x.approved)}>Approve all</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={doFill} disabled={!toFill.length || stale}>
                  Fill form{toFill.length ? ` (${toFill.length})` : ''}
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

const TWEAKS = ['Shorter', 'More detail', 'More formal', 'Friendlier', 'Bullet points'];

function FieldCard({ it, onChange, onReveal, onRegenerate }: {
  it: Item; onChange: (p: Partial<Item>) => void; onReveal: () => void;
  onRegenerate: (opts?: { instruction?: string; brief?: string }) => void;
}) {
  const { field: f, answer: a } = it;
  const [tweakOpen, setTweakOpen] = useState(false);
  const [tweak, setTweak] = useState('');
  const [brief, setBrief] = useState(it.brief || '');
  const [typeOwn, setTypeOwn] = useState(false);
  const level = a ? confidenceLevel(a) : null;
  const missing = a?.status === 'needs_info';
  const textual = f.kind === 'text' || f.kind === 'textarea';
  const decision = a?.method === 'profile' && missing && !textual; // consent / self-ID: the user's call
  const prefilled = hasValue(f.currentValue) && !a;
  const set = (value: Value | null) => onChange({ value, approved: hasValue(value) ? it.approved : false });
  const writable = textual && !['date', 'number', 'email', 'tel', 'url', 'time', 'month'].includes(f.inputType || '');
  const showBrief = writable && missing && !hasValue(it.value) && !typeOwn;
  const canAi = !decision && (textual || f.kind === 'select' || f.kind === 'radio' || f.kind === 'checkbox-group');

  return (
    <div className={`fcard ${it.skipped ? 'is-skipped' : ''} ${it.approved && !it.skipped ? 'is-approved' : ''}`}>
      <div className="fcard-head">
        <button className="flabel" onClick={onReveal} title="Show on page">{f.label || f.name || 'Untitled field'}{f.required && <span className="req">*</span>}</button>
        {it.filled === 'ok' ? <span className="badge badge-high">Filled</span>
          : it.skipped ? <span className="badge plain">{prefilled ? 'Already filled' : 'Skipped'}</span>
          : level && <span className={`badge badge-${level}`}>{LEVEL_LABEL[level]}</span>}
      </div>

      {!it.skipped && (
        <>
          {missing && <p className="reason">{a?.reason}{showBrief ? ' — describe it briefly and FormPilot will write it up.' : ''}</p>}
          {!missing && a?.reason && level !== 'high' && <p className="subtle small">{a.reason}</p>}

          {it.busy ? <div className="row subtle small"><span className="spinner" /> Writing…</div> : showBrief ? (
            <div className="brief">
              <textarea className="input" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
                placeholder={briefPlaceholder(f)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && brief.trim()) onRegenerate({ brief: brief.trim() }); }} />
              <div className="row between">
                <button className="btn btn-ghost btn-sm" onClick={() => setTypeOwn(true)}>Type the exact answer instead</button>
                <button className="btn btn-primary btn-sm" disabled={!brief.trim()} onClick={() => onRegenerate({ brief: brief.trim() })}>Write it</button>
              </div>
            </div>
          ) : (it.editing || missing || !textual) ? (
            <Editor field={f} value={it.value} onChange={set} autoFocus={it.editing || typeOwn} />
          ) : (
            <p className={`answer ${f.kind === 'textarea' ? 'long' : ''}`} onClick={() => onChange({ editing: true })}>{String(it.value ?? '')}</p>
          )}

          {writable && hasValue(it.value) && !it.busy && (f.kind === 'textarea' || f.maxLength || String(it.value).length > 60) && <Counter text={String(it.value)} max={f.maxLength} />}
          {it.brief && !missing && !it.busy && <p className="subtle small">Written from your note: “{it.brief.length > 80 ? it.brief.slice(0, 80) + '…' : it.brief}”</p>}

          {missing && textual && hasValue(it.value) && f.label && (
            <label className="row subtle small"><input type="checkbox" checked={it.saveToProfile} onChange={(e) => onChange({ saveToProfile: e.target.checked })} /> Save this answer to my profile</label>
          )}
          {it.error && <p className="reason">{it.error}</p>}
          {typeof it.filled === 'string' && it.filled !== 'ok' && <p className="reason">{it.filled}</p>}

          {tweakOpen && (
            <div className="tweak">
              <div className="row wrap" style={{ gap: 6 }}>
                {(writable ? TWEAKS : ['Different option']).map((t) => (
                  <button key={t} className="btn btn-sm" onClick={() => { setTweakOpen(false); onRegenerate({ instruction: t }); }}>{t}</button>
                ))}
              </div>
              <textarea className="input" rows={2} value={tweak} onChange={(e) => setTweak(e.target.value)}
                placeholder={writable ? 'Or say what to change — e.g. “mention the budget is $2,000” or “keep it under 300 characters”' : 'Or say what to consider'} />
              <div className="row between">
                <button className="btn btn-ghost btn-sm" onClick={() => { setTweakOpen(false); onRegenerate(); }}>Just retry</button>
                <button className="btn btn-primary btn-sm" disabled={!tweak.trim()} onClick={() => { setTweakOpen(false); onRegenerate({ instruction: tweak.trim() }); setTweak(''); }}>Rewrite</button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="fcard-actions">
        {!it.skipped && (
          <button className={`btn btn-sm ${it.approved ? 'btn-approved' : ''}`} disabled={!hasValue(it.value)} onClick={() => onChange({ approved: !it.approved, editing: false })}>
            {it.approved ? '✓ Approved' : 'Approve'}
          </button>
        )}
        {!it.skipped && textual && hasValue(it.value) && !missing && <button className="btn btn-ghost btn-sm" onClick={() => onChange({ editing: !it.editing })}>{it.editing ? 'Done' : 'Edit'}</button>}
        {!it.skipped && a && canAi && !showBrief && <button className="btn btn-ghost btn-sm" disabled={it.busy} onClick={() => setTweakOpen(!tweakOpen)}>{hasValue(it.value) ? 'Tweak' : 'Write with AI'}</button>}
        <button className="btn btn-ghost btn-sm push" onClick={() => onChange({ skipped: !it.skipped, approved: false })}>{it.skipped ? 'Include' : 'Skip'}</button>
      </div>
    </div>
  );
}

function briefPlaceholder(f: DetectedField): string {
  const l = (f.label || '').toLowerCase();
  if (/expense|cost|budget|purchase|spend/.test(l)) return 'Briefly describe it — e.g. “upgrade our booth for the December rush, about $2,000” — and FormPilot will write it up properly.';
  if (/reason|why|justif|purpose/.test(l)) return 'Jot down the reason in your own words — FormPilot will turn it into a clear, well-written answer.';
  if (f.kind === 'textarea') return 'Describe it in a few words — what it is, why, any key numbers — and FormPilot will write a polished answer.';
  return 'A few words about what to put here — FormPilot will write it properly.';
}

function Counter({ text, max }: { text: string; max?: number }) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const over = max !== undefined && chars > max;
  return (
    <p className={`counter ${over ? 'over' : ''}`}>
      {max ? `${chars.toLocaleString()} / ${max.toLocaleString()} characters` : `${chars.toLocaleString()} character${chars === 1 ? '' : 's'}`} · {words} word{words === 1 ? '' : 's'}
      {over && ' — too long for this field'}
    </p>
  );
}

function Editor({ field: f, value, onChange, autoFocus }: { field: DetectedField; value: Value | null; onChange: (v: Value | null) => void; autoFocus?: boolean }) {
  const opts = (f.options || []).filter((o) => !/^(\s*|-+|select.*|choose.*|please select.*)$/i.test(o));
  if (f.kind === 'select' || f.kind === 'radio') {
    return (
      <select className="input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— Choose —</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.kind === 'checkbox') {
    return <label className="row small"><input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> Tick this box</label>;
  }
  if (f.kind === 'checkbox-group') {
    const cur = Array.isArray(value) ? value : [];
    return (
      <div className="stack-sm">
        {opts.map((o) => (
          <label key={o} className="row small"><input type="checkbox" checked={cur.includes(o)} onChange={(e) => {
            const next = e.target.checked ? [...cur, o] : cur.filter((x) => x !== o);
            onChange(next.length ? next : null);
          }} /> {o}</label>
        ))}
      </div>
    );
  }
  const long = f.kind === 'textarea';
  const v = typeof value === 'string' ? value : '';
  return long
    ? <textarea className="input" rows={6} autoFocus={autoFocus} value={v} maxLength={f.maxLength} placeholder="Type your answer…" onChange={(e) => onChange(e.target.value || null)} />
    : <input className="input" autoFocus={autoFocus} value={v} maxLength={f.maxLength} type={f.inputType === 'date' ? 'date' : 'text'} placeholder="Type your answer…" onChange={(e) => onChange(e.target.value || null)} />;
}

function hasValue(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

function pageInfo(p: ScanResult) {
  return { url: p.url, title: p.title, host: p.host, pageContext: p.pageContext };
}
