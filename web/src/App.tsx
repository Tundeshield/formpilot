import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { configured } from './lib/firebase';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { ProfilePage } from './pages/Profile';
import { DocumentsPage } from './pages/Documents';
import { AccountPage } from './pages/Account';
import { ExtensionPage } from './pages/Extension';
import { Landing } from './pages/Landing';
import { PrivacyPage, TermsPage } from './pages/Legal';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/login" element={<Guest><AuthPage mode="login" /></Guest>} />
      <Route path="/signup" element={<Guest><AuthPage mode="signup" /></Guest>} />
      <Route path="/app/*" element={<Protected><AppRoutes /></Protected>} />
      {/* Old paths from the first release */}
      <Route path="/documents" element={<Navigate to="/app/documents" replace />} />
      <Route path="/account" element={<Navigate to="/app/account" replace />} />
      <Route path="/extension" element={<Navigate to="/app/extension" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route index element={<ProfilePage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="extension" element={<ExtensionPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Layout>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (!configured) return <SetupNeeded />;
  if (loading) return <div className="center-screen"><span className="spinner" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function Guest({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (!configured) return <SetupNeeded />;
  if (loading) return <div className="center-screen"><span className="spinner" /></div>;
  if (user) {
    const next = new URLSearchParams(loc.search).get('next');
    return <Navigate to={next && next.startsWith('/app') ? next : '/app'} replace />;
  }
  return <>{children}</>;
}

function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="card card-body stack" style={{ maxWidth: 480 }}>
        <h2>FormPilot isn't configured yet</h2>
        <p className="muted">Set the <span className="mono">VITE_FIREBASE_*</span> environment variables and rebuild. See the README for the full setup.</p>
      </div>
    </div>
  );
}
