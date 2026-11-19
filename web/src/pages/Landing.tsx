import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout';
import { useAuth } from '../lib/auth';
import { PLANS } from '../../../src/shared/plans';
import { BRAND } from '../lib/brand';
import '../landing.css';

const FEATURES = [
  { t: 'Understands the question', d: '“Why this role?” and “Describe a challenging project” get real answers, not a pasted bio.' },
  { t: 'Grounded in your facts', d: 'Every answer comes from your profile and CV. FormPilot never invents experience, dates or numbers.' },
  { t: 'Flags what it doesn’t know', d: 'Missing salary expectation? It says so instead of guessing, and can save your answer for next time.' },
  { t: 'You approve everything', d: 'Review, edit, regenerate or skip each answer. Nothing is filled until you say so.' },
  { t: 'Works where you apply', d: 'Ordinary websites: text fields, dropdowns, checkboxes and radio buttons, including React and Vue forms.' },
  { t: 'Never presses submit', d: 'FormPilot fills the form and stops. You check the page and submit it yourself.' },
];

const USES = [
  { t: 'Job applications', d: 'Career portals that ask the same ten questions in slightly different words.' },
  { t: 'Scholarships & fellowships', d: 'Long-form motivation questions, drafted from what you’ve actually done.' },
  { t: 'Grants & accelerators', d: 'Founder and company questions answered consistently, every time.' },
  { t: 'Onboarding & sign-ups', d: 'Vendor forms, client intake, event registrations — the tedious ones.' },
];

const FAQ = [
  { q: 'Is this just autofill?', a: 'No. Browser autofill matches field names to saved values. FormPilot reads each question, works out what it’s asking, and writes an answer from your profile, including open-ended questions autofill can’t touch.' },
  { q: 'Will it make things up?', a: 'It’s built not to. Answers must be supported by your profile; anything it can’t support is marked “Needs info” for you to answer. Consent boxes and demographic questions are always left to you.' },
  { q: 'What data is sent to the AI?', a: 'Only the parts of your profile relevant to the questions on the page. Contact details like your email and phone are filled directly and are never sent to the AI. Password and payment fields are ignored completely.' },
  { q: 'Which websites does it work on?', a: 'Most sites built with standard form fields. Some heavily customised widgets (for example certain Workday dropdowns or Google Forms’ styled menus) and forms embedded from another site aren’t supported yet.' },
  { q: 'Does FormPilot keep the forms I fill?', a: 'No. Page content is used to draft answers and then discarded. We store your profile, your uploaded documents and a monthly usage count — and you can delete them at any time.' },
  { q: 'Can I cancel Pro?', a: 'Yes, anytime from your account page. You keep Pro until the end of the period you’ve paid for.' },
];

