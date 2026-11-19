import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Logo } from '../components/Layout';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const signup = mode === 'signup';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (signup) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        sendEmailVerification(cred.user).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) { setError(friendly(e)); }
    setBusy(false);
  }

  async function reset() {
    if (!email) return setError('Enter your email first.');
    try { await sendPasswordResetEmail(auth, email); setInfo('Password reset email sent.'); } catch (e) { setError(friendly(e)); }
  }

  return (
    <div className="center-screen">
      <div className="auth-wrap stack" style={{ gap: 22 }}>
        <div>
          <Link to="/" className="logo-link"><Logo /></Link>
          <p className="auth-tag">Your information. Every form. Handled.</p>
        </div>
        <form className="card card-body stack" onSubmit={submit}>
          <h2>{signup ? 'Create your account' : 'Sign in'}</h2>
          <label className="field">Email
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">Password
            <input className="input" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {info && <div className="notice notice-success">{info}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <span className="spinner" /> : signup ? 'Create account' : 'Sign in'}</button>
          {!signup && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>Forgot password?</button>}
          {signup && <p className="subtle">By creating an account you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>}
        </form>
        <p className="subtle" style={{ textAlign: 'center' }}>
          {signup ? <>Already have an account? <Link to="/login">Sign in</Link></> : <>New to FormPilot? <Link to="/signup">Create an account</Link></>}
        </p>
      </div>
    </div>
  );
}

export function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Use at least 8 characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/requires-recent-login': 'Please sign out and in again, then retry.',
  };
  return map[code] || (e instanceof Error ? e.message.replace(/^Firebase: /, '') : 'Something went wrong');
}
