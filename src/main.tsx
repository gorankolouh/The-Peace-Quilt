import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './lib/auth';
import { configured, DEMO } from './lib/supabase';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import Welcome from './pages/Welcome';
import Feed from './pages/Feed';
import ConstellationPage from './pages/ConstellationPage';
import { SubjectPage, SubjectsIndex } from './pages/Subjects';
import Search from './pages/Search';
import Compare from './pages/Compare';
import ReviewDesk from './pages/ReviewDesk';
import Transparency from './pages/Transparency';
import StoryPage from './pages/StoryPage';
import PostPage from './pages/PostPage';
import Compose from './pages/Compose';
import Messages from './pages/Messages';
import Chat from './pages/Chat';
import ProfilePage from './pages/ProfilePage';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import { I18nProvider } from './lib/i18n';
import { Login, Signup, ResetPassword, Setup } from './pages/Auth';
import { Imprint, Privacy, Terms } from './pages/Legal';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="col"><Spinner /></div>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (me && !me.username && loc.pathname !== '/setup') return <Navigate to="/setup" replace />;
  return children;
}

function SetupGate({ children }: { children: JSX.Element }) {
  const { me } = useAuth();
  const loc = useLocation();
  if (me && !me.username && !['/setup', '/privacy', '/terms', '/imprint'].includes(loc.pathname)) return <Navigate to="/setup" replace />;
  return children;
}

function NotConfigured() {
  return (
    <div className="col" style={{ paddingTop: 60 }}>
      <h1>Verum Agora</h1>
      <p className="sub">The app is not connected to its database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment and redeploy.</p>
    </div>
  );
}

function App() {
  if (!configured) return <NotConfigured />;
  return (
    <SetupGate>
      <>
      {DEMO && <div className="demo-bar">Preview with sample data. Nothing you do here is saved.</div>}
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route path="/setup" element={<RequireAuth><Setup /></RequireAuth>} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/constellation" element={<ConstellationPage />} />
          <Route path="/peace-quilt" element={<ConstellationPage />} />
          <Route path="/subjects" element={<SubjectsIndex />} />
          <Route path="/s/:slug" element={<SubjectPage />} />
          <Route path="/search" element={<Search />} />
          <Route path="/compare/:tag" element={<Compare />} />
          <Route path="/transparency" element={<Transparency />} />
          <Route path="/review" element={<RequireAuth><ReviewDesk /></RequireAuth>} />
          <Route path="/post/:id/edit" element={<RequireAuth><Compose /></RequireAuth>} />
          <Route path="/story/:id" element={<StoryPage />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/new" element={<RequireAuth><Compose /></RequireAuth>} />
          <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
          <Route path="/messages/:id" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/imprint" element={<Imprint />} />
          <Route path="*" element={<div className="col"><h1>Page not found</h1><p className="sub">This page does not exist or is no longer available.</p></div>} />
        </Route>
      </Routes>
      </>
    </SetupGate>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {DEMO ? (
      <MemoryRouter initialEntries={['/' + window.location.hash.slice(1).replace('-', '/')]}>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </MemoryRouter>
    ) : (
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>,
);
