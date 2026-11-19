import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { configured } from './lib/supabase';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { ProfilePage } from './pages/Profile';
import { DocumentsPage } from './pages/Documents';
import { AccountPage } from './pages/Account';
import { ExtensionPage } from './pages/Extension';

export function App() {
  const { session, loading } = useAuth();
  if (!configured) return <SetupNeeded />;
  if (loading) return <div className="center-screen"><span className="spinner" /></div>;
  if (!session) {
    return (
      <Routes>
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProfilePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/extension" element={<ExtensionPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="card card-body stack" style={{ maxWidth: 480 }}>
        <h2>FormPilot isn't configured yet</h2>
        <p className="muted">Set <span className="mono">VITE_SUPABASE_URL</span> and <span className="mono">VITE_SUPABASE_ANON_KEY</span> and rebuild. See the README for the full setup.</p>
      </div>
    </div>
  );
}
