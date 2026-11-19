import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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
    if (signup) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) setError(error.message);
      else if (!data.session) setInfo('Check your inbox to confirm your email, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setBusy(false);
  }

  async function reset() {
    if (!email) return setError('Enter your email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/account' });
    if (error) setError(error.message); else setInfo('Password reset email sent.');
  }

  return (
    <div className="center-screen">
      <div className="auth-wrap stack" style={{ gap: 22 }}>
        <div>
          <Logo />
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
        </form>
        <p className="subtle" style={{ textAlign: 'center' }}>
          {signup ? <>Already have an account? <Link to="/">Sign in</Link></> : <>New to FormPilot? <Link to="/signup">Create an account</Link></>}
        </p>
      </div>
    </div>
  );
}
