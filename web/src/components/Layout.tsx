import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth';

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 8h6M3 12h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><path d="m9.5 12 1.6 1.6L14 10.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      FormPilot
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="logo-link"><Logo /></NavLink>
          <nav className="nav">
            <NavLink to="/" end>Profile</NavLink>
            <NavLink to="/documents">Documents</NavLink>
            <NavLink to="/extension">Extension</NavLink>
            <NavLink to="/account">Account</NavLink>
          </nav>
          <div className="row">
            <span className="subtle hide-sm">{user?.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => signOut(auth)}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="stack" style={{ gap: 4 }}>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