export function Landing() {
  const { user } = useAuth();
  const [yearly, setYearly] = useState(true);
  const start = user ? '/app' : '/signup';
  const pro = PLANS.pro;
  const proPrice = yearly ? (pro.yearlyUsd / 12) : pro.monthlyUsd;

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" className="logo-link"><Logo /></Link>
          <nav className="lp-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="row">
            {user ? <Link className="btn btn-primary btn-sm" to="/app">Open dashboard</Link> : (
              <>
                <Link className="btn btn-ghost btn-sm" to="/login">Sign in</Link>
                <Link className="btn btn-primary btn-sm" to="/signup">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">AI form filler for Chrome</span>
            <h1>Your information.<br />Every form. <span className="lp-accent">Handled.</span></h1>
            <p className="lp-lede">FormPilot reads the form you’re on, drafts answers from your own profile and CV, and fills them in once you approve. It understands the question — it doesn’t just paste your email.</p>
            <div className="row wrap" style={{ gap: 10 }}>
              <Link className="btn btn-primary lp-btn-lg" to={start}>Get started free</Link>
              <a className="btn lp-btn-lg" href="#how">See how it works</a>
            </div>
            <p className="subtle">Free plan · No card required · You always press submit</p>
          </div>
          <HeroMock />
        </div>
      </section>

      <section className="lp-section lp-compare">
        <div className="lp-wrap lp-narrow">
          <h2 className="lp-h2">Autofill knows your email.<br />FormPilot knows your story.</h2>
          <div className="lp-table card">
            <div className="lp-tr lp-th"><span /><span>Browser autofill</span><span>FormPilot</span></div>
            {[
              ['Name, email, phone, links', true, true],
              ['“Tell us about yourself”', false, true],
              ['Dropdowns matched to your answer', false, true],
              ['Says when it doesn’t know', false, true],
              ['Shows you every answer first', false, true],
            ].map(([label, a, b]) => (
              <div className="lp-tr" key={String(label)}>
                <span>{label}</span>
                <span className={a ? 'yes' : 'no'}>{a ? '✓' : '—'}</span>
                <span className={b ? 'yes' : 'no'}>{b ? '✓' : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <h2 className="lp-h2 center">Set up once. Use everywhere.</h2>
          <div className="lp-steps">
            <div className="lp-step"><span className="lp-num">1</span><h3>Build your profile</h3><p>Add your details, or import your CV and choose what to keep. This becomes FormPilot’s only source of truth.</p></div>
            <div className="lp-step"><span className="lp-num">2</span><h3>Scan any form</h3><p>On any page, open FormPilot and click Scan. It finds every question and drafts answers in seconds.</p></div>
            <div className="lp-step"><span className="lp-num">3</span><h3>Review, then fill</h3><p>Edit, regenerate or skip answers, approve them, and fill. Then check the page and submit it yourself.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-tint" id="features">
        <div className="lp-wrap">
          <h2 className="lp-h2 center">Built to be trusted with your name on it</h2>
          <div className="lp-grid3">
            {FEATURES.map((f) => <div className="lp-feature" key={f.t}><h3>{f.t}</h3><p>{f.d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-wrap lp-split">
          <div>
            <h2 className="lp-h2">For every form that asks about you</h2>
            <p className="lp-lede">If you’ve ever rewritten the same paragraph for the fifth application this week, FormPilot is for you.</p>
          </div>
          <div className="lp-uses">
            {USES.map((u) => <div className="lp-use" key={u.t}><h3>{u.t}</h3><p>{u.d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="lp-section lp-tint">
        <div className="lp-wrap lp-split">
          <div>
            <h2 className="lp-h2">Private by design</h2>
            <p className="lp-lede">Your profile is yours. FormPilot is built to share as little as possible, even with the AI that writes your answers.</p>
          </div>
          <ul className="lp-checks">
            <li>Only the profile sections a question needs are sent to the AI</li>
            <li>Your email, phone and address are filled directly — never sent to the AI</li>
            <li>Password, payment and ID fields are ignored completely</li>
            <li>Text on web pages is treated as untrusted, so hidden instructions can’t hijack your answers</li>
            <li>Your data is isolated to your account, and you can delete it any time</li>
          </ul>
        </div>
      </section>

      <section className="lp-section" id="pricing">
        <div className="lp-wrap">
          <h2 className="lp-h2 center">Simple pricing</h2>
          <p className="lp-lede center">Fields filled straight from your profile are always free. You only count answers the AI writes.</p>
          <div className="lp-toggle">
            <div className="seg">
              <button className={!yearly ? 'on' : ''} onClick={() => setYearly(false)}>Monthly</button>
              <button className={yearly ? 'on' : ''} onClick={() => setYearly(true)}>Yearly <span className="lp-save">save {Math.round((1 - pro.yearlyUsd / (pro.monthlyUsd * 12)) * 100)}%</span></button>
            </div>
          </div>
          <div className="lp-plans">
            <div className="lp-plan card">
              <h3>{PLANS.free.name}</h3>
              <p className="subtle">{PLANS.free.tagline}</p>
              <div className="lp-price"><strong>$0</strong><span>forever</span></div>
              <Link className="btn btn-block" to={start}>Start free</Link>
              <ul className="lp-checks small">{PLANS.free.features.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
            <div className="lp-plan card lp-plan-pro">
              <div className="row between"><h3>{pro.name}</h3><span className="badge badge-medium plain">Most popular</span></div>
              <p className="subtle">{pro.tagline}</p>
              <div className="lp-price"><strong>${proPrice % 1 ? proPrice.toFixed(2) : proPrice}</strong><span>/ month{yearly ? `, billed $${pro.yearlyUsd} yearly` : ''}</span></div>
              <Link className="btn btn-primary btn-block" to={user ? `/app/account?plan=${yearly ? 'year' : 'month'}` : `/signup?next=${encodeURIComponent(`/app/account?plan=${yearly ? 'year' : 'month'}`)}`}>Get Pro</Link>
              <ul className="lp-checks small">{pro.features.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-tint" id="faq">
        <div className="lp-wrap lp-narrow">
          <h2 className="lp-h2 center">Questions</h2>
          <div className="lp-faq">
            {FAQ.map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-cta">
        <div className="lp-wrap lp-narrow center">
          <h2 className="lp-h2">Stop retyping yourself.</h2>
          <p className="lp-lede">Set up your profile in five minutes and let FormPilot draft your next form.</p>
          <Link className="btn btn-primary lp-btn-lg" to={start}>Get started free</Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap row between wrap">
          <span className="subtle">© {new Date().getFullYear()} {BRAND.legalName}</span>
          <div className="row" style={{ gap: 18 }}>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            {BRAND.supportEmail && <a href={`mailto:${BRAND.supportEmail}`}>Contact</a>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMock() {
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock-bar"><i /><i /><i /><span>careers.example.com/apply</span></div>
      <div className="lp-mock-body">
        <div className="lp-mock-form">
          <div className="lp-mock-title">Senior Product Manager</div>
          <label>Full name</label><div className="lp-mock-input filled">Ada Obi</div>
          <label>Email</label><div className="lp-mock-input filled">ada@example.com</div>
          <label>Why are you interested in this role?</label>
          <div className="lp-mock-input filled tall">I’ve spent six years in product operations at regulated fintechs, most recently launching four payment corridors…</div>
          <label>Salary expectations</label><div className="lp-mock-input" />
        </div>
        <div className="lp-mock-panel">
          <div className="lp-mock-stats"><div><b>12</b>Detected</div><div><b className="c-green">10</b>Ready</div><div><b className="c-red">2</b>Need info</div></div>
          <div className="lp-mock-card"><div className="row between"><span>Full name</span><span className="badge badge-high">High</span></div><p>Ada Obi</p></div>
          <div className="lp-mock-card"><div className="row between"><span>Why this role?</span><span className="badge badge-medium">Review</span></div><p>I’ve spent six years in product operations…</p></div>
          <div className="lp-mock-card"><div className="row between"><span>Salary expectations</span><span className="badge badge-missing">Needs info</span></div><p className="c-red">No salary expectation in your profile</p></div>
          <div className="lp-mock-btn">Fill form (10)</div>
        </div>
      </div>
    </div>
  );
}
